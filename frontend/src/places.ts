// Kyoto places loader and search utility
// - Attempts to fetch a dataset from VITE_ODCS_URL (default: the URL you provided)
// - Supports GeoJSON (features with geometry.coordinates) and simple CSV with latitude/longitude columns
// - Exposes a simple searchPlaces(query) that returns matching places: { name, lat, lng }

export type Place = { name: string; lat: number; lng: number };

const DEFAULT_ODCS_URL = (import.meta as any).env?.VITE_ODCS_URL || "https://odcs.bodik.jp/260002/";
let cachedPlaces: Place[] | null = null;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.text();
}

async function loadPlaces(): Promise<Place[]> {
  if (cachedPlaces) return cachedPlaces;

  console.debug('[places] loadPlaces: attempting to load from', DEFAULT_ODCS_URL);

  // Try to fetch the URL and parse as JSON (GeoJSON) first
  try {
    const res = await fetch(DEFAULT_ODCS_URL, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      console.debug('[places] fetched content-type:', ct);
      if (ct.includes('application/json')) {
        const json = await res.json();
        // GeoJSON: features[] with properties and geometry.coordinates [lng, lat]
        if (Array.isArray(json.features)) {
          const places = json.features
            .map((f: any) => {
              const coords = f?.geometry?.coordinates;
              const props = f?.properties || {};
              if (!coords || coords.length < 2) return null;
              return { name: props.name || props['名称'] || props['name_jp'] || String(props), lat: coords[1], lng: coords[0] } as Place;
            })
            .filter(Boolean) as Place[];
          cachedPlaces = places;
          return cachedPlaces;
        }
        // fallback: if JSON is an array of objects with lat/lng
        if (Array.isArray(json)) {
          const places = json
            .map((o: any) => {
              const lat = o.lat ?? o.latitude ?? o['緯度'];
              const lng = o.lng ?? o.longitude ?? o['経度'];
              const name = o.name ?? o['名称'] ?? o['施設名'] ?? JSON.stringify(o);
              if (lat == null || lng == null) return null;
              return { name: String(name), lat: Number(lat), lng: Number(lng) } as Place;
            })
            .filter(Boolean) as Place[];
          cachedPlaces = places;
          return cachedPlaces;
        }
      }
    }
  } catch (e) {
    // ignore and try text parse
    console.warn('[places] JSON load failed', e);
  }

  // Try to fetch as CSV or plain text and parse simple CSV-like rows
  try {
    const text = await fetchText(DEFAULT_ODCS_URL);
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    // try to find header with lat/lon column names
    const header = lines[0].split(/,|\t|;/).map(h => h.replace(/^"|"$/g, '').trim());
    const latIdx = header.findIndex(h => /lat|緯度|latitude/i.test(h));
    const lonIdx = header.findIndex(h => /lon|lng|経度|longitude/i.test(h));
    const nameIdx = header.findIndex(h => /name|名称|施設名|名称_/i.test(h));
    if (latIdx >= 0 && lonIdx >= 0 && lines.length > 1) {
      const places: Place[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/,|\t|;/).map(c => c.replace(/^"|"$/g, '').trim());
        const lat = parseFloat(cols[latIdx]);
        const lng = parseFloat(cols[lonIdx]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const name = nameIdx >= 0 ? cols[nameIdx] : `${lat},${lng}`;
          places.push({ name, lat, lng });
        }
      }
      if (places.length > 0) {
        cachedPlaces = places;
        return cachedPlaces;
      }
    }
  } catch (e) {
    console.warn('[places] CSV/text load failed', e);
  }

  // Fallback: use a small built-in list of Kyoto sights so UI still works offline or when ODCS is not directly accessible.
  console.warn('[places] ODCS load failed or returned unparseable content. Using built-in fallback places.');
  const fallback: Place[] = [
    { name: '八坂神社', lat: 35.0037, lng: 135.7788 },
    { name: '錦市場', lat: 35.0043, lng: 135.7646 },
    { name: '鴨川', lat: 35.0116, lng: 135.7709 },
    { name: '二条城', lat: 35.0104, lng: 135.7539 },
  ];
  cachedPlaces = fallback;
  return cachedPlaces;
}

// Simple case-insensitive substring search over name. Returns top N results.
export async function searchPlaces(query: string, limit = 20): Promise<Place[]> {
  if (!query || query.trim().length === 0) return [];
  const places = await loadPlaces();
  const q = query.trim().toLowerCase();
  const results = places
    .filter(p => p.name.toLowerCase().includes(q))
    .slice(0, limit);
  return results;
}

export default { searchPlaces };
