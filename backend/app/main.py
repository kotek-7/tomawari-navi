import os

import asyncpg
from fastapi import FastAPI

app = FastAPI(title=os.getenv("APP_NAME", "tomawari-backend"))


def _db_dsn() -> str:
    host = os.getenv("DB_HOST", "db")
    port = int(os.getenv("DB_PORT", "5432"))
    user = os.getenv("POSTGRES_USER", "tomawari")
    password = os.getenv("POSTGRES_PASSWORD", "tomawari")
    database = os.getenv("POSTGRES_DB", "tomawari")
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "tomawari backend is running"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/db-health")
async def db_health() -> dict[str, str]:
    conn = await asyncpg.connect(_db_dsn())
    try:
        await conn.fetchval("SELECT 1")
        return {"status": "ok"}
    finally:
        await conn.close()
