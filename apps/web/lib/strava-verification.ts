import type { SportType, StravaVerifiedLevel, StravaStats, StravaAiAnalysis } from "@groute/shared";
import { stravaAiAnalysisSchema } from "@groute/shared";
import { callAI } from "./ai";
import { redis } from "./redis";
import { getSupabaseAdmin } from "./strava";

// ── Activity summary for AI analysis ──

interface ActivitySummary {
  sportType: SportType;
  totalActivities: number;
  dateRange: { earliest: string; latest: string };
  activitiesPerWeek: number;
  longestWeeklyStreak: number;
  gapsOverTwoWeeks: number;
  distance: {
    avgKm: number;
    maxKm: number;
    totalKm: number;
    trend: "increasing" | "stable" | "decreasing";
  };
  elevation: {
    avgM: number;
    maxM: number;
    totalM: number;
  };
  duration: {
    avgMin: number;
    maxMin: number;
  };
  recentMonthCount: number;
  firstMonthCount: number;
  mostImpressive: {
    name: string;
    distanceKm: number;
    elevationM: number;
    durationMin: number;
    date: string;
  } | null;
}

interface RawActivity {
  sport_type: string;
  name: string | null;
  distance_meters: number | null;
  elevation_gain_meters: number | null;
  moving_time_seconds: number | null;
  start_date: string | null;
}

