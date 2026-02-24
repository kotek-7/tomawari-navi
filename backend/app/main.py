import asyncio
import json
import os
import uuid
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import asyncpg
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title=os.getenv("APP_NAME", "tomawari-backend"))

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
    origin: LatLng | None = None
    destination: LatLng | None = None
    origin_text: str | None = Field(default=None, min_length=1, max_length=200)
    destination_text: str | None = Field(default=None, min_length=1, max_length=200)
    genre: Literal["sightseeing"] = "sightseeing"
    start_time_iso: str | None = None
    target_minutes: int | None = Field(default=None, ge=10, le=240)
    weight_kg: float = Field(default=60.0, ge=30.0, le=150.0)


class GeoJSONLineString(BaseModel):
    type: Literal["LineString"] = "LineString"
    coordinates: list[list[float]]


class RouteGeometry(BaseModel):
    geojson: GeoJSONLineString


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
    route: RouteGeometry
    summary: Summary
    via_spots: list[ViaSpot]


def _haversine_m(a: LatLng, b: LatLng) -> float:
    r = 6371000.0
    lat1, lon1 = radians(a.lat), radians(a.lng)
    lat2, lon2 = radians(b.lat), radians(b.lng)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(h))


def _estimate_calories_kcal(distance_m: float, weight_kg: float) -> int:
    km = distance_m / 1000.0
    kcal = 0.9 * weight_kg * km
    return int(round(kcal))


DEFAULT_KYOTO_SIGHTS = [
    ViaSpot(
        lat=35.0037,
        lng=135.7788,
        name="八坂神社",
        type="shrine",
        description="祇園のシンボル。参道と街歩きが楽しいです。",
    ),
    ViaSpot(
        lat=35.0043,
        lng=135.7646,
        name="錦市場",
        type="market",
        description="京の台所。食べ歩きが楽しい通りです。",
    ),
    ViaSpot(
        lat=35.0116,
        lng=135.7709,
        name="鴨川",
        type="river",
        description="川沿いの道が気持ちいい散歩スポットです。",
    ),
    ViaSpot(
        lat=35.0104,
        lng=135.7539,
        name="二条城",
        type="castle",
        description="歴史を感じる城郭。周辺の落ち着いた道も魅力です。",
    ),
]


def _classify_spot_type(name: str, description: str) -> str:
    text = f"{name} {description}"
    rules = [
        ("shrine", ["神社", "稲荷", "八幡", "天満宮"]),
        ("temple", ["寺", "院", "堂"]),
        ("castle", ["城", "城跡"]),
        ("market", ["市場", "商店街", "朝市"]),
        ("river", ["川", "河川", "渓谷", "鴨川"]),
        ("museum", ["博物館", "美術館", "資料館"]),
        ("park", ["公園", "庭園", "植物園"]),
    ]
    for spot_type, keywords in rules:
        if any(k in text for k in keywords):
            return spot_type
    return "sightseeing"


def _col_ref_to_index(col_ref: str) -> int:
    result = 0
    for ch in col_ref:
        result = result * 26 + (ord(ch) - ord("A") + 1)
    return result - 1


