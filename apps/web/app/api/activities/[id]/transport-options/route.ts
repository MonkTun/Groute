import { NextRequest, NextResponse } from "next/server";

import type { TransportOption, DrivingDirections, TransitRoute, CarpoolRouteDetails } from "@groute/shared";
import { createApiClient } from "@/lib/supabase/api";
import { getDrivingRoute, getWalkingRoute } from "@/lib/directions";
import { getTransitRoutes } from "@/lib/transit";
import { computeLeaveTime } from "@/lib/leave-time";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: activityId } = await params;
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const fromLat = parseFloat(url.searchParams.get("fromLat") ?? "");
  const fromLng = parseFloat(url.searchParams.get("fromLng") ?? "");

  if (isNaN(fromLat) || isNaN(fromLng)) {
    return NextResponse.json(
      { error: "fromLat and fromLng are required" },
      { status: 400 }
    );
  }

  // Fetch activity to get destination coords and scheduled time
  const { data: activity } = await supabase
    .from("activities")
    .select(
      "scheduled_at, location_lat, location_lng, location_name, trailhead_lat, trailhead_lng, trail_approach_duration_s"
    )
    .eq("id", activityId)
    .single();

  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const destLat = parseFloat(
    activity.trailhead_lat ?? activity.location_lat ?? "0"
  );
  const destLng = parseFloat(
    activity.trailhead_lng ?? activity.location_lng ?? "0"
  );
  const scheduledAt = activity.scheduled_at;
  const approachWalkSeconds = activity.trail_approach_duration_s ?? 0;

  // Fetch carpool offers
  const { data: rides } = await supabase
    .from("activity_rides")
    .select(
      `id, user_id, type, available_seats, pickup_location_name, departure_time, status,
       user:users!user_id ( display_name, first_name, last_name )`
    )
    .eq("activity_id", activityId)
    .eq("type", "offer")
    .eq("status", "open");

  // Calculate straight-line distance for walking threshold (rough check)
  const distKm =
    Math.sqrt(
      Math.pow((destLat - fromLat) * 111, 2) +
        Math.pow(
          (destLng - fromLng) * 111 * Math.cos((fromLat * Math.PI) / 180),
          2
        )
    );

  // Fetch all transport options in parallel
  const [drivingResult, transitResult, walkingResult] = await Promise.all([
    getDrivingRoute(fromLat, fromLng, destLat, destLng),
    getTransitRoutes(fromLat, fromLng, destLat, destLng, scheduledAt),
    distKm < 13 // ~8 miles
      ? getWalkingRoute(fromLat, fromLng, destLat, destLng)
      : Promise.resolve(null),
  ]);

  const options: TransportOption[] = [];

  // Driving option
  if (drivingResult) {
    const totalSeconds = drivingResult.durationSeconds + approachWalkSeconds;
    options.push({
      mode: "driving",
      durationSeconds: totalSeconds,
      distanceMeters: drivingResult.distanceMeters,
      leaveAt: computeLeaveTime(scheduledAt, totalSeconds),
      arriveBy: scheduledAt,
      details: drivingResult,
    });
  }

  // Transit options (take the best one)
  if (transitResult.length > 0) {
    const best = transitResult[0];
    const totalSeconds = best.durationSeconds + approachWalkSeconds;
    options.push({
      mode: "transit",
      durationSeconds: totalSeconds,
      leaveAt: computeLeaveTime(scheduledAt, totalSeconds),
      arriveBy: scheduledAt,
      details: best,
    });
  }

  // Rideshare estimate (based on driving time + buffer)
  if (drivingResult) {
    const rideshareWaitBuffer = 300; // 5 min wait
    const totalSeconds =
      drivingResult.durationSeconds + rideshareWaitBuffer + approachWalkSeconds;
    const costPerMile = 1.5;
    const miles = drivingResult.distanceMeters / 1609.34;
    const baseFare = 5;
    const estimatedCost = baseFare + miles * costPerMile;

    options.push({
      mode: "rideshare",
      durationSeconds: totalSeconds,
      distanceMeters: drivingResult.distanceMeters,
      leaveAt: computeLeaveTime(scheduledAt, totalSeconds),
      arriveBy: scheduledAt,
      costEstimate: `$${Math.round(estimatedCost)}-$${Math.round(estimatedCost * 1.5)}`,
      details: drivingResult,
    });
  }

  // Carpool options
  if (rides) {
    for (const ride of rides) {
      const driver = Array.isArray(ride.user) ? ride.user[0] : ride.user;
      const driverName = driver?.first_name
        ? `${driver.first_name} ${driver.last_name?.[0] ?? ""}.`
        : driver?.display_name ?? "Driver";

      const carpoolDetails: CarpoolRouteDetails = {
        rideId: ride.id,
        driverName,
        pickupTime: ride.departure_time ?? undefined,
        pickupLocation: ride.pickup_location_name ?? undefined,
        totalDurationSeconds: drivingResult?.durationSeconds ?? 0,
      };

      options.push({
        mode: "carpool_passenger",
        durationSeconds: drivingResult?.durationSeconds ?? 0,
        leaveAt: ride.departure_time
          ? new Date(
              new Date(ride.departure_time).getTime() - 10 * 60 * 1000
            ).toISOString()
          : computeLeaveTime(
              scheduledAt,
              (drivingResult?.durationSeconds ?? 0) + approachWalkSeconds
            ),
        arriveBy: scheduledAt,
        details: carpoolDetails,
      });
    }
  }

  // Walking option
  if (walkingResult) {
    const totalSeconds = walkingResult.durationSeconds;
    options.push({
      mode: "walking",
      durationSeconds: totalSeconds,
      distanceMeters: walkingResult.distanceMeters,
      leaveAt: computeLeaveTime(scheduledAt, totalSeconds),
      arriveBy: scheduledAt,
      details: walkingResult,
    });
  }

  // Sort by leave time (earliest first)
  options.sort(
    (a, b) => new Date(a.leaveAt).getTime() - new Date(b.leaveAt).getTime()
  );

  return NextResponse.json({ data: options });
}
