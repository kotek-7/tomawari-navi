import Map from "./components/Map";
import RouteForm from "./components/RouteForm";
import type { RouteData } from "./types/route";
import { useState } from "react";

export default function App() {
  const [routeData, setRouteData] = useState<RouteData | null>(null);

  return (
    <main className="relative h-screen w-screen overflow-hidden font-sans">
      <Map routeData={routeData} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[9999] px-2 pt-[max(8px,env(safe-area-inset-top))] sm:px-4">
        <div className="pointer-events-auto">
          <RouteForm onSubmit={(data: RouteData) => setRouteData(data)} />
        </div>
      </div>
    </main>
  );
}
