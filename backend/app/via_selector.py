from __future__ import annotations

import os
import time

from app.app_logger import get_logger
from app.detour_models import LatLng, RouteRequest, ViaSpot
from app.geo_utils import haversine_m
from app.poi_loader import load_kyoto_sights

KYOTO_SIGHTS = load_kyoto_sights()
logger = get_logger(__name__)


def _target_distance_m_from_minutes(target_minutes: int) -> float:
    walk_speed_kmph = float(os.getenv("WALK_SPEED_KMPH", "4.0"))
    if walk_speed_kmph <= 0:
        raise RuntimeError("WALK_SPEED_KMPH must be > 0")
    return target_minutes * walk_speed_kmph * 1000.0 / 60.0


def _preselect_candidates(
    all_spots: list[ViaSpot],
    origin: LatLng,
    destination: LatLng,
    *,
    target_distance_m: float,
    min_endpoint_gap_m: float,
    preselect_count: int,
) -> list[ViaSpot]:
    direct_distance = haversine_m(origin, destination)
    target_extra = max(0.0, target_distance_m - direct_distance)
    preselect_min_gap_m = float(os.getenv("PRESELECT_MIN_SPOT_GAP_M", "250"))
    bucket_count = int(os.getenv("PRESELECT_PROGRESS_BUCKETS", "10"))
    max_per_bucket = int(os.getenv("PRESELECT_MAX_PER_BUCKET", "2"))
    if bucket_count <= 0:
        bucket_count = 1
    if max_per_bucket <= 0:
        max_per_bucket = 1
    weighted: list[tuple[float, ViaSpot]] = []

    for spot in all_spots:
        p = LatLng(lat=spot.lat, lng=spot.lng)
        if haversine_m(p, origin) < min_endpoint_gap_m or haversine_m(p, destination) < min_endpoint_gap_m:
            continue
        extra = haversine_m(origin, p) + haversine_m(p, destination) - direct_distance
        # 直線進行度 t を使い、ルート方向に分散しやすくする
        denom = max(1e-9, direct_distance)
        t = haversine_m(origin, p) / denom
        t = max(0.0, min(1.0, t))
        score = abs(extra - target_extra)
        weighted.append((score, t, spot))

    weighted.sort(key=lambda x: x[0])

    selected: list[ViaSpot] = []
    bucket_used = [0] * bucket_count
    for _, t, spot in weighted:
        bucket = min(bucket_count - 1, int(t * bucket_count))
        if bucket_used[bucket] >= max_per_bucket:
            continue
        p = LatLng(lat=spot.lat, lng=spot.lng)
        if any(
            haversine_m(p, LatLng(lat=s.lat, lng=s.lng)) < preselect_min_gap_m
            for s in selected
        ):
            continue
        selected.append(spot)
        bucket_used[bucket] += 1
        if len(selected) >= preselect_count:
            break

    if len(selected) < preselect_count:
        used_ids = {id(s) for s in selected}
        for _, _, spot in weighted:
            if id(spot) in used_ids:
                continue
            selected.append(spot)
            if len(selected) >= preselect_count:
                break

    return selected


