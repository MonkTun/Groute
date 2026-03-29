import { NextRequest, NextResponse } from "next/server";

import { createActivitySchema } from "@groute/shared";

import { createApiClient } from "@/lib/supabase/api";

export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const sportType = searchParams.get("sportType");
  const status = searchParams.get("status") || "open";

  let query = supabase
    .from("activities")
    .select(
      `
      id, title, description, sport_type, skill_level, banner_url, location_lat, location_lng, location_name, max_participants, scheduled_at, status, created_at, creator_id,
      creator:users!creator_id (
        id,
        display_name,
        first_name,
        last_name,
        avatar_url,
        area
      )
    `
    )
    .eq("status", status)
    .neq("visibility", "private")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (sportType) {
    query = query.eq("sport_type", sportType);
  }

  const { data: activities, error } = await query;

  if (error) {
    console.error("Failed to fetch activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }

  // Fetch participant counts for returned activities
  const activityIds = (activities ?? []).map((a) => a.id);
  let participantCounts: Record<string, number> = {};

  if (activityIds.length > 0) {
    const { data: participants } = await supabase
      .from("activity_participants")
      .select("activity_id")
      .in("activity_id", activityIds)
      .eq("status", "accepted");

    const countMap: Record<string, number> = {};
    for (const p of participants ?? []) {
      countMap[p.activity_id] = (countMap[p.activity_id] ?? 0) + 1;
    }
    participantCounts = countMap;
  }

  const activitiesWithCounts = (activities ?? []).map((a) => ({
    ...a,
    participant_count: (participantCounts[a.id] ?? 0) + 1, // +1 for creator
  }));

  return NextResponse.json({ data: activitiesWithCounts });
}

export async function POST(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const invitedUserIds: string[] = body.invitedUserIds ?? [];
  const parsed = createActivitySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const { data: activity, error } = await supabase
      .from("activities")
      .insert({
        creator_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        sport_type: parsed.data.sportType,
        skill_level: parsed.data.skillLevel,
        visibility: parsed.data.visibility,
        location_lat: String(parsed.data.location.latitude),
        location_lng: String(parsed.data.location.longitude),
        location_name: parsed.data.locationName,
        max_participants: parsed.data.maxParticipants,
        scheduled_at: parsed.data.scheduledAt,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create activity:", error);
      return NextResponse.json(
        { error: "Failed to create activity" },
        { status: 500 }
      );
    }

    // Create initial group chat message + send invites
    if (activity) {
      await supabase.from("messages").insert({
        activity_id: activity.id,
        sender_id: user.id,
        content: "created this activity. Welcome to the group!",
      });

      // Send invite notifications to selected friends
      if (invitedUserIds.length > 0) {
        const notifications = invitedUserIds.map((friendId) => ({
          user_id: friendId,
          from_user_id: user.id,
          type: "invite",
          activity_id: activity.id,
        }));
        await supabase.from("notifications").insert(notifications);

        // Also send a DM to each invited friend
        const inviteMessages = invitedUserIds.map((friendId) => ({
          sender_id: user.id,
          receiver_id: friendId,
          content: `[invite:${activity.id}] ${activity.title}`,
        }));
        await supabase.from("messages").insert(inviteMessages);
      }
    }

    return NextResponse.json({ data: activity }, { status: 201 });
  } catch (err) {
    console.error("Activity creation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
