export type LatLng = {
  lat: number;
  lng: number;
};

export type NearbySpot = {
  lat: number;
  lng: number;
  name: string;
  type: string;
  description: string;
  distance_m: number;
};

export type NearbySpotsRequest = {
  current: LatLng;
  radius_m?: number;
  limit?: number;
};

export type NearbySpotsResponse = {
  status: "ok";
  current: LatLng;
  radius_m: number;
  spots: NearbySpot[];
};
