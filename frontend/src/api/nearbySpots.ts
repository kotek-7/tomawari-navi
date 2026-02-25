import type { NearbySpotsRequest, NearbySpotsResponse } from "../types/nearby";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:8000" : "/api");

function buildApiUrl(base: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (base.startsWith("http://") || base.startsWith("https://")) {
    return new URL(normalizedPath, base).toString();
  }
  const normalizedBase = base.startsWith("/") ? base : `/${base}`;
  return `${normalizedBase.replace(/\/+$/, "")}${normalizedPath}`;
}

export async function nearbySpots(
  body: NearbySpotsRequest,
  timeoutMs = 10000,
  apiBase = API_BASE,
): Promise<NearbySpotsResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildApiUrl(apiBase, "/v1/spots:nearby"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Backend error ${response.status}: ${detail}`);
    }

    return (await response.json()) as NearbySpotsResponse;
  } finally {
    clearTimeout(timer);
  }
}
