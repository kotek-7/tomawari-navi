import Map from "./components/Map";
import NearbySpotsPanel from "./components/NearbySpotsPanel";
import RouteForm from "./components/RouteForm";
import type { RouteData } from "./types/route";
import { useState } from "react";

export default function App() {
  const [routeData, setRouteData] = useState<RouteData | null>(null);

  return (
    <main className="relative h-screen w-screen overflow-hidden font-sans">
      <Map routeData={routeData} />
      <div className="pointer-events-auto absolute left-6 top-6 z-[9999]">
        <RouteForm onSubmit={(data: RouteData) => setRouteData(data)} />
      </div>
      <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-[9999] flex justify-center px-2">
        <NearbySpotsPanel />
      </div>
    </main>
  );
}
