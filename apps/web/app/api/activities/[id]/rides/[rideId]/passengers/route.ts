import { NextRequest, NextResponse } from "next/server";

import { updateRidePassengerStatusSchema } from "@groute/shared";
import { createApiClient } from "@/lib/supabase/api";

// POST: request to join a ride offer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rideId: string }> }
) {
  const { rideId } = await params;
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ride exists and is an open offer
  const { data: ride } = await supabase
    .from("activity_rides")
    .select("id, type, status, user_id")
    .eq("id", rideId)
    .single();

  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  if (ride.type !== "offer") {
    return NextResponse.json(
      { error: "Can only join ride offers" },
      { status: 400 }
    );
  }

  if (ride.status !== "open") {
    return NextResponse.json(
      { error: "Ride is no longer available" },
      { status: 409 }
    );
  }

  if (ride.user_id === user.id) {
    return NextResponse.json(
      { error: "Cannot join your own ride" },
      { status: 400 }
    );
  }

  // Check if already requested
  const { data: existing } = await supabase
    .from("ride_passengers")
    .select("id")
    .eq("ride_offer_id", rideId)
    .eq("passenger_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Already requested this ride" },
      { status: 409 }
    );
  }

  const { data: passenger, error } = await supabase
    .from("ride_passengers")
    .insert({
      ride_offer_id: rideId,
      passenger_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to request ride:", error);
    return NextResponse.json(
      { error: "Failed to request ride" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: passenger }, { status: 201 });
}

// PATCH: driver confirms or declines a passenger
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rideId: string }> }
) {
  const { rideId } = await params;
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the current user is the driver (ride owner)
  const { data: ride } = await supabase
    .from("activity_rides")
    .select("user_id")
    .eq("id", rideId)
    .single();

  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  if (ride.user_id !== user.id) {
    return NextResponse.json(
      { error: "Only the driver can manage passengers" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { passengerId, ...rest } = body;
  const parsed = updateRidePassengerStatusSchema.safeParse(rest);
  if (!parsed.success || !passengerId) {
    return NextResponse.json(
      { error: "Validation failed" },
      { status: 400 }
    );
  }

  const { data: updated, error } = await supabase
    .from("ride_passengers")
    .update({ status: parsed.data.status })
    .eq("ride_offer_id", rideId)
    .eq("passenger_id", passengerId)
    .select()
    .single();

  if (error) {
    console.error("Failed to update passenger:", error);
    return NextResponse.json(
      { error: "Failed to update passenger status" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: updated });
}
