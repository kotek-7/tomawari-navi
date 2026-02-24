import { useState } from "react";
import { MOCK_ROUTE_DATA } from "../testData";

export default function RouteForm({ onSubmit }: { onSubmit?: (data: any) => void }) {
  const [targetType, setTargetType] = useState<"time" | "calories">("time");
  const [priority, setPriority] = useState<"health" | "sightseeing">("health");
  const [showResult, setShowResult] = useState(false);
  const [predictedTime, setPredictedTime] = useState<number>(45);
  const [predictedCalories, setPredictedCalories] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

  return (
    <div style={containerStyle}>
      {/* 経路入力セクション */}
      <div style={sectionStyle}>
        <div style={inputGroupStyle}>
          <label style={labelStyle}>出発地</label>
          <input type="text" placeholder="現在の場所、または駅名" style={inputStyle} />
        </div>
        
        <div style={inputGroupStyle}>
          <label style={labelStyle}>目的地</label>
          <input type="text" placeholder="目的地を入力" style={inputStyle} />
        </div>
      </div>

      {/* 目標設定の切り替え */}
      <div style={inputGroupStyle}>
        <label style={labelStyle}>目標設定</label>
        <div style={segmentContainerStyle}>
          <button 
            onClick={() => setTargetType("time")}
            style={targetType === "time" ? activeSegmentStyle : inactiveSegmentStyle}
          >
            時間
          </button>
          <button 
            onClick={() => setTargetType("calories")}
            style={targetType === "calories" ? activeSegmentStyle : inactiveSegmentStyle}
          >
            カロリー
          </button>
        </div>
      </div>

      {/* 数値入力エリア */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", padding: "8px 0" }}>
        <input 
          type="number" 
          placeholder={targetType === "time" ? "60" : "300"} 
          style={numberInputStyle} 
        />
        <span style={unitStyle}>
          {targetType === "time" ? "分" : "kcal"}
        </span>
      </div>

      {/* 重視する項目の選択（セグメントコントロール形式） */}
      <div style={inputGroupStyle}>
        <label style={labelStyle}>重視する項目</label>
        <div style={priorityContainerStyle}>
          <button 
            onClick={() => setPriority("health")}
            style={priority === "health" ? activePriorityStyle : inactivePriorityStyle}
          >
            健康 (坂道・運動量)
          </button>
          <button 
            onClick={() => setPriority("sightseeing")}
            style={priority === "sightseeing" ? activePriorityStyle : inactivePriorityStyle}
          >
            観光 (名所・景観)
          </button>
        </div>
      </div>

      {showResult && (
        <div style={resultCardStyle}>
          <div style={resultRowStyle}><span style={resultLabelStyle}>推定時間</span><span style={resultValueStyle}>{predictedTime} 分</span></div>
          <div style={resultRowStyle}><span style={resultLabelStyle}>消費カロリー</span><span style={resultValueStyle}>{predictedCalories} kcal</span></div>
        </div>
      )}

      {errorMessage && <div style={{color:'#fff',background:'rgba(0,0,0,0.25)',padding:'8px',borderRadius:8,fontSize:13}}>{errorMessage}</div>}
      <button onClick={async () => {
        try {
          setLoading(true);
          setErrorMessage("");
          // quick health check with timeout
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2000);
          let healthy = false;
          try {
            const h = await fetch(`${apiBase}/health`, { signal: controller.signal });
            healthy = h.ok;
          } catch (e) {
            healthy = false;
          } finally {
            clearTimeout(timeout);
          }

          if (!healthy) {
            setErrorMessage('バックエンドに接続できません。モックを使用します。');
            // fallback to MOCK immediately
            setPredictedTime(MOCK_ROUTE_DATA.summary.total_duration_min);
            setPredictedCalories(MOCK_ROUTE_DATA.summary.calories_kcal);
            setShowResult(true);
            onSubmit?.(MOCK_ROUTE_DATA);
            return;
          }

          // send request to backend using mock origin/destination from docs-derived mock
          const body = {
            origin: MOCK_ROUTE_DATA.origin,
            destination: MOCK_ROUTE_DATA.destination,
            genre: "sightseeing",
            start_time_iso: null,
            weight_kg: 60.0
          };
          const res = await fetch(`${apiBase}/v1/routes:detour`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          // show summary in the UI
          const mins = Math.round((data.summary?.duration_s || 0) / 60);
          setPredictedTime(mins || MOCK_ROUTE_DATA.summary.total_duration_min);
          setPredictedCalories(data.summary?.calories_kcal || MOCK_ROUTE_DATA.summary.calories_kcal);
          setShowResult(true);
          // propagate full route data to parent
          onSubmit?.(data);
        } catch (err) {
          console.error("route request failed", err);
          setErrorMessage('バックエンド通信中にエラーが発生しました。モックを使用します。');
          // fallback to MOCK
          setPredictedTime(MOCK_ROUTE_DATA.summary.total_duration_min);
          setPredictedCalories(MOCK_ROUTE_DATA.summary.calories_kcal);
          setShowResult(true);
          onSubmit?.(MOCK_ROUTE_DATA);
        } finally {
          setLoading(false);
        }
      }} style={submitButtonStyle}>
        {loading ? "生成中..." : "ルートを生成する"}
      </button>
    </div>
  );
}

// --- Styles (Fast Refreshエラー防止のためexportしない) ---

const containerStyle: React.CSSProperties = {
  width: "300px",
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
  gap: "16px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "700",
  color: "#E6F7FF",
  letterSpacing: "0.05em",
  marginBottom: "8px",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.14)",
  border: "none",
  padding: "8px 10px",
  fontSize: "14px",
  color: "#000",
  borderRadius: "8px",
  outline: "none",
};

const numberInputStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  fontSize: "28px",
  fontWeight: "700",
  width: "120px",
  outline: "none",
  color: "#000",
};

const unitStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#E6F7FF",
};

const segmentContainerStyle: React.CSSProperties = {
  display: "flex",
  backgroundColor: "rgba(255,255,255,0.12)",
  padding: "6px",
  borderRadius: "10px",
};

const activeSegmentStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px",
  fontSize: "13px",
  fontWeight: "600",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "rgba(255,255,255,0.25)",
  color: "#fff",
  boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
  cursor: "pointer",
};

const inactiveSegmentStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px",
  fontSize: "13px",
  fontWeight: "500",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "transparent",
  color: "rgba(230,247,255,0.95)",
  cursor: "pointer",
};

const priorityContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: "8px",
  justifyContent: "space-between",
};

const activePriorityStyle: React.CSSProperties = {
  padding: "10px",
  fontSize: "13px",
  fontWeight: "600",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.25)",
  backgroundColor: "rgba(255,255,255,0.18)",
  color: "#fff",
  cursor: "pointer",
  textAlign: "center",
};

const inactivePriorityStyle: React.CSSProperties = {
  padding: "10px",
  fontSize: "13px",
  fontWeight: "500",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "transparent",
  color: "rgba(230,247,255,0.95)",
  cursor: "pointer",
  textAlign: "center",
};

const submitButtonStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  color: "#1E90FF",
  border: "none",
  padding: "10px 14px",
  borderRadius: "10px",
  fontWeight: "700",
  fontSize: "15px",
  cursor: "pointer",
  marginTop: "8px",
  boxShadow: "0 6px 18px rgba(30,144,255,0.18)",
  width: "100%",
};

const resultCardStyle: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.12)",
  padding: "10px",
  borderRadius: "10px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const resultRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const resultLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#E6F7FF",
};

const resultValueStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  color: "#fff",
};