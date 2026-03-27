import { NextResponse } from "next/server";

import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch activities I created and activities I'm participating in, in parallel
  const [createdResult, participatingResult] = await Promise.all([
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
    },
  });
}
