import { NextRequest, NextResponse } from "next/server";

import { createTransitPlanSchema } from "@groute/shared";
import { createApiClient } from "@/lib/supabase/api";

// GET: fetch current user's transport plan for this activity
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

  const { data: plan, error } = await supabase
    .from("user_transit_plans")
    .select("*")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch transport plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch transport plan" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: plan });
}

// POST: create or update transport plan
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

  const body = await request.json();
  const parsed = createTransitPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const row = {
    activity_id: activityId,
    user_id: user.id,
    transport_mode: parsed.data.transportMode,
    ride_id: parsed.data.rideId ?? null,
    origin_lat: parsed.data.originLat?.toString() ?? null,
    origin_lng: parsed.data.originLng?.toString() ?? null,
    origin_name: parsed.data.originName ?? null,
    estimated_travel_seconds: parsed.data.estimatedTravelSeconds ?? null,
    leave_at: parsed.data.leaveAt ?? null,
    route_summary: parsed.data.routeSummary ?? null,
    vehicle_capacity: parsed.data.vehicleCapacity ?? null,
    needs_ride: parsed.data.needsRide ?? false,
    updated_at: new Date().toISOString(),
  };

  // Upsert: check if plan exists
  const { data: existing } = await supabase
    .from("user_transit_plans")
    .select("id")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();

  let result;
  if (existing) {
    result = await supabase
      .from("user_transit_plans")
      .update(row)
      .eq("id", existing.id)
      .select()
      .single();
  } else {
    result = await supabase
      .from("user_transit_plans")
      .insert(row)
      .select()
      .single();
  }

  if (result.error) {
    console.error("Failed to save transport plan:", result.error);
    return NextResponse.json(
      { error: "Failed to save transport plan" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: result.data });
}
