import { NextRequest, NextResponse } from "next/server";

import { drivingDirectionsQuerySchema } from "@groute/shared";
import { getDrivingRoute } from "@/lib/directions";
import { createApiClient } from "@/lib/supabase/api";

// GET: get driving directions between two points
export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = drivingDirectionsQuerySchema.safeParse({
    fromLat: parseFloat(url.searchParams.get("fromLat") ?? ""),
    fromLng: parseFloat(url.searchParams.get("fromLng") ?? ""),
    toLat: parseFloat(url.searchParams.get("toLat") ?? ""),
    toLng: parseFloat(url.searchParams.get("toLng") ?? ""),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const directions = await getDrivingRoute(
      parsed.data.fromLat,
      parsed.data.fromLng,
      parsed.data.toLat,
      parsed.data.toLng
    );

    if (!directions) {
      return NextResponse.json(
        { error: "No route found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: directions });
  } catch (err) {
    console.error("Directions API error:", err);
    return NextResponse.json(
      { error: "Failed to get directions" },
      { status: 500 }
    );
  }
}
