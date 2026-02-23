import Map from "./components/Map";
import RouteForm from "./components/RouteForm";

export default function App() {
  return (
    <main style={mainStyle}>
      <Map />
      <div style={overlayStyle}>
        <RouteForm />
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
  zIndex: 10,
};