import { NextRequest, NextResponse } from "next/server";

import { onboardingProfileSchema } from "@groute/shared";

import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ data: null });
  }

  const { data: sports } = await supabase
    .from("user_sports")
    .select("sport_type, self_reported_level, strava_verified_level")
    .eq("user_id", user.id);

  return NextResponse.json({
    data: { ...profile, sports: sports ?? [] },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = onboardingProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { sports, ...profileData } = parsed.data;

  try {
    // Upsert user profile
    const { error: profileError } = await supabase
      .from("users")
      .update({
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        date_of_birth: profileData.dateOfBirth,
        area: profileData.area,
        preferred_language: profileData.preferredLanguage || null,
        edu_email: profileData.eduEmail || null,
        profile_completed: true,
      })
      .eq("id", user.id);

    if (profileError) {
      console.error("Failed to update profile:", profileError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    // Delete existing sports and insert new ones
    await supabase.from("user_sports").delete().eq("user_id", user.id);

    if (sports.length > 0) {
      const { error: sportsError } = await supabase
        .from("user_sports")
        .insert(
          sports.map((s) => ({
            user_id: user.id,
            sport_type: s.sportType,
            self_reported_level: s.selfReportedLevel,
          }))
        );

      if (sportsError) {
        console.error("Failed to insert sports:", sportsError);
        return NextResponse.json(
          { error: "Failed to save activities" },
          { status: 500 }
        );
      }
    }

    const response = NextResponse.json({ data: { success: true } }, { status: 200 });
    response.cookies.set('profile_completed', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });
    return response;
  } catch (err) {
    console.error("Profile update error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
