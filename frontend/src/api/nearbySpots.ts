import type { NearbySpotsRequest, NearbySpotsResponse } from "../types/nearby";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function nearbySpots(
  body: NearbySpotsRequest,
  timeoutMs = 10000,
  apiBase = API_BASE,
): Promise<NearbySpotsResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(new URL("/v1/spots:nearby", apiBase).toString(), {
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
