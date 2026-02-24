from __future__ import annotations

import json
import os
from typing import Literal
from urllib.request import Request
from urllib.parse import urlencode
from urllib.request import urlopen

ElevationPreference = Literal["low", "normal", "high"]


def lookup_open_elevation(coords: list[tuple[float, float]]) -> list[float | None]:
    if not coords:
        return []

    base_url = os.getenv("OPEN_ELEVATION_URL", "https://api.open-elevation.com/api/v1/lookup")
    locations = "|".join(f"{lat},{lng}" for lat, lng in coords)
    url = f"{base_url}?{urlencode({'locations': locations})}"

    try:
        with urlopen(url, timeout=3.0) as response:
            payload = json.loads(response.read().decode("utf-8"))
        results = payload.get("results", [])
        out: list[float | None] = []
        for i in range(len(coords)):
            if i < len(results):
                out.append(results[i].get("elevation"))
            else:
                out.append(None)
        return out
    except Exception:
        return [None] * len(coords)


def score_with_elevation(
    distances: list[float],
    elevations: list[float | None],
    preference: ElevationPreference,
) -> list[float]:
    if preference == "normal":
        return distances

    known_elevations = [e for e in elevations if e is not None]
    if not known_elevations:
        return distances

    min_dist = min(distances)
    max_dist = max(distances)
    min_ele = min(known_elevations)
    max_ele = max(known_elevations)

    def norm(v: float, lo: float, hi: float) -> float:
        if hi <= lo:
            return 0.0
        return (v - lo) / (hi - lo)

    scored: list[float] = []
    for i, dist in enumerate(distances):
        dist_n = norm(dist, min_dist, max_dist)
        ele = elevations[i]
        ele_n = 0.5 if ele is None else norm(ele, min_ele, max_ele)

        if preference == "low":
            score = dist_n + 0.35 * ele_n
        else:
            score = dist_n + 0.35 * (1.0 - ele_n)
        scored.append(score)

    return scored


def fetch_ors_route_points(
    waypoints: list[tuple[float, float]],
) -> list[tuple[float, float]] | None:
    if len(waypoints) < 2:
        return None

    api_key = os.getenv("OPENROUTESERVICE_API_KEY")
    if not api_key:
        return None

    base_url = os.getenv(
        "OPENROUTESERVICE_DIRECTIONS_URL",
        "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
    )

    # ORS coordinates are [lng, lat]
    coordinates = [[lng, lat] for lat, lng in waypoints]
    payload = json.dumps({"coordinates": coordinates}).encode("utf-8")
    request = Request(
        base_url,
        data=payload,
        headers={
            "Authorization": api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=8.0) as response:
            data = json.loads(response.read().decode("utf-8"))
        features = data.get("features", [])
        if not features:
            return None
        geometry = features[0].get("geometry", {})
        coords = geometry.get("coordinates", [])
        if not coords:
            return None
        # Convert back to [(lat, lng), ...]
        return [(c[1], c[0]) for c in coords if isinstance(c, list) and len(c) >= 2]
    except Exception:
        return None

