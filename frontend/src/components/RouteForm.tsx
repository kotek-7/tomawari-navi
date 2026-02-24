import { useMemo, useState } from "react";
import { detourRoute } from "../api";
import type { RouteData } from "../types/route";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export default function RouteForm({ onSubmit }: { onSubmit?: (data: RouteData) => void }) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [originText, setOriginText] = useState<string>("");
  const [destinationText, setDestinationText] = useState<string>("");
  const [targetMinutesText, setTargetMinutesText] = useState<string>("60");
  const [lastRoute, setLastRoute] = useState<RouteData | null>(null);

  const targetMinutes = useMemo(() => {
    const parsed = Number.parseInt(targetMinutesText, 10);
    return Number.isFinite(parsed) ? clamp(parsed, 10, 240) : 60;
  }, [targetMinutesText]);

  const mockMetrics = useMemo(() => {
    const steps = Math.round(targetMinutes * 80);
    const calories = Math.round(targetMinutes * 4.8);
    const detourDeltaM = Math.round(targetMinutes * 70);
    return { steps, calories, detourDeltaM };
  }, [targetMinutes]);

  async function handleSubmit() {
    try {
      const origin = originText.trim();
      const destination = destinationText.trim();
      if (!origin || !destination) {
        setErrorMessage("出発地と目的地を入力してください。");
        return;
      }

      setLoading(true);
      setErrorMessage("");

      const body = {
        origin_text: origin,
        destination_text: destination,
        genre: "sightseeing",
        start_time_iso: null,
        target_minutes: targetMinutes,
        weight_kg: 60.0,
      };

      console.log("[UI] Sending detour request body:", body);
      const resp = await detourRoute(body);
      console.log("[UI] detour response (raw):", resp);

      setLastRoute(resp);
      onSubmit?.(resp);
    } catch (err) {
      console.error("route request failed", err);
      const rawMsg = err instanceof Error ? err.message : String(err);
      setErrorMessage(rawMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={containerStyle}>
      <div style={sectionStyle}>
        <div style={inputGroupStyle}>
          <label style={labelStyle}>出発地</label>
          <input
            value={originText}
            onChange={(e) => setOriginText(e.target.value)}
            type="text"
            placeholder="現在地、または駅名"
            style={inputStyle}
          />
        </div>

        <div style={inputGroupStyle}>
          <label style={labelStyle}>目的地</label>
          <input
            value={destinationText}
            onChange={(e) => setDestinationText(e.target.value)}
            type="text"
            placeholder="目的地を入力"
            style={inputStyle}
          />
        </div>
      </div>

      <div style={inputGroupStyle}>
        <label style={labelStyle}>遠回りルート</label>
        <div style={segmentContainerStyle}>
          <button type="button" style={activeSegmentStyle}>
            観光
          </button>
          <button type="button" disabled style={disabledSegmentStyle}>
            健康
          </button>
        </div>
      </div>

      <div style={inlineGridStyle}>
        <div style={inputGroupStyle}>
          <label style={labelStyle}>時間</label>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <input
              type="number"
              min={10}
              max={240}
              value={targetMinutesText}
              onChange={(e) => setTargetMinutesText(e.target.value)}
              style={numberInputStyle}
            />
            <span style={unitStyle}>分</span>
          </div>
        </div>

        <div style={inputGroupStyle}>
          <label style={labelStyle}>カテゴリ</label>
          <select value="none" disabled style={disabledSelectStyle}>
            <option value="none">指定なし</option>
            <option value="temple">神社・寺</option>
            <option value="local">ローカルなお店</option>
            <option value="nature">自然</option>
          </select>
        </div>
      </div>

      <div style={metricsCardStyle}>
        <div style={metricRowStyle}>
          <span>推定歩数</span>
          <strong>{mockMetrics.steps.toLocaleString()} 歩</strong>
        </div>
        <div style={metricRowStyle}>
          <span>消費カロリー</span>
          <strong>{mockMetrics.calories} cal</strong>
        </div>
        <div style={deltaStyle}>最短距離より +{mockMetrics.detourDeltaM} m（モック）</div>
      </div>

      {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

      <button onClick={handleSubmit} disabled={loading} style={submitButtonStyle}>
        {loading ? "生成中..." : "検索"}
      </button>

      <div style={spotsCardStyle}>
        <div style={spotsTitleStyle}>スポット</div>
        <div style={spotsListStyle}>
          {[...(lastRoute?.via_spots ?? []), ...(lastRoute?.along_route_spots ?? [])].map((s, i) => (
            <div key={`${s.name ?? "spot"}-${i}`} style={spotItemStyle}>
              <span style={spotDotStyle} />
              <span>{s.name ?? "スポット"}</span>
            </div>
          ))}
          {!lastRoute && <div style={spotPlaceholderStyle}>まだ検索していません</div>}
        </div>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: "320px",
  backgroundColor: "#1E90FF",
  padding: "18px 16px",
  borderRadius: "12px",
  boxShadow: "0 8px 20px rgba(0,0,0,0.16)",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  color: "#ffffff",
};

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const inlineGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
  alignItems: "end",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: "700",
  color: "#E6F7FF",
  letterSpacing: "0.03em",
  marginBottom: "8px",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.22)",
  border: "none",
  padding: "10px 12px",
  fontSize: "14px",
  color: "#ffffff",
  borderRadius: "8px",
  outline: "none",
};

const numberInputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.22)",
  border: "none",
  borderRadius: "8px",
  padding: "8px 10px",
  fontSize: "20px",
  fontWeight: "700",
  width: "84px",
  outline: "none",
  color: "#ffffff",
};

const unitStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#E6F7FF",
};

const segmentContainerStyle: React.CSSProperties = {
  display: "flex",
  backgroundColor: "rgba(255,255,255,0.12)",
  padding: "6px",
  borderRadius: "10px",
  gap: "6px",
};

const activeSegmentStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px",
  fontSize: "13px",
  fontWeight: "700",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "rgba(255,255,255,0.25)",
  color: "#fff",
  cursor: "default",
};

const disabledSegmentStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px",
  fontSize: "13px",
  fontWeight: "600",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "rgba(0,0,0,0.12)",
  color: "rgba(230,247,255,0.55)",
  cursor: "not-allowed",
};

const disabledSelectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.22)",
  border: "none",
  padding: "10px 10px",
  borderRadius: "8px",
  color: "rgba(255,255,255,0.7)",
  cursor: "not-allowed",
};

const metricsCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.14)",
  borderRadius: "10px",
  padding: "10px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const metricRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "15px",
};

const deltaStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "rgba(255,255,255,0.9)",
};

const errorStyle: React.CSSProperties = {
  color: "#fff",
  background: "rgba(0,0,0,0.25)",
  padding: "8px",
  borderRadius: 8,
  fontSize: 13,
};

const submitButtonStyle: React.CSSProperties = {
  backgroundColor: "#22C6FF",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.45)",
  padding: "10px 14px",
  borderRadius: "999px",
  fontWeight: "700",
  fontSize: "15px",
  cursor: "pointer",
  width: "100%",
};

const spotsCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.14)",
  borderRadius: "10px",
  padding: "10px",
};

const spotsTitleStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "6px",
};

const spotsListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  fontSize: "12px",
};

const spotItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const spotDotStyle: React.CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "999px",
  background: "#FFA500",
  display: "inline-block",
};

const spotPlaceholderStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.8)",
};
