import { createServerClient } from '@/lib/supabase/server'
import { DiscoverView, type ActivityData, type FriendLocation } from '@/components/DiscoverView'

export default async function DiscoverPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [activitiesResult, participantsResult, allParticipantsResult, friendsResult] = await Promise.all([
    supabase
      .from('activities')
      .select(
        `
        id, title, description, sport_type, skill_level, visibility, creator_id, banner_url,
        location_lat, location_lng, location_name,
        scheduled_at, max_participants, status,
        trail_osm_id, trail_name, trail_distance_meters, trail_surface, trail_sac_scale,
        trailhead_lat, trailhead_lng, trail_approach_distance_m, trail_approach_duration_s,
        trail_geometry, approach_geometry, unsplash_image_url,
        creator:users!creator_id (
          id, display_name, first_name, last_name, avatar_url, area
        )
      `
      )
      .eq('status', 'open')
      .neq('visibility', 'private')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(50),

    user
      ? supabase
          .from('activity_participants')
          .select('activity_id, status')
          .eq('user_id', user.id)
      : Promise.resolve({ data: [] }),

    supabase
      .from('activity_participants')
      .select(`
        activity_id, status,
        user:users!user_id ( id, display_name, first_name, last_name, avatar_url )
      `)
      .eq('status', 'accepted'),

    // Fetch friends with locations (mutual follows)
    user
      ? (async () => {
          const [fwing, fwers] = await Promise.all([
            supabase.from('follows').select('following_id').eq('follower_id', user.id),
            supabase.from('follows').select('follower_id').eq('following_id', user.id),
          ])
          const followingSet = new Set((fwing.data ?? []).map((f) => f.following_id))
          const followerSet = new Set((fwers.data ?? []).map((f) => f.follower_id))
          const mutualIds = [...followingSet].filter((id) => followerSet.has(id))
          if (mutualIds.length === 0) return { data: [] }
          return supabase
            .from('users')
            .select('id, display_name, first_name, last_name, avatar_url, last_location_lat, last_location_lng, last_location_at')
            .in('id', mutualIds)
        })()
      : Promise.resolve({ data: [] }),
  ])

  const participationMap = new Map(
    (participantsResult.data ?? []).map((p) => [p.activity_id, p.status])
  )

  const participantsByActivity = new Map<string, Array<{
    id: string; display_name: string; first_name: string | null
    last_name: string | null; avatar_url: string | null
  }>>()

  for (const p of allParticipantsResult.data ?? []) {
    const u = Array.isArray(p.user) ? p.user[0] : p.user
    if (!u) continue
    const list = participantsByActivity.get(p.activity_id) ?? []
    list.push(u)
    participantsByActivity.set(p.activity_id, list)
  }

  const activities: ActivityData[] = (activitiesResult.data ?? []).map((a) => {
    const creator = Array.isArray(a.creator) ? a.creator[0] ?? null : a.creator
    return {
      ...a,
      creator,
      participantStatus: participationMap.get(a.id) ?? null,
      isOwner: a.creator_id === user?.id,
      participants: participantsByActivity.get(a.id) ?? [],
    }
  })

  // Filter friends who have a recent location (within 24h)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  const friends: FriendLocation[] = (friendsResult.data ?? [])
    .filter((f) => f.last_location_lat && f.last_location_lng && f.last_location_at && new Date(f.last_location_at).getTime() > cutoff)
    .map((f) => ({
      id: f.id,
      name: f.first_name && f.last_name
        ? `${f.first_name} ${f.last_name[0]}.`
        : f.display_name,
      avatarUrl: f.avatar_url,
      initial: (f.first_name?.[0] ?? f.display_name[0]).toUpperCase(),
      lat: parseFloat(f.last_location_lat!),
      lng: parseFloat(f.last_location_lng!),
    }))

  return (
    <DiscoverView
      initialActivities={activities}
      currentUserId={user?.id ?? null}
      friends={friends}
    />
  )
}
