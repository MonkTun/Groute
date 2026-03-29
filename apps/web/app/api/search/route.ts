import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface SearchRequest {
  query: string;
  activities: Array<{
    id: string;
    title: string;
    sport_type: string;
    skill_level: string;
    location_name: string;
    scheduled_at: string;
    trail_name: string | null;
  }>;
}

interface ParsedFilters {
  sport: string | null;
  skill: string | null;
  timeframeDays: number | null;
  locationKeyword: string | null;
  trailKeyword: string | null;
  rankedIds: string[];
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

  if (!ANTHROPIC_API_KEY) {
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

  // Build a compact activity summary for the LLM
  const today = new Date();
  const activitySummary = activities
    .slice(0, 50) // cap to keep prompt small
    .map((a) => {
      const date = new Date(a.scheduled_at);
      const daysAway = Math.ceil(
        (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      const dayLabel =
        daysAway === 0
          ? "today"
          : daysAway === 1
            ? "tomorrow"
            : `in ${daysAway} days`;
      return `[${a.id}] "${a.title}" | ${a.sport_type} | ${a.skill_level} | ${a.location_name}${a.trail_name ? ` | trail: ${a.trail_name}` : ""} | ${dayLabel}`;
    })
    .join("\n");

  const systemPrompt = `You are a search assistant for Groute, an outdoor activity discovery app. Users search for activities like hikes, trail runs, etc.

Given a user's natural language search query and a list of available activities, extract structured filters and rank the most relevant activity IDs.

Available sport types: hiking, trail_running
Available skill levels: beginner, intermediate, advanced

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "sport": "hiking" | "trail_running" | null,
  "skill": "beginner" | "intermediate" | "advanced" | null,
  "timeframeDays": <number of days from today, 0=today, 1=tomorrow, 7=this week, null if not specified>,
  "locationKeyword": <extracted location/place name if mentioned, or null>,
  "trailKeyword": <extracted trail name if mentioned, or null>,
  "rankedIds": [<array of activity IDs sorted by relevance to the query, most relevant first, max 20>]
}`;

  const userMessage = `Search query: "${query.trim()}"

Today is ${today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.

Available activities:
${activitySummary || "(none)"}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.error("Anthropic API error:", response.status, await response.text());
      return NextResponse.json(
        { error: "Search failed" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";

    // Parse the JSON response — strip any markdown fences if present
    const jsonStr = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed: ParsedFilters = JSON.parse(jsonStr);

    // Validate rankedIds against actual activity IDs
    const validIds = new Set(activities.map((a) => a.id));
    parsed.rankedIds = (parsed.rankedIds ?? []).filter((id) =>
      validIds.has(id)
    );

    return NextResponse.json({ data: parsed });
  } catch (err) {
    console.error("Search AI error:", err);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
