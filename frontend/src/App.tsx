import Map from "./components/Map";
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
    </main>
  );
}
