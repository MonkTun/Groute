import { NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@/lib/supabase/server";

// POST: accept or decline an activity invite
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  const { notificationId } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const action = body.action; // 'accept' | 'decline'

  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Get the notification
  const { data: notification } = await supabase
    .from("notifications")
    .select("id, user_id, from_user_id, type, activity_id")
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .eq("type", "invite")
    .single();

  if (!notification || !notification.activity_id) {
    return NextResponse.json(
      { error: "Invite not found" },
      { status: 404 }
    );
  }

  // Mark notification as read
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);

  if (action === "accept") {
    // Add as accepted participant
    const { error: insertError } = await supabase
      .from("activity_participants")
      .insert({
        activity_id: notification.activity_id,
        user_id: user.id,
        status: "accepted",
      });

    if (insertError && insertError.code !== "23505") {
      console.error("Failed to join:", insertError);
      return NextResponse.json(
        { error: "Failed to join activity" },
        { status: 500 }
      );
    }

    // Send join message to group chat
    await supabase.from("messages").insert({
      activity_id: notification.activity_id,
      sender_id: user.id,
      content: "joined the group!",
    });

    return NextResponse.json({ data: { status: "accepted" } });
  }

  // Decline — just mark as read (already done above)
  return NextResponse.json({ data: { status: "declined" } });
}
