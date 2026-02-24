import { useEffect, useMemo, useRef, useState } from "react";
import { detourRoute, fetchRankingSuggestions, type RankingItem } from "../api";
import type { RouteData } from "../types/route";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

type PanelMode = "collapsed" | "basic" | "full";

type RouteFormProps = {
  onSubmit?: (data: RouteData) => void;
  onSearchStart?: () => void;
  onSearchSuccess?: () => void;
  onSearchError?: () => void;
};

export default function RouteForm({ onSubmit, onSearchStart, onSearchSuccess, onSearchError }: RouteFormProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [originText, setOriginText] = useState<string>("同志社大学");
  const [destinationText, setDestinationText] = useState<string>("京都市役所");
  const [targetMinutesText, setTargetMinutesText] = useState<string>("60");
  const [lastRoute, setLastRoute] = useState<RouteData | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("collapsed");
  const [suggestions, setSuggestions] = useState<RankingItem[]>([]);
  const [isDestinationFocused, setIsDestinationFocused] = useState(false);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const rankingRequestSeqRef = useRef(0);

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

  useEffect(() => {
    if (panelMode !== "basic" || loading) return;

    function handlePointerDown(event: PointerEvent) {
      const root = rootRef.current;
      const target = event.target as Node | null;
      if (!root || !target) return;
      if (root.contains(target)) return;
      setPanelMode("collapsed");
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [loading, panelMode]);

  useEffect(() => {
    if (panelMode === "collapsed") {
      setIsDestinationFocused(false);
    }
  }, [panelMode]);

  useEffect(() => {
    if (!isDestinationFocused) {
      setSuggestions([]);
      return;
    }
    const keyword = destinationText.trim();
    if (!keyword) {
      setSuggestions([]);
      return;
    }

    const seq = ++rankingRequestSeqRef.current;
    const timer = window.setTimeout(async () => {
      try {
        setIsSuggestLoading(true);
        const items = await fetchRankingSuggestions(keyword, 8);
        if (rankingRequestSeqRef.current !== seq) return;
        setSuggestions(items);
      } catch {
        if (rankingRequestSeqRef.current !== seq) return;
        setSuggestions([]);
      } finally {
        if (rankingRequestSeqRef.current !== seq) return;
        setIsSuggestLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [destinationText, isDestinationFocused]);

  function selectSuggestion(spotName: string) {
    setDestinationText(spotName);
    setSuggestions([]);
    setIsDestinationFocused(false);
  }

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
      onSearchStart?.();

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
      onSearchSuccess?.();
      setIsDestinationFocused(false);
      setPanelMode("collapsed");
    } catch (err) {
      console.error("route request failed", err);
      const rawMsg = err instanceof Error ? err.message : String(err);
      setErrorMessage(rawMsg);
      onSearchError?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={panelMode === "collapsed" ? "mx-auto w-full max-w-md" : "mx-auto w-full max-w-md rounded-3xl border border-white/30 bg-sky-500/95 p-4 text-white shadow-[0_8px_28px_rgba(0,0,0,0.28)] backdrop-blur-sm"}
    >
      {panelMode === "collapsed" ? (
        <div>
          <label className="mb-1 block text-xs font-bold tracking-[0.03em] text-white/90">目的地</label>
          <div className="relative">
            <input
              value={destinationText}
              onChange={(e) => setDestinationText(e.target.value)}
              onFocus={() => {
                setPanelMode("basic");
                setIsDestinationFocused(true);
              }}
              onBlur={() => {
                window.setTimeout(() => setIsDestinationFocused(false), 120);
              }}
              type="text"
              placeholder="目的地を入力"
              className="w-full rounded-xl border-4 border-sky-500/90 bg-white py-2 pl-10 pr-28 text-base text-gray-800 shadow-[0_4px_14px_rgba(0,0,0,0.16)] outline-none placeholder:text-black/30"
            />
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-red-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 -960 960 960"
                className="h-[24px] w-[24px] drop-shadow-[0_2px_2px_rgba(0,0,0,0.1)]"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M536.5-503.5Q560-527 560-560t-23.5-56.5Q513-640 480-640t-56.5 23.5Q400-593 400-560t23.5 56.5Q447-480 480-480t56.5-23.5ZM480-80Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Z" />
              </svg>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1 text-xs font-semibold text-black/35">
              <span>遠回り検索！</span>
              <span>▸</span>
            </div>
            {isDestinationFocused && destinationText.trim() && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[10000] max-h-56 overflow-auto rounded-xl border border-sky-200 bg-white py-1 text-gray-800 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
                {suggestions.map((item) => (
                  <button
                    key={`${item.spot_name}-${item.count}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(item.spot_name)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-sky-50"
                  >
                    <span>{item.spot_name}</span>
                    <span className="text-xs text-gray-500">{item.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex justify-center">
            <span className="h-1.5 w-10 rounded-full bg-white/60" />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-bold tracking-[0.03em] text-sky-100">出発地</label>
              <input
                value={originText}
                onChange={(e) => setOriginText(e.target.value)}
                type="text"
                placeholder="例: 同志社大学"
                className="h-10 w-full rounded-xl border-none px-3 text-base text-gray-800 outline-none placeholder:text-black/30"
              />
            </div>
            <button
              type="button"
              aria-label={panelMode === "full" ? "追加項目を閉じる" : "追加項目を開く"}
              onClick={() =>
                setPanelMode((prev) => {
                  if (prev === "collapsed") return "basic";
                  if (prev === "basic") return "full";
                  return "basic";
                })
              }
              className="mb-0.5 h-8 w-8 shrink-0 rounded-full border border-white/60 bg-white/20 text-sm font-bold"
            >
              {panelMode === "full" ? "▾" : "▴"}
            </button>
          </div>
        </>
      )}

      {panelMode !== "collapsed" && (
        <div className="relative mt-2 space-y-3">
          <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2">
            <div className="flex flex-col items-center gap-1 text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className="relative">
              <label className="mb-1 block text-xs font-bold tracking-[0.03em] text-sky-100">目的地</label>
              <input
                value={destinationText}
                onChange={(e) => setDestinationText(e.target.value)}
                onFocus={() => setIsDestinationFocused(true)}
                onBlur={() => {
                  window.setTimeout(() => setIsDestinationFocused(false), 120);
                }}
                type="text"
                placeholder="目的地を入力"
                className="h-10 w-full rounded-xl border-none px-3 text-base text-gray-800 outline-none placeholder:text-black/30"
              />
              {isDestinationFocused && destinationText.trim() && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[10000] max-h-56 overflow-auto rounded-xl border border-sky-200 bg-white py-1 text-gray-800 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
                  {suggestions.map((item) => (
                    <button
                      key={`${item.spot_name}-${item.count}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectSuggestion(item.spot_name)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-sky-50"
                    >
                      <span>{item.spot_name}</span>
                      <span className="text-xs text-gray-500">{item.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold tracking-[0.03em] text-sky-100">時間</label>
              <div className="flex items-baseline gap-1">
                <input
                  type="number"
                  min={10}
                  max={240}
                  step={10}
                  value={targetMinutesText}
                  onChange={(e) => setTargetMinutesText(e.target.value)}
                  className="h-10 w-20 rounded-xl border-none px-3 text-base font-bold text-gray-800 outline-none"
                />
                <span className="text-sm font-bold text-sky-100">分</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-full border border-white/45 bg-orange-400 px-3.5 py-2 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "遠回り検索中……" : "遠回り検索"}
          </button>
        </div>
      )}

      {panelMode === "full" && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-col">
            <label className="mb-2 text-xs font-bold tracking-[0.03em] text-sky-100">遠回りルート</label>
            <div className="flex gap-1.5 rounded-[10px] border border-white p-1.5">
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
            <div className="w-fit">
              <label className="mb-2 block text-xs font-bold tracking-[0.03em] text-sky-100">カテゴリ</label>
              <select
                value="none"
                disabled
                className="cursor-not-allowed rounded-lg border border-white bg-transparent px-2 py-1 text-sm text-white/80 outline-none"
              >
                <option value="none">指定なし</option>
                <option value="temple">神社・寺</option>
                <option value="local">ローカルなお店</option>
                <option value="nature">自然</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-0.5 rounded-[10px] border border-white p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span>推定歩数</span>
              <strong>{mockMetrics.steps.toLocaleString()} 歩</strong>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>消費カロリー</span>
              <strong>{mockMetrics.calories} cal</strong>
            </div>
            <div className="text-xs text-white/90">最短距離より +{mockMetrics.detourDeltaM} m</div>
          </div>

          <div className="rounded-[10px] bg-white/15 p-2.5">
            <div className="text-xs font-bold">スポット</div>
            <div className="mt-2 flex max-h-40 flex-col gap-2 overflow-auto pr-1 text-sm">
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
      )}

      {errorMessage && <div className="mt-3 rounded-lg bg-black/25 p-2 text-[13px] text-white">{errorMessage}</div>}
    </div>
  );
}
