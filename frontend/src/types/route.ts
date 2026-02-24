export interface GeocodingInfo {
  query: string;
  display_name?: string | null;
  place_id?: number | null;
  osm_type?: string | null;
  osm_id?: number | null;
  category?: string | null;
  type?: string | null;
  importance?: number | null;
  address?: Record<string, string> | null;
}

export interface RouteData {
  status: "ok";
  route_id: string;
  genre: string;
  origin: { lat: number; lng: number; name?: string };
  destination: { lat: number; lng: number; name?: string };
  origin_geocoding?: GeocodingInfo | null;
  destination_geocoding?: GeocodingInfo | null;
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
