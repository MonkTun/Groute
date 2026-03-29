import { NextRequest, NextResponse } from "next/server";

import { onboardingProfileExtendedSchema } from "@groute/shared";

import { createApiClient } from "@/lib/supabase/api";

export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request);
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

  const [{ data: sports }, { data: experience }, { data: preferences }] = await Promise.all([
    supabase
      .from("user_sports")
      .select("sport_type, self_reported_level, strava_verified_level")
      .eq("user_id", user.id),
    supabase
      .from("user_experience")
      .select("*")
      .eq("user_id", user.id),
    supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    data: {
      ...profile,
      sports: sports ?? [],
      experience: experience ?? [],
      preferences: preferences ?? null,
    },
  });
}

// PATCH: update existing profile (for edit-profile, not onboarding)
export async function PATCH(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Reset onboarding: set profile_completed to false and redirect
  if (body.resetOnboarding) {
    const { error } = await supabase
      .from("users")
      .update({ profile_completed: false })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to reset" }, { status: 500 });
    }

    const response = NextResponse.json({ data: { success: true } });
    response.cookies.delete("profile_completed");
    return response;
  }

  try {
    // Build update object from allowed fields
    const updateData: Record<string, unknown> = {};
    if (body.firstName !== undefined) updateData.first_name = body.firstName;
    if (body.lastName !== undefined) updateData.last_name = body.lastName;
    if (body.displayName !== undefined) updateData.display_name = body.displayName;
    if (body.dateOfBirth !== undefined) updateData.date_of_birth = body.dateOfBirth;
    if (body.area !== undefined) updateData.area = body.area;
    if (body.country !== undefined) updateData.country = body.country;
    if (body.preferredLanguage !== undefined) updateData.preferred_language = body.preferredLanguage || null;
    if (body.eduEmail !== undefined) updateData.edu_email = body.eduEmail || null;
    if (body.bio !== undefined) updateData.bio = body.bio || null;

    if (Object.keys(updateData).length > 0) {
      const { error: profileError } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", user.id);

      if (profileError) {
        console.error("Failed to update profile:", profileError);
        return NextResponse.json(
          { error: "Failed to update profile" },
          { status: 500 }
        );
      }
    }

    // Update sports if provided
    if (body.sports !== undefined) {
      await supabase.from("user_sports").delete().eq("user_id", user.id);

      if (body.sports.length > 0) {
        const { error: sportsError } = await supabase
          .from("user_sports")
          .insert(
            body.sports.map((s: { sportType: string; selfReportedLevel: string }) => ({
              user_id: user.id,
              sport_type: s.sportType,
              self_reported_level: s.selfReportedLevel,
            }))
          );

        if (sportsError) {
          console.error("Failed to update sports:", sportsError);
          return NextResponse.json(
            { error: "Failed to save sports" },
            { status: 500 }
          );
        }
      }
    }

    // Return updated profile
    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    const { data: sports } = await supabase
      .from("user_sports")
      .select("sport_type, self_reported_level, strava_verified_level")
      .eq("user_id", user.id);

    return NextResponse.json({
      data: { ...profile, sports: sports ?? [] },
    });
  } catch (err) {
    console.error("Profile PATCH error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
  const parsed = onboardingProfileExtendedSchema.safeParse(body);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    console.error("Onboarding validation failed:", issues);
    return NextResponse.json(
      { error: `Validation failed: ${issues}`, details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { sports, experience, preferences, ...profileData } = parsed.data;

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

    // Save experience data (per sport)
    if (experience && experience.length > 0) {
      await supabase.from("user_experience").delete().eq("user_id", user.id);

      const { error: expError } = await supabase
        .from("user_experience")
        .insert(
          experience.map((e) => ({
            user_id: user.id,
            sport_type: e.sportType,
            highest_altitude_ft: e.highestAltitudeFt ?? null,
            longest_distance_mi: e.longestDistanceMi ?? null,
            trips_last_12_months: e.tripsLast12Months ?? null,
            years_experience: e.yearsExperience ?? null,
            certifications: e.certifications,
            terrain_comfort: e.terrainComfort,
            water_comfort: e.waterComfort ?? null,
          }))
        );

      if (expError) {
        console.error("Failed to save experience:", expError);
      }
    }

    // Save preferences (upsert)
    if (preferences) {
      await supabase.from("user_preferences").delete().eq("user_id", user.id);

      const { error: prefError } = await supabase
        .from("user_preferences")
        .insert({
          user_id: user.id,
          has_car: preferences.hasCar ?? null,
          willing_to_carpool: preferences.willingToCarpool ?? null,
          max_drive_distance_mi: preferences.maxDriveDistanceMi ?? null,
          preferred_group_size: preferences.preferredGroupSize ?? null,
          preferred_time_of_day: preferences.preferredTimeOfDay,
          weekday_availability: preferences.weekdayAvailability,
          weekend_availability: preferences.weekendAvailability,
          gear_level: preferences.gearLevel ?? null,
          overnight_comfort: preferences.overnightComfort ?? null,
          fitness_level: preferences.fitnessLevel ?? null,
          comfort_with_strangers: preferences.comfortWithStrangers ?? null,
          accessibility_notes: preferences.accessibilityNotes ?? null,
        });

      if (prefError) {
        console.error("Failed to save preferences:", prefError);
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
