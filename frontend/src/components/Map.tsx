// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "../types/nearby";
import type { RouteData } from "../types/route";

function RouteAdjuster({ bounds }: { bounds: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
  }, [bounds, map]);
  return null;
}

function MapCenterReporter({ onCenterChange }: { onCenterChange?: (center: LatLng) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!onCenterChange) return;
    const center = map.getCenter();
    onCenterChange({ lat: center.lat, lng: center.lng });
  }, [map, onCenterChange]);

  useMapEvents({
    moveend() {
      if (!onCenterChange) return;
      const center = map.getCenter();
      onCenterChange({ lat: center.lat, lng: center.lng });
    },
    zoomend() {
      if (!onCenterChange) return;
      const center = map.getCenter();
      onCenterChange({ lat: center.lat, lng: center.lng });
    },
  });

  return null;
}

function RecenterController({
  recenterTick,
  target,
}: {
  recenterTick: number;
  target: LatLng | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (recenterTick <= 0 || !target) return;
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.8 });
  }, [map, recenterTick]);

  return null;
}

function makeLabeledIcon(label?: string, color = "#4CD964", size = 18) {
  const circle = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:inline-block;vertical-align:middle"></div>`;
  const labelHtml = label
    ? `<div style="display:inline-block;margin-left:8px;padding:6px 10px;border-radius:12px;background:#ffffff;color:#111;font-weight:700;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,0.12)">${label}</div>`
    : "";
  return L.divIcon({
    html: `<div style="display:flex;align-items:center">${circle}${labelHtml}</div>`,
    className: "",
    iconSize: [size + (label ? 120 : size), size],
    iconAnchor: [Math.floor(size / 2), Math.floor(size / 2)],
  });
}

function makeCurrentLocationIcon(heading: number) {
  const normalized = Number.isFinite(heading) ? heading : 0;
  return L.divIcon({
    html: `
      <div style="position:relative;width:78px;height:78px;">
        <div style="position:absolute;left:50%;top:50%;width:56px;height:56px;transform:translate(-50%,-50%) rotate(${normalized}deg);transform-origin:50% 50%;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
          <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
            <path d="M32 5 L58 58 L34 44 L6 58 Z" fill="#ef4444"/>
            <path d="M32 5 L34 44 L6 58 Z" fill="#dc2626"/>
            <path d="M32 5 L58 58 L34 44 Z" fill="#f87171"/>
          </svg>
        </div>
      </div>
    `,
    className: "",
    iconSize: [78, 78],
    iconAnchor: [39, 39],
  });
}

function CurrentLocationMarker({ onCurrentChange }: { onCurrentChange?: (pos: LatLng) => void }) {
  const [current, setCurrent] = useState<LatLng | null>(null);
  const [headingDeg, setHeadingDeg] = useState(0);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCurrent(next);
        onCurrentChange?.(next);
        const heading = pos.coords.heading;
        if (heading !== null && Number.isFinite(heading)) {
          setHeadingDeg(heading);
        }
      },
      () => {
        // ignore geolocation errors to avoid blocking map rendering
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [onCurrentChange]);

  if (!current) return null;
  return <Marker position={[current.lat, current.lng]} icon={makeCurrentLocationIcon(headingDeg)} />;
}

type MapProps = {
  routeData: RouteData | null;
  onCenterChange?: (center: LatLng) => void;
  onCurrentLocationChange?: (pos: LatLng) => void;
  recenterTick?: number;
  recenterTarget?: LatLng | null;
};

export default function Map({
  routeData,
  onCenterChange,
  onCurrentLocationChange,
  recenterTick = 0,
  recenterTarget = null,
}: MapProps) {
  const routePath = useMemo<[number, number][]>(() => {
    if (!routeData) return [];
    return routeData.route.geojson.coordinates.map(([lng, lat]) => [lat, lng]);
  }, [routeData]);

  return (
    <MapContainer center={[35.0394, 135.7292]} zoom={14} style={{ width: "100%", height: "100%" }}>
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapCenterReporter onCenterChange={onCenterChange} />
      <CurrentLocationMarker onCurrentChange={onCurrentLocationChange} />
      <RecenterController recenterTick={recenterTick} target={recenterTarget} />

      {routePath.length > 0 && (
        <>
          <Polyline positions={routePath} pathOptions={{ color: "#3182F9", weight: 6, opacity: 0.8 }} />
          <RouteAdjuster bounds={routePath} />
        </>
      )}

      {routeData && (
        <>
          <Marker
            position={[routeData.origin.lat, routeData.origin.lng]}
            icon={makeLabeledIcon(routeData.origin?.name, "#4CD964", 18)}
          />
          {(routeData.via_spots ?? []).map((s, i) => (
            <Marker key={`via-${i}`} position={[s.lat, s.lng]} icon={makeLabeledIcon(s.name, "#FFA500", 12)} />
          ))}
          {(routeData.along_route_spots ?? []).map((s, i) => (
            <Marker
              key={`along-${i}`}
              position={[s.lat, s.lng]}
              icon={makeLabeledIcon(s.name, "#FFA500", 12)}
            />
          ))}
          <Marker
            position={[routeData.destination.lat, routeData.destination.lng]}
            icon={makeLabeledIcon(routeData.destination?.name, "#FF3B30", 18)}
          />
        </>
      )}
    </MapContainer>
  );
}
