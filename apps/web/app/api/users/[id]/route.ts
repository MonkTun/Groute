import { NextRequest, NextResponse } from 'next/server'

import { createApiClient } from '@/lib/supabase/api'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params
  const supabase = await createApiClient(request)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch profile, sports, experience, preferences, follow status, and mutual friend count in parallel
  const [profileResult, sportsResult, experienceResult, preferencesResult, followResult, mutualCountResult] =
    await Promise.all([
      supabase
        .from('users')
        .select(
          'id, display_name, first_name, last_name, avatar_url, area, bio, edu_email, edu_verified, date_of_birth, preferred_language, strava_connected, created_at, last_location_lat, last_location_lng, last_location_at'
        )
        .eq('id', userId)
        .single(),

      supabase
        .from('user_sports')
        .select('sport_type, self_reported_level, strava_verified_level')
        .eq('user_id', userId),

      supabase
        .from('user_experience')
        .select('*')
        .eq('user_id', userId),

      supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),

      supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle(),

      // Mutual friends: intersection of my friends and their friends
      (async () => {
        const [myFollowing, myFollowers, theirFollowing, theirFollowers] =
          await Promise.all([
            supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', user.id),
            supabase
              .from('follows')
              .select('follower_id')
              .eq('following_id', user.id),
            supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', userId),
            supabase
              .from('follows')
              .select('follower_id')
              .eq('following_id', userId),
          ])

        const myFriends = new Set(
          (myFollowing.data ?? [])
            .map((f) => f.following_id)
            .filter((id) =>
              (myFollowers.data ?? []).some((f) => f.follower_id === id)
            )
        )

        const theirFriends = new Set(
          (theirFollowing.data ?? [])
            .map((f) => f.following_id)
            .filter((id) =>
              (theirFollowers.data ?? []).some((f) => f.follower_id === id)
            )
        )

        return [...myFriends].filter((id) => theirFriends.has(id)).length
      })(),
    ])

  if (profileResult.error || !profileResult.data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    data: {
      ...profileResult.data,
      sports: sportsResult.data ?? [],
      experience: experienceResult.data ?? [],
      preferences: preferencesResult.data ?? null,
      isFollowing: !!followResult.data,
      mutualFriendCount: mutualCountResult,
    },
  })
}
