import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";

// POST: register or update a push token for the current user
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
  const { token, platform } = body;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  if (!platform || !["ios", "android"].includes(platform)) {
    return NextResponse.json(
      { error: "Platform must be ios or android" },
      { status: 400 }
    );
  }

  // Upsert: if token already exists for this user, update it; otherwise insert
  // First, remove this token from any other user (device changed accounts)
  await supabase.from("push_tokens").delete().eq("token", token);

  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: user.id,
      token,
      platform,
    },
    { onConflict: "token" }
  );

  if (error) {
    console.error("Failed to save push token:", error);
    return NextResponse.json(
      { error: "Failed to save token" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { success: true } }, { status: 201 });
}

// DELETE: remove a push token (logout / disable notifications)
export async function DELETE(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { token } = body;

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  await supabase
    .from("push_tokens")
    .delete()
    .eq("user_id", user.id)
    .eq("token", token);

  return NextResponse.json({ data: { success: true } });
}
