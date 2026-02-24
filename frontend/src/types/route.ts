// src/types/route.ts
export interface RouteData {
  origin: { lat: number; lng: number; name?: string };
  destination: { lat: number; lng: number; name?: string };
  via_spots: Array<{ lat: number; lng: number; name?: string }>;
  summary: {
    total_distance_km: number;
    total_duration_min: number;
    calories_kcal: number;
  };
  health_metrics: {
    estimated_steps: number;
  };
}