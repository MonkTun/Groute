import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

interface SuggestionRequest {
  trailName: string | null;
  locationName: string;
  locationLat: number;
  locationLng: number;
  trailheadLat?: number;
  trailheadLng?: number;
  approachDurationMin?: number;
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
      { error: "AI suggestions unavailable" },
      { status: 503 }
    );
  }

  const body: SuggestionRequest = await request.json();

  const prompt = `You are a helpful outdoor activity planner. Given this trail/location, provide practical logistics suggestions.

Trail/Location: ${body.trailName ?? body.locationName}
Location name: ${body.locationName}
Coordinates: ${body.locationLat}, ${body.locationLng}
${body.trailheadLat ? `Trailhead coordinates: ${body.trailheadLat}, ${body.trailheadLng}` : ""}
${body.approachDurationMin ? `Walking approach from parking to trailhead: ~${body.approachDurationMin} minutes` : ""}

Provide suggestions in this exact JSON format:
{
  "parking": [
    {
      "name": "parking lot or area name",
      "description": "brief description with directions",
      "paid": true/false,
      "cost": "$X/day or Free",
      "notes": "any tips (fills up early, etc)"
    }
  ],
  "meetingPoints": [
    {
      "name": "meeting point name",
      "description": "why this is a good meeting spot"
    }
  ],
  "transportTips": [
    "practical tip about getting to this location"
  ],
  "carpoolNotes": "suggestion for where carpoolers should meet before heading to the trail"
}

Rules:
- Provide 2-3 parking options if multiple exist, otherwise 1
- Provide 1-2 meeting point suggestions
- Provide 2-3 transport tips covering different modes (driving, transit, rideshare)
- For carpool notes, suggest a logical intermediate meeting point (coffee shop, park & ride, etc) where people sharing rides would meet before driving to the trailhead together
- Be specific to this actual location - use real place names, real parking lots, real transit routes
- If you don't know specific details about this location, provide general but useful advice
- Keep descriptions concise (1-2 sentences max)`;

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
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic API error:", res.status, errText);
      return NextResponse.json(
        { error: "AI suggestion failed" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 502 }
      );
    }

    const suggestions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ data: suggestions });
  } catch (err) {
    console.error("Suggest logistics error:", err);
    return NextResponse.json(
      { error: "Failed to get suggestions" },
      { status: 500 }
    );
  }
}
