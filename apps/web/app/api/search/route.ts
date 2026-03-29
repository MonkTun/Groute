import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";
import { callAI, AIError, getAIConfig } from "@/lib/ai";

interface ActivityForSearch {
  id: string;
  title: string;
  sport_type: string;
  skill_level: string;
  location_name: string;
  scheduled_at: string;
  trail_name: string | null;
  creator_name: string | null;
  participant_names: string[];
  has_friends_going: boolean;
  spots_left: number;
  distance_label: string | null;
}

interface SearchRequest {
  query: string;
  activities: ActivityForSearch[];
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

  const { hasKey } = getAIConfig();
  if (!hasKey) {
    console.error("[AI Search] API key is not set");
    return NextResponse.json(
      { error: "Search AI not configured" },
      { status: 503 }
    );
  }

  const body: SearchRequest = await request.json();
  const { query, activities } = body;

  if (!query || typeof query !== "string" || query.trim().length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  const today = new Date();
  const activityLines = activities
    .slice(0, 50)
    .map((a) => {
      const date = new Date(a.scheduled_at);
      const daysAway = Math.ceil(
        (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      const hoursAway = Math.ceil(
        (date.getTime() - today.getTime()) / (1000 * 60 * 60)
      );
      const timeLabel =
        hoursAway <= 0
          ? "happening now"
          : hoursAway <= 6
            ? `in ${hoursAway}h`
            : daysAway === 0
              ? "today"
              : daysAway === 1
                ? "tomorrow"
                : `in ${daysAway} days`;

      const parts = [
        `[${a.id}]`,
        `"${a.title}"`,
        a.sport_type,
        a.skill_level,
        a.location_name,
        a.trail_name ? `trail: ${a.trail_name}` : null,
        timeLabel,
        `${a.spots_left} spots left`,
        a.creator_name ? `by ${a.creator_name}` : null,
        a.participant_names.length > 0
          ? `going: ${a.participant_names.join(", ")}`
          : null,
        a.has_friends_going ? "FRIENDS GOING" : null,
        a.distance_label,
      ]
        .filter(Boolean)
        .join(" | ");

      return parts;
    })
    .join("\n");

  console.log(
    `[AI Search] query="${query.trim()}" activities=${activities.length}`
  );

  const systemPrompt = `You are the search engine for Groute, an outdoor activity app for young adults. Given the user's search and a list of activities, return the most relevant ones ranked by relevance.

Context about the user:
- Activities marked "FRIENDS GOING" are highly relevant (social signal)
- Activities marked "happening now" or "in Xh" are time-sensitive
- "spots left" indicates urgency — fewer spots = more urgent
- Distance labels indicate proximity — closer is better unless user asks for something specific

Available sport types: hiking, trail_running
Available skill levels: beginner, intermediate, advanced

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "rankedIds": [<activity IDs sorted by relevance, most relevant first, include ALL that match, max 20>],
  "sport": "hiking" | "trail_running" | null,
  "skill": "beginner" | "intermediate" | "advanced" | null,
  "timeframeDays": <number 0=today 1=tomorrow 7=week, or null>,
  "reasoning": "<one short sentence explaining why you ranked them this way>"
}`;

  const userMessage = `Search: "${query.trim()}"
Today: ${today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}

Activities:
${activityLines || "(none available)"}`;

  try {
    const result = await callAI(systemPrompt, userMessage, 512);
    console.log(`[AI Search] Raw: ${result.text.slice(0, 300)}`);

    const jsonStr = result.text
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(jsonStr);

    const validIds = new Set(activities.map((a) => a.id));
    parsed.rankedIds = (parsed.rankedIds ?? []).filter((id: string) =>
      validIds.has(id)
    );

    console.log(
      `[AI Search] Result: ${parsed.rankedIds.length} ranked, sport=${parsed.sport}, reasoning="${parsed.reasoning}"`
    );

    return NextResponse.json({ data: parsed });
  } catch (err) {
    console.error("[AI Search] Error:", err);
    if (err instanceof AIError) {
      return NextResponse.json(
        {
          error: "Search failed",
          debug: { status: err.status, body: err.body.slice(0, 200) },
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      {
        error: "Search failed",
        debug: {
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 }
    );
  }
}
