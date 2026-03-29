import { redirect } from 'next/navigation'

import { createServerClient } from '@/lib/supabase/server'
import { ProfileView } from '@/components/ProfileView'

export default async function ProfilePage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profileResult, sportsResult, followingResult, followersResult, notificationsResult, createdActivitiesResult, participantResult] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase
      .from('user_sports')
      .select('sport_type, self_reported_level, strava_verified_level')
      .eq('user_id', user.id),

    supabase
      .from('follows')
      .select('following_id, user:users!following_id ( id, display_name, first_name, last_name, avatar_url, area )')
      .eq('follower_id', user.id),

    supabase
      .from('follows')
      .select('follower_id, user:users!follower_id ( id, display_name, first_name, last_name, avatar_url, area )')
      .eq('following_id', user.id),

    supabase
      .from('notifications')
      .select(`
        id, type, read, created_at, activity_id,
        from_user:users!from_user_id ( id, display_name, first_name, last_name, avatar_url )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),

    // Past activities created by user
    supabase
      .from('activities')
      .select('id, title, sport_type, location_name, scheduled_at, banner_url, max_participants')
      .eq('creator_id', user.id)
      .lt('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: false })
      .limit(10),

    // Activities user participated in
    supabase
      .from('activity_participants')
      .select('activity_id')
      .eq('user_id', user.id)
      .eq('status', 'accepted'),
  ])

  const profile = profileResult.data
  const sports = sportsResult.data ?? []

  if (!profile) redirect('/onboarding')

  // Build friends + incoming follows
  const followingSet = new Set((followingResult.data ?? []).map((f) => f.following_id))
  const followerSet = new Set((followersResult.data ?? []).map((f) => f.follower_id))

  const allUsers = new Map<string, { id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null; area: string | null }>()
  for (const f of followingResult.data ?? []) {
    const u = Array.isArray(f.user) ? f.user[0] : f.user
    if (u) allUsers.set(u.id, u)
  }
  for (const f of followersResult.data ?? []) {
    const u = Array.isArray(f.user) ? f.user[0] : f.user
    if (u) allUsers.set(u.id, u)
  }

  const friends = Array.from(allUsers.values()).filter(
    (u) => followingSet.has(u.id) && followerSet.has(u.id)
  )
  const incomingFollows = Array.from(allUsers.values()).filter(
    (u) => followerSet.has(u.id) && !followingSet.has(u.id)
  )

  const notifications = (notificationsResult.data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    read: n.read,
    createdAt: n.created_at,
    activityId: n.activity_id,
    fromUser: Array.isArray(n.from_user) ? n.from_user[0] : n.from_user,
  }))

  // Build activity history
  const createdActivities = createdActivitiesResult.data ?? []
  const joinedIds = (participantResult.data ?? []).map((r) => r.activity_id)

  let joinedActivities: typeof createdActivities = []
  if (joinedIds.length > 0) {
    const { data } = await supabase
      .from('activities')
      .select('id, title, sport_type, location_name, scheduled_at, banner_url, max_participants')
      .in('id', joinedIds)
      .neq('creator_id', user.id)
      .lt('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: false })
      .limit(10)
    joinedActivities = data ?? []
  }

  const pastActivities = [...createdActivities, ...joinedActivities]
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
    .slice(0, 10)
    .map((a) => ({
      ...a,
      isCreator: createdActivities.some((c) => c.id === a.id),
    }))

  return (
    <ProfileView
      profile={profile}
      sports={sports}
      friends={friends}
      incomingFollows={incomingFollows}
      notifications={notifications}
      currentUserId={user.id}
      pastActivities={pastActivities}
    />
  )
}
