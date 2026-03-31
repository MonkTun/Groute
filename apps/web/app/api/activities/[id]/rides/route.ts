import { NextRequest, NextResponse } from "next/server";

import { createRideSchema } from "@groute/shared";
import { createApiClient } from "@/lib/supabase/api";

// GET: list all rides for an activity
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

  const { data: rides, error } = await supabase
    .from("activity_rides")
    .select(
      `id, activity_id, user_id, type, available_seats, pickup_location_name,
       pickup_lat, pickup_lng, departure_time, note, status, created_at,
       user:users!user_id ( id, display_name, first_name, last_name, avatar_url ),
       passengers:ride_passengers (
         id, passenger_id, status, created_at,
         user:users!passenger_id ( id, display_name, first_name, last_name, avatar_url )
       )`
    )
    .eq("activity_id", activityId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch rides:", error);
    return NextResponse.json(
      { error: "Failed to fetch rides" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: rides ?? [] });
}

// POST: create a ride offer or request
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

  // Verify user is creator or accepted participant
  const [activityResult, participantResult] = await Promise.all([
    supabase
      .from("activities")
      .select("creator_id")
      .eq("id", activityId)
      .single(),
    supabase
      .from("activity_participants")
      .select("status")
      .eq("activity_id", activityId)
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .maybeSingle(),
  ]);

  if (!activityResult.data) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const isCreator = activityResult.data.creator_id === user.id;
  const isParticipant = !!participantResult.data;

  if (!isCreator && !isParticipant) {
    return NextResponse.json(
      { error: "Must be a participant to post rides" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = createRideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  if (parsed.data.type === "offer" && !parsed.data.availableSeats) {
    return NextResponse.json(
      { error: "Offers must specify available seats" },
      { status: 400 }
    );
  }

  const { data: ride, error } = await supabase
    .from("activity_rides")
    .insert({
      activity_id: activityId,
      user_id: user.id,
      type: parsed.data.type,
      available_seats: parsed.data.availableSeats ?? null,
      pickup_location_name: parsed.data.pickupLocationName ?? null,
      pickup_lat: parsed.data.pickupLat?.toString() ?? null,
      pickup_lng: parsed.data.pickupLng?.toString() ?? null,
      departure_time: parsed.data.departureTime ?? null,
      note: parsed.data.note ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create ride:", error);
    return NextResponse.json(
      { error: "Failed to create ride" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: ride }, { status: 201 });
}
