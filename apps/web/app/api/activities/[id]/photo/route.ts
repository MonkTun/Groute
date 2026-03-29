import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: activityId } = await params;

  // Verify the user owns this activity
  const { data: activity, error: fetchError } = await supabase
    .from("activities")
    .select("id, creator_id")
    .eq("id", activityId)
    .single();

  if (fetchError || !activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  if (activity.creator_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are allowed" },
      { status: 400 }
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File must be under 5MB" },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const filePath = `activity-photos/${activityId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("activity-photos")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("Activity photo upload error:", uploadError);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("activity-photos").getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("activities")
    .update({ banner_url: publicUrl })
    .eq("id", activityId);

  if (updateError) {
    console.error("Activity banner URL update error:", updateError);
    return NextResponse.json(
      { error: "Failed to update activity" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { bannerUrl: publicUrl } });
}
