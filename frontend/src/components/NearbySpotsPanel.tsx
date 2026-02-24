import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nearbySpots } from "../api/nearbySpots";
import type { NearbySpot } from "../types/nearby";

type Props = {
  initialRadiusM?: number;
  initialLimit?: number;
  pollingIntervalMs?: number;
  title?: string;
  onSpotsLoaded?: (spots: NearbySpot[]) => void;
  onSpotClick?: (spot: NearbySpot) => void;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export default function NearbySpotsPanel({
  initialRadiusM = 800,
  initialLimit = 10,
  pollingIntervalMs = 30000,
  title = "近くの寄り道スポット",
  onSpotsLoaded,
  onSpotClick,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [spots, setSpots] = useState<NearbySpot[]>([]);
  const inFlightRef = useRef(false);

  const searchParams = useMemo(() => {
    return {
      radius: clamp(initialRadiusM, 50, 5000),
      limit: clamp(initialLimit, 1, 50),
    };
  }, [initialLimit, initialRadiusM]);

  const requestCurrentLocationAndSearch = useCallback(() => {
    if (!navigator.geolocation || inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const current = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          const response = await nearbySpots({
            current,
            radius_m: searchParams.radius,
            limit: searchParams.limit,
          });
          setSpots(response.spots);
          setErrorMessage("");
          onSpotsLoaded?.(response.spots);
        } catch (e) {
          setErrorMessage(e instanceof Error ? e.message : String(e));
        } finally {
          inFlightRef.current = false;
          setLoading(false);
        }
      },
      (err) => {
        inFlightRef.current = false;
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMessage("位置情報の権限が未許可です。ブラウザ設定から許可してください。");
        } else {
          setErrorMessage("現在地を取得できませんでした。");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      },
    );
  }, [onSpotsLoaded, searchParams.limit, searchParams.radius]);

  useEffect(() => {
    requestCurrentLocationAndSearch();
    const id = window.setInterval(requestCurrentLocationAndSearch, pollingIntervalMs);
    return () => window.clearInterval(id);
  }, [pollingIntervalMs, requestCurrentLocationAndSearch]);

  return (
    <section style={{ ...sheetStyle, transform: expanded ? "translateY(0%)" : "translateY(72%)" }}>
      <button type="button" onClick={() => setExpanded((v) => !v)} style={handleButtonStyle}>
        <span style={handleBarStyle} />
        <h3 style={titleStyle}>{title}</h3>
        <span style={chevronStyle}>{expanded ? "▼" : "▲"}</span>
      </button>

      <div style={contentStyle}>
        {errorMessage && <div style={errorStyle}>{errorMessage}</div>}
        {loading && <div style={loadingStyle}>周辺スポットを検索中...</div>}

        <div style={listStyle}>
          {spots.length === 0 ? (
            <div style={emptyStyle}>周辺スポットがまだ見つかっていません</div>
          ) : (
            spots.map((spot) => (
              <button
                type="button"
                key={`${spot.name}-${spot.lat}-${spot.lng}`}
                onClick={() => onSpotClick?.(spot)}
                style={spotItemStyle}
              >
                <strong>{spot.name}</strong>
                <span style={distanceStyle}>{spot.distance_m} m</span>
                <p style={descriptionStyle}>{spot.description}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

const sheetStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  background: "#ffffff",
  border: "1px solid #d8dee9",
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  padding: "8px 14px 16px",
  boxShadow: "0 -10px 30px rgba(2, 6, 23, 0.25)",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  maxHeight: "72vh",
  transition: "transform 220ms ease-out",
};

const contentStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  overflowY: "auto",
  paddingBottom: 4,
};

const handleButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  width: "100%",
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: 6,
  padding: "2px 0 6px",
};

const handleBarStyle: React.CSSProperties = {
  justifySelf: "center",
  width: 40,
  height: 5,
  borderRadius: 99,
  background: "#cbd5e1",
};

const chevronStyle: React.CSSProperties = {
  justifySelf: "end",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
  justifySelf: "center",
};

const loadingStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 12,
};

const errorStyle: React.CSSProperties = {
  color: "#b91c1c",
  fontSize: 13,
};

const listStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxHeight: 300,
  overflowY: "auto",
};

const emptyStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
};

const spotItemStyle: React.CSSProperties = {
  textAlign: "left",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
  background: "#f8fafc",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const distanceStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: 12,
};

const descriptionStyle: React.CSSProperties = {
  margin: 0,
  color: "#334155",
  fontSize: 12,
};