function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${year}-W${week}`;
}

export function summarizeActivitiesForAI(
  activities: RawActivity[],
  sportType: SportType
): ActivitySummary | null {
  const filtered = activities.filter((a) => a.sport_type === sportType && a.start_date);
  if (filtered.length === 0) return null;

  // Sort by date ascending
  filtered.sort(
    (a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime()
  );

  const dates = filtered.map((a) => new Date(a.start_date!));
  const earliest = dates[0];
  const latest = dates[dates.length - 1];

  // Frequency
  const totalWeeks = Math.max(
    1,
    (latest.getTime() - earliest.getTime()) / (7 * 86400000)
  );
  const activitiesPerWeek = filtered.length / totalWeeks;

  // Weekly streak analysis
  const weekSet = new Set(dates.map((d) => getWeekKey(d)));
  const allWeeks: string[] = [];
  const cursor = new Date(earliest);
  while (cursor <= latest) {
    allWeeks.push(getWeekKey(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  const uniqueWeeks = [...new Set(allWeeks)];

  let longestWeeklyStreak = 0;
  let currentStreak = 0;
  let gapsOverTwoWeeks = 0;
  let consecutiveEmpty = 0;

  for (const week of uniqueWeeks) {
    if (weekSet.has(week)) {
      currentStreak++;
      longestWeeklyStreak = Math.max(longestWeeklyStreak, currentStreak);
      consecutiveEmpty = 0;
    } else {
      currentStreak = 0;
      consecutiveEmpty++;
      if (consecutiveEmpty === 2) gapsOverTwoWeeks++;
    }
  }

  // Distance stats
  const distances = filtered
    .map((a) => a.distance_meters ?? 0)
    .map((d) => d / 1000);
  const avgDistKm = distances.reduce((s, d) => s + d, 0) / distances.length;
  const maxDistKm = Math.max(...distances);
  const totalDistKm = distances.reduce((s, d) => s + d, 0);

  // Distance trend: compare first half avg vs second half avg
  const halfIdx = Math.floor(distances.length / 2);
  const firstHalfAvg =
    distances.slice(0, halfIdx).reduce((s, d) => s + d, 0) / Math.max(1, halfIdx);
  const secondHalfAvg =
    distances.slice(halfIdx).reduce((s, d) => s + d, 0) /
    Math.max(1, distances.length - halfIdx);
  let distanceTrend: "increasing" | "stable" | "decreasing" = "stable";
  if (secondHalfAvg > firstHalfAvg * 1.15) distanceTrend = "increasing";
  else if (secondHalfAvg < firstHalfAvg * 0.85) distanceTrend = "decreasing";

  // Elevation stats
  const elevations = filtered.map((a) => a.elevation_gain_meters ?? 0);
  const avgElevM = elevations.reduce((s, e) => s + e, 0) / elevations.length;
  const maxElevM = Math.max(...elevations);
  const totalElevM = elevations.reduce((s, e) => s + e, 0);

  // Duration stats
  const durations = filtered
    .map((a) => a.moving_time_seconds ?? 0)
    .map((s) => s / 60);
  const avgDurMin = durations.reduce((s, d) => s + d, 0) / durations.length;
  const maxDurMin = Math.max(...durations);

  // Recent vs first month
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const firstMonthEnd = new Date(earliest);
  firstMonthEnd.setMonth(firstMonthEnd.getMonth() + 1);

  const recentMonthCount = filtered.filter(
    (a) => new Date(a.start_date!) >= oneMonthAgo
  ).length;
  const firstMonthCount = filtered.filter(
    (a) => new Date(a.start_date!) <= firstMonthEnd
  ).length;

  // Most impressive activity (by combined distance + elevation score)
  const best = filtered.reduce((top, a) => {
    const score = (a.distance_meters ?? 0) / 1000 + (a.elevation_gain_meters ?? 0) / 100;
    const topScore = (top.distance_meters ?? 0) / 1000 + (top.elevation_gain_meters ?? 0) / 100;
    return score > topScore ? a : top;
  }, filtered[0]);

  const mostImpressive = best
    ? {
        name: best.name ?? "Unnamed activity",
        distanceKm: Math.round(((best.distance_meters ?? 0) / 1000) * 10) / 10,
        elevationM: Math.round(best.elevation_gain_meters ?? 0),
        durationMin: Math.round((best.moving_time_seconds ?? 0) / 60),
        date: new Date(best.start_date!).toISOString().split("T")[0],
      }
    : null;

  return {
    sportType,
    totalActivities: filtered.length,
    dateRange: {
      earliest: earliest.toISOString().split("T")[0],
      latest: latest.toISOString().split("T")[0],
    },
    activitiesPerWeek: Math.round(activitiesPerWeek * 10) / 10,
    longestWeeklyStreak,
    gapsOverTwoWeeks,
    distance: {
      avgKm: Math.round(avgDistKm * 10) / 10,
      maxKm: Math.round(maxDistKm * 10) / 10,
      totalKm: Math.round(totalDistKm * 10) / 10,
      trend: distanceTrend,
    },
    elevation: {
      avgM: Math.round(avgElevM),
      maxM: Math.round(maxElevM),
      totalM: Math.round(totalElevM),
    },
    duration: {
      avgMin: Math.round(avgDurMin),
      maxMin: Math.round(maxDurMin),
    },
    recentMonthCount,
    firstMonthCount,
    mostImpressive,
  };
}

// ── AI prompt ──

const SYSTEM_PROMPT = `You are a supportive outdoor activity experience evaluator for a social app that connects people through sports.
You analyze summarized Strava activity data to determine a user's experience level for a specific sport.

Your tone should be encouraging and highlight accomplishments. Write in THIRD PERSON (e.g. "This runner has...", "They've logged...", "Their longest ride was...") since this text is displayed on the user's public profile for others to read. Focus on what they HAVE done, not what they haven't. Reference their most impressive activity by name when available. Frame the assessment positively — every level is great, you're just helping people find the right activity partners.

You must respond with ONLY a JSON object in this exact format (no markdown fences, no extra text):
{
  "level": "beginner" | "intermediate" | "advanced" | "expert",
  "confidence": "low" | "medium" | "high",
  "reasoning": "2-3 sentence third-person summary highlighting their accomplishments and standout activities",
  "highlights": ["positive achievement 1", "positive achievement 2"]
}

Assessment criteria (consider ALL holistically):
- Consistency: Regular weekly/monthly activity over extended periods indicates experience
- Volume: Total number of activities and cumulative distance/elevation
- Progression: Are distances, elevation gains, or durations increasing over time?
- Intensity: Average and peak metrics compared to sport norms
- Recency: Recent activity is weighted more than old activity

Level guidelines (apply across all sports — adjust thresholds for sport norms):