def _read_xlsx_rows(xlsx_path: Path) -> list[dict[str, str]]:
    ns_main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    ns_rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    ns_pkg = "http://schemas.openxmlformats.org/package/2006/relationships"

    with zipfile.ZipFile(xlsx_path) as zf:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            shared_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in shared_root.findall(f".//{{{ns_main}}}si"):
                texts = [t.text or "" for t in si.findall(f".//{{{ns_main}}}t")]
                shared_strings.append("".join(texts))

        workbook_root = ET.fromstring(zf.read("xl/workbook.xml"))
        first_sheet = workbook_root.find(f".//{{{ns_main}}}sheets/{{{ns_main}}}sheet")
        if first_sheet is None:
            return []
        rel_id = first_sheet.attrib.get(f"{{{ns_rel}}}id")
        if not rel_id:
            return []

        rels_root = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        target = None
        for rel in rels_root.findall(f".//{{{ns_pkg}}}Relationship"):
            if rel.attrib.get("Id") == rel_id:
                target = rel.attrib.get("Target")
                break
        if not target:
            return []

        sheet_path = target if target.startswith("xl/") else f"xl/{target}"
        sheet_root = ET.fromstring(zf.read(sheet_path))
        row_nodes = sheet_root.findall(f".//{{{ns_main}}}sheetData/{{{ns_main}}}row")
        if not row_nodes:
            return []

        def _cell_text(cell: ET.Element) -> str:
            cell_type = cell.attrib.get("t")
            value_node = cell.find(f"{{{ns_main}}}v")
            if value_node is not None:
                value = value_node.text or ""
                if cell_type == "s" and value.isdigit():
                    idx = int(value)
                    if 0 <= idx < len(shared_strings):
                        return shared_strings[idx]
                return value
            inline_text = cell.find(f"{{{ns_main}}}is/{{{ns_main}}}t")
            return inline_text.text or "" if inline_text is not None else ""

        header_cells = row_nodes[0].findall(f"{{{ns_main}}}c")
        headers: dict[int, str] = {}
        for cell in header_cells:
            ref = cell.attrib.get("r", "")
            col_ref = "".join(ch for ch in ref if ch.isalpha())
            if not col_ref:
                continue
            headers[_col_ref_to_index(col_ref)] = _cell_text(cell).strip()

        rows: list[dict[str, str]] = []
        for row in row_nodes[1:]:
            values_by_idx: dict[int, str] = {}
            for cell in row.findall(f"{{{ns_main}}}c"):
                ref = cell.attrib.get("r", "")
                col_ref = "".join(ch for ch in ref if ch.isalpha())
                if not col_ref:
                    continue
                values_by_idx[_col_ref_to_index(col_ref)] = _cell_text(cell).strip()

            row_dict: dict[str, str] = {}
            for idx, header in headers.items():
                row_dict[header] = values_by_idx.get(idx, "")
            rows.append(row_dict)
        return rows


def _load_kyoto_sights_from_xlsx() -> list[ViaSpot]:
    xlsx_path = Path(os.getenv("KYOTO_SIGHTS_XLSX_PATH", "/app/data/kyoto_kankouchi.xlsx"))
    if not xlsx_path.exists():
        return DEFAULT_KYOTO_SIGHTS

    try:
        rows = _read_xlsx_rows(xlsx_path)
    except (OSError, zipfile.BadZipFile, ET.ParseError):
        return DEFAULT_KYOTO_SIGHTS

    loaded: list[ViaSpot] = []
    for row in rows:
        if row.get("都道府県名") != "京都府":
            continue
        name = row.get("名称", "").strip()
        lat_s = row.get("緯度", "").strip()
        lng_s = row.get("経度", "").strip()
        if not name or not lat_s or not lng_s:
            continue
        try:
            lat = float(lat_s)
            lng = float(lng_s)
        except ValueError:
            continue

        description = (
            row.get("説明", "").strip()
            or row.get("アクセス方法", "").strip()
            or row.get("住所", "").strip()
            or "京都の観光スポット"
        )
        spot_type = _classify_spot_type(name, description)
        loaded.append(
            ViaSpot(
                lat=lat,
                lng=lng,
                name=name,
                type=spot_type,
                description=description,
            )
        )

    return loaded or DEFAULT_KYOTO_SIGHTS


KYOTO_SIGHTS = _load_kyoto_sights_from_xlsx()


def _dist_point_to_segment_rough(p: LatLng, a: LatLng, b: LatLng) -> float:
    r = 6371000.0
    ref_lat = radians((a.lat + b.lat + p.lat) / 3.0)

    def _to_xy_m(ll: LatLng) -> tuple[float, float]:
        x = r * radians(ll.lng) * cos(ref_lat)
        y = r * radians(ll.lat)
        return (x, y)

    ax, ay = _to_xy_m(a)
    bx, by = _to_xy_m(b)
    px, py = _to_xy_m(p)

    abx = bx - ax
    aby = by - ay
    apx = px - ax
    apy = py - ay
    ab2 = abx * abx + aby * aby

    if ab2 == 0.0:
        return sqrt(apx * apx + apy * apy)

    t = (apx * abx + apy * aby) / ab2
    if t < 0.0:
        t = 0.0
    elif t > 1.0:
        t = 1.0

    cx = ax + t * abx
    cy = ay + t * aby
    dx = px - cx
    dy = py - cy
    return sqrt(dx * dx + dy * dy)


def _decide_via_count_by_distance(distance_m: float, max_spots: int = 5) -> int:
    if distance_m < 1500:
        return 0
    if distance_m < 3000:
        return min(1, max_spots)
    if distance_m < 5000:
        return min(2, max_spots)
    if distance_m < 7000:
        return min(3, max_spots)
    if distance_m < 9000:
        return min(4, max_spots)
    return min(5, max_spots)



