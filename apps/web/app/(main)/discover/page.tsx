import { createServerClient } from '@/lib/supabase/server'
import { DiscoverView, type ActivityData } from '@/components/DiscoverView'

export default async function DiscoverPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [activitiesResult, participantsResult, allParticipantsResult] = await Promise.all([
    supabase
      .from('activities')
      .select(
        `
        id, title, description, sport_type, skill_level, visibility, creator_id, banner_url,
        location_lat, location_lng, location_name,
        scheduled_at, max_participants, status,
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

    // Current user's participations
    user
      ? supabase
          .from('activity_participants')
          .select('activity_id, status')
          .eq('user_id', user.id)
      : Promise.resolve({ data: [] }),

    // Accepted participants for all activities (for the detail sheet)
    supabase
      .from('activity_participants')
      .select(`
        activity_id, status,
        user:users!user_id ( id, display_name, first_name, last_name, avatar_url )
      `)
      .eq('status', 'accepted'),
  ])

  const participationMap = new Map(
    (participantsResult.data ?? []).map((p) => [p.activity_id, p.status])
  )

  // Group participants by activity
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

  return <DiscoverView initialActivities={activities} currentUserId={user?.id ?? null} />
}
