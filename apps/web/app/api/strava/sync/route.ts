import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { syncStravaActivities, getSupabaseAdmin } from "@/lib/strava";
import { redis } from "@/lib/redis";

export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: sports, error } = await admin
    .from("user_sports")
    .select("sport_type, self_reported_level, strava_verified_level, strava_stats")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }

  return NextResponse.json({ data: { sports: sports ?? [] } });
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

  // Check Strava connection
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("users")
    .select("strava_connected")
    .eq("id", user.id)
    .single();

  if (!profile?.strava_connected) {
    return NextResponse.json(
      { error: "Strava not connected" },
      { status: 400 }
    );
  }

  // Rate limit: 1 sync per 5 minutes
  if (redis) {
    const lockKey = `strava:sync-lock:${user.id}`;
    try {
      const locked = await redis.get(lockKey);
      if (locked) {
        return NextResponse.json(
          { error: "Sync already in progress. Please wait a few minutes." },
          { status: 429 }
        );
      }
      await redis.set(lockKey, "1", { ex: 300 });
    } catch {
      // Redis down — allow the sync anyway
    }
  }

  // Trigger sync in background
  syncStravaActivities(user.id).catch((err) => {
    console.error("[Strava Sync] Background sync failed:", err);
  });

  return NextResponse.json({ data: { status: "syncing" } });
}
