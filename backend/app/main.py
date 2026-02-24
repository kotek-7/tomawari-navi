import os
import uuid
from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from typing import Literal
import xml.etree.ElementTree as ET
import zipfile

import asyncpg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from app.ranking import router as ranking_router

app = FastAPI(title=os.getenv("APP_NAME", "tomawari-backend"))
app.include_router(ranking_router)

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


DEFAULT_KYOTO_SIGHTS = [
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
    repo_root = Path(__file__).resolve().parents[2]
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
    # 線分ABに対する点Pの最短距離（局所平面近似, meters）
    # 京都市内スケールなら実用上十分な精度になる。
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
    # OD距離に応じて経由地数を増やす（最大5）
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


def _pick_via_spots(req: RouteRequest, max_spots: int = 5) -> list[ViaSpot]:
    # 「出発-目的の線に近い観光スポット」を優先しつつ、
    # 近すぎるエリアの候補を除外して多様化する。
    a, b = req.origin, req.destination
    base_distance_m = _haversine_m(a, b)
    target_count = _decide_via_count_by_distance(base_distance_m, max_spots=max_spots)
    if target_count <= 0:
        return []

    min_spot_gap_m = float(os.getenv("MIN_VIA_SPOT_GAP_M", "300"))
    min_endpoint_gap_m = float(os.getenv("MIN_VIA_ENDPOINT_GAP_M", "150"))

    scored = []
    for s in KYOTO_SIGHTS:
        p = LatLng(lat=s.lat, lng=s.lng)
        d = _dist_point_to_segment_rough(p, a, b)
        scored.append((d, s))
    scored.sort(key=lambda x: x[0])

    selected: list[ViaSpot] = []
    selected_points: list[LatLng] = []
    for _, spot in scored:
        p = LatLng(lat=spot.lat, lng=spot.lng)

        # 出発地/目的地の直近は除外
        if _haversine_m(p, a) < min_endpoint_gap_m or _haversine_m(p, b) < min_endpoint_gap_m:
            continue

        # 既に選んだスポットと近すぎる候補は除外
        if any(_haversine_m(p, sp) < min_spot_gap_m for sp in selected_points):
            continue

        selected.append(spot)
        selected_points.append(p)
        if len(selected) >= target_count:
            break

    return selected


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
    vias = _pick_via_spots(req, max_spots=5)
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
