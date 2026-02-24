from __future__ import annotations

import math
import os

from app.app_logger import get_logger
from app.detour_models import GeoJSONLineString, LatLng, ViaSpot
from app.geo_utils import haversine_m
from app.poi_loader import load_kyoto_sights

logger = get_logger(__name__)
KYOTO_SIGHTS = load_kyoto_sights()


def _dist_point_to_segment_rough_m(p: LatLng, a: LatLng, b: LatLng) -> float:
    # 局所座標への近似変換で、線分への最短距離を高速に計算
    r = 6371000.0
    ref_lat = (a.lat + b.lat + p.lat) / 3.0
    ref_lat_rad = ref_lat * 3.141592653589793 / 180.0

    def _to_xy_m(ll: LatLng) -> tuple[float, float]:
        x = r * (ll.lng * 3.141592653589793 / 180.0) * math.cos(ref_lat_rad)
        y = r * (ll.lat * 3.141592653589793 / 180.0)
        return x, y

    ax, ay = _to_xy_m(a)
    bx, by = _to_xy_m(b)
    px, py = _to_xy_m(p)
    abx, aby = bx - ax, by - ay
    apx, apy = px - ax, py - ay
    ab2 = abx * abx + aby * aby
    if ab2 == 0.0:
        dx, dy = apx, apy
        return (dx * dx + dy * dy) ** 0.5
    t = (apx * abx + apy * aby) / ab2
    t = max(0.0, min(1.0, t))
    cx, cy = ax + t * abx, ay + t * aby
    dx, dy = px - cx, py - cy
    return (dx * dx + dy * dy) ** 0.5


def _point_to_polyline_distance_m(point: LatLng, polyline: list[LatLng]) -> float:
    if len(polyline) < 2:
        return float("inf")
    best = float("inf")
    for i in range(len(polyline) - 1):
        d = _dist_point_to_segment_rough_m(point, polyline[i], polyline[i + 1])
        if d < best:
            best = d
    return best


def select_along_route_spots(
    route_geojson: GeoJSONLineString,
    *,
    origin: LatLng,
    destination: LatLng,
    exclude_spots: list[ViaSpot],
    max_spots: int = 10,
) -> list[ViaSpot]:
    max_distance_m = float(os.getenv("ALONG_ROUTE_MAX_DISTANCE_M", "120"))
    min_gap_m = float(os.getenv("ALONG_ROUTE_MIN_SPOT_GAP_M", "180"))
    min_endpoint_gap_m = float(os.getenv("MIN_VIA_ENDPOINT_GAP_M", "150"))

    line = [LatLng(lat=lat, lng=lng) for lng, lat in route_geojson.coordinates]
    if len(line) < 2:
        return []

    excluded_keys = {(round(s.lat, 6), round(s.lng, 6), s.name) for s in exclude_spots}
    scored: list[tuple[float, ViaSpot]] = []
    for spot in KYOTO_SIGHTS:
        key = (round(spot.lat, 6), round(spot.lng, 6), spot.name)
        if key in excluded_keys:
            continue
        p = LatLng(lat=spot.lat, lng=spot.lng)
        if haversine_m(p, origin) < min_endpoint_gap_m or haversine_m(p, destination) < min_endpoint_gap_m:
            continue
        d = _point_to_polyline_distance_m(p, line)
        if d <= max_distance_m:
            scored.append((d, spot))

    scored.sort(key=lambda x: x[0])
    selected: list[ViaSpot] = []
    for _, spot in scored:
        p = LatLng(lat=spot.lat, lng=spot.lng)
        if any(haversine_m(p, LatLng(lat=s.lat, lng=s.lng)) < min_gap_m for s in selected):
            continue
        selected.append(spot)
        if len(selected) >= max_spots:
            break

    logger.info(
        "along_route_spots selected: selected=%s scanned=%s max_distance_m=%.1f",
        len(selected),
        len(KYOTO_SIGHTS),
        max_distance_m,
    )
    return selected