def pick_via_spots(req: RouteRequest, max_spots: int = 10) -> list[ViaSpot]:
    started_at = time.perf_counter()
    if req.origin is None or req.destination is None:
        raise RuntimeError("origin/destination coordinates are not resolved")
    if req.target_minutes is None:
        logger.info("via_selector skip: target_minutes is None")
        return []

    a, b = req.origin, req.destination
    target_distance_m = _target_distance_m_from_minutes(req.target_minutes)
    tolerance_m = float(os.getenv("TARGET_DISTANCE_TOLERANCE_M", "500"))
    min_endpoint_gap_m = float(os.getenv("MIN_VIA_ENDPOINT_GAP_M", "150"))
    preselect_count = int(os.getenv("PRESELECT_CANDIDATES", "24"))
    max_candidates = int(os.getenv("EXACT_ROUTE_MAX_CANDIDATES", "24"))
    if preselect_count <= 0:
        raise RuntimeError("PRESELECT_CANDIDATES must be > 0")
    if max_candidates <= 0:
        raise RuntimeError("EXACT_ROUTE_MAX_CANDIDATES must be > 0")
    if preselect_count > max_candidates:
        preselect_count = max_candidates

    candidates = _preselect_candidates(
        KYOTO_SIGHTS,
        a,
        b,
        target_distance_m=target_distance_m,
        min_endpoint_gap_m=min_endpoint_gap_m,
        preselect_count=preselect_count,
    )

    if not candidates:
        logger.info("via_selector no candidates after preselect")
        return []
    if len(candidates) > max_candidates:
        candidates = candidates[:max_candidates]

    n = len(candidates)
    dist_a = [0.0] * n
    dist_b = [0.0] * n
    for i, spot in enumerate(candidates):
        p = LatLng(lat=spot.lat, lng=spot.lng)
        dist_a[i] = haversine_m(a, p)
        dist_b[i] = haversine_m(p, b)

    dist = [[0.0] * n for _ in range(n)]
    for i in range(n):
        pi = LatLng(lat=candidates[i].lat, lng=candidates[i].lng)
        for j in range(i + 1, n):
            pj = LatLng(lat=candidates[j].lat, lng=candidates[j].lng)
            d = haversine_m(pi, pj)
            dist[i][j] = d
            dist[j][i] = d

    max_mask = 1 << n
    inf = float("inf")
    dp = [[inf] * n for _ in range(max_mask)]
    parent = [[-1] * n for _ in range(max_mask)]

    for i in range(n):
        mask = 1 << i
        dp[mask][i] = dist_a[i]

    best_feasible: tuple[int, float, float, int, int] | None = None

    direct_distance = haversine_m(a, b)
    direct_deviation = abs(direct_distance - target_distance_m)
    if direct_deviation <= tolerance_m:
        best_feasible = (0, direct_deviation, direct_distance, 0, -1)

    for mask in range(1, max_mask):
        k = mask.bit_count()
        if k > max_spots:
            continue

        for last in range(n):
            curr = dp[mask][last]
            if curr == inf:
                continue

            route_distance = curr + dist_b[last]
            deviation = abs(route_distance - target_distance_m)
            feasible_key = (k, -deviation, -route_distance, -mask, -last)

            if deviation <= tolerance_m:
                if best_feasible is None or feasible_key > (
                    best_feasible[0],
                    -best_feasible[1],
                    -best_feasible[2],
                    -best_feasible[3],
                    -best_feasible[4],
                ):
                    best_feasible = (k, deviation, route_distance, mask, last)

            if k == max_spots:
                continue

            for nxt in range(n):
                bit = 1 << nxt
                if mask & bit:
                    continue
                next_mask = mask | bit
                next_dist = curr + dist[last][nxt]
                if next_dist < dp[next_mask][nxt]:
                    dp[next_mask][nxt] = next_dist
                    parent[next_mask][nxt] = last

    if best_feasible is None:
        logger.info(
            "via_selector no feasible route within tolerance: target_distance_m=%.1f tolerance_m=%.1f candidates=%s elapsed_ms=%.1f",
            target_distance_m,
            tolerance_m,
            len(candidates),
            (time.perf_counter() - started_at) * 1000.0,
        )
        return []
    chosen = best_feasible
    _, _, _, chosen_mask, chosen_last = chosen
    if chosen_last < 0:
        return []

    order_indices: list[int] = []
    mask = chosen_mask
    last = chosen_last
    while last >= 0:
        order_indices.append(last)
        prev = parent[mask][last]
        mask ^= 1 << last
        last = prev
    order_indices.reverse()

    selected = [candidates[i] for i in order_indices]
    logger.info(
        "via_selector selected: selected_count=%s candidates=%s target_distance_m=%.1f tolerance_m=%.1f elapsed_ms=%.1f",
        len(selected),
        len(candidates),
        target_distance_m,
        tolerance_m,
        (time.perf_counter() - started_at) * 1000.0,
    )
    return selected
