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

function MapZoomReporter({ onZoomChange }: { onZoomChange?: (zoom: number) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!onZoomChange) return;
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  useMapEvents({
    zoomend() {
      if (!onZoomChange) return;
      onZoomChange(map.getZoom());
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

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function spotTypeJa(type?: string): string {
  const key = (type || "").trim().toLowerCase();
  const table: Record<string, string> = {
    shrine: "神社",
    temple: "寺院",
    castle: "城",
    market: "市場",
    river: "川",
    museum: "博物館",
    park: "公園",
    sightseeing: "観光地",
  };
  return table[key] || "観光地";
}

function makeDotIcon(color = "#FFA500", size = 12) {
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,0.28);"></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [Math.floor(size / 2), Math.floor(size / 2)],
  });
}

function makeWaypointDetailIcon(name?: string, type?: string, description?: string) {
  const safeName = escapeHtml((name || "スポット").trim());
  const safeType = escapeHtml(spotTypeJa(type));
  const descText = (description || "").trim();
  const safeDesc = escapeHtml(descText.length > 36 ? `${descText.slice(0, 36)}...` : descText || "詳細情報なし");
  return L.divIcon({
    html: `
      <div style="display:flex;align-items:flex-start;gap:8px;white-space:nowrap;">
        <div style="margin-top:2px;width:12px;height:12px;border-radius:999px;background:#f59e0b;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.28);"></div>
        <div style="display:flex;flex-direction:column;gap:3px;max-width:230px;padding:6px 8px;border-radius:12px;background:#fff;border:2px solid #f59e0b;box-shadow:0 3px 8px rgba(0,0,0,0.16);line-height:1.2;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:12px;font-weight:800;color:#111;">${safeName}</span>
            <span style="font-size:10px;font-weight:700;color:#92400e;background:#fef3c7;padding:1px 6px;border-radius:999px;">${safeType}</span>
          </div>
          <div style="font-size:10px;color:#444;max-width:210px;overflow:hidden;text-overflow:ellipsis;">${safeDesc}</div>
        </div>
      </div>
    `,
    className: "",
    iconSize: [260, 58],
    iconAnchor: [6, 6],
  });
}

function makeEndpointIcon(label: string, kind: "origin" | "destination") {
  const config =
    kind === "origin"
      ? { color: "#0061c8", badge: "出発", badgeBg: "#005e87" }
      : { color: "#ef4444", badge: "到着", badgeBg: "#d01010" };
  return L.divIcon({
    html: `
      <div style="display:flex;align-items:center;gap:8px;white-space:nowrap;">
        <div style="position:relative;width:24px;height:24px;border-radius:50%;background:${config.color};border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>
        <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:14px;background:rgba(255,255,255,0.98);border:2px solid ${config.color};box-shadow:0 3px 8px rgba(0,0,0,0.18);">
          <span style="display:inline-block;padding:2px 6px;border-radius:999px;background:${config.badgeBg};color:#fff;font-size:10px;font-weight:800;line-height:1;">${config.badge}</span>
          <span style="color:#111;font-size:12px;font-weight:800;">${label}</span>
        </div>
      </div>
    `,
    className: "",
    iconSize: [200, 28],
    iconAnchor: [12, 12],
  });
}

function endpointLabel(raw: string | undefined, fallback: string): string {
  if (!raw || !raw.trim()) return fallback;
  const cleaned = raw.trim();
  const head = cleaned.split(",")[0]?.trim() || cleaned;
  return head.length > 24 ? `${head.slice(0, 24)}...` : head;
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
  const [zoom, setZoom] = useState(14);

  const routePath = useMemo<[number, number][]>(() => {
    if (!routeData) return [];
    return routeData.route.geojson.coordinates.map(([lng, lat]) => [lat, lng]);
  }, [routeData]);

  const waypointIconMode = zoom >= 17 ? "detail" : zoom >= 16 ? "name" : "dot";

  function waypointIcon(spot: { name?: string; type?: string; description?: string }) {
    if (waypointIconMode === "dot") {
      return makeDotIcon("#FFA500", 12);
    }
    if (waypointIconMode === "detail") {
      return makeWaypointDetailIcon(spot.name, spot.type, spot.description);
    }
    return makeLabeledIcon(spot.name, "#FFA500", 12);
  }

  return (
    <MapContainer center={[35.0394, 135.7292]} zoom={14} style={{ width: "100%", height: "100%" }}>
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapCenterReporter onCenterChange={onCenterChange} />
      <MapZoomReporter onZoomChange={setZoom} />
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
            icon={makeEndpointIcon(endpointLabel(routeData.origin?.name, "出発地"), "origin")}
          />
          {(routeData.via_spots ?? []).map((s, i) => (
            <Marker key={`via-${i}`} position={[s.lat, s.lng]} icon={waypointIcon(s)} />
          ))}
          {(routeData.along_route_spots ?? []).map((s, i) => (
            <Marker key={`along-${i}`} position={[s.lat, s.lng]} icon={waypointIcon(s)} />
          ))}
          <Marker
            position={[routeData.destination.lat, routeData.destination.lng]}
            icon={makeEndpointIcon(endpointLabel(routeData.destination?.name, "目的地"), "destination")}
          />
        </>
      )}
    </MapContainer>
  );
}
