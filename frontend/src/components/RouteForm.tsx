import { useState } from "react";

export default function RouteForm() {
  const [targetType, setTargetType] = useState<"time" | "calories">("time");
  const [priority, setPriority] = useState<"health" | "sightseeing">("health");

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

      <button style={submitButtonStyle}>
        ルートを生成する
      </button>
    </div>
  );
}

// --- Styles (Fast Refreshエラー防止のためexportしない) ---

const containerStyle: React.CSSProperties = {
  width: "340px",
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  padding: "32px 24px",
  borderRadius: "24px",
  boxShadow: "0 20px 40px rgba(0,0,0,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  border: "1px solid rgba(255, 255, 255, 0.4)",
};

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "700",
  color: "#888",
  letterSpacing: "0.05em",
  marginBottom: "8px",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const inputStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  borderBottom: "1px solid #eee",
  padding: "8px 0",
  fontSize: "15px",
  color: "#1d1d1f",
  outline: "none",
};

const numberInputStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  fontSize: "32px",
  fontWeight: "700",
  width: "120px",
  outline: "none",
  color: "#1d1d1f",
};

const unitStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#888",
};

const segmentContainerStyle: React.CSSProperties = {
  display: "flex",
  backgroundColor: "#f2f2f7",
  padding: "4px",
  borderRadius: "12px",
};

const activeSegmentStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px",
  fontSize: "13px",
  fontWeight: "600",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "#fff",
  color: "#000",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  cursor: "pointer",
};

const inactiveSegmentStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px",
  fontSize: "13px",
  fontWeight: "500",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "transparent",
  color: "#8e8e93",
  cursor: "pointer",
};

const priorityContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const activePriorityStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "13px",
  fontWeight: "600",
  borderRadius: "12px",
  border: "2px solid #000",
  backgroundColor: "#000",
  color: "#fff",
  cursor: "pointer",
  textAlign: "left",
};

const inactivePriorityStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "13px",
  fontWeight: "500",
  borderRadius: "12px",
  border: "2px solid #eee",
  backgroundColor: "#fff",
  color: "#444",
  cursor: "pointer",
  textAlign: "left",
};

const submitButtonStyle: React.CSSProperties = {
  backgroundColor: "#007AFF",
  color: "#fff",
  border: "none",
  padding: "18px",
  borderRadius: "16px",
  fontWeight: "700",
  fontSize: "15px",
  cursor: "pointer",
  marginTop: "8px",
};