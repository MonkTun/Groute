import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";
import { fetchTrailImage } from "@/lib/unsplash";

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
  const { query, activityId } = body;

  if (!query || typeof query !== "string") {
    return NextResponse.json(
      { error: "query is required" },
      { status: 400 }
    );
  }

  if (!activityId || typeof activityId !== "string") {
    return NextResponse.json(
      { error: "activityId is required" },
      { status: 400 }
    );
  }

  try {
    const imageUrl = await fetchTrailImage(query);

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image found" },
        { status: 404 }
      );
    }

    // Cache the URL on the activity
    await supabase
      .from("activities")
      .update({ unsplash_image_url: imageUrl })
      .eq("id", activityId);

    return NextResponse.json({ data: { url: imageUrl } });
  } catch (err) {
    console.error("Unsplash fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 500 }
    );
  }
}
