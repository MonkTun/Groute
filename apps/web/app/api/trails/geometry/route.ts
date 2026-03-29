import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";
import { getTrailGeometry } from "@/lib/trails";

export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const osmId = Number(request.nextUrl.searchParams.get("osmId"));
  if (!osmId || !Number.isInteger(osmId)) {
    return NextResponse.json(
      { error: "osmId must be an integer" },
      { status: 400 }
    );
  }

  try {
    const coordinates = await getTrailGeometry(osmId);
    return NextResponse.json({ data: coordinates });
  } catch (err) {
    console.error("Trail geometry fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch trail geometry" },
      { status: 500 }
    );
  }
}
