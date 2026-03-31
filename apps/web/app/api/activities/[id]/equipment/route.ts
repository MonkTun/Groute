import { NextRequest, NextResponse } from "next/server";

import { bulkCreateEquipmentSchema, updateEquipmentItemSchema } from "@groute/shared";
import { createApiClient } from "@/lib/supabase/api";

// GET: all equipment items for an activity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: activityId } = await params;
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("activity_equipment")
    .select(
      `id, activity_id, user_id, item_name, status, lender_id, created_at,
       user:users!user_id ( id, display_name, first_name, last_name, avatar_url ),
       lender:users!lender_id ( id, display_name, first_name, last_name, avatar_url )`
    )
    .eq("activity_id", activityId)
    .order("item_name", { ascending: true });

  if (error) {
    console.error("Failed to fetch equipment:", error);
    return NextResponse.json(
      { error: "Failed to fetch equipment" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: data ?? [] });
}

// POST: bulk create equipment items for current user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: activityId } = await params;
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = bulkCreateEquipmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const rows = parsed.data.items.map((item) => ({
    activity_id: activityId,
    user_id: user.id,
    item_name: item.itemName,
    status: item.status,
  }));

  const { data, error } = await supabase
    .from("activity_equipment")
    .insert(rows)
    .select();

  if (error) {
    console.error("Failed to create equipment:", error);
    return NextResponse.json(
      { error: "Failed to create equipment" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}

// PATCH: update an equipment item (change status, assign lender)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: activityId } = await params;
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { itemId, ...rest } = body;
  const parsed = updateEquipmentItemSchema.safeParse(rest);

  if (!parsed.success || !itemId) {
    return NextResponse.json(
      { error: "Validation failed" },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.status !== undefined) {
    updateData.status = parsed.data.status;
  }

  if (parsed.data.lenderId !== undefined) {
    updateData.lender_id = parsed.data.lenderId;
    if (parsed.data.lenderId) {
      updateData.status = "lending";
    }
  }

  const { data, error } = await supabase
    .from("activity_equipment")
    .update(updateData)
    .eq("id", itemId)
    .eq("activity_id", activityId)
    .select()
    .single();

  if (error) {
    console.error("Failed to update equipment:", error);
    return NextResponse.json(
      { error: "Failed to update equipment" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}
