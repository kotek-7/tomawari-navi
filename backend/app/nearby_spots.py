from __future__ import annotations

from app.detour_models import LatLng, NearbySpot, ViaSpot
from app.geo_utils import haversine_m
from app.poi_loader import load_kyoto_sights

KYOTO_SIGHTS = load_kyoto_sights()


def select_nearby_spots(
    current: LatLng,
    *,
    radius_m: float,
    limit: int,
) -> list[NearbySpot]:
    if radius_m <= 0:
        return []
    if limit <= 0:
        return []

    found: list[tuple[float, ViaSpot]] = []
    for spot in KYOTO_SIGHTS:
        d = haversine_m(current, LatLng(lat=spot.lat, lng=spot.lng))
        if d <= radius_m:
            found.append((d, spot))

    found.sort(key=lambda x: x[0])

    return [
        NearbySpot(
            lat=spot.lat,
            lng=spot.lng,
            name=spot.name,
            type=spot.type,
            description=spot.description,
            distance_m=int(round(distance_m)),
        )
        for distance_m, spot in found[:limit]
    ]
