import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getSupabaseAdmin } from "@/lib/strava";
import { clearCache } from "@/lib/strava-verification";

export async function POST(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // Clear Strava tokens and connection status
  await admin
    .from("users")
    .update({
      strava_connected: false,
      strava_access_token: null,
      strava_refresh_token: null,
      strava_token_expires_at: null,
      strava_athlete_id: null,
    })
    .eq("id", user.id);

  // Delete all synced Strava activities
  await admin
    .from("strava_activities")
    .delete()
    .eq("user_id", user.id);

  // Clear verification data from user_sports
  await admin
    .from("user_sports")
    .update({
      strava_verified_level: null,
      strava_stats: null,
    })
    .eq("user_id", user.id);

  // Clear Redis cache
  await clearCache(user.id);

  return NextResponse.json({ data: { success: true } });
}
