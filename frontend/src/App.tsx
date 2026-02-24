import { useState } from "react";
import Map from "./components/Map";
import RouteForm from "./components/RouteForm";
import type { RouteData } from "./types/route";

export default function App() {
  // バックエンドから届くルートデータを管理
  const [routeData, setRouteData] = useState<RouteData | null>(null);

  return (
    <div style={appContainerStyle}>
      {/* 1. 地図レイヤー（全画面） */}
      <div style={mapLayerStyle}>
        <Map routeData={routeData} />
      </div>

      {/* 2. UIレイヤー（フォームを左上に配置） */}
      <div style={uiLayerStyle}>
        <RouteForm 
          onRouteGenerated={(data) => setRouteData(data)} 
          resultData={routeData} 
        />
      </div>

      {/* 3. Googleロゴなどのオーバーレイ調整用（必要に応じて） */}
      <style>{`
        .gm-style-cc { display: none !important; } /* 著作権表示をスッキリさせる場合（規約注意） */
        .fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// --- スタイル定義 ---

const appContainerStyle: React.CSSProperties = {
  position: "relative",
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
  backgroundColor: "#e5e7eb", // 地図読み込み前の背景色
};

const mapLayerStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  zIndex: 1,
};

const uiLayerStyle: React.CSSProperties = {
  position: "absolute",
  top: "20px",
  left: "20px",
  zIndex: 10, // 地図より前面に
  pointerEvents: "none", // 下の地図を操作できるように、このレイヤー自体は透過（中身のフォームは後述で戻す）
};

/* 注: UIレイヤー内の各コンポーネントで pointerEvents: "auto" を設定する必要があります。
   RouteForm の panelStyle に追加してください。 */