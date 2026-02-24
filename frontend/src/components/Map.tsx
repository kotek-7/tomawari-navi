import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RouteData } from "../types/route";

// 地図の表示範囲をルートに合わせて自動調整するコンポーネント
function RouteAdjuster({ bounds }: { bounds: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
  }, [bounds, map]);
  return null;
}

function makeLabeledIcon(label?: string, color = '#4CD964', size = 18) {
  const circle = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:inline-block;vertical-align:middle"></div>`;
  const labelHtml = label ? `<div style="display:inline-block;margin-left:8px;padding:6px 10px;border-radius:12px;background:#ffffff;color:#111;font-weight:700;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,0.12)">${label}</div>` : '';
  return L.divIcon({ html: `<div style="display:flex;align-items:center">${circle}${labelHtml}</div>`, className: '', iconSize: [size + (label ? 120 : size), size], iconAnchor: [Math.floor(size/2), Math.floor(size/2)] });
}

export default function Map({ routeData }: { routeData: RouteData | null }) {
  const routePath: [number, number][] =
    routeData?.route?.geojson?.coordinates?.map(([lng, lat]) => [lat, lng]) ?? [];

  return (
    <MapContainer center={[35.0394, 135.7292]} zoom={14} style={{ width: "100%", height: "100%" }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {routePath.length > 0 && (
        <>
          <Polyline positions={routePath} pathOptions={{ color: "#3182F9", weight: 6, opacity: 0.8 }} />
          <RouteAdjuster bounds={routePath} />
        </>
      )}

      {routeData && (
        <>
          <Marker position={[routeData.origin.lat, routeData.origin.lng]} icon={makeLabeledIcon((routeData as any).origin?.name, '#4CD964', 18)} />
          {(routeData.via_spots ?? []).map((s, i) => (
            <Marker key={`via-${i}`} position={[s.lat, s.lng]} icon={makeLabeledIcon(s.name, '#FFA500', 12)} />
          ))}
          <Marker position={[routeData.destination.lat, routeData.destination.lng]} icon={makeLabeledIcon((routeData as any).destination?.name, '#FF3B30', 18)} />
        </>
      )}
    </MapContainer>
  );
}
