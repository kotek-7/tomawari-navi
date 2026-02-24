// src/testData.ts
// Mock data adapted from docs/response_health_route.jsonc
export const MOCK_ROUTE_DATA = {
  origin: { lat: 35.0037, lng: 135.7681, name: "出発地点" },
  destination: { lat: 34.9858, lng: 135.7588, name: "目的地点" },
  via_spots: [
    { lat: 35.0043, lng: 135.7646, name: "錦市場" },
    { lat: 35.0070, lng: 135.7619, name: "六角堂" }
  ],
  summary: {
    total_distance_km: 3.2,          // docs: 3200 m
    total_duration_min: 40,          // docs: 2400 s = 40 min
    calories_kcal: 173
  },
  health_metrics: {
    estimated_steps: 4200,
    total_elevation_gain_m: 85,
    max_slope_percent: 9.2
  }
};