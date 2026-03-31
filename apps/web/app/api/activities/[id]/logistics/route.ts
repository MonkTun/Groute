import { NextRequest, NextResponse } from "next/server";

import { upsertActivityLogisticsSchema } from "@groute/shared";
import { createApiClient } from "@/lib/supabase/api";

// GET: fetch logistics for an activity
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

  const { data: logistics, error } = await supabase
    .from("activity_logistics")
    .select("*")
    .eq("activity_id", activityId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch logistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch logistics" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: logistics });
}

// PUT: create or update logistics for an activity (host only)
export async function PUT(
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

  // Verify ownership
  const { data: activity } = await supabase
    .from("activities")
    .select("creator_id")
    .eq("id", activityId)
    .single();

  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  if (activity.creator_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = upsertActivityLogisticsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const row = {
    activity_id: activityId,
    meeting_point_name: parsed.data.meetingPointName ?? null,
    meeting_point_lat: parsed.data.meetingPointLat?.toString() ?? null,
    meeting_point_lng: parsed.data.meetingPointLng?.toString() ?? null,
    meeting_time: parsed.data.meetingTime ?? null,
    estimated_return_time: parsed.data.estimatedReturnTime ?? null,
    parking_name: parsed.data.parkingName ?? null,
    parking_lat: parsed.data.parkingLat?.toString() ?? null,
    parking_lng: parsed.data.parkingLng?.toString() ?? null,
    parking_paid: parsed.data.parkingPaid ?? null,
    parking_cost: parsed.data.parkingCost ?? null,
    parking_notes: parsed.data.parkingNotes ?? null,
    transport_notes: parsed.data.transportNotes ?? null,
    checklist_items: parsed.data.checklistItems ?? [],
    notes: parsed.data.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  // Upsert: insert if not exists, update if exists
  const { data: existing } = await supabase
    .from("activity_logistics")
    .select("id")
    .eq("activity_id", activityId)
    .maybeSingle();

  let result;
  if (existing) {
    result = await supabase
      .from("activity_logistics")
      .update(row)
      .eq("activity_id", activityId)
      .select()
      .single();
  } else {
    result = await supabase
      .from("activity_logistics")
      .insert(row)
      .select()
      .single();
  }

  if (result.error) {
    console.error("Failed to upsert logistics:", result.error);
    return NextResponse.json(
      { error: "Failed to save logistics" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: result.data });
}
