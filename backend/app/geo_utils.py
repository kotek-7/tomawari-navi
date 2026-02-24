from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt

from app.detour_models import LatLng

JST = timezone(timedelta(hours=9))


def haversine_m(a: LatLng, b: LatLng) -> float:
    r = 6371000.0
    lat1, lon1 = radians(a.lat), radians(a.lng)
    lat2, lon2 = radians(b.lat), radians(b.lng)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(h))


def estimate_calories_kcal(distance_m: float, weight_kg: float) -> int:
    km = distance_m / 1000.0
    kcal = 0.9 * weight_kg * km
    return int(round(kcal))


def parse_start_time(start_time_iso: str | None) -> datetime:
    if not start_time_iso:
        return datetime.now(JST)
    dt = datetime.fromisoformat(start_time_iso)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=JST)
    return dt.astimezone(JST)
