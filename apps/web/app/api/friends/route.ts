import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";

// GET: list mutual follows (friends)
export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [followingResult, followersResult] = await Promise.all([
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
    (followingResult.data ?? []).map((f) => f.following_id)
  );
  const followerSet = new Set(
    (followersResult.data ?? []).map((f) => f.follower_id)
  );

  // Mutual follows
  const mutualIds = [...followingSet].filter((id) => followerSet.has(id));

  if (mutualIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const { data: friends } = await supabase
    .from("users")
    .select("id, display_name, first_name, last_name, avatar_url, area, last_location_lat, last_location_lng, last_location_at")
    .in("id", mutualIds);

  return NextResponse.json({ data: friends ?? [] });
}
