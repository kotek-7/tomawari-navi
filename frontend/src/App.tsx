import Map from "./components/Map";
import NearbySpotsPanel from "./components/NearbySpotsPanel";
import RouteForm from "./components/RouteForm";
import type { LatLng } from "./types/nearby";
import type { RouteData } from "./types/route";
import { useEffect, useRef, useState } from "react";

const NEARBY_REVEAL_DELAY_MS = 5000;
const DEFAULT_MAP_CENTER: LatLng = { lat: 35.0394, lng: 135.7292 };

export default function App() {
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [showNearbyPanel, setShowNearbyPanel] = useState(false);
  const [mapCenter, setMapCenter] = useState<LatLng>(DEFAULT_MAP_CENTER);
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

  return (
    <main className="relative h-screen w-screen overflow-hidden font-sans">
      <Map routeData={routeData} onCenterChange={setMapCenter} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[9999] px-2 pt-[max(8px,env(safe-area-inset-top))] sm:px-4">
        <div className="pointer-events-auto">
          <RouteForm
            onSubmit={(data: RouteData) => setRouteData(data)}
            onSearchStart={() => hideNearbyPanel()}
            onSearchSuccess={() => scheduleNearbyPanelReveal(NEARBY_REVEAL_DELAY_MS)}
            onSearchError={() => setShowNearbyPanel(true)}
          />
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
