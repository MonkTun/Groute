import { NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@/lib/supabase/server";

// GET DMs with a specific user
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: otherUserId } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: messages, error } = await supabase
    .from("messages")
    .select(
      `
      id, content, created_at,
      sender:users!sender_id ( id, display_name, first_name, last_name, avatar_url )
    `
    )
    .is("activity_id", null)
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("Failed to fetch DMs:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: messages ?? [] });
}

// POST a DM to a user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: otherUserId } = await params;
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
      sender_id: user.id,
      receiver_id: otherUserId,
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
    console.error("Failed to send DM:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: message }, { status: 201 });
}
