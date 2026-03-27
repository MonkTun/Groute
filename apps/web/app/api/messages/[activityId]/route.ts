import { NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@/lib/supabase/server";

// GET messages for an activity group chat
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  const { activityId } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify user is a participant or creator
  const [activityResult, participantResult] = await Promise.all([
    supabase
      .from("activities")
      .select("creator_id, title")
      .eq("id", activityId)
      .single(),
    supabase
      .from("activity_participants")
      .select("id")
      .eq("activity_id", activityId)
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .single(),
  ]);

  const isCreator = activityResult.data?.creator_id === user.id;
  const isParticipant = !!participantResult.data;

  if (!isCreator && !isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: messages, error } = await supabase
    .from("messages")
    .select(
      `
      id, content, created_at,
      sender:users!sender_id ( id, display_name, first_name, last_name, avatar_url )
    `
    )
    .eq("activity_id", activityId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("Failed to fetch messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: messages ?? [] });
}

// POST a message to the group chat
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  const { activityId } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const content = body.content?.trim();

  if (!content || content.length > 2000) {
    return NextResponse.json(
      { error: "Message must be 1-2000 characters" },
      { status: 400 }
    );
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      activity_id: activityId,
      sender_id: user.id,
      content,
    })
    .select(
      `
      id, content, created_at,
      sender:users!sender_id ( id, display_name, first_name, last_name, avatar_url )
    `
    )
    .single();

  if (error) {
    console.error("Failed to send message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: message }, { status: 201 });
}
