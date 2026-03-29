import type {
  Trail,
  TrailSurface,
  TrailSacScale,
  ApproachRoute,
} from "@groute/shared";

// Multiple endpoints for resilience — the main server gets overloaded
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

interface OverpassElement {
  type: "way";
  id: number;
  geometry: { lat: number; lon: number }[];
  tags: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

const VALID_SURFACES = new Set([
  "ground",
  "dirt",
  "grass",
  "gravel",
  "sand",
  "rock",
  "paved",
  "asphalt",
  "concrete",
  "wood",
]);

const VALID_SAC_SCALES = new Set([
  "hiking",
  "mountain_hiking",
  "demanding_mountain_hiking",
  "alpine_hiking",
  "demanding_alpine_hiking",
  "difficult_alpine_hiking",
]);

function normalizeSurface(raw: string | undefined): TrailSurface {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase();
  // Map common OSM surface values to our enum
  if (lower === "earth" || lower === "mud") return "ground";
  if (lower === "fine_gravel" || lower === "compacted") return "gravel";
  if (lower === "paving_stones" || lower === "cobblestone" || lower === "sett")
    return "paved";
  if (VALID_SURFACES.has(lower)) return lower as TrailSurface;
  return "unknown";
}

function normalizeSacScale(raw: string | undefined): TrailSacScale | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (VALID_SAC_SCALES.has(lower)) return lower as TrailSacScale;
  return null;
}

/** Haversine distance between two points in meters */
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeTrailDistance(
  geometry: { lat: number; lon: number }[]
): number {
  let total = 0;
  for (let i = 1; i < geometry.length; i++) {
    total += haversineMeters(
      geometry[i - 1].lat,
      geometry[i - 1].lon,
      geometry[i].lat,
      geometry[i].lon
    );
  }
  return Math.round(total);
}

/** Convert center point + radius into a bbox string for Overpass (south,west,north,east) */
function toBbox(lat: number, lng: number, radiusMeters: number): string {
  const latDelta = radiusMeters / 111_320;
  const lngDelta = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return `${lat - latDelta},${lng - lngDelta},${lat + latDelta},${lng + lngDelta}`;
}

function buildOverpassQuery(
  lat: number,
  lng: number,
  radiusMeters: number
): string {
  const bbox = toBbox(lat, lng, radiusMeters);
  // Query strategy:
  // 1. Named paths/tracks with sac_scale (definite hiking trails)
  // 2. Named paths/tracks tagged as hiking/foot routes
  // 3. Named footways in natural areas (not urban sidewalks)
  // Using bbox instead of "around" for better Overpass performance
  return `
[out:json][timeout:25][maxsize:2097152];
(
  way["highway"~"path|track"]["name"]["sac_scale"](${bbox});
  way["highway"~"path|track"]["name"]["route"~"hiking|foot"](${bbox});
  way["highway"="footway"]["name"]["surface"~"ground|dirt|grass|gravel|sand|rock|earth|unpaved"](${bbox});
  way["highway"~"path|track"]["name"]["leisure"="nature_reserve"](${bbox});
  way["highway"~"path|track"]["name"]["natural"](${bbox});
);
out geom;
`.trim();
}

function parseElement(
  element: OverpassElement,
  originLat: number,
  originLng: number
): Trail | null {
  if (
    element.type !== "way" ||
    !element.tags?.name ||
    !element.geometry?.length
  ) {
    return null;
  }

  const coordinates: [number, number][] = element.geometry.map((node) => [
    node.lat,
    node.lon,
  ]);

  const distanceMeters = computeTrailDistance(element.geometry);

  // Skip very short segments (< 100m) — likely fragments
  if (distanceMeters < 100) return null;

  // Compute center point (midpoint of the geometry)
  const midIdx = Math.floor(coordinates.length / 2);
  const centerLat = coordinates[midIdx][0];
  const centerLng = coordinates[midIdx][1];

  // Find the closest endpoint to the origin (trailhead)
  const first = element.geometry[0];
  const last = element.geometry[element.geometry.length - 1];
  const distToFirst = haversineMeters(originLat, originLng, first.lat, first.lon);
  const distToLast = haversineMeters(originLat, originLng, last.lat, last.lon);

  const trailhead = distToFirst <= distToLast ? first : last;
  const distanceFromLocation = Math.round(Math.min(distToFirst, distToLast));

  return {
    osmId: element.id,
    name: element.tags.name,
    surface: normalizeSurface(element.tags.surface),
    sacScale: normalizeSacScale(element.tags.sac_scale),
    distanceMeters,
    coordinates,
    centerLat,
    centerLng,
    trailheadLat: trailhead.lat,
    trailheadLng: trailhead.lon,
    distanceFromLocation,
  };
}

async function queryOverpass(query: string): Promise<OverpassResponse> {
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(30_000),
      });

      if (response.status === 429 || response.status === 504) {
        // Rate limited or timeout — try next endpoint
        lastError = new Error(`${endpoint}: ${response.status}`);
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `Overpass API error: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Network error or timeout — try next endpoint
      continue;
    }
  }

  throw lastError ?? new Error("All Overpass endpoints failed");
}

/**
 * Search for trails near a geographic point using the Overpass API.
 * This runs server-side only — never call from client code.
 */
export async function searchTrails(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<Trail[]> {
  const query = buildOverpassQuery(lat, lng, radiusMeters);
  const data = await queryOverpass(query);

  const trails: Trail[] = [];
  const seenNames = new Set<string>();

  for (const element of data.elements) {
    const trail = parseElement(element, lat, lng);
    if (!trail) continue;

    // Deduplicate by name — OSM often splits one trail into many way segments.
    // Keep the longest segment as the representative.
    if (seenNames.has(trail.name.toLowerCase())) {
      const existingIdx = trails.findIndex(
        (t) => t.name.toLowerCase() === trail.name.toLowerCase()
      );
      if (
        existingIdx !== -1 &&
        trail.distanceMeters > trails[existingIdx].distanceMeters
      ) {
        trails[existingIdx] = trail;
      }
      continue;
    }

    seenNames.add(trail.name.toLowerCase());
    trails.push(trail);
  }

  // Sort by distance from location (closest trailheads first)
  trails.sort((a, b) => a.distanceFromLocation - b.distanceFromLocation);

  return trails;
}

/**
 * Fetch the geometry of a single trail way by its OSM ID.
 * Returns coordinates as [lng, lat] pairs (GeoJSON order) ready for Mapbox.
 */
export async function getTrailGeometry(
  osmId: number
): Promise<[number, number][] | null> {
  const query = `[out:json][timeout:10];way(${osmId});out geom;`;
  try {
    const data = await queryOverpass(query);
    const way = data.elements[0];
    if (!way?.geometry?.length) return null;
    return way.geometry.map((n) => [n.lon, n.lat]);
  } catch {
    return null;
  }
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

/**
 * Get a walking route from an origin point to a trailhead using Mapbox Directions API.
 * Returns route geometry, distance, and duration. Server-side only.
 */
export async function getApproachRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<ApproachRoute | null> {
  const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    access_token: MAPBOX_TOKEN,
  });

  const res = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?${params}`,
    { signal: AbortSignal.timeout(10_000) }
  );

  if (!res.ok) return null;

  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return null;

  return {
    distanceMeters: Math.round(route.distance),
    durationSeconds: Math.round(route.duration),
    coordinates: route.geometry.coordinates as [number, number][],
  };
}
