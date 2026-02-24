import asyncio
import os
import time
import uuid
from datetime import timedelta

import asyncpg
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.app_logger import get_logger
from app.detour_models import RouteGeometry, RouteRequest, RouteResponse, Summary
from app.geo_utils import estimate_calories_kcal, haversine_m, minimum_required_minutes, parse_start_time
from app.geocoding import resolve_route_points
from app.ors_client import request_ors_route_sync
from app.via_selector import pick_via_spots

app = FastAPI(title=os.getenv("APP_NAME", "tomawari-backend"))
logger = get_logger(__name__)

app.add_middleware(
    CORSMiddleware,
    # 開発環境で frontend が異なるホストやポートからアクセスする際の CORS エラーを防ぐため
    # 一旦すべてのオリジンを許可する設定に変更しました。
    # 本番では安全なオリジンに限定してください（例: ['https://example.com']）。
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.post("/v1/routes:detour", response_model=RouteResponse)
async def detour_route(req: RouteRequest) -> RouteResponse:
    started_at = time.perf_counter()
    logger.info(
        "detour_route start: genre=%s target_minutes=%s has_origin=%s has_destination=%s has_origin_text=%s has_destination_text=%s",
        req.genre,
        req.target_minutes,
        req.origin is not None,
        req.destination is not None,
        bool(req.origin_text),
        bool(req.destination_text),
    )
    try:
        origin, destination = await resolve_route_points(req)
    except ValueError as e:
        logger.warning("detour_route validation failed at resolve_route_points: %s", e)
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        logger.warning("detour_route geocoding failed: %s", e)
        raise HTTPException(status_code=502, detail=str(e)) from e

    resolved_req = req.model_copy(update={"origin": origin, "destination": destination})
    # 到達不可能な短時間を早期に弾く（直線距離ベースの理論下限）
    if req.target_minutes is not None:
        walk_speed_kmph = float(os.getenv("WALK_SPEED_KMPH", "4.0"))
        direct_distance_m = haversine_m(origin, destination)
        min_minutes = minimum_required_minutes(direct_distance_m, walk_speed_kmph)
        if req.target_minutes < min_minutes:
            detail = (
                f"target_minutes={req.target_minutes} is too short for this OD pair. "
                f"At least {min_minutes} minutes is required at {walk_speed_kmph:.1f} km/h "
                "(straight-line lower bound)."
            )
            logger.warning("detour_route invalid target_minutes: %s", detail)
            raise HTTPException(status_code=422, detail=detail)

    try:
        max_via_spots = int(os.getenv("MAX_VIA_SPOTS", "10"))
        vias = pick_via_spots(resolved_req, max_spots=max_via_spots)
    except RuntimeError as e:
        logger.warning("detour_route via selection failed: %s", e)
        raise HTTPException(status_code=422, detail=str(e)) from e
    logger.info("detour_route via selection done: via_count=%s", len(vias))

    route_geojson = None
    dist = 0.0
    duration_s = 0
    routed_vias = vias
    last_route_error: RuntimeError | None = None
    # ORS が「経路不可(404)」を返した場合に備えて、経由地を減らしながら再試行する。
    for keep in range(len(vias), -1, -1):
        candidate_vias = vias[:keep]
        try:
            route_geojson, dist, duration_s = await asyncio.to_thread(
                request_ors_route_sync, resolved_req, candidate_vias
            )
            routed_vias = candidate_vias
            if keep != len(vias):
                logger.info(
                    "detour_route ors recovered by reducing vias: original=%s used=%s",
                    len(vias),
                    keep,
                )
            break
        except RuntimeError as e:
            last_route_error = e
            msg = str(e)
            if "Route could not be found" in msg and keep > 0:
                logger.warning(
                    "detour_route ors route-not-found, retry with fewer vias: keep=%s error=%s",
                    keep - 1,
                    msg,
                )
                continue
            logger.warning("detour_route ors routing failed: %s", e)
            raise HTTPException(status_code=502, detail=str(e)) from e

    if route_geojson is None:
        detail = str(last_route_error) if last_route_error else "openrouteservice routing failed"
        raise HTTPException(status_code=502, detail=detail)

    start_dt = parse_start_time(req.start_time_iso)
    eta_dt = start_dt + timedelta(seconds=duration_s)
    calories = estimate_calories_kcal(dist, req.weight_kg)
    route_id = f"route_{uuid.uuid4().hex[:12]}"
    logger.info(
        "detour_route done: route_id=%s via_count=%s distance_m=%s duration_s=%s elapsed_ms=%.1f",
        route_id,
        len(vias),
        int(round(dist)),
        duration_s,
        (time.perf_counter() - started_at) * 1000.0,
    )

    return RouteResponse(
        status="ok",
        route_id=route_id,
        genre="sightseeing",
        origin=origin,
        destination=destination,
        route=RouteGeometry(geojson=route_geojson),
        summary=Summary(
            distance_m=int(round(dist)),
            duration_s=duration_s,
            eta_iso=eta_dt.isoformat(),
            calories_kcal=calories,
        ),
        via_spots=routed_vias,
    )
