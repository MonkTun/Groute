import { NextRequest, NextResponse } from "next/server";

import { suggestEquipmentSchema } from "@groute/shared";
import { createApiClient } from "@/lib/supabase/api";

export async function POST(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI suggestions unavailable" },
      { status: 503 }
    );
  }

  const body = await request.json();
  const parsed = suggestEquipmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { sportType, trailName, trailSacScale, trailSurface, scheduledAt, locationName } = parsed.data;

  // Derive season from scheduledAt
  let season = "unknown";
  if (scheduledAt) {
    const month = new Date(scheduledAt).getMonth();
    if (month >= 2 && month <= 4) season = "spring";
    else if (month >= 5 && month <= 7) season = "summer";
    else if (month >= 8 && month <= 10) season = "fall";
    else season = "winter";
  }

  const prompt = `You are an outdoor activity equipment advisor. Suggest equipment for this trip.

Activity: ${sportType}
${trailName ? `Trail: ${trailName}` : ""}
${trailSacScale ? `Difficulty: ${trailSacScale}` : ""}
${trailSurface ? `Surface: ${trailSurface}` : ""}
${locationName ? `Location: ${locationName}` : ""}
Season: ${season}

Return JSON only:
{
  "essential": ["item1", "item2"],
  "recommended": ["item3", "item4"],
  "groupShared": ["item5", "item6"]
}

Rules:
- Essential: 5-8 items everyone must have (water, footwear, etc.)
- Recommended: 3-5 nice-to-have items for comfort/safety
- Group shared: 2-4 items only 1-2 people need to bring (first aid kit, etc.)
- Be specific to the sport, trail difficulty, and season
- Keep items concise (2-4 words each)`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "AI suggestion failed" }, { status: 502 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
    }

    const suggestions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ data: suggestions });
  } catch (err) {
    console.error("Suggest equipment error:", err);
    return NextResponse.json({ error: "Failed to get suggestions" }, { status: 500 });
  }
}
