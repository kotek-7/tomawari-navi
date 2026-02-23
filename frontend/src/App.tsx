import { useEffect, useState } from "react";
import "./App.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type HealthResponse = {
  status: string;
};

function App() {
  const [health, setHealth] = useState("checking...");

  useEffect(() => {
    fetch(`${apiBaseUrl}/health`)
      .then((res) => res.json() as Promise<HealthResponse>)
      .then((data) => setHealth(data.status))
      .catch(() => setHealth("ng"));
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", margin: "2rem", lineHeight: 1.6 }}>
      <h1>tomawari-navi</h1>
      <p>Frontend: Vite + React + TypeScript</p>
      <p>Backend health: {health}</p>
      <p>API base: {apiBaseUrl}</p>
    </main>
  );
}

export default App;
