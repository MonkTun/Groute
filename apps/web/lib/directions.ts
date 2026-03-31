import type { DrivingDirections } from "@groute/shared";

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.MAPBOX_TOKEN ?? "";

/**
 * Get a driving route between two points using Mapbox Directions API.
 * Returns route geometry, distance, and duration. Server-side only.
 */
export async function getDrivingRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<DrivingDirections | null> {
  const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    access_token: MAPBOX_TOKEN,
  });

  const res = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?${params}`,
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

/**
 * Get a driving route through multiple waypoints using Mapbox Directions API.
 * Waypoints are visited in the order provided (no optimization).
 */
export async function getMultiStopDrivingRoute(
  waypoints: Array<{ lat: number; lng: number }>
): Promise<DrivingDirections | null> {
  if (waypoints.length < 2) return null;

  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    access_token: MAPBOX_TOKEN,
  });

  const res = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?${params}`,
    { signal: AbortSignal.timeout(15_000) }
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

/**
 * Get a walking route between two points using Mapbox Directions API.
 */
export async function getWalkingRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<DrivingDirections | null> {
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
