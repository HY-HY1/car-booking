import type { ServiceArea } from "./config";

// Postcodes, distances and service areas. Coordinates come from postcodes.io
// (free, no key). Drive times are estimated from straight-line distance,
// which is good enough to space jobs out; swap in a routing API later if
// estimates prove too rough.

export type Coords = { lat: number; lng: number };

const FULL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/;

export function isUkPostcode(value: string) {
  return FULL_POSTCODE.test(value.trim().toUpperCase());
}

// "BS16 3AB" → "BS16"
export function outcode(postcode: string) {
  const compact = postcode.replace(/\s/g, "").toUpperCase();
  return compact.length > 3 ? compact.slice(0, -3) : compact;
}

export function haversineMiles(a: Coords, b: Coords) {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Roads wind about 1.3× the straight line; 25 mph averages town and A-road
// driving with a van. Rounded up to 5 minutes.
export function estimateDriveMins(miles: number) {
  const mins = ((miles * 1.3) / 25) * 60;
  return Math.ceil(mins / 5) * 5;
}

export type AreaCheck =
  | { ok: true; miles?: number }
  | { ok: false; reason: "outside_area" | "unknown_postcode"; miles?: number };

export function checkServiceArea(
  postcode: string,
  area: ServiceArea,
  coords: { job?: Coords; base?: Coords },
): AreaCheck {
  if ("districts" in area) {
    return area.districts.includes(outcode(postcode))
      ? { ok: true }
      : { ok: false, reason: "outside_area" };
  }
  if ("radius_miles" in area) {
    // A radius needs both ends; without them we can't say yes.
    if (!coords.job || !coords.base) return { ok: false, reason: "unknown_postcode" };
    const miles = Math.round(haversineMiles(coords.base, coords.job) * 10) / 10;
    return miles <= area.radius_miles
      ? { ok: true, miles }
      : { ok: false, reason: "outside_area", miles };
  }
  if ("territories" in area) {
    if (!coords.job) return { ok: false, reason: "unknown_postcode" };
    const job = coords.job;
    const away = area.territories.map((t) => ({
      t,
      miles: Math.round(haversineMiles(t, job) * 10) / 10,
    }));
    const hit = away.find(({ t, miles }) => miles <= t.radius_miles);
    if (hit) return { ok: true, miles: hit.miles };
    return { ok: false, reason: "outside_area", miles: Math.min(...away.map((a) => a.miles)) };
  }
  return { ok: true };
}

// Process-wide cache: postcodes don't move.
const cache = new Map<string, Coords | null>();

function key(postcode: string) {
  return postcode.replace(/\s/g, "").toUpperCase();
}

// Looks up several postcodes at once. Unknown postcodes map to null; if
// postcodes.io is down, the missing ones are left out and callers fall back
// to the tenant's fixed travel buffer.
export async function lookupPostcodes(postcodes: string[]): Promise<Map<string, Coords | null>> {
  const result = new Map<string, Coords | null>();
  const missing: string[] = [];
  for (const p of new Set(postcodes.map(key))) {
    if (cache.has(p)) result.set(p, cache.get(p)!);
    else missing.push(p);
  }

  for (let i = 0; i < missing.length; i += 100) {
    const batch = missing.slice(i, i + 100);
    try {
      const res = await fetch("https://api.postcodes.io/postcodes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postcodes: batch }),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error(`postcodes.io ${res.status}`);
      const body = (await res.json()) as {
        result: { query: string; result: { latitude: number; longitude: number } | null }[];
      };
      for (const { query, result: r } of body.result) {
        const coords = r ? { lat: r.latitude, lng: r.longitude } : null;
        cache.set(key(query), coords);
        result.set(key(query), coords);
      }
    } catch (error) {
      console.error("Postcode lookup failed", error);
    }
  }
  return result;
}

export function coordsFor(lookup: Map<string, Coords | null>, postcode: string | null | undefined) {
  return postcode ? (lookup.get(key(postcode)) ?? undefined) : undefined;
}
