import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";

// GET: fetch a single activity with full details
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

  const [activityResult, participantsResult, myStatusResult] =
    await Promise.all([
      supabase
        .from("activities")
        .select(
          `id, title, description, sport_type, skill_level, visibility, banner_url,
           location_lat, location_lng, location_name,
           max_participants, scheduled_at, status, created_at, creator_id,
           creator:users!creator_id (
             id, display_name, first_name, last_name, avatar_url, area
           )`
        )
        .eq("id", activityId)
        .single(),

      supabase
        .from("activity_participants")
        .select(
          `id, user_id, status, joined_at,
           user:users!user_id ( id, display_name, first_name, last_name, avatar_url )`
        )
        .eq("activity_id", activityId)
        .eq("status", "accepted"),

      supabase
        .from("activity_participants")
        .select("id, status")
        .eq("activity_id", activityId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (activityResult.error || !activityResult.data) {
    return NextResponse.json(
      { error: "Activity not found" },
      { status: 404 }
    );
  }

  const activity = activityResult.data;
  const creator = Array.isArray(activity.creator)
    ? activity.creator[0]
    : activity.creator;

  const participants = (participantsResult.data ?? []).map((p) => ({
    id: p.id,
    userId: p.user_id,
    status: p.status,
    joinedAt: p.joined_at,
    user: Array.isArray(p.user) ? p.user[0] : p.user,
  }));

  return NextResponse.json({
    data: {
      ...activity,
      creator,
      participants,
      myStatus: myStatusResult.data?.status ?? null,
      isOwner: activity.creator_id === user.id,
    },
  });
}

// PATCH: update an activity (owner only)
export async function PATCH(
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
    return NextResponse.json(
      { error: "Activity not found" },
      { status: 404 }
    );
  }

  if (activity.creator_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  // Build update object from allowed fields
  const updateData: Record<string, unknown> = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.sportType !== undefined) updateData.sport_type = body.sportType;
  if (body.skillLevel !== undefined) updateData.skill_level = body.skillLevel;
  if (body.visibility !== undefined) updateData.visibility = body.visibility;
  if (body.locationName !== undefined) updateData.location_name = body.locationName;
  if (body.maxParticipants !== undefined)
    updateData.max_participants = body.maxParticipants;
  if (body.scheduledAt !== undefined) updateData.scheduled_at = body.scheduledAt;
  if (body.location?.latitude !== undefined)
    updateData.location_lat = String(body.location.latitude);
  if (body.location?.longitude !== undefined)
    updateData.location_lng = String(body.location.longitude);

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("activities")
    .update(updateData)
    .eq("id", activityId)
    .select()
    .single();

  if (updateError) {
    console.error("Failed to update activity:", updateError);
    return NextResponse.json(
      { error: "Failed to update activity" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: updated });
}

// DELETE: remove an activity (owner only)
export async function DELETE(
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

  const { data: activity } = await supabase
    .from("activities")
    .select("creator_id")
    .eq("id", activityId)
    .single();

  if (!activity) {
    return NextResponse.json(
      { error: "Activity not found" },
      { status: 404 }
    );
  }

  if (activity.creator_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId);

  if (error) {
    console.error("Failed to delete activity:", error);
    return NextResponse.json(
      { error: "Failed to delete activity" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { success: true } });
}
