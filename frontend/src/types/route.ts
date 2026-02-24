export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteData {
  status: string;
  origin: LatLng & { name: string };
  destination: LatLng & { name: string };
  route: {
    // 道なりの経路を圧縮した文字列（API節約のキモ）
    encoded_polyline: string;
  };
  summary: {
    distance_m: number;
    duration_s: number;
    calories_kcal: number;
  };
  health_metrics?: {
    estimated_steps: number;
    noise?: { avg_dba: number };
  };
  via_spots: (LatLng & { name: string; description: string })[];
}