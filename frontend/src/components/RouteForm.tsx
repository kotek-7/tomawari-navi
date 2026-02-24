import { useState } from "react";
import type { RouteData } from "../types/route";
import { MOCK_ROUTE_DATA } from "../testData";

interface RouteFormProps {
  onRouteGenerated: (d: RouteData) => void;
  resultData: RouteData | null;
}

export default function RouteForm({ onRouteGenerated, resultData }: RouteFormProps) {
  const [loading, setLoading] = useState(false);
  const [targetType, setTargetType] = useState<"distance" | "time">("distance");
  const [targetValue, setTargetValue] = useState("30");

  const handleSearch = () => {
    setLoading(true);
    setTimeout(() => {
      onRouteGenerated(MOCK_ROUTE_DATA);
      setLoading(false);
    }, 1200);
  };

  return (
    <div style={panelStyle}>
      {/* 1. 目的地・出発地（左側のインジケーターを白で再現） */}
      <div style={locationSection}>
        <div style={lineIndicator}>
          <div style={circleFull} />
          <div style={dotLine} />
          <div style={circleEmpty} />
        </div>
        <div style={inputGroup}>
          <div style={inputField}>
            <span style={inputLabel}>目的地</span>
            <input style={textInput} defaultValue="金閣寺" />
          </div>
          <div style={{ ...inputField, marginTop: "10px" }}>
            <span style={inputLabel}>出発地</span>
            <input style={textInput} defaultValue="現在地" />
          </div>
        </div>
      </div>

      {/* 2. 遠回りルート設定 */}
      <div style={row}>
        <span style={rowLabel}>遠回りルート</span>
        <select style={mainSelect}>
          <option>健康</option>
          <option>観光</option>
        </select>
      </div>

      {/* 3. 時間/距離設定 */}
      <div style={row}>
        <span 
          style={rowLabel} 
          onClick={() => setTargetType(targetType === "distance" ? "time" : "distance")}
        >
          {targetType === "distance" ? "距離" : "時間"}
        </span>
        <div style={targetInputWrapper}>
          <input 
            type="number" 
            style={smallNumberInput} 
            value={targetValue} 
            onChange={(e) => setTargetValue(e.target.value)} 
          />
          <span style={unitText}>{targetType === "distance" ? "km" : "分"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={rowLabel}>カテゴリ</span>
          <select style={subSelect}>
            <option>指定なし</option>
            <option>神社・寺</option>
            <option>自然</option>
          </select>
        </div>
      </div>

      {/* 4. 解析結果表示（画像通りの白カード） */}
      {resultData && !loading && (
        <div style={resultCard}>
          <div style={resultRow}>
            <span style={resTitle}>推定歩数</span>
            <span style={resValue}>2400 <small style={resUnit}>歩</small></span>
            <span style={resDiff}>最短距離より <span style={blueText}>+1200</span> 歩</span>
          </div>
          <div style={resRowDivider} />
          <div style={resultRow}>
            <span style={resTitle}>消費カロリー</span>
            <span style={resValue}>100 <small style={resUnit}>cal</small></span>
            <span style={resDiff}>最短距離より <span style={blueText}>+50</span> cal</span>
          </div>
        </div>
      )}

      {/* 5. 検索ボタン（画像通りの青枠・白文字デザイン） */}
      <button 
        style={{ ...searchButton, opacity: loading ? 0.7 : 1 }} 
        onClick={handleSearch}
        disabled={loading}
      >
        {loading ? "解析中..." : "検索"}
      </button>
    </div>
  );
}

// --- 画像の配色を完全再現 ---

const panelStyle: React.CSSProperties = {
  width: "360px",
  backgroundColor: "#3182F9", // 画像のベースカラー
  padding: "20px",
  borderRadius: "16px",
  color: "white",
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
  pointerEvents: "auto",
};

const locationSection: React.CSSProperties = { display: "flex", gap: "12px", alignItems: "center" };

const lineIndicator: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", width: "16px"
};
const circleFull: React.CSSProperties = { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "white" };
const circleEmpty: React.CSSProperties = { width: "10px", height: "10px", borderRadius: "50%", border: "2px solid white" };
const dotLine: React.CSSProperties = { width: "2px", height: "24px", borderLeft: "2px dotted white" };

const inputGroup: React.CSSProperties = { flex: 1 };
const inputField: React.CSSProperties = { 
  backgroundColor: "rgba(255, 255, 255, 0.25)", // 入力欄の透過白
  padding: "10px 14px", 
  borderRadius: "8px", 
  display: "flex", 
  alignItems: "center" 
};
const inputLabel: React.CSSProperties = { fontSize: "11px", fontWeight: "bold", color: "rgba(255,255,255,0.8)", width: "50px" };
const textInput: React.CSSProperties = { background: "none", border: "none", outline: "none", fontWeight: "bold", fontSize: "15px", color: "white", flex: 1 };

const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const rowLabel: React.CSSProperties = { fontSize: "12px", fontWeight: "bold", color: "white" };

const mainSelect: React.CSSProperties = { 
  width: "180px", padding: "8px", borderRadius: "8px", border: "1px solid white", 
  backgroundColor: "rgba(255,255,255,0.1)", color: "white", fontWeight: "bold", outline: "none" 
};

const subSelect: React.CSSProperties = { 
  width: "110px", padding: "6px", borderRadius: "8px", border: "1px solid white", 
  backgroundColor: "rgba(255,255,255,0.1)", color: "white", fontSize: "11px", fontWeight: "bold", outline: "none"
};

const targetInputWrapper: React.CSSProperties = { display: "flex", alignItems: "center", gap: "6px" };
const smallNumberInput: React.CSSProperties = { 
  width: "55px", padding: "6px", borderRadius: "8px", border: "none", textAlign: "center", 
  fontWeight: "bold", backgroundColor: "rgba(255,255,255,0.3)", color: "white" 
};
const unitText: React.CSSProperties = { fontSize: "12px", fontWeight: "bold" };

const resultCard: React.CSSProperties = { 
  backgroundColor: "white", // 結果エリアの白背景
  padding: "16px", 
  borderRadius: "12px", 
  color: "#3182F9" // カード内テキストの青
};
const resultRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline" };
const resTitle: React.CSSProperties = { fontSize: "11px", fontWeight: "bold", width: "80px" };
const resValue: React.CSSProperties = { fontSize: "20px", fontWeight: "900", textAlign: "right", flex: 1, marginRight: "10px" };
const resUnit: React.CSSProperties = { fontSize: "11px", fontWeight: "bold" };
const resDiff: React.CSSProperties = { fontSize: "9px", color: "#60A5FA", width: "95px", textAlign: "right", fontWeight: "bold" };
const blueText: React.CSSProperties = { color: "#3182F9" };
const resRowDivider: React.CSSProperties = { height: "1px", backgroundColor: "#f0f0f0", margin: "10px 0" };

const searchButton: React.CSSProperties = {
  width: "100%", padding: "14px", borderRadius: "100px", border: "2px solid white",
  backgroundColor: "transparent", color: "white", fontWeight: "bold", fontSize: "16px", cursor: "pointer"
};