import { NextRequest, NextResponse } from "next/server";

import type { ComputedTimeline } from "@groute/shared";
import { createApiClient } from "@/lib/supabase/api";
import { computeCarpoolMatching } from "@/lib/carpool-matcher";

// GET: return existing computed timeline
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

  const { data } = await supabase
    .from("activity_logistics")
    .select("computed_timeline")
    .eq("activity_id", activityId)
    .maybeSingle();

  return NextResponse.json({ data: data?.computed_timeline ?? null });
}

// POST: compute and store timeline
export async function POST(
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

  // Fetch activity details
  const { data: activity } = await supabase
    .from("activities")
    .select(
      "scheduled_at, location_name, location_lat, location_lng, trailhead_lat, trailhead_lng"
    )
    .eq("id", activityId)
    .single();

  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  // Fetch all transit plans for this activity with user profiles
  const { data: plans } = await supabase
    .from("user_transit_plans")
    .select(
      `user_id, transport_mode, origin_lat, origin_lng, origin_name, vehicle_capacity, needs_ride,
       user:users!user_id ( id, display_name, first_name, last_name, avatar_url )`
    )
    .eq("activity_id", activityId);

  if (!plans || plans.length === 0) {
    return NextResponse.json(
      { error: "No transport plans found" },
      { status: 400 }
    );
  }

  // Build participant list for matcher
  const participants = plans.map((p) => {
    const u = Array.isArray(p.user) ? p.user[0] : p.user;
    return {
      userId: p.user_id,
      displayName: u?.first_name && u?.last_name
        ? `${u.first_name} ${u.last_name[0]}.`
        : u?.display_name ?? "Unknown",
      avatarUrl: u?.avatar_url ?? null,
      originLat: parseFloat(p.origin_lat ?? "0"),
      originLng: parseFloat(p.origin_lng ?? "0"),
      originName: p.origin_name ?? "Unknown",
      transportMode: p.transport_mode as import("@groute/shared").TransportMode,
      vehicleCapacity: p.vehicle_capacity,
      needsRide: p.needs_ride ?? false,
    };
  });

  const destLat = parseFloat(
    activity.trailhead_lat ?? activity.location_lat ?? "0"
  );
  const destLng = parseFloat(
    activity.trailhead_lng ?? activity.location_lng ?? "0"
  );

  try {
    const { carpoolGroups, participantTimelines, convergencePoints } =
      await computeCarpoolMatching(
        participants,
        { lat: destLat, lng: destLng, name: activity.location_name },
        activity.scheduled_at
      );

    const timeline: ComputedTimeline = {
      computedAt: new Date().toISOString(),
      activityStartTime: activity.scheduled_at,
      meetingPointName: activity.location_name,
      carpoolGroups,
      participantTimelines,
      convergencePoints,
    };

    // Upsert into activity_logistics
    const { data: existing } = await supabase
      .from("activity_logistics")
      .select("id")
      .eq("activity_id", activityId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("activity_logistics")
        .update({
          computed_timeline: timeline,
          updated_at: new Date().toISOString(),
        })
        .eq("activity_id", activityId);
    } else {
      await supabase.from("activity_logistics").insert({
        activity_id: activityId,
        computed_timeline: timeline,
      });
    }

    return NextResponse.json({ data: timeline });
  } catch (err) {
    console.error("Failed to compute timeline:", err);
    return NextResponse.json(
      { error: "Failed to compute timeline" },
      { status: 500 }
    );
  }
}
