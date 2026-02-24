import { useMemo, useState } from "react";
import { detourRoute } from "../api";
import type { RouteData } from "../types/route";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export default function RouteForm({ onSubmit }: { onSubmit?: (data: RouteData) => void }) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [originText, setOriginText] = useState<string>("同志社大学");
  const [destinationText, setDestinationText] = useState<string>("京都市役所");
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
    <div className="flex w-80 flex-col gap-3 rounded-xl bg-sky-500 p-4 text-white shadow-[0_8px_20px_rgba(0,0,0,0.16)]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <label className="mb-2 text-xs font-bold tracking-[0.03em] text-sky-100">出発地</label>
          <input
            value={originText}
            onChange={(e) => setOriginText(e.target.value)}
            type="text"
            placeholder="例: 同志社大学"
            className="rounded-lg border-none px-3 py-1.5 text-lg text-gray-800 outline-none placeholder:text-black/20 shadow-inner"
          />
        </div>

        <div className="flex flex-col">
          <label className="mb-2 text-xs font-bold tracking-[0.03em] text-sky-100">目的地</label>
          <input
            value={destinationText}
            onChange={(e) => setDestinationText(e.target.value)}
            type="text"
            placeholder="目的地を入力"
            className="rounded-lg border-none px-3 py-1.5 text-lg text-gray-800 outline-none placeholder:text-black/20 shadow-inner"
          />
        </div>
      </div>

      <div className="flex flex-col">
        <label className="mb-2 text-xs font-bold tracking-[0.03em] text-sky-100">遠回りルート</label>
        <div className="flex gap-1.5 rounded-[10px] border-white border p-1.5">
          <button type="button" className="flex-1 cursor-default rounded-lg bg-white/25 px-2 py-1 text-sm font-bold">
            観光
          </button>
          <button
            type="button"
            disabled
            className="flex-1 cursor-not-allowed rounded-lg bg-black/15 px-2 py-1 text-sm font-semibold text-sky-100/60"
          >
            健康
          </button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col w-fit">
          <label className="mb-2 text-xs font-bold tracking-[0.03em] text-sky-100">カテゴリ</label>
          <select
            value="none"
            disabled
            className="bg-transparent cursor-not-allowed rounded-lg text-sm border border-white px-2 py-1 text-white/80 outline-none"
          >
            <option value="none">指定なし</option>
            <option value="temple">神社・寺</option>
            <option value="local">ローカルなお店</option>
            <option value="nature">自然</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="mb-2 text-xs font-bold tracking-[0.03em] text-sky-100 shadow-inner">時間</label>
          <div className="flex items-baseline gap-2">
            <div>
              <input
                type="number"
                min={10}
                max={240}
                value={targetMinutesText}
                onChange={(e) => setTargetMinutesText(e.target.value)}
                className="rounded-lg border-none bg-white px-4 py-2 text-4xl font-bold text-gray-800 max-w-28 outline-none"
              />
            </div>
            <div className="text-sm font-bold text-sky-100">分</div>
          </div>
        </div>

      </div>

      <div className="flex flex-col gap-0.5 rounded-[10px] border-white border p-2.5">
        <div className="flex items-center justify-between text-xs">
          <span>推定歩数</span>
          <strong>{mockMetrics.steps.toLocaleString()} 歩</strong>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span>消費カロリー</span>
          <strong>{mockMetrics.calories} cal</strong>
        </div>
        <div className="text-xs text-white/90">最短距離より +{mockMetrics.detourDeltaM} m（モック）</div>
      </div>

      {errorMessage && <div className="rounded-lg bg-black/25 p-2 text-[13px] text-white">{errorMessage}</div>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full rounded-full border border-white/45 bg-orange-400 px-3.5 py-2 text-xl font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "生成中..." : "検索"}
      </button>

      <div className="rounded-[10px] bg-white/15 p-2.5">
        <div className="text-xs font-bold">スポット</div>
        <div className="mt-2 flex max-h-52 flex-col gap-2 overflow-auto pr-1 text-sm">
          {[...(lastRoute?.via_spots ?? []), ...(lastRoute?.along_route_spots ?? [])].map((s, i) => (
            <div key={`${s.name ?? "spot"}-${i}`} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-200" />
              <span>{s.name ?? "スポット"}</span>
            </div>
          ))}
          {!lastRoute && <div className="text-white/80">まだ検索していません</div>}
        </div>
      </div>
    </div>
  );
}
