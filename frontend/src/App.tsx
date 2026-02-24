import Map from "./components/Map";
import NearbySpotsPanel from "./components/NearbySpotsPanel";
import RouteForm from "./components/RouteForm";
import type { LatLng } from "./types/nearby";
import type { RouteData } from "./types/route";
import { useEffect, useRef, useState } from "react";

const NEARBY_REVEAL_DELAY_MS = 5000;
const DEFAULT_MAP_CENTER: LatLng = { lat: 35.0394, lng: 135.7292 };
const RECENTER_SKIP_DISTANCE_M = 35;

function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * r * Math.asin(Math.sqrt(h));
}

export default function App() {
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [showNearbyPanel, setShowNearbyPanel] = useState(false);
  const [mapCenter, setMapCenter] = useState<LatLng>(DEFAULT_MAP_CENTER);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [recenterTick, setRecenterTick] = useState(0);
  const nearbyRevealTimerRef = useRef<number | null>(null);

  function clearNearbyRevealTimer() {
    if (nearbyRevealTimerRef.current === null) return;
    window.clearTimeout(nearbyRevealTimerRef.current);
    nearbyRevealTimerRef.current = null;
  }

  function hideNearbyPanel() {
    clearNearbyRevealTimer();
    setShowNearbyPanel(false);
  }

  function scheduleNearbyPanelReveal(delayMs: number) {
    clearNearbyRevealTimer();
    nearbyRevealTimerRef.current = window.setTimeout(() => {
      setShowNearbyPanel(true);
      nearbyRevealTimerRef.current = null;
    }, delayMs);
  }

  useEffect(() => {
    return () => clearNearbyRevealTimer();
  }, []);

  const canRecenter =
    !!currentLocation && haversineMeters(mapCenter, currentLocation) > RECENTER_SKIP_DISTANCE_M;

  function handleRecenter() {
    if (!currentLocation) return;
    const distance = haversineMeters(mapCenter, currentLocation);
    if (distance <= RECENTER_SKIP_DISTANCE_M) return;
    setRecenterTick((v) => v + 1);
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden font-sans">
      <Map
        routeData={routeData}
        onCenterChange={setMapCenter}
        onCurrentLocationChange={setCurrentLocation}
        recenterTick={recenterTick}
        recenterTarget={currentLocation}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[9999] px-2 pt-[max(8px,env(safe-area-inset-top))] sm:px-4">
        <div className="pointer-events-auto mx-auto w-full max-w-md">
          <RouteForm
            onSubmit={(data: RouteData) => setRouteData(data)}
            onSearchStart={() => hideNearbyPanel()}
            onSearchSuccess={() => scheduleNearbyPanelReveal(NEARBY_REVEAL_DELAY_MS)}
            onSearchError={() => setShowNearbyPanel(true)}
          />
          <div className="mt-8 flex justify-end pr-1">
            <button
              type="button"
              onClick={handleRecenter}
              disabled={!canRecenter}
              aria-label="現在地へ移動"
              className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/80 bg-sky-500 text-5xl leading-none text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              ⌖
            </button>
          </div>
        </div>
      </div>
      {showNearbyPanel && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[9998] flex justify-center px-2 pb-[max(8px,env(safe-area-inset-bottom))] sm:px-4">
          <div className="pointer-events-auto w-full max-w-[520px]">
            <NearbySpotsPanel center={mapCenter} />
          </div>
        </div>
      )}
    </main>
  );
}
