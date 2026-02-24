import { useEffect, useState } from "react";
import { GoogleMap, useJsApiLoader, DirectionsRenderer } from "@react-google-maps/api";
import type { RouteData } from "../types/route";

export default function Map({ routeData }: { routeData: RouteData | null }) {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: ["geometry"],
  });

  useEffect(() => {
    if (isLoaded && routeData) {
      const service = new google.maps.DirectionsService();

      // JSONから経由地を取り出す
      const waypoints = routeData.via_spots.map(spot => ({
        location: { lat: spot.lat, lng: spot.lng },
        stopover: true,
      }));

      service.route(
        {
          origin: { lat: routeData.origin.lat, lng: routeData.origin.lng },
          destination: { lat: routeData.destination.lat, lng: routeData.destination.lng },
          waypoints: waypoints,
          travelMode: google.maps.TravelMode.WALKING,
        },
        (result, status) => {
          if (status === "OK") setDirections(result);
        }
      );
    }
  }, [isLoaded, routeData]);

  if (!isLoaded) return null;

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "100vh" }}
      center={{ lat: 35.0394, lng: 135.7292 }} // 金閣寺付近
      zoom={14}
    >
      {directions && <DirectionsRenderer directions={directions} />}
    </GoogleMap>
  );
}