import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";

const SKILL_ORDER: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch user's sports, location, social graph, and candidate activities in parallel
  const [
    userSportsResult,
    userResult,
    followingResult,
    pastParticipantsResult,
    activitiesResult,
  ] = await Promise.all([
    supabase
      .from("user_sports")
      .select("sport_type, self_reported_level")
      .eq("user_id", user.id),

    supabase
      .from("users")
      .select("last_location_lat, last_location_lng")
      .eq("id", user.id)
      .single(),

    // Mutual follows (friends)
    (async () => {
      const [fwing, fwers] = await Promise.all([
        supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id),
        supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", user.id),
      ]);
      const followingSet = new Set(
        (fwing.data ?? []).map((f) => f.following_id)
      );
      const followerSet = new Set(
        (fwers.data ?? []).map((f) => f.follower_id)
      );
      return [...followingSet].filter((id) => followerSet.has(id));
    })(),

    // Past co-participants (people I've done activities with)
    supabase
      .from("activity_participants")
      .select("activity_id")
      .eq("user_id", user.id)
      .eq("status", "accepted"),

    // Candidate activities
    supabase
      .from("activities")
      .select(
        `
        id, title, description, sport_type, skill_level, visibility, creator_id, banner_url,
        location_lat, location_lng, location_name,
        scheduled_at, max_participants, status,
        creator:users!creator_id (
          id, display_name, first_name, last_name, avatar_url, area
        )
      `
      )
      .eq("status", "open")
      .neq("visibility", "private")
      .neq("creator_id", user.id)
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(100),
  ]);

  const activities = activitiesResult.data ?? [];
  if (activities.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Build user profile for scoring
  const sportSkills = new Map(
    (userSportsResult.data ?? []).map((s) => [
      s.sport_type,
      s.self_reported_level,
    ])
  );

  const userLat = userResult.data?.last_location_lat
    ? parseFloat(userResult.data.last_location_lat)
    : null;
  const userLng = userResult.data?.last_location_lng
    ? parseFloat(userResult.data.last_location_lng)
    : null;

  const friendIds = new Set(followingResult);

  // Get co-participant user IDs from past activities
  const pastActivityIds = (pastParticipantsResult.data ?? []).map(
    (p) => p.activity_id
  );
  let coParticipantIds = new Set<string>();
  if (pastActivityIds.length > 0) {
    const { data: coParticipants } = await supabase
      .from("activity_participants")
      .select("user_id")
      .in("activity_id", pastActivityIds.slice(0, 50))
      .eq("status", "accepted")
      .neq("user_id", user.id);
    coParticipantIds = new Set(
      (coParticipants ?? []).map((p) => p.user_id)
    );
  }

  // Fetch participants for candidate activities
  const activityIds = activities.map((a) => a.id);
  const { data: allParticipants } = await supabase
    .from("activity_participants")
    .select(
      `
      activity_id, user_id, status,
      user:users!user_id ( id, display_name, first_name, last_name, avatar_url )
    `
    )
    .in("activity_id", activityIds)
    .eq("status", "accepted");

  const participantsByActivity = new Map<
    string,
    Array<{
      id: string;
      display_name: string;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
    }>
  >();
  const participantIdsByActivity = new Map<string, Set<string>>();

  for (const p of allParticipants ?? []) {
    const u = Array.isArray(p.user) ? p.user[0] : p.user;
    if (!u) continue;
    const list = participantsByActivity.get(p.activity_id) ?? [];
    list.push(u);
    participantsByActivity.set(p.activity_id, list);

    const ids = participantIdsByActivity.get(p.activity_id) ?? new Set();
    ids.add(p.user_id);
    participantIdsByActivity.set(p.activity_id, ids);
  }

  // Check user's participation status
  const { data: userParticipation } = await supabase
    .from("activity_participants")
    .select("activity_id, status")
    .eq("user_id", user.id)
    .in("activity_id", activityIds);

  const participationMap = new Map(
    (userParticipation ?? []).map((p) => [p.activity_id, p.status])
  );

  // Score each activity
  const scored = activities.map((activity) => {
    let score = 0;

    // Sport match (0-40 points)
    const userSkill = sportSkills.get(activity.sport_type);
    if (userSkill) {
      score += 40;

      // Skill proximity bonus (0-20 points)
      const userLevel = SKILL_ORDER[userSkill] ?? 0;
      const activityLevel = SKILL_ORDER[activity.skill_level] ?? 0;
      const gap = Math.abs(userLevel - activityLevel);
      score += gap === 0 ? 20 : gap === 1 ? 10 : 0;
    }

    // Distance score (0-20 points, closer = better)
    let distanceMiles: number | null = null;
    if (
      userLat !== null &&
      userLng !== null &&
      activity.location_lat &&
      activity.location_lng
    ) {
      distanceMiles = haversineDistance(
        userLat,
        userLng,
        parseFloat(activity.location_lat),
        parseFloat(activity.location_lng)
      );
      if (distanceMiles <= 5) score += 20;
      else if (distanceMiles <= 15) score += 15;
      else if (distanceMiles <= 30) score += 10;
      else if (distanceMiles <= 60) score += 5;
    }

    // Friend overlap (0-15 points)
    const creatorIsFriend = friendIds.has(activity.creator_id);
    if (creatorIsFriend) score += 10;

    const pIds = participantIdsByActivity.get(activity.id) ?? new Set();
    const friendsGoing = [...pIds].filter((id) => friendIds.has(id)).length;
    score += Math.min(friendsGoing * 5, 15);

    // Co-participant overlap (0-5 points)
    if (coParticipantIds.has(activity.creator_id)) score += 3;
    const coParticipantsGoing = [...pIds].filter((id) =>
      coParticipantIds.has(id)
    ).length;
    score += Math.min(coParticipantsGoing * 2, 5);

    const creator = Array.isArray(activity.creator)
      ? activity.creator[0] ?? null
      : activity.creator;

    return {
      ...activity,
      creator,
      score,
      distanceMiles,
      participantStatus: participationMap.get(activity.id) ?? null,
      isOwner: false,
      participants: participantsByActivity.get(activity.id) ?? [],
    };
  });

  // Filter to activities with meaningful relevance, sort by score
  const recommended = scored
    .filter((a) => a.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  return NextResponse.json({ data: recommended });
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
