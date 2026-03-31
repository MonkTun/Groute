import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";

export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = request.nextUrl.searchParams.get("name");
  if (!name || name.length < 3) {
    return NextResponse.json(
      { error: "name parameter required (min 3 chars)" },
      { status: 400 }
    );
  }

  try {
    // Use Nominatim (OpenStreetMap text search) — fast and designed for name lookups
    const hasTrailKeyword = /trail|hike|path|peak|canyon|falls/i.test(name);
    const params = new URLSearchParams({
      q: hasTrailKeyword ? name : name + " trail",
      format: "json",
      limit: "5",
      addressdetails: "1",
    });

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          "User-Agent": "Groute/1.0 (outdoor activity app)",
        },
        signal: AbortSignal.timeout(8_000),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ data: [] });
    }

    const results = await res.json();

    const trails = results
      .filter(
        (r: { lat: string; lon: string; display_name: string; class?: string }) =>
          r.lat && r.lon
      )
      .map(
        (r: {
          place_id: number;
          lat: string;
          lon: string;
          display_name: string;
          name?: string;
        }) => ({
          osmId: r.place_id,
          name: r.name || r.display_name.split(",")[0],
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
        })
      );

    return NextResponse.json({ data: trails });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
