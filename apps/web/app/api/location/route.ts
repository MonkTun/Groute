import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";

// POST: update current user's location
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
  const { latitude, longitude } = body;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  await supabase
    .from("users")
    .update({
      last_location_lat: String(latitude),
      last_location_lng: String(longitude),
      last_location_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  return NextResponse.json({ data: { success: true } });
}
