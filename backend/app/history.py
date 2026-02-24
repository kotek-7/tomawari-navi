from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, TypedDict

import asyncpg

DEFAULT_HISTORY_TABLE = os.getenv("ROUTE_HISTORY_TABLE", "route_search_history")


JSONDict = dict[str, Any]


class RouteHistoryPayload(TypedDict):
    origin: JSONDict
    destination: JSONDict
    request_payload: JSONDict
    response_summary: JSONDict
    metadata: JSONDict


class RouteHistoryEntry(TypedDict, total=False):
    id: str
    created_at: str
    search_type: str
    origin: JSONDict
    destination: JSONDict
    request_payload: JSONDict
    response_summary: JSONDict
    metadata: JSONDict


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _db_dsn() -> str:
    host = os.getenv("DB_HOST", "db")
    port = int(os.getenv("DB_PORT", "5432"))
    user = os.getenv("POSTGRES_USER", "tomawari")
    password = os.getenv("POSTGRES_PASSWORD", "tomawari")
    database = os.getenv("POSTGRES_DB", "tomawari")
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


def _validate_table_name(table_name: str) -> str:
    if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", table_name):
        raise ValueError(f"Invalid table name: {table_name}")
    return table_name


def create_route_history_entry(
    *,
    search_type: str,
    origin: JSONDict,
    destination: JSONDict,
    request_payload: JSONDict | None = None,
    response_summary: JSONDict | None = None,
    metadata: JSONDict | None = None,
) -> RouteHistoryEntry:
    """
    ルート検索履歴レコードを組み立てる。
    この関数は保存を行わないため、エンドポイント側で柔軟に加工しやすい。
    """
    return {
        "id": f"hist_{uuid.uuid4().hex[:12]}",
        "created_at": _now_iso(),
        "search_type": search_type,
        "origin": origin,
        "destination": destination,
        "request_payload": request_payload or {},
        "response_summary": response_summary or {},
        "metadata": metadata or {},
    }


async def ensure_route_history_table(
    conn: asyncpg.Connection,
    *,
    table_name: str = DEFAULT_HISTORY_TABLE,
) -> None:
    safe_table = _validate_table_name(table_name)
    await conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {safe_table} (
            id TEXT PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            search_type TEXT NOT NULL,
            payload JSONB NOT NULL
        )
        """
    )
    await conn.execute(
        f"""
        CREATE INDEX IF NOT EXISTS idx_{safe_table}_recorded_at
        ON {safe_table} (created_at DESC)
        """
    )


async def append_route_history(
    entry: RouteHistoryEntry,
    *,
    conn: asyncpg.Connection | None = None,
    table_name: str = DEFAULT_HISTORY_TABLE,
) -> str:
    safe_table = _validate_table_name(table_name)
    own_conn = conn is None
    db = conn or await asyncpg.connect(_db_dsn())
    try:
        await ensure_route_history_table(db, table_name=safe_table)

        history_id = str(entry.get("id") or f"hist_{uuid.uuid4().hex[:12]}")
        created_at = str(entry.get("created_at") or _now_iso())
        search_type = entry.get("search_type")
        if not search_type:
            raise ValueError("search_type is required")
        payload_obj: RouteHistoryPayload = {
            "origin": entry.get("origin") or {},
            "destination": entry.get("destination") or {},
            "request_payload": entry.get("request_payload") or {},
            "response_summary": entry.get("response_summary") or {},
            "metadata": entry.get("metadata") or {},
        }
        payload = json.dumps(payload_obj, ensure_ascii=False)

        await db.execute(
            f"""
            INSERT INTO {safe_table} (
                id,
                created_at,
                search_type,
                payload
            )
            VALUES (
                $1, $2::timestamptz, $3, $4::jsonb
            )
            """,
            history_id,
            created_at,
            search_type,
            payload,
        )
        return history_id
    finally:
        if own_conn:
            await db.close()


async def append_route_history_async(
    entry: RouteHistoryEntry,
    *,
    conn: asyncpg.Connection | None = None,
    table_name: str = DEFAULT_HISTORY_TABLE,
) -> str:
    return await append_route_history(
        entry,
        conn=conn,
        table_name=table_name,
    )