For hiking:
- Beginner: Getting started — fewer than 10 hikes or shorter distances (< 5km avg)
- Intermediate: Building a solid habit — regular outings, moderate distances (5-15km), meaningful elevation
- Advanced: Strong and consistent — long distances (15km+), significant elevation (600m+), months of regular activity
- Expert: Exceptionally dedicated — very high volume, long distances, high elevation, year+ of weekly consistency

For trail running:
- Beginner: Getting into it — fewer than 10 runs or shorter distances
- Intermediate: Solid runner — regular runs (2-3x/week), moderate distances (5-15km)
- Advanced: Strong commitment — high volume, long distances (15km+), significant elevation
- Expert: Elite consistency — very high volume, 20km+ distances, year+ of dedication

For running:
- Beginner: Starting out — fewer than 10 runs or short distances (< 5km avg)
- Intermediate: Regular runner — consistent runs, moderate distances (5-15km)
- Advanced: Dedicated runner — high frequency, longer distances (10-20km), months of consistency
- Expert: Serious athlete — very high volume, long distances (20km+), year+ consistency

For cycling:
- Beginner: New to cycling — fewer than 10 rides or short distances (< 20km avg)
- Intermediate: Regular rider — consistent rides, moderate distances (20-50km)
- Advanced: Strong cyclist — high frequency, longer distances (50-100km), significant elevation
- Expert: Very dedicated — high volume, long distances (100km+), year+ of consistent riding

If data is insufficient (< 3 activities), set level to the user's self-reported level, confidence to "low", and note they're just getting started with tracking.`;

function buildUserMessage(
  summary: ActivitySummary,
  selfReportedLevel: string
): string {
  let msg = `Sport: ${summary.sportType}
User's self-reported level: ${selfReportedLevel}

