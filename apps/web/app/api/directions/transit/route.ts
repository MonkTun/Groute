import { NextRequest, NextResponse } from "next/server";

import { transitDirectionsQuerySchema } from "@groute/shared";
import { getTransitRoutes } from "@/lib/transit";
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

  const url = new URL(request.url);
  const parsed = transitDirectionsQuerySchema.safeParse({
    fromLat: parseFloat(url.searchParams.get("fromLat") ?? ""),
    fromLng: parseFloat(url.searchParams.get("fromLng") ?? ""),
    toLat: parseFloat(url.searchParams.get("toLat") ?? ""),
    toLng: parseFloat(url.searchParams.get("toLng") ?? ""),
    arrivalTime: url.searchParams.get("arrivalTime") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const routes = await getTransitRoutes(
      parsed.data.fromLat,
      parsed.data.fromLng,
      parsed.data.toLat,
      parsed.data.toLng,
      parsed.data.arrivalTime
    );

    return NextResponse.json({ data: routes });
  } catch (err) {
    console.error("Transit directions error:", err);
    return NextResponse.json(
      { error: "Failed to get transit directions" },
      { status: 500 }
    );
  }
}
