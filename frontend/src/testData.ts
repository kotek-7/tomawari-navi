import type { RouteData } from "./types/route";

export const MOCK_ROUTE_DATA: RouteData = {
  status: "ok",
  route_id: "kyoto_health_0001",
  genre: "health",
  origin: { lat: 35.0037, lng: 135.7681, name: "出発地点" },
  destination: { lat: 34.9858, lng: 135.7588, name: "目的地点" },
  route: {
    polyline: {
      format: "encoded_polyline",
      // 本物の道なりデータ（京都河原町〜京都駅）
      encoded_data: "m~l{C_raiV_pA~l@iVvE{DlDeCpD_ChDgBzDaB~CsAtCiAxCeAnCcA~BcAfCcArCcAnCcA~BcAfCcArCcAnCcA~BcAfCcArCcA~BcAfCcArCcA",
    }
  },
  summary: {
    distance_m: 3200,
    duration_s: 2400,
    eta_iso: "2026-02-23T15:40:00+09:00",
    calories_kcal: 173
  },
  health_metrics: {
    estimated_steps: 4200,
    total_elevation_gain_m: 85,
    max_slope_percent: 9.2,
    noise: { unit: "dBA", avg_dba: 58.4, max_dba: 71.2, method: "segment_weighted_average" }
  },
  via_spots: [
    { lat: 35.0043, lng: 135.7646, name: "錦市場", type: "market", description: "京の台所。" },
    { lat: 35.0070, lng: 135.7619, name: "六角堂", type: "temple", description: "街中のお寺。" }
  ]
};