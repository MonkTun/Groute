import { redirect } from 'next/navigation'

import { createServerClient } from '@/lib/supabase/server'

import { RightNowView } from '@/components/RightNowView'

export default async function RightNowPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const now = new Date()
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  const [activitiesResult, userSportsResult, participantsResult, allParticipantsResult, friendsResult] = await Promise.all([
    supabase
      .from('activities')
      .select(`
        id, title, description, sport_type, skill_level, banner_url, unsplash_image_url, visibility,
        creator_id, location_name, scheduled_at, max_participants, status, trail_name,
        creator:users!creator_id ( id, display_name, first_name, last_name, avatar_url, area )
      `)
      .eq('status', 'open')
      .neq('visibility', 'private')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', in48h.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(20),

    supabase
      .from('user_sports')
      .select('sport_type')
      .eq('user_id', user.id),

    supabase
      .from('activity_participants')
      .select('activity_id, status')
      .eq('user_id', user.id),

    supabase
      .from('activity_participants')
      .select(`
        activity_id,
        user:users!user_id ( id, display_name, first_name, last_name, avatar_url )
      `)
      .eq('status', 'accepted'),

    // Mutual friends (for "friends going" signal)
    (async () => {
      const [fwing, fwers] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
        supabase.from('follows').select('follower_id').eq('following_id', user.id),
      ])
      const followingSet = new Set((fwing.data ?? []).map((f) => f.following_id))
      const followerSet = new Set((fwers.data ?? []).map((f) => f.follower_id))
      return [...followingSet].filter((id) => followerSet.has(id))
    })(),
  ])

  const userSports = (userSportsResult.data ?? []).map((s) => s.sport_type)
  const participationMap = new Map(
    (participantsResult.data ?? []).map((p) => [p.activity_id, p.status])
  )

  const participantsByActivity = new Map<string, Array<{ id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null }>>()
  for (const p of allParticipantsResult.data ?? []) {
    const u = Array.isArray(p.user) ? p.user[0] : p.user
    if (!u) continue
    const list = participantsByActivity.get(p.activity_id) ?? []
    list.push(u)
    participantsByActivity.set(p.activity_id, list)
  }

  const activities = (activitiesResult.data ?? []).map((a) => {
    const creator = Array.isArray(a.creator) ? a.creator[0] ?? null : a.creator
    return {
      ...a,
      creator,
      participants: participantsByActivity.get(a.id) ?? [],
      participantStatus: participationMap.get(a.id) ?? null,
      isOwner: a.creator_id === user.id,
    }
  })

  const friendIds = new Set(friendsResult ?? [])

  return (
    <RightNowView
      activities={activities}
      userSports={userSports}
      userId={user.id}
      friendIds={Array.from(friendIds)}
    />
  )
}
