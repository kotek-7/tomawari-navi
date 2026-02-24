export interface RouteData {
  status: "ok";
  route_id: string;
  genre: string;
  origin: { lat: number; lng: number; name?: string };
  destination: { lat: number; lng: number; name?: string };
  route: {
    geojson: {
      type: "LineString";
      coordinates: Array<[number, number]>; // [lng, lat]
    };
  };
  summary: {
    distance_m: number;
    duration_s: number;
    eta_iso: string;
    calories_kcal: number;
  };
  via_spots: Array<{ lat: number; lng: number; name?: string; type?: string; description?: string }>;
  along_route_spots?: Array<{ lat: number; lng: number; name?: string; type?: string; description?: string }>;
}
