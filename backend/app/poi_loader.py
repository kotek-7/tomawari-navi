from __future__ import annotations

import os
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from app.detour_models import ViaSpot


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


def load_kyoto_sights() -> list[ViaSpot]:
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
