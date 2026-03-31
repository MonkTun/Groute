import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { SportType } from "@groute/shared";

// ── Supabase admin client (service role for background operations) ──

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabaseAdmin;
}

// ── Strava API response schemas ──

const stravaTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(),
  token_type: z.string(),
  athlete: z
    .object({
      id: z.number(),
      firstname: z.string().optional(),
      lastname: z.string().optional(),
    })
    .optional(),
});

const stravaActivityResponseSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  sport_type: z.string(),
  distance: z.number().optional(),
  total_elevation_gain: z.number().optional(),
  moving_time: z.number().optional(),
  start_date: z.string().optional(),
  start_latlng: z.array(z.number()).nullable().optional(),
});

export type StravaActivityResponse = z.infer<typeof stravaActivityResponseSchema>;

// ── Sport type mapping ──

const STRAVA_TO_SPORT_TYPE: Record<string, SportType> = {
  Hike: "hiking",
  Hiking: "hiking",
  TrailRun: "trail_running",
  Trail_Run: "trail_running",
  VirtualHike: "hiking",
  Run: "running",
  VirtualRun: "running",
  Ride: "cycling",
  VirtualRide: "cycling",
  MountainBikeRide: "cycling",
  GravelRide: "cycling",
  EBikeRide: "cycling",
  Velodrome: "cycling",
  Handcycle: "cycling",
};

export function mapStravaToSportType(stravaType: string): SportType | null {
  return STRAVA_TO_SPORT_TYPE[stravaType] ?? null;
}

// ── OAuth: exchange authorization code for tokens ──

export async function exchangeCodeForTokens(code: string) {
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Strava OAuth exchange failed (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const parsed = stravaTokenResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid Strava token response: ${parsed.error.message}`);
  }

  return parsed.data;
}

// ── Token refresh ──

export async function refreshStravaToken(
  userId: string,
  refreshToken: string
): Promise<string> {
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Strava token refresh failed (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const parsed = stravaTokenResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid Strava refresh response: ${parsed.error.message}`);
  }

  const admin = getSupabaseAdmin();
  await admin
    .from("users")
    .update({
      strava_access_token: parsed.data.access_token,
      strava_refresh_token: parsed.data.refresh_token,
      strava_token_expires_at: parsed.data.expires_at,
    })
    .eq("id", userId);

  return parsed.data.access_token;
}

// ── Get a valid access token (refresh if expired) ──

export async function getValidStravaToken(userId: string): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data: user, error } = await admin
    .from("users")
    .select("strava_access_token, strava_refresh_token, strava_token_expires_at, strava_connected")
    .eq("id", userId)
    .single();

  if (error || !user) {
    throw new Error(`User not found: ${userId}`);
  }

  if (!user.strava_connected || !user.strava_access_token || !user.strava_refresh_token) {
    throw new Error(`User ${userId} does not have Strava connected`);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (user.strava_token_expires_at && user.strava_token_expires_at > nowSeconds + 60) {
    return user.strava_access_token;
  }

  return refreshStravaToken(userId, user.strava_refresh_token);
}

// ── Generic Strava API fetch wrapper ──

export async function stravaFetch<T>(
  userId: string,
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const token = await getValidStravaToken(userId);
  const url = new URL(`https://www.strava.com/api/v3/${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    // Token might have been revoked — mark user as disconnected
    const admin = getSupabaseAdmin();
    await admin
      .from("users")
      .update({ strava_connected: false })
      .eq("id", userId);
    throw new Error("Strava token revoked");
  }

  if (response.status === 429) {
    throw new Error("Strava rate limit exceeded");
  }

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Strava API error (${response.status}): ${errBody}`);
  }

  return response.json() as Promise<T>;
}

// ── Fetch paginated activities ──

export async function fetchAthleteActivities(
  userId: string,
  after: number,
  page: number,
  perPage = 100
): Promise<StravaActivityResponse[]> {
  const data = await stravaFetch<unknown[]>(userId, "athlete/activities", {
    after: String(after),
    page: String(page),
    per_page: String(perPage),
  });

  return data
    .map((item) => stravaActivityResponseSchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => r.data);
}

// ── Fetch a single activity (for webhook events) ──

export async function fetchSingleActivity(
  userId: string,
  stravaActivityId: number
): Promise<StravaActivityResponse | null> {
  const data = await stravaFetch<unknown>(
    userId,
    `activities/${stravaActivityId}`
  );
  const parsed = stravaActivityResponseSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

// ── Sync all activities for a user (last N months) ──

export async function syncStravaActivities(userId: string): Promise<void> {
  const SYNC_MONTHS = 24;
  const afterDate = new Date();
  afterDate.setMonth(afterDate.getMonth() - SYNC_MONTHS);
  const after = Math.floor(afterDate.getTime() / 1000);

  const admin = getSupabaseAdmin();
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const activities = await fetchAthleteActivities(userId, after, page);

    if (activities.length === 0) {
      hasMore = false;
      break;
    }

    const rows = activities
      .map((a) => {
        const sportType = mapStravaToSportType(a.sport_type);
        if (!sportType) return null;
        return {
          user_id: userId,
          strava_activity_id: a.id,
          sport_type: sportType,
          name: a.name ?? null,
          distance_meters: a.distance ?? null,
          elevation_gain_meters: a.total_elevation_gain ?? null,
          moving_time_seconds: a.moving_time ?? null,
          start_date: a.start_date ?? null,
          start_latlng: a.start_latlng ? a.start_latlng.join(",") : null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length > 0) {
      await admin.from("strava_activities").upsert(rows, {
        onConflict: "strava_activity_id",
      });
    }

    if (activities.length < 100) {
      hasMore = false;
    } else {
      page++;
    }
  }

  // Import dynamically to avoid circular dependency
  const { computeAndStoreSkillVerification } = await import(
    "./strava-verification"
  );
  await computeAndStoreSkillVerification(userId);
}
