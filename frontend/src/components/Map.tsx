import { GoogleMap, LoadScript } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "100%",
};

const center = {
  lat: 35.0116,
  lng: 135.7681, // 京都
};

export default function Map() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  return (
    <LoadScript googleMapsApiKey={apiKey}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={14}
        options={{
          disableDefaultUI: true, // 余計なボタンを消すとスッキリします
          zoomControl: true,
        }}
      />
    </LoadScript>
  );
}