import { NextRequest, NextResponse } from "next/server";

import { createActivitySchema } from "@groute/shared";

import { createApiClient } from "@/lib/supabase/api";
import { getTrailGeometry, getApproachRoute } from "@/lib/trails";
import { fetchTrailImage } from "@/lib/unsplash";

export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const sportType = searchParams.get("sportType");
  const status = searchParams.get("status") || "open";

  let query = supabase
    .from("activities")
    .select(
      `
      id, title, description, sport_type, skill_level, banner_url, unsplash_image_url, visibility, location_lat, location_lng, location_name, max_participants, scheduled_at, status, created_at, creator_id,
      trail_osm_id, trail_name, trail_distance_meters, trail_surface, trail_sac_scale,
      trailhead_lat, trailhead_lng, trail_approach_distance_m, trail_approach_duration_s,
      trail_geometry, approach_geometry,
      creator:users!creator_id (
        id,
        display_name,
        first_name,
        last_name,
        avatar_url,
        area
      )
    `
    )
    .eq("status", status)
    .neq("visibility", "private")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (sportType) {
    query = query.eq("sport_type", sportType);
  }

  const { data: activities, error } = await query;

  if (error) {
    console.error("Failed to fetch activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }

  // Fetch participant counts for returned activities
  const activityIds = (activities ?? []).map((a) => a.id);
  let participantCounts: Record<string, number> = {};

  if (activityIds.length > 0) {
    const { data: participants } = await supabase
      .from("activity_participants")
      .select("activity_id")
      .in("activity_id", activityIds)
      .eq("status", "accepted");

    const countMap: Record<string, number> = {};
    for (const p of participants ?? []) {
      countMap[p.activity_id] = (countMap[p.activity_id] ?? 0) + 1;
    }
    participantCounts = countMap;
  }

  const activitiesWithCounts = (activities ?? []).map((a) => ({
    ...a,
    participant_count: (participantCounts[a.id] ?? 0) + 1, // +1 for creator
  }));

  // Backfill missing trail geometries in background
  for (const a of activitiesWithCounts) {
    const needsTrailGeo = a.trail_osm_id && !a.trail_geometry;
    const needsApproachGeo =
      a.trail_osm_id &&
      a.location_lat &&
      a.location_lng &&
      a.trailhead_lat &&
      a.trailhead_lng &&
      !a.approach_geometry;

    if (needsTrailGeo || needsApproachGeo) {
      Promise.all([
        needsTrailGeo
          ? getTrailGeometry(a.trail_osm_id!)
          : Promise.resolve(null),
        needsApproachGeo
          ? getApproachRoute(
              parseFloat(a.location_lat!),
              parseFloat(a.location_lng!),
              parseFloat(a.trailhead_lat!),
              parseFloat(a.trailhead_lng!)
            )
          : Promise.resolve(null),
      ])
        .then(async ([trailGeo, approachRoute]) => {
          const updates: Record<string, unknown> = {};
          if (trailGeo) updates.trail_geometry = JSON.stringify(trailGeo);
          if (approachRoute) {
            updates.approach_geometry = JSON.stringify(
              approachRoute.coordinates
            );
            if (!a.trail_approach_distance_m) {
              updates.trail_approach_distance_m = approachRoute.distanceMeters;
            }
            if (!a.trail_approach_duration_s) {
              updates.trail_approach_duration_s = approachRoute.durationSeconds;
            }
          }
          if (Object.keys(updates).length > 0) {
            await supabase
              .from("activities")
              .update(updates)
              .eq("id", a.id);
          }
        })
        .catch(() => {});
    }
  }

  // Backfill missing Unsplash images (awaited so URLs are in the response)
  const unsplashPromises = activitiesWithCounts
    .filter((a) => !a.banner_url && !a.unsplash_image_url)
    .slice(0, 5) // limit to 5 per request to avoid rate limits
    .map(async (a) => {
      const query = [a.trail_name, a.sport_type, a.location_name, "trail"]
        .filter(Boolean)
        .join(" ");
      try {
        const url = await fetchTrailImage(query);
        if (url) {
          a.unsplash_image_url = url;
          await supabase
            .from("activities")
            .update({ unsplash_image_url: url })
            .eq("id", a.id);
        }
      } catch {}
    });

  await Promise.all(unsplashPromises);

  return NextResponse.json({ data: activitiesWithCounts });
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
  const invitedUserIds: string[] = body.invitedUserIds ?? [];
  const parsed = createActivitySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const trail = parsed.data.trail;

    const { data: activity, error } = await supabase
      .from("activities")
      .insert({
        creator_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        sport_type: parsed.data.sportType,
        skill_level: parsed.data.skillLevel,
        visibility: parsed.data.visibility,
        location_lat: String(parsed.data.location.latitude),
        location_lng: String(parsed.data.location.longitude),
        location_name: parsed.data.locationName,
        max_participants: parsed.data.maxParticipants,
        scheduled_at: parsed.data.scheduledAt,
        ...(trail && {
          trail_osm_id: trail.osmId,
          trail_name: trail.name,
          trail_distance_meters: trail.distanceMeters,
          trail_surface: trail.surface,
          trail_sac_scale: trail.sacScale,
          trailhead_lat: String(trail.trailheadLat),
          trailhead_lng: String(trail.trailheadLng),
          trail_approach_distance_m: trail.approachDistanceMeters ?? null,
          trail_approach_duration_s: trail.approachDurationSeconds ?? null,
        }),
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create activity:", error);
      return NextResponse.json(
        { error: "Failed to create activity" },
        { status: 500 }
      );
    }

    // Create initial group chat message + send invites
    if (activity) {
      await supabase.from("messages").insert({
        activity_id: activity.id,
        sender_id: user.id,
        content: "created this activity. Welcome to the group!",
      });

      // Fetch Unsplash image for activities without a banner (non-blocking)
      fetchTrailImage(
        [trail?.name, parsed.data.sportType, parsed.data.locationName, "trail"]
          .filter(Boolean)
          .join(" ")
      )
        .then(async (url) => {
          if (url && activity) {
            await supabase
              .from("activities")
              .update({ unsplash_image_url: url })
              .eq("id", activity.id);
          }
        })
        .catch(() => {});

      // Fetch and store trail + approach geometries (non-blocking)
      if (trail && activity) {
        Promise.all([
          getTrailGeometry(trail.osmId),
          getApproachRoute(
            parsed.data.location.latitude,
            parsed.data.location.longitude,
            trail.trailheadLat,
            trail.trailheadLng
          ),
        ]).then(async ([trailGeo, approachRoute]) => {
          const updates: Record<string, unknown> = {};
          if (trailGeo) updates.trail_geometry = JSON.stringify(trailGeo);
          if (approachRoute) {
            updates.approach_geometry = JSON.stringify(approachRoute.coordinates);
            // Also backfill approach distance/duration if not already set
            if (!trail.approachDistanceMeters) {
              updates.trail_approach_distance_m = approachRoute.distanceMeters;
            }
            if (!trail.approachDurationSeconds) {
              updates.trail_approach_duration_s = approachRoute.durationSeconds;
            }
          }
          if (Object.keys(updates).length > 0) {
            await supabase
              .from("activities")
              .update(updates)
              .eq("id", activity.id);
          }
        }).catch((err) => {
          console.error("Failed to fetch trail geometries:", err);
        });
      }

      // Send invite notifications to selected friends
      if (invitedUserIds.length > 0) {
        const notifications = invitedUserIds.map((friendId) => ({
          user_id: friendId,
          from_user_id: user.id,
          type: "invite",
          activity_id: activity.id,
        }));
        await supabase.from("notifications").insert(notifications);

        // Also send a DM to each invited friend
        const inviteMessages = invitedUserIds.map((friendId) => ({
          sender_id: user.id,
          receiver_id: friendId,
          content: `[invite:${activity.id}] ${activity.title}`,
        }));
        await supabase.from("messages").insert(inviteMessages);
      }
    }

    return NextResponse.json({ data: activity }, { status: 201 });
  } catch (err) {
    console.error("Activity creation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
