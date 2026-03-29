import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const supabase = await createApiClient(request);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check privacy: if viewing someone else's profile, check their show_activity_history pref
  if (userId !== user.id) {
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("show_activity_history")
      .eq("user_id", userId)
      .maybeSingle();

    if (prefs && prefs.show_activity_history === false) {
      return NextResponse.json({ data: { activities: [], stats: null } });
    }
  }

  // Get past activities where user was creator or accepted participant
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const offset = (page - 1) * limit;

  // Activities created by user (past)
  const { data: createdActivities } = await supabase
    .from("activities")
    .select("id, title, sport_type, location_name, scheduled_at, banner_url, max_participants, status")
    .eq("creator_id", userId)
    .lt("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Activities user joined (accepted, past)
  const { data: participantRows } = await supabase
    .from("activity_participants")
    .select("activity_id")
    .eq("user_id", userId)
    .eq("status", "accepted");

  const joinedActivityIds = (participantRows ?? []).map((r) => r.activity_id);

  let joinedActivities: typeof createdActivities = [];
  if (joinedActivityIds.length > 0) {
    const { data } = await supabase
      .from("activities")
      .select("id, title, sport_type, location_name, scheduled_at, banner_url, max_participants, status")
      .in("id", joinedActivityIds)
      .neq("creator_id", userId) // exclude ones they created (already in createdActivities)
      .lt("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: false })
      .range(offset, offset + limit - 1);
    joinedActivities = data;
  }

  // Merge and sort by date desc
  const all = [...(createdActivities ?? []), ...(joinedActivities ?? [])];
  all.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  // Get participant counts for each activity
  const activityIds = all.map((a) => a.id);
  let participantCounts: Record<string, number> = {};
  if (activityIds.length > 0) {
    const { data: counts } = await supabase
      .from("activity_participants")
      .select("activity_id")
      .in("activity_id", activityIds)
      .eq("status", "accepted");

    participantCounts = (counts ?? []).reduce<Record<string, number>>((acc, row) => {
      acc[row.activity_id] = (acc[row.activity_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  const activities = all.slice(0, limit).map((a) => ({
    ...a,
    participantCount: (participantCounts[a.id] ?? 0) + 1, // +1 for creator
    isCreator: (createdActivities ?? []).some((c) => c.id === a.id),
  }));

  // Stats
  const totalTrips = all.length;
  const uniqueSports = new Set(all.map((a) => a.sport_type));

  // People met: unique users from activities
  let peopleMet = 0;
  if (activityIds.length > 0) {
    const { data: allParticipants } = await supabase
      .from("activity_participants")
      .select("user_id")
      .in("activity_id", activityIds)
      .eq("status", "accepted")
      .neq("user_id", userId);

    const uniquePeople = new Set((allParticipants ?? []).map((p) => p.user_id));
    peopleMet = uniquePeople.size;
  }

  return NextResponse.json({
    data: {
      activities,
      stats: {
        totalTrips,
        uniqueSports: uniqueSports.size,
        peopleMet,
      },
    },
  });
}
