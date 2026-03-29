import { NextRequest, NextResponse } from "next/server";

import { searchTrailsSchema } from "@groute/shared";

import { createApiClient } from "@/lib/supabase/api";
import { searchTrails } from "@/lib/trails";

export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const radius = Number(searchParams.get("radius") || "5000");

  const parsed = searchTrailsSchema.safeParse({
    latitude: lat,
    longitude: lng,
    radiusMeters: radius,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const trails = await searchTrails(
      parsed.data.latitude,
      parsed.data.longitude,
      parsed.data.radiusMeters
    );

    return NextResponse.json({ data: trails });
  } catch (err) {
    console.error("Trail search failed:", err);
    return NextResponse.json(
      { error: "Failed to search trails" },
      { status: 500 }
    );
  }
}
