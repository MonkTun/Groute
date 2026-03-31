import type {
  TransportMode,
  CarpoolGroup,
  ParticipantTimeline,
  TimelineNode,
  ComputedTimeline,
} from "@groute/shared";
import { getMultiStopDrivingRouteWithLegs } from "./directions";
import { computeLeaveTime } from "./leave-time";

interface MatchParticipant {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  originLat: number;
  originLng: number;
  originName: string;
  transportMode: TransportMode;
  vehicleCapacity: number | null;
  needsRide: boolean;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

/**
 * Auto-match riders to drivers and build converging timelines.
 */
export async function computeCarpoolMatching(
  participants: MatchParticipant[],
  destination: { lat: number; lng: number; name: string },
  activityStartTime: string,
  bufferMinutes: number = 15
): Promise<{
  carpoolGroups: CarpoolGroup[];
  participantTimelines: ParticipantTimeline[];
  convergencePoints: ComputedTimeline["convergencePoints"];
}> {
  // Separate into roles
  const drivers = participants.filter(
    (p) =>
      (p.transportMode === "driving" || p.transportMode === "carpool_driver") &&
      p.vehicleCapacity != null &&
      p.vehicleCapacity > 0
  );
  const riders = participants.filter((p) => p.needsRide);
  const soloTravelers = participants.filter(
    (p) => !p.needsRide && !(p.vehicleCapacity != null && p.vehicleCapacity > 0)
  );

  // Greedy carpool assignment
  const assigned = new Set<string>();
  const driverPassengers = new Map<string, MatchParticipant[]>();

  // Initialize driver -> passengers map
  for (const d of drivers) {
    driverPassengers.set(d.userId, []);
  }

  // Sort rider-driver pairs by distance
  const pairs: Array<{ rider: MatchParticipant; driver: MatchParticipant; dist: number }> = [];
  for (const rider of riders) {
    for (const driver of drivers) {
      const dist = haversineKm(
        rider.originLat,
        rider.originLng,
        driver.originLat,
        driver.originLng
      );
      pairs.push({ rider, driver, dist });
    }
  }
  pairs.sort((a, b) => a.dist - b.dist);

  // Assign riders to closest drivers with capacity
  for (const { rider, driver } of pairs) {
    if (assigned.has(rider.userId)) continue;
    const passengers = driverPassengers.get(driver.userId)!;
    if (passengers.length >= (driver.vehicleCapacity ?? 0)) continue;
    passengers.push(rider);
    assigned.add(rider.userId);
  }

  // Unassigned riders become solo
  const unassignedRiders = riders.filter((r) => !assigned.has(r.userId));

  // Build carpool groups with routes
  const carpoolGroups: CarpoolGroup[] = [];
  const participantTimelines: ParticipantTimeline[] = [];
  const convergencePoints: ComputedTimeline["convergencePoints"] = [];

  for (const driver of drivers) {
    const passengers = driverPassengers.get(driver.userId) ?? [];
    const groupId = generateId();

    if (passengers.length === 0) {
      // Driver going alone
      participantTimelines.push(
        buildSoloTimeline(driver, destination, activityStartTime, bufferMinutes)
      );
      continue;
    }

    // Order passengers by nearest-neighbor from driver
    const orderedPassengers = orderByProximity(driver, passengers);

    // Build waypoints: driver -> each passenger -> destination
    const waypoints = [
      { lat: driver.originLat, lng: driver.originLng },
      ...orderedPassengers.map((p) => ({ lat: p.originLat, lng: p.originLng })),
      { lat: destination.lat, lng: destination.lng },
    ];

    const routeResult = await getMultiStopDrivingRouteWithLegs(waypoints);

    if (!routeResult) {
      // Fallback: treat everyone as solo
      participantTimelines.push(
        buildSoloTimeline(driver, destination, activityStartTime, bufferMinutes)
      );
      for (const p of orderedPassengers) {
        participantTimelines.push(
          buildSoloTimeline(
            { ...p, transportMode: "carpool_passenger" },
            destination,
            activityStartTime,
            bufferMinutes
          )
        );
      }
      continue;
    }

    // Compute times working backward from arrival
    const arrivalTime = new Date(activityStartTime).getTime() - bufferMinutes * 60 * 1000;
    let currentTime = arrivalTime;

    // Walk backward through legs to compute pickup times
    const pickupTimes: Array<{ userId: string; time: number; legSeconds: number }> = [];

    // Last leg: last passenger -> destination
    for (let i = routeResult.legs.length - 1; i >= 1; i--) {
      const leg = routeResult.legs[i];
      currentTime -= leg.durationSeconds * 1000;
      const passengerIdx = i - 1;
      if (passengerIdx < orderedPassengers.length) {
        pickupTimes.unshift({
          userId: orderedPassengers[passengerIdx].userId,
          time: currentTime,
          legSeconds: leg.durationSeconds,
        });
      }
    }

    // First leg: driver home -> first pickup
    const firstLeg = routeResult.legs[0];
    currentTime -= firstLeg.durationSeconds * 1000;
    const driverLeaveTime = new Date(currentTime).toISOString();

    // Build carpool group
    const pickupOrder = orderedPassengers.map((p, i) => ({
      userId: p.userId,
      userName: p.displayName,
      pickupTime: new Date(pickupTimes[i]?.time ?? arrivalTime).toISOString(),
      pickupLocationName: p.originName,
      legDurationSeconds: pickupTimes[i]?.legSeconds ?? 0,
    }));

    carpoolGroups.push({
      id: groupId,
      driverId: driver.userId,
      driverName: driver.displayName,
      passengerIds: orderedPassengers.map((p) => p.userId),
      vehicleCapacity: driver.vehicleCapacity ?? 0,
      totalDurationSeconds: routeResult.totalDurationSeconds,
      pickupOrder,
    });

    // Driver timeline
    const driverNodes: TimelineNode[] = [
      {
        type: "leave_home",
        time: driverLeaveTime,
        label: `Leave home`,
        locationName: driver.originName,
      },
      ...pickupOrder.map((po) => ({
        type: "pickup" as const,
        time: po.pickupTime,
        label: `Pick up ${po.userName}`,
        locationName: po.pickupLocationName,
      })),
      {
        type: "arrive_trailhead" as const,
        time: new Date(arrivalTime).toISOString(),
        label: "Arrive at trailhead",
        locationName: destination.name,
      },
    ];

    participantTimelines.push({
      userId: driver.userId,
      displayName: driver.displayName,
      avatarUrl: driver.avatarUrl,
      role: "driver",
      transportMode: "carpool_driver",
      carpoolGroupId: groupId,
      nodes: driverNodes,
    });

    // Passenger timelines
    for (const po of pickupOrder) {
      const passenger = orderedPassengers.find((p) => p.userId === po.userId)!;
      const readyTime = new Date(
        new Date(po.pickupTime).getTime() - 10 * 60 * 1000
      ).toISOString();

      participantTimelines.push({
        userId: po.userId,
        displayName: po.userName,
        avatarUrl: passenger.avatarUrl,
        role: "passenger",
        transportMode: "carpool_passenger",
        carpoolGroupId: groupId,
        nodes: [
          {
            type: "get_ready",
            time: readyTime,
            label: "Get ready",
            locationName: po.pickupLocationName,
          },
          {
            type: "pickup",
            time: po.pickupTime,
            label: `Picked up by ${driver.displayName}`,
            locationName: po.pickupLocationName,
          },
          {
            type: "arrive_trailhead",
            time: new Date(arrivalTime).toISOString(),
            label: "Arrive at trailhead",
            locationName: destination.name,
          },
        ],
      });

      // Add pickup as convergence point
      convergencePoints.push({
        time: po.pickupTime,
        locationName: po.pickupLocationName,
        participantIds: [driver.userId, po.userId],
        type: "pickup",
      });
    }
  }

  // Solo travelers and unassigned riders
  for (const p of [...soloTravelers, ...unassignedRiders]) {
    participantTimelines.push(
      buildSoloTimeline(p, destination, activityStartTime, bufferMinutes)
    );
  }

  // Final convergence: everyone at trailhead
  const arrivalTimeIso = new Date(
    new Date(activityStartTime).getTime() - bufferMinutes * 60 * 1000
  ).toISOString();

  convergencePoints.push({
    time: arrivalTimeIso,
    locationName: destination.name,
    participantIds: participants.map((p) => p.userId),
    type: "trailhead",
  });

  return { carpoolGroups, participantTimelines, convergencePoints };
}

function buildSoloTimeline(
  participant: MatchParticipant,
  destination: { lat: number; lng: number; name: string },
  activityStartTime: string,
  bufferMinutes: number
): ParticipantTimeline {
  // Estimate travel time based on distance (rough: 1 km/min for driving)
  const distKm = haversineKm(
    participant.originLat,
    participant.originLng,
    destination.lat,
    destination.lng
  );
  const estimatedSeconds = Math.round(distKm * 60); // ~1 min per km as rough estimate
  const leaveAt = computeLeaveTime(
    activityStartTime,
    estimatedSeconds,
    bufferMinutes
  );

  return {
    userId: participant.userId,
    displayName: participant.displayName,
    avatarUrl: participant.avatarUrl,
    role: "solo",
    transportMode: participant.transportMode,
    nodes: [
      {
        type: "leave_home",
        time: leaveAt,
        label: "Leave home",
        locationName: participant.originName,
      },
      {
        type: "arrive_trailhead",
        time: new Date(
          new Date(activityStartTime).getTime() - bufferMinutes * 60 * 1000
        ).toISOString(),
        label: "Arrive at trailhead",
        locationName: destination.name,
      },
    ],
  };
}

function orderByProximity(
  driver: MatchParticipant,
  passengers: MatchParticipant[]
): MatchParticipant[] {
  // Simple nearest-neighbor ordering from driver's location
  const ordered: MatchParticipant[] = [];
  const remaining = [...passengers];
  let currentLat = driver.originLat;
  let currentLng = driver.originLng;

  while (remaining.length > 0) {
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineKm(
        currentLat,
        currentLng,
        remaining[i].originLat,
        remaining[i].originLng
      );
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    const next = remaining.splice(closest, 1)[0];
    ordered.push(next);
    currentLat = next.originLat;
    currentLng = next.originLng;
  }

  return ordered;
}
