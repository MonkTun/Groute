import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";

// POST: follow a user
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
  const followingId = body.followingId;

  if (!followingId || followingId === user.id) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const { error: insertError } = await supabase.from("follows").insert({
    follower_id: user.id,
    following_id: followingId,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Already following" },
        { status: 409 }
      );
    }
    console.error("Failed to follow:", insertError);
    return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
  }

  // Send notification to the followed user
  await supabase.from("notifications").insert({
    user_id: followingId,
    from_user_id: user.id,
    type: "follow",
  });

  return NextResponse.json({ data: { success: true } }, { status: 201 });
}

// DELETE: unfollow a user
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
  const followingId = body.followingId;

  if (!followingId) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", followingId);

  return NextResponse.json({ data: { success: true } });
}
