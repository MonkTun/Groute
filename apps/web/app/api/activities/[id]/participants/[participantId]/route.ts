import { NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@/lib/supabase/server";

// PATCH: accept or decline a participant (host only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  const { id: activityId, participantId } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify caller is the host
  const { data: activity } = await supabase
    .from("activities")
    .select("creator_id")
    .eq("id", activityId)
    .single();

  if (!activity || activity.creator_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const newStatus = body.status;

  if (newStatus !== "accepted" && newStatus !== "declined") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("activity_participants")
    .update({ status: newStatus })
    .eq("id", participantId)
    .eq("activity_id", activityId);

  if (updateError) {
    console.error("Failed to update participant:", updateError);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }

  // If accepted, add welcome message and the user to the chat
  if (newStatus === "accepted") {
    const { data: participant } = await supabase
      .from("activity_participants")
      .select("user_id")
      .eq("id", participantId)
      .single();

    if (participant) {
      await supabase.from("messages").insert({
        activity_id: activityId,
        sender_id: participant.user_id,
        content: "joined the group!",
      });
    }
  }

  return NextResponse.json({ data: { status: newStatus } });
}
