import { useState } from "react";
import { MOCK_ROUTE_DATA } from "../testData";
import { detourRoute } from "../api";
import type { RouteData } from "../types/route";


export default function RouteForm({ onSubmit }: { onSubmit?: (data: RouteData) => void }) {
  const [targetType, setTargetType] = useState<"time" | "calories">("time");
  const [priority, setPriority] = useState<"health" | "sightseeing">("health");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  // ユーザーが入力する地名（文字列）を保持する state
  // - 現状はテキスト入力で地名を受け取り、バックエンドへ地名形式で送信します。
  // - 将来的にジオコーディングをフロントエンドで行う場合は、ここで経度緯度を保持する形に変更してください。
  const [originText, setOriginText] = useState<string>("");
  const [destinationText, setDestinationText] = useState<string>("");

  return (
    <div style={containerStyle}>
      {/* 経路入力セクション */}
      <div style={sectionStyle}>
        <div style={inputGroupStyle}>
          <label style={labelStyle}>出発地</label>
          <input value={originText} onChange={(e) => setOriginText(e.target.value)} type="text" placeholder="現在の場所、または駅名（例: 京都駅）" style={inputStyle} />
        </div>
        
        <div style={inputGroupStyle}>
          <label style={labelStyle}>目的地</label>
          <input value={destinationText} onChange={(e) => setDestinationText(e.target.value)} type="text" placeholder="目的地を入力（例: 清水寺）" style={inputStyle} />
        </div>
      </div>

      {/* 目標設定の切り替え */}
      <div style={inputGroupStyle}>
        <label style={labelStyle}>標設定</label>
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

      {errorMessage && <div style={{color:'#fff',background:'rgba(0,0,0,0.25)',padding:'8px',borderRadius:8,fontSize:13}}>{errorMessage}</div>}
      <button onClick={async () => {
        try {
          setLoading(true);
          setErrorMessage("");
          // ヘルスチェックを行わず、直接リクエストを送信します（開発リクエストの要望に合わせた挙動）。
          // 長時間待たせずに確実に送信したい場合はここでタイムアウトや再試行の設計を追加してください。


          // リクエストボディを組み立てます（現状は docs 由来の MOCK_ROUTE_DATA を使用した簡易版です）。
          // 将来的には以下のフィールドをユーザー入力から組み立てる想定です:
          // - origin: { lat, lng }
          // - destination: { lat, lng }
          // - genre: string (例: "sightseeing")
          // - start_time_iso: ISO フォーマットの開始時刻文字列または null
          // - weight_kg: 数値（消費カロリー算出用）
          // API の型（backend の RouteRequest）に合わせてフィールドを揃えてください。
          // リクエストボディを組み立てます（地名を送信する仕様に変更）
          // - origin と destination は { name: string } の形式で送信します。
          // - バックエンド側で地名を受け取りジオコーディングする実装が必要になる点に注意してください。
          // 送信前の処理：モック座標を固定で送る仕様のため、入力テキストをジオコーディングしない。
          // 設定されたモック座標を常に送信する（入力に関係なく固定の座標を使う仕様）
          const body = {
            origin: { lat: MOCK_ROUTE_DATA.origin.lat, lng: MOCK_ROUTE_DATA.origin.lng, name: originText || MOCK_ROUTE_DATA.origin.name },
            destination: { lat: MOCK_ROUTE_DATA.destination.lat, lng: MOCK_ROUTE_DATA.destination.lng, name: destinationText || MOCK_ROUTE_DATA.destination.name },
            genre: "sightseeing",
            start_time_iso: null,
            weight_kg: 60.0,
          };

          // UI 層で送信前の内容を出力（必ず表示されるように console.log を使用）
          console.log('[UI] Sending detour request body (mock coords):', body);

          // 中央化した API クライアント detourRoute を使ってリクエストを送信します。
          // レスポンスはそのままコンソールに出力しておきます（デバッグ目的）。
          try {
            const resp = await detourRoute(body);
            console.log('[UI] detour response (raw):', resp);
            // 親コンポーネントへは API レスポンスをそのまま渡す
            onSubmit?.(resp as RouteData);
          } catch (e) {
            // detourRoute は既に内部で詳細ログを出すためここでは軽く扱う
            console.error('[UI] detour request failed', e);
            throw e;
          }
          // レスポンスは UI に反映しない（コンソールに出力のみ）
          return;
        } catch (err) {
          // 詳細なエラー情報をコンソールに出力して原因追跡を容易にします
          console.error("route request failed", err);
          const _err: any = err as any;
          const rawMsg = _err?.message || String(err);
          // バックエンドのエラーレスポンスに JSON が含まれている場合はパースして
          // ユーザーに分かりやすい要約メッセージを表示する。
          let userMessage = rawMsg;
          try {
            const jsonPart = rawMsg.replace(/^.*?:\s*/, '');
            const parsed = JSON.parse(jsonPart);
            if (parsed?.detail && Array.isArray(parsed.detail)) {
              // detail 配列から不足フィールドを抽出して日本語メッセージを作る
              const missingFields = parsed.detail
                .map((d: any) => {
                  const loc = Array.isArray(d.loc) ? d.loc.join('.') : String(d.loc);
                  const message = d.msg || '';
                  return `${loc} (${message})`;
                })
                .join(', ');
              userMessage = `バックエンドの入力検証エラー: ${missingFields}。入力候補から選択するか、正確な地名を入力してください。`;
            }
          } catch {
            // JSON パースに失敗したら生のメッセージをそのまま表示
            userMessage = rawMsg;
          }

          // UI にもエラーの概要を表示（ユーザーにわかりやすい日本語）
          setErrorMessage(userMessage);
          // 完全なエラーはコンソールに残す（デバッグ用）
          console.error('Full backend error:', err);
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
