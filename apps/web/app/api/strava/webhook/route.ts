import { NextRequest, NextResponse } from "next/server";
import {
  fetchSingleActivity,
  mapStravaToSportType,
  getSupabaseAdmin,
} from "@/lib/strava";
import { computeAndStoreSkillVerification } from "@/lib/strava-verification";

// Strava webhook subscription validation
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const challenge = searchParams.get("hub.challenge");
  const verifyToken = searchParams.get("hub.verify_token");

  if (
    mode === "subscribe" &&
    verifyToken === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
  ) {
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Strava webhook event handler
export async function POST(request: NextRequest) {
  const body = await request.json();

  const {
    object_type,
    aspect_type,
    object_id,
    owner_id,
  } = body as {
    object_type: string;
    aspect_type: string;
    object_id: number;
    owner_id: number;
  };

  // Only process activity events
  if (object_type !== "activity") {
    return NextResponse.json({ status: "ignored" });
  }

  // Process in background — Strava expects a fast 200 response
  processWebhookEvent(aspect_type, object_id, owner_id).catch((err) => {
    console.error("[Strava Webhook] Background processing failed:", err);
  });

  return NextResponse.json({ status: "ok" });
}

async function processWebhookEvent(
  aspectType: string,
  objectId: number,
  ownerId: number
): Promise<void> {
  const admin = getSupabaseAdmin();

  // Look up user by Strava athlete ID
  const { data: user, error } = await admin
    .from("users")
    .select("id, strava_connected")
    .eq("strava_athlete_id", ownerId)
    .single();

  if (error || !user || !user.strava_connected) {
    return;
  }

  const userId = user.id;

  if (aspectType === "delete") {
    await admin
      .from("strava_activities")
      .delete()
      .eq("strava_activity_id", objectId);

    await computeAndStoreSkillVerification(userId);
    return;
  }

  // create or update
  const activity = await fetchSingleActivity(userId, objectId);
  if (!activity) return;

  const sportType = mapStravaToSportType(activity.sport_type);
  if (!sportType) return;

  await admin.from("strava_activities").upsert(
    {
      user_id: userId,
      strava_activity_id: activity.id,
      sport_type: sportType,
      name: activity.name ?? null,
      distance_meters: activity.distance ?? null,
      elevation_gain_meters: activity.total_elevation_gain ?? null,
      moving_time_seconds: activity.moving_time ?? null,
      start_date: activity.start_date ?? null,
      start_latlng: activity.start_latlng
        ? activity.start_latlng.join(",")
        : null,
    },
    { onConflict: "strava_activity_id" }
  );

  await computeAndStoreSkillVerification(userId);
}
