import os
import uuid
from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Literal

import asyncpg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title=os.getenv("APP_NAME", "tomawari-backend"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # ReactのURL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# DB
# ----------------------------
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


# ----------------------------
# Detour API
# ----------------------------
JST = timezone(timedelta(hours=9))


class LatLng(BaseModel):
    lat: float
    lng: float


class RouteRequest(BaseModel):
    origin: LatLng
    destination: LatLng
    genre: Literal["sightseeing"] = "sightseeing"
    start_time_iso: str | None = None  # 省略時はサーバ時刻(JST)を使う
    # カロリーの前提は一旦固定にする（必要なら後で入力化）
    weight_kg: float = Field(default=60.0, ge=30.0, le=150.0)


class Polyline(BaseModel):
    format: Literal["latlng_array"] = "latlng_array"
    points: list[LatLng]


class ViaSpot(BaseModel):
    lat: float
    lng: float
    name: str
    type: str
    description: str


class Summary(BaseModel):
    distance_m: int
    duration_s: int
    eta_iso: str
    calories_kcal: int


class RouteResponse(BaseModel):
    status: Literal["ok"]
    route_id: str
    genre: Literal["sightseeing"]
    origin: LatLng
    destination: LatLng
    route: dict  # {"polyline": Polyline}
    summary: Summary
    via_spots: list[ViaSpot]


def _haversine_m(a: LatLng, b: LatLng) -> float:
    # 地球半径
    r = 6371000.0
    lat1, lon1 = radians(a.lat), radians(a.lng)
    lat2, lon2 = radians(b.lat), radians(b.lng)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(h))


def _estimate_duration_s(distance_m: float, speed_kmh: float = 4.8) -> int:
    # 徒歩速度の雑推定（MVP）
    m_per_s = (speed_kmh * 1000) / 3600
    return int(round(distance_m / m_per_s))


def _estimate_calories_kcal(distance_m: float, weight_kg: float) -> int:
    # 雑推定：歩行 0.9 kcal / kg / km を採用（MVP）
    km = distance_m / 1000.0
    kcal = 0.9 * weight_kg * km
    return int(round(kcal))


KYOTO_SIGHTS = [
    ViaSpot(
        lat=35.0037, lng=135.7788,
        name="八坂神社",
        type="shrine",
        description="祇園のシンボル。参道と街歩きが楽しいです。"
    ),
    ViaSpot(
        lat=35.0043, lng=135.7646,
        name="錦市場",
        type="market",
        description="京の台所。食べ歩きが楽しい通りです。"
    ),
    ViaSpot(
        lat=35.0116, lng=135.7709,
        name="鴨川",
        type="river",
        description="川沿いの道が気持ちいい散歩スポットです。"
    ),
    ViaSpot(
        lat=35.0104, lng=135.7539,
        name="二条城",
        type="castle",
        description="歴史を感じる城郭。周辺の落ち着いた道も魅力です。"
    ),
]


def _dist_point_to_segment_rough(p: LatLng, a: LatLng, b: LatLng) -> float:
    # 厳密でなくてOK（MVP）：端点までの距離の小さい方を近似として使う
    return min(_haversine_m(p, a), _haversine_m(p, b))


def _pick_via_spots(req: RouteRequest, max_spots: int = 2) -> list[ViaSpot]:
    # 「出発-目的の線に近い観光スポット」を上位max_spots個（MVP）
    a, b = req.origin, req.destination
    scored = []
    for s in KYOTO_SIGHTS:
        p = LatLng(lat=s.lat, lng=s.lng)
        d = _dist_point_to_segment_rough(p, a, b)
        scored.append((d, s))
    scored.sort(key=lambda x: x[0])
    return [s for _, s in scored[:max_spots]]


def _make_polyline_with_via(req: RouteRequest, vias: list[ViaSpot]) -> list[LatLng]:
    # polylineは「origin -> via1 -> via2 -> destination」の順で点を置く（MVP）
    points = [req.origin]
    for v in vias:
        points.append(LatLng(lat=v.lat, lng=v.lng))
    points.append(req.destination)
    return points


def _parse_start_time(start_time_iso: str | None) -> datetime:
    if not start_time_iso:
        return datetime.now(JST)
    # ISO文字列を受け取り（+09:00付き推奨）
    dt = datetime.fromisoformat(start_time_iso)
    if dt.tzinfo is None:
        # tzがなければJST扱い
        dt = dt.replace(tzinfo=JST)
    return dt.astimezone(JST)


@app.post("/v1/routes:detour", response_model=RouteResponse)
async def detour_route(req: RouteRequest) -> RouteResponse:
    vias = _pick_via_spots(req, max_spots=2)
    poly_points = _make_polyline_with_via(req, vias)

    # 距離は polyline の各区間を足す（MVP）
    dist = 0.0
    for i in range(len(poly_points) - 1):
        dist += _haversine_m(poly_points[i], poly_points[i + 1])

    duration_s = _estimate_duration_s(dist)
    start_dt = _parse_start_time(req.start_time_iso)
    eta_dt = start_dt + timedelta(seconds=duration_s)

    calories = _estimate_calories_kcal(dist, req.weight_kg)

    return RouteResponse(
        status="ok",
        route_id=f"route_{uuid.uuid4().hex[:12]}",
        genre="sightseeing",
        origin=req.origin,
        destination=req.destination,
        route={"polyline": Polyline(points=poly_points).model_dump()},
        summary=Summary(
            distance_m=int(round(dist)),
            duration_s=duration_s,
            eta_iso=eta_dt.isoformat(),
            calories_kcal=calories,
        ),
        via_spots=vias,
    )


'''
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
'''
