from __future__ import annotations

import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.app_logger import get_logger
from app.detour_models import GeoJSONLineString, RouteRequest, ViaSpot

logger = get_logger(__name__)


def _build_ors_coordinates(req: RouteRequest, vias: list[ViaSpot]) -> list[list[float]]:
    if req.origin is None or req.destination is None:
        raise RuntimeError("origin/destination coordinates are not resolved")

    coordinates: list[list[float]] = [[req.origin.lng, req.origin.lat]]
    for v in vias:
        coordinates.append([v.lng, v.lat])
    coordinates.append([req.destination.lng, req.destination.lat])
    return coordinates


def request_ors_route_sync(req: RouteRequest, vias: list[ViaSpot]) -> tuple[GeoJSONLineString, float, int]:
    started_at = time.perf_counter()
    api_key = os.getenv("OPENROUTESERVICE_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTESERVICE_API_KEY is not set")

    url = os.getenv(
        "OPENROUTESERVICE_DIRECTIONS_URL",
        "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
    )
    payload = {
        "coordinates": _build_ors_coordinates(req, vias),
        "instructions": False,
        "elevation": False,
    }
    logger.info("ors request start: via_count=%s point_count=%s", len(vias), len(payload["coordinates"]))

    request = Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"openrouteservice HTTP {e.code}: {detail[:200]}") from e
    except URLError as e:
        raise RuntimeError(f"openrouteservice connection error: {e.reason}") from e

    try:
        data = json.loads(raw)
        feature = data["features"][0]
        geometry = feature["geometry"]
        summary = feature["properties"]["summary"]
        distance_m = float(summary["distance"])
        duration_s = int(round(float(summary["duration"])))
    except (KeyError, IndexError, TypeError, ValueError) as e:
        raise RuntimeError("openrouteservice response format is invalid") from e

    try:
        geojson = GeoJSONLineString.model_validate(geometry)
    except Exception as e:
        raise RuntimeError("openrouteservice geometry is invalid") from e

    logger.info(
        "ors request done: via_count=%s distance_m=%.1f duration_s=%s elapsed_ms=%.1f",
        len(vias),
        distance_m,
        duration_s,
        (time.perf_counter() - started_at) * 1000.0,
    )
    return geojson, distance_m, duration_s
