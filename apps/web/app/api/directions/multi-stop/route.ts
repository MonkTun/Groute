import { NextRequest, NextResponse } from "next/server";

import { multiStopRouteQuerySchema } from "@groute/shared";
import { getMultiStopDrivingRoute } from "@/lib/directions";
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

  const body = await request.json();
  const parsed = multiStopRouteQuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const route = await getMultiStopDrivingRoute(parsed.data.waypoints);

    if (!route) {
      return NextResponse.json({ error: "No route found" }, { status: 404 });
    }

    return NextResponse.json({ data: route });
  } catch (err) {
    console.error("Multi-stop route error:", err);
    return NextResponse.json(
      { error: "Failed to get route" },
      { status: 500 }
    );
  }
}
