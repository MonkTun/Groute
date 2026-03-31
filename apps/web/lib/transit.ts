import type { TransitRoute, TransitStep } from "@groute/shared";

/**
 * Get transit route options from Google Maps Directions API.
 * Returns multiple route alternatives sorted by arrival time.
 */
export async function getTransitRoutes(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  arrivalTime?: string // ISO — when user needs to arrive
): Promise<TransitRoute[]> {
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn("GOOGLE_MAPS_API_KEY not set, skipping transit routing");
    return [];
  }

  const params = new URLSearchParams({
    origin: `${fromLat},${fromLng}`,
    destination: `${toLat},${toLng}`,
    mode: "transit",
    alternatives: "true",
    key: GOOGLE_MAPS_API_KEY,
  });

  if (arrivalTime) {
    params.set(
      "arrival_time",
      Math.floor(new Date(arrivalTime).getTime() / 1000).toString()
    );
  }

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?${params}`,
    { signal: AbortSignal.timeout(15_000) }
  );

  if (!res.ok) return [];

  const data = await res.json();
  if (data.status !== "OK" || !data.routes?.length) return [];

  return data.routes.map((route: GoogleRoute): TransitRoute => {
    const leg = route.legs[0];
    const steps: TransitStep[] = leg.steps.map(
      (step: GoogleStep): TransitStep => {
        const isTransit = step.travel_mode === "TRANSIT";
        return {
          mode: isTransit
            ? mapTransitMode(step.transit_details?.line?.vehicle?.type)
            : "WALK",
          lineName: isTransit
            ? step.transit_details?.line?.short_name ||
              step.transit_details?.line?.name
            : undefined,
          departureStop: isTransit
            ? step.transit_details?.departure_stop?.name
            : undefined,
          arrivalStop: isTransit
            ? step.transit_details?.arrival_stop?.name
            : undefined,
          departureTime:
            step.transit_details?.departure_time?.value
              ? new Date(
                  step.transit_details.departure_time.value * 1000
                ).toISOString()
              : leg.departure_time?.value
                ? new Date(leg.departure_time.value * 1000).toISOString()
                : "",
          arrivalTime:
            step.transit_details?.arrival_time?.value
              ? new Date(
                  step.transit_details.arrival_time.value * 1000
                ).toISOString()
              : leg.arrival_time?.value
                ? new Date(leg.arrival_time.value * 1000).toISOString()
                : "",
          durationSeconds: step.duration.value,
          distanceMeters: step.distance?.value,
          numStops: step.transit_details?.num_stops,
          instructions: step.html_instructions?.replace(/<[^>]*>/g, ""),
        };
      }
    );

    return {
      durationSeconds: leg.duration.value,
      departureTime: leg.departure_time?.value
        ? new Date(leg.departure_time.value * 1000).toISOString()
        : "",
      arrivalTime: leg.arrival_time?.value
        ? new Date(leg.arrival_time.value * 1000).toISOString()
        : "",
      steps,
    };
  });
}

function mapTransitMode(vehicleType?: string): string {
  switch (vehicleType) {
    case "BUS":
      return "BUS";
    case "SUBWAY":
    case "METRO_RAIL":
      return "SUBWAY";
    case "RAIL":
    case "COMMUTER_TRAIN":
    case "LONG_DISTANCE_TRAIN":
      return "RAIL";
    case "TRAM":
    case "LIGHT_RAIL":
      return "TRAM";
    default:
      return "BUS";
  }
}

// Google Maps Directions API response types (minimal)
interface GoogleRoute {
  legs: GoogleLeg[];
}

interface GoogleLeg {
  duration: { value: number };
  departure_time?: { value: number };
  arrival_time?: { value: number };
  steps: GoogleStep[];
}

interface GoogleStep {
  travel_mode: string;
  duration: { value: number };
  distance?: { value: number };
  html_instructions?: string;
  transit_details?: {
    departure_stop?: { name: string };
    arrival_stop?: { name: string };
    departure_time?: { value: number };
    arrival_time?: { value: number };
    num_stops?: number;
    line?: {
      name?: string;
      short_name?: string;
      vehicle?: { type?: string };
    };
  };
}
