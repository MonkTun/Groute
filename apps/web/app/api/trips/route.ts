import { NextRequest, NextResponse } from "next/server";

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

  // Fetch activities I created, participating in, and pending requests in parallel
  const [createdResult, participatingResult, pendingResult] = await Promise.all([
    supabase
      .from("activities")
      .select(
        `
        id, title, description, sport_type, skill_level,
        location_lat, location_lng, location_name,
        max_participants, scheduled_at, status, created_at
      `
      )
      .eq("creator_id", user.id)
      .order("scheduled_at", { ascending: false }),

    supabase
      .from("activity_participants")
      .select(
        `
        status,
        joined_at,
        activity:activities!activity_id (
          id, title, description, sport_type, skill_level,
          location_lat, location_lng, location_name,
          max_participants, scheduled_at, status, created_at,
          creator:users!creator_id (
            id, display_name, first_name, last_name
          )
        )
      `
      )
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false }),

    // Pending join requests for activities I created
    (async () => {
      const { data: myActivities } = await supabase
        .from("activities")
        .select("id")
        .eq("creator_id", user.id);

      if (!myActivities?.length) return [];

      const activityIds = myActivities.map((a) => a.id);
      const { data: pending } = await supabase
        .from("activity_participants")
        .select(
          `id, user_id, activity_id, status, joined_at,
           user:users!user_id ( id, display_name, first_name, last_name, avatar_url ),
           activity:activities!activity_id ( id, title, sport_type )`
        )
        .in("activity_id", activityIds)
        .eq("status", "requested")
        .order("joined_at", { ascending: false });

      return (pending ?? []).map((p) => ({
        ...p,
        user: Array.isArray(p.user) ? p.user[0] : p.user,
        activity: Array.isArray(p.activity) ? p.activity[0] : p.activity,
      }));
    })(),
  ]);

  if (createdResult.error) {
    console.error("Failed to fetch created activities:", createdResult.error);
    return NextResponse.json(
      { error: "Failed to fetch trips" },
      { status: 500 }
    );
  }

  // Normalize participating data — Supabase returns joined relations as arrays
  const participating = (participatingResult.data ?? []).map((p) => ({
    participantStatus: p.status,
    joinedAt: p.joined_at,
    ...(Array.isArray(p.activity) ? p.activity[0] : p.activity),
    creator: (() => {
      const act = Array.isArray(p.activity) ? p.activity[0] : p.activity;
      if (!act) return null;
      const c = act.creator;
      return Array.isArray(c) ? c[0] ?? null : c;
    })(),
  }));

  return NextResponse.json({
    data: {
      created: createdResult.data ?? [],
      participating,
      pendingRequests: pendingResult,
    },
  });
}
