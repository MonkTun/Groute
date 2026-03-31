import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, getSupabaseAdmin, syncStravaActivities } from "@/lib/strava";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/profile?strava=error&reason=missing_params", request.url)
    );
  }

  const userId = state;

  try {
    const tokenData = await exchangeCodeForTokens(code);

    const admin = getSupabaseAdmin();
    const { error: updateError } = await admin
      .from("users")
      .update({
        strava_athlete_id: tokenData.athlete?.id ?? null,
        strava_connected: true,
        strava_access_token: tokenData.access_token,
        strava_refresh_token: tokenData.refresh_token,
        strava_token_expires_at: tokenData.expires_at,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[Strava Callback] Failed to update user:", updateError);
      return NextResponse.redirect(
        new URL("/profile?strava=error&reason=db_error", request.url)
      );
    }

    // Trigger initial sync in background (fire-and-forget)
    syncStravaActivities(userId).catch((err) => {
      console.error("[Strava Callback] Background sync failed:", err);
    });

    return NextResponse.redirect(
      new URL("/profile?strava=connected", request.url)
    );
  } catch (err) {
    console.error("[Strava Callback] OAuth exchange failed:", err);
    return NextResponse.redirect(
      new URL("/profile?strava=error&reason=oauth_failed", request.url)
    );
  }
}
