from __future__ import annotations

import asyncio
import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.app_logger import get_logger
from app.detour_models import LatLng, RouteRequest

logger = get_logger(__name__)


def geocode_sync(place_name: str) -> LatLng:
    logger.info("geocode start: query=%s", place_name)
    base_url = os.getenv("GEOCODING_URL", "https://nominatim.openstreetmap.org/search")
    countrycodes = os.getenv("GEOCODING_COUNTRYCODES", "jp").strip()
    params = {
        "q": place_name,
        "format": "jsonv2",
        "limit": 1,
    }
    if countrycodes:
        params["countrycodes"] = countrycodes
    url = f"{base_url}?{urlencode(params)}"

    user_agent = os.getenv(
        "GEOCODING_USER_AGENT",
        "tomawari-navi/1.0 (set GEOCODING_USER_AGENT with contact info)",
    )
    request = Request(
        url=url,
        headers={
            "User-Agent": user_agent,
            "Accept": "application/json",
        },
        method="GET",
    )

    try:
        with urlopen(request, timeout=15) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"geocoding HTTP {e.code}: {detail[:200]}") from e
    except URLError as e:
        raise RuntimeError(f"geocoding connection error: {e.reason}") from e

    try:
        payload = json.loads(raw)
        if not isinstance(payload, list) or not payload:
            raise RuntimeError(f"place not found: {place_name}")
        item = payload[0]
        result = LatLng(lat=float(item["lat"]), lng=float(item["lon"]))
        logger.info("geocode done: query=%s lat=%s lng=%s", place_name, result.lat, result.lng)
        return result
    except (KeyError, TypeError, ValueError) as e:
        raise RuntimeError("geocoding response format is invalid") from e


async def resolve_route_points(req: RouteRequest) -> tuple[LatLng, LatLng]:
    async def _resolve_one(coord: LatLng | None, text: str | None, label: str) -> LatLng:
        if coord is not None:
            return coord
        if text and text.strip():
            return await asyncio.to_thread(geocode_sync, text.strip())
        raise ValueError(
            f"{label} is required. Send either `{label}` coordinates or `{label}_text` place name."
        )

    origin_task = _resolve_one(req.origin, req.origin_text, "origin")
    destination_task = _resolve_one(req.destination, req.destination_text, "destination")
    origin, destination = await asyncio.gather(origin_task, destination_task)
    return origin, destination