Activity summary:
- Total activities: ${summary.totalActivities}
- Date range: ${summary.dateRange.earliest} to ${summary.dateRange.latest}
- Frequency: ${summary.activitiesPerWeek} per week average
- Consistency: ${summary.longestWeeklyStreak} consecutive weeks active, ${summary.gapsOverTwoWeeks} gaps > 2 weeks
- Distance: avg ${summary.distance.avgKm}km, max ${summary.distance.maxKm}km, total ${summary.distance.totalKm}km
- Elevation: avg ${summary.elevation.avgM}m gain, max ${summary.elevation.maxM}m, total ${summary.elevation.totalM}m
- Duration: avg ${summary.duration.avgMin}min, max ${summary.duration.maxMin}min
- Trend: ${summary.recentMonthCount} activities last month vs ${summary.firstMonthCount} in first month of data
- Distance progression: ${summary.distance.trend}`;

  if (summary.mostImpressive) {
    const mi = summary.mostImpressive;
    msg += `\n\nMost impressive activity: "${mi.name}" on ${mi.date} — ${mi.distanceKm}km, ${mi.elevationM}m elevation, ${mi.durationMin}min`;
  }

  return msg;
}

// ── Simple threshold fallback (used when AI fails) ──

function thresholdVerification(
  summary: ActivitySummary
): StravaVerifiedLevel {
  const { totalActivities, distance, elevation } = summary;

  if (totalActivities < 10 || distance.avgKm < 5) return "beginner";

  if (totalActivities >= 100 && distance.avgKm >= 15 && elevation.avgM >= 600) {
    return "expert";
  }

  if (totalActivities >= 50 && distance.avgKm >= 10 && elevation.avgM >= 400) {
    return "advanced";
  }

  return "intermediate";
}

// ── Core verification function ──

async function verifySkillForSport(
  summary: ActivitySummary,
  selfReportedLevel: string
): Promise<StravaAiAnalysis> {
  // Insufficient data
  if (summary.totalActivities < 3) {
    return {
      level: selfReportedLevel as StravaVerifiedLevel,
      confidence: "low",
      reasoning:
        "Insufficient Strava data (fewer than 3 activities). Using self-reported level as baseline.",
      highlights: ["Insufficient data"],
    };
  }

  try {
    const userMessage = buildUserMessage(summary, selfReportedLevel);
    const response = await callAI(SYSTEM_PROMPT, userMessage, 300);

    // Strip markdown fences if present
    let text = response.text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(text);
    const validated = stravaAiAnalysisSchema.safeParse(parsed);

    if (validated.success) {
      return validated.data;
    }

    console.warn(
      "[Strava AI] Invalid AI response shape, falling back to threshold:",
      validated.error.message
    );
  } catch (err) {
    console.error("[Strava AI] AI call failed, falling back to threshold:", err);
  }

  // Fallback to threshold-based verification
  const level = thresholdVerification(summary);
  return {
    level,
    confidence: "medium",
    reasoning: `Determined by activity metrics: ${summary.totalActivities} activities, ${summary.distance.avgKm}km avg distance, ${summary.elevation.avgM}m avg elevation.`,
    highlights: ["Threshold-based assessment (AI unavailable)"],
  };
}

// ── Orchestrator: compute and store verification for all sports ──

export async function computeAndStoreSkillVerification(
  userId: string
): Promise<void> {
  const admin = getSupabaseAdmin();

  // Fetch all strava activities for this user
  const { data: activities, error: actError } = await admin
    .from("strava_activities")
    .select("sport_type, name, distance_meters, elevation_gain_meters, moving_time_seconds, start_date")
    .eq("user_id", userId);

  if (actError || !activities) {
    console.error("[Strava Verification] Failed to fetch activities:", actError);
    return;
  }

  // Fetch user's sports
  const { data: sports, error: sportsError } = await admin
    .from("user_sports")
    .select("id, sport_type, self_reported_level")
    .eq("user_id", userId);

  if (sportsError || !sports || sports.length === 0) {
    console.error("[Strava Verification] No sports found for user:", sportsError);
    return;
  }

  for (const sport of sports) {
    const sportType = sport.sport_type as SportType;
    const summary = summarizeActivitiesForAI(activities, sportType);

    if (!summary) {
      // No activities for this sport
      const analysis: StravaAiAnalysis = {
        level: sport.self_reported_level as StravaVerifiedLevel,
        confidence: "low",
        reasoning: "No Strava activities found for this sport. Using self-reported level.",
        highlights: ["No Strava data"],
      };

      const stats: StravaStats = {
        totalActivities: 0,
        avgDistanceKm: 0,
        avgElevationM: 0,
        totalDistanceKm: 0,
        lastSyncedAt: new Date().toISOString(),
        aiAnalysis: analysis,
      };

      await admin
        .from("user_sports")
        .update({
          strava_verified_level: analysis.level,
          strava_stats: stats,
        })
        .eq("id", sport.id);

      await cacheResult(userId, sportType, stats);
      continue;
    }

    const analysis = await verifySkillForSport(summary, sport.self_reported_level);

    const stats: StravaStats = {
      totalActivities: summary.totalActivities,
      avgDistanceKm: summary.distance.avgKm,
      avgElevationM: summary.elevation.avgM,
      totalDistanceKm: summary.distance.totalKm,
      lastSyncedAt: new Date().toISOString(),
      aiAnalysis: analysis,
    };

    await admin
      .from("user_sports")
      .update({
        strava_verified_level: analysis.level,
        strava_stats: stats,
      })
      .eq("id", sport.id);

    await cacheResult(userId, sportType, stats);
  }
}

// ── Redis caching ──

const CACHE_TTL_SECONDS = 86400; // 24 hours

async function cacheResult(
  userId: string,
  sportType: SportType,
  stats: StravaStats
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(
      `strava:skill:${userId}:${sportType}`,
      JSON.stringify(stats),
      { ex: CACHE_TTL_SECONDS }
    );
  } catch (err) {
    // Redis down — non-fatal, fall through to DB on next read
    console.warn("[Strava Cache] Redis write failed:", err);
  }
}

export async function getCachedResult(
  userId: string,
  sportType: SportType
): Promise<StravaStats | null> {
  if (!redis) return null;
  try {
    const cached = await redis.get<string>(`strava:skill:${userId}:${sportType}`);
    if (!cached) return null;
    return typeof cached === "string" ? JSON.parse(cached) : cached;
  } catch {
    return null;
  }
}

export async function clearCache(userId: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(`strava:skill:${userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Non-fatal
  }
}
