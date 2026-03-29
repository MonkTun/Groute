import { NextRequest, NextResponse } from "next/server";

import { coordinatesSchema } from "@groute/shared";
import { z } from "zod";

import { createApiClient } from "@/lib/supabase/api";
import { getApproachRoute } from "@/lib/trails";

const approachQuerySchema = z.object({
  fromLat: z.number().min(-90).max(90),
  fromLng: z.number().min(-180).max(180),
  toLat: z.number().min(-90).max(90),
  toLng: z.number().min(-180).max(180),
});

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
  const parsed = approachQuerySchema.safeParse({
    fromLat: Number(searchParams.get("fromLat")),
    fromLng: Number(searchParams.get("fromLng")),
    toLat: Number(searchParams.get("toLat")),
    toLng: Number(searchParams.get("toLng")),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const route = await getApproachRoute(
      parsed.data.fromLat,
      parsed.data.fromLng,
      parsed.data.toLat,
      parsed.data.toLng
    );

    if (!route) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: route });
  } catch (err) {
    console.error("Approach route failed:", err);
    return NextResponse.json(
      { error: "Failed to get approach route" },
      { status: 500 }
    );
  }
}
