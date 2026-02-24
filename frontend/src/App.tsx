import Map from "./components/Map";
import RouteForm from "./components/RouteForm";
import type { RouteData } from "./types/route";
import { useState } from "react";

export default function App() {
  const [routeData, setRouteData] = useState<RouteData | null>(null);

  return (
    <main style={mainStyle}>
      <Map routeData={routeData} />
      <div style={overlayStyle}>
        <RouteForm onSubmit={(data: RouteData) => setRouteData(data)} />
      </div>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  position: "relative",
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  top: "24px",
  left: "24px",
  zIndex: 9999,
  // Ensure overlay sits above map and receives pointer events
  pointerEvents: "auto",
};