def _decide_via_count_by_target_minutes(target_minutes: int | None, max_spots: int = 5) -> int:
    if target_minutes is None:
        return max_spots
    if target_minutes < 30:
        return 0
    if target_minutes < 45:
        return min(1, max_spots)
    if target_minutes < 60:
        return min(2, max_spots)
    if target_minutes < 90:
        return min(3, max_spots)
    if target_minutes < 120:
        return min(4, max_spots)
    return min(5, max_spots)
def _pick_via_spots(req: RouteRequest, max_spots: int = 5) -> list[ViaSpot]:
    a, b = req.origin, req.destination
    base_distance_m = _haversine_m(a, b)
    distance_based_count = _decide_via_count_by_distance(base_distance_m, max_spots=max_spots)
    minutes_based_count = _decide_via_count_by_target_minutes(req.target_minutes, max_spots=max_spots)
    target_count = min(distance_based_count, minutes_based_count)
    if target_count <= 0:
        return []

    min_spot_gap_m = float(os.getenv("MIN_VIA_SPOT_GAP_M", "300"))
    min_endpoint_gap_m = float(os.getenv("MIN_VIA_ENDPOINT_GAP_M", "150"))

    scored: list[tuple[float, ViaSpot]] = []
    for s in KYOTO_SIGHTS:
        p = LatLng(lat=s.lat, lng=s.lng)
        d = _dist_point_to_segment_rough(p, a, b)
        scored.append((d, s))
    scored.sort(key=lambda x: x[0])

    selected: list[ViaSpot] = []
    selected_points: list[LatLng] = []
    for _, spot in scored:
        p = LatLng(lat=spot.lat, lng=spot.lng)
        if _haversine_m(p, a) < min_endpoint_gap_m or _haversine_m(p, b) < min_endpoint_gap_m:
            continue
        if any(_haversine_m(p, sp) < min_spot_gap_m for sp in selected_points):
            continue

        selected.append(spot)
        selected_points.append(p)
        if len(selected) >= target_count:
            break

    return selected


def _parse_start_time(start_time_iso: str | None) -> datetime:
    if not start_time_iso:
        return datetime.now(JST)
    dt = datetime.fromisoformat(start_time_iso)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=JST)
    return dt.astimezone(JST)


def _build_ors_coordinates(req: RouteRequest, vias: list[ViaSpot]) -> list[list[float]]:
    if req.origin is None or req.destination is None:
        raise RuntimeError("origin/destination coordinates are not resolved")

    coordinates: list[list[float]] = [[req.origin.lng, req.origin.lat]]
    for v in vias:
        coordinates.append([v.lng, v.lat])
    coordinates.append([req.destination.lng, req.destination.lat])
    return coordinates


def _geocode_sync(place_name: str) -> LatLng:
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
        return LatLng(lat=float(item["lat"]), lng=float(item["lon"]))
    except (KeyError, TypeError, ValueError) as e:
        raise RuntimeError("geocoding response format is invalid") from e


async def _resolve_route_points(req: RouteRequest) -> tuple[LatLng, LatLng]:
    async def _resolve_one(coord: LatLng | None, text: str | None, label: str) -> LatLng:
        if coord is not None:
            return coord
        if text and text.strip():
            return await asyncio.to_thread(_geocode_sync, text.strip())
        raise ValueError(
            f"{label} is required. Send either `{label}` coordinates or `{label}_text` place name."
        )

    origin_task = _resolve_one(req.origin, req.origin_text, "origin")
    destination_task = _resolve_one(req.destination, req.destination_text, "destination")
    origin, destination = await asyncio.gather(origin_task, destination_task)
    return origin, destination


def _request_ors_route_sync(req: RouteRequest, vias: list[ViaSpot]) -> tuple[GeoJSONLineString, float, int]:
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

    return geojson, distance_m, duration_s


@app.post("/v1/routes:detour", response_model=RouteResponse)
async def detour_route(req: RouteRequest) -> RouteResponse:
    try:
        origin, destination = await _resolve_route_points(req)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    resolved_req = req.model_copy(update={"origin": origin, "destination": destination})
    vias = _pick_via_spots(resolved_req, max_spots=5)

    try:
        route_geojson, dist, duration_s = await asyncio.to_thread(_request_ors_route_sync, resolved_req, vias)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    start_dt = _parse_start_time(req.start_time_iso)
    eta_dt = start_dt + timedelta(seconds=duration_s)
    calories = _estimate_calories_kcal(dist, req.weight_kg)

    return RouteResponse(
        status="ok",
        route_id=f"route_{uuid.uuid4().hex[:12]}",
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
        via_spots=vias,
    )


