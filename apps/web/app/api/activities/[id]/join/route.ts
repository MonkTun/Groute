import { NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: activityId } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get activity to check visibility and creator
  const { data: activity, error: actError } = await supabase
    .from("activities")
    .select("id, creator_id, visibility, status, max_participants")
    .eq("id", activityId)
    .single();

  if (actError || !activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  if (activity.creator_id === user.id) {
    return NextResponse.json(
      { error: "Cannot join your own activity" },
      { status: 400 }
    );
  }

  if (activity.status !== "open") {
    return NextResponse.json(
      { error: "Activity is not open" },
      { status: 400 }
    );
  }

  if (activity.visibility === "private") {
    return NextResponse.json(
      { error: "This activity is invite only" },
      { status: 403 }
    );
  }

  // Check if already participating
  const { data: existing } = await supabase
    .from("activity_participants")
    .select("id, status")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Already requested or joined" },
      { status: 409 }
    );
  }

  // Public = auto-accept, discoverable = requested
  const participantStatus =
    activity.visibility === "public" ? "accepted" : "requested";

  const { error: insertError } = await supabase
    .from("activity_participants")
    .insert({
      activity_id: activityId,
      user_id: user.id,
      status: participantStatus,
    });

  if (insertError) {
    console.error("Failed to join activity:", insertError);
    return NextResponse.json(
      { error: "Failed to join activity" },
      { status: 500 }
    );
  }

  // If accepted (public), send a system-style welcome message
  if (participantStatus === "accepted") {
    await supabase.from("messages").insert({
      activity_id: activityId,
      sender_id: user.id,
      content: "joined the group!",
    });
  }

  return NextResponse.json({
    data: { status: participantStatus },
  });
}
