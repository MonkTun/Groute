import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";

// PATCH: update a ride (owner only — cancel or edit)
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

  const { data: ride } = await supabase
    .from("activity_rides")
    .select("user_id")
    .eq("id", rideId)
    .single();

  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  if (ride.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};
  if (body.status !== undefined) updateData.status = body.status;
  if (body.note !== undefined) updateData.note = body.note;
  if (body.pickupLocationName !== undefined)
    updateData.pickup_location_name = body.pickupLocationName;
  if (body.departureTime !== undefined)
    updateData.departure_time = body.departureTime;
  if (body.availableSeats !== undefined)
    updateData.available_seats = body.availableSeats;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const { data: updated, error } = await supabase
    .from("activity_rides")
    .update(updateData)
    .eq("id", rideId)
    .select()
    .single();

  if (error) {
    console.error("Failed to update ride:", error);
    return NextResponse.json(
      { error: "Failed to update ride" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: updated });
}

// DELETE: remove a ride (owner only)
export async function DELETE(
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

  const { data: ride } = await supabase
    .from("activity_rides")
    .select("user_id")
    .eq("id", rideId)
    .single();

  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  if (ride.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("activity_rides")
    .delete()
    .eq("id", rideId);

  if (error) {
    console.error("Failed to delete ride:", error);
    return NextResponse.json(
      { error: "Failed to delete ride" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { success: true } });
}
