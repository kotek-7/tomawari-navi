import type { RouteData } from "./types/route";

// 軽量なフロントエンド ⇄ バックエンド API クライアント
// - フロントエンド担当者がバックエンド通信の挙動を理解・保守しやすいよう、
//   関数ごとに詳細な日本語コメントを付けています。
// - 環境変数 VITE_API_BASE_URL が設定されていればそれを使用します。
// - 未設定時は、開発環境のみ localhost:8000、本番環境は /api を既定にします。
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:8000" : "/api");

export type RankingItem = {
  spot_name: string;
  count: number;
};

type RankingResponse = {
  area: string | null;
  q: string | null;
  items: RankingItem[];
};

// ヘルパー: AbortController を使ったタイムアウト付き fetch
// - 目的: ネットワーク要求が長時間ブロックされるのを防ぎ、UI を応答可能に保つ。
// - 使い方: fetchWithTimeout(url, options, timeoutMs)
//   - timeoutMs ミリ秒経過でリクエストを中断し AbortError を発生させる。
//   - 呼び出し側は try/catch でタイムアウトやネットワークエラーに対応すること。
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// healthCheck
// - /health エンドポイントに GET し、サービスが "利用可能かどうか" を boolean で返す。
// - UI 側は短いタイムアウト（デフォルト 2000ms）でヘルスチェックして、失敗時は
//   ユーザーに待たせずモック表示にフォールバックすることを想定している。
// - ネットワークエラーやタイムアウトは false として扱い、例外は呼び出し元へ伝播させない。
export async function healthCheck(timeoutMs = 2000): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(buildApiUrl("/health"), { method: "GET" }, timeoutMs);
    return res.ok;
  } catch (e) {
    // ネットワークエラー・タイムアウトは "サービス不可" と見なす（UI はフォールバックする）
    return false;
  }
}

// detourRoute
// - POST /v1/routes:detour に経路リクエストを送信し、成功時にパース済みの JSON オブジェクトを返す。
// - エラーの扱い:
//   - ネットワークエラー / タイムアウト -> 例外を投げる
//   - HTTP ステータスが OK でない -> レスポンス本文を読み取り Error を投げる（デバッグ情報として有用）
//   - JSON 解析エラー -> 例外を投げる
// - 呼び出し側は try/catch で例外を受け、必要に応じてモック表示やユーザー向けエラーメッセージを実装する。
// - timeoutMs の既定は 15000ms にしているが、処理時間に合わせて引数で調整すること。
export async function detourRoute(body: any, timeoutMs = 150000): Promise<RouteData> {
  // 送信する JSON をブラウザのコンソールに出力します。
  // - 開発中に "どんな JSON を backend に送っているか" を素早く確認できるようにする目的です。
  // - 本番環境でログを抑制したい場合は環境変数を参照して条件付きで出力する実装に変えてください。
  try {
    // オブジェクトそのままとシリアライズした文字列を両方出力することで
    // オブジェクトの構造と実際に送信される JSON 文字列（エスケープを含む）を確認できます。
    console.log("[API] detourRoute - request object:", body);
    try {
      // console.log を使うことでブラウザのデフォルトログフィルタでも表示されやすくする
      console.log("[API] detourRoute - request JSON:", JSON.stringify(body));
    } catch (e) {
      // JSON.stringify が失敗する可能性があるため保険
      console.warn("[API] detourRoute - request JSON stringify failed", e);
    }
  } catch (e) {
    // ログ出力は副作用なので失敗しても処理を止めない
    console.warn("[API] detourRoute - logging failed", e);
  }

  const res = await fetchWithTimeout(
    buildApiUrl("/v1/routes:detour"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs
  );

  if (!res.ok) {
    // 非 OK レスポンスの本文を読み取り、呼び出し元で原因特定しやすいよう Error を投げる。
    const text = await res.text().catch(() => "");
    // エラー時のレスポンス内容もログに出力してデバッグを助ける
    console.error(`[API] detourRoute - backend returned ${res.status}:`, text);
    throw new Error(`Backend error ${res.status}: ${text}`);
  }

  // 成功時は JSON を返す（パースに失敗すると例外が発生する）。
  const data = await res.json() as RouteData;

  // 受信した JSON をログに出力（構造確認用）
  try {
    console.debug("[API] detourRoute - response:", data);
  } catch (e) {
    console.warn("[API] detourRoute - response logging failed", e);
  }

  return data;
}

export async function fetchRankingSuggestions(q: string, limit = 8, timeoutMs = 4000): Promise<RankingItem[]> {
  const keyword = q.trim();
  if (!keyword) {
    return [];
  }

  const endpoint = buildApiUrl("/v1/ranking");
  const params = new URLSearchParams({ q: keyword, limit: String(limit) });
  const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}${params.toString()}`;

  const res = await fetchWithTimeout(url, { method: "GET" }, timeoutMs);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Backend error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as RankingResponse;
  return data.items ?? [];
}
function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (API_BASE.startsWith("http://") || API_BASE.startsWith("https://")) {
    return new URL(normalizedPath, API_BASE).toString();
  }
  const base = API_BASE.startsWith("/") ? API_BASE : `/${API_BASE}`;
  return `${base.replace(/\/+$/, "")}${normalizedPath}`;
}
