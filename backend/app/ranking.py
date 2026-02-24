from __future__ import annotations

import os
import re

import asyncpg
from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()


def _db_dsn() -> str:
    host = os.getenv("DB_HOST", "db")
    port = int(os.getenv("DB_PORT", "5432"))
    user = os.getenv("POSTGRES_USER", "tomawari")
    password = os.getenv("POSTGRES_PASSWORD", "tomawari")
    database = os.getenv("POSTGRES_DB", "tomawari")
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


def _history_table() -> str:
    table_name = os.getenv("ROUTE_HISTORY_TABLE", "route_search_history")
    if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", table_name):
        raise ValueError(f"Invalid table name: {table_name}")
    return table_name


class RankingItem(BaseModel):
    spot_name: str
    count: int


class RankingResponse(BaseModel):
    area: str | None = None
    items: list[RankingItem]


@router.get("/ranking", response_model=RankingResponse)
async def get_ranking(
    area: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
) -> RankingResponse:
    table_name = _history_table()
    conn = await asyncpg.connect(_db_dsn())
    try:
        try:
            rows = await conn.fetch(
                f"""
                SELECT
                    COALESCE(
                        NULLIF(payload->'metadata'->>'spot_name', ''),
                        NULLIF(payload->'response_summary'->>'spot_name', ''),
                        NULLIF(payload->>'spot_name', '')
                    ) AS spot_name,
                    COUNT(*)::int AS count
                FROM {table_name}
                WHERE
                    (
                        $1::text IS NULL OR
                        COALESCE(
                            NULLIF(payload->'metadata'->>'area', ''),
                            NULLIF(payload->>'area', '')
                        ) = $1
                    )
                    AND COALESCE(
                        NULLIF(payload->'metadata'->>'spot_name', ''),
                        NULLIF(payload->'response_summary'->>'spot_name', ''),
                        NULLIF(payload->>'spot_name', '')
                    ) IS NOT NULL
                GROUP BY spot_name
                ORDER BY count DESC, spot_name ASC
                LIMIT $2
                """,
                area,
                limit,
            )
        except asyncpg.exceptions.UndefinedTableError:
            return RankingResponse(area=area, items=[])

        items = [RankingItem(spot_name=r["spot_name"], count=r["count"]) for r in rows]
        return RankingResponse(area=area, items=items)
    finally:
        await conn.close()
