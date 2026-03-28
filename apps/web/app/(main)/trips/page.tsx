import { redirect } from 'next/navigation'
import Link from 'next/link'

import { createServerClient } from '@/lib/supabase/server'
import { SPORT_LABELS } from '@groute/shared'
import { MapPin, Clock, Crown, CheckCircle, Clock3 } from 'lucide-react'

import { ParticipantManager } from '@/components/ParticipantManager'
import { TripChat } from '@/components/TripChat'

export default async function TripsPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [createdResult, participatingResult, pendingResult] = await Promise.all([
    supabase
      .from('activities')
      .select('id, title, sport_type, skill_level, visibility, location_name, scheduled_at, status, max_participants')
      .eq('creator_id', user.id)
      .order('scheduled_at', { ascending: false }),

    supabase
      .from('activity_participants')
      .select(`
        status,
        activity:activities!activity_id (
          id, title, sport_type, skill_level, location_name, scheduled_at, status, max_participants,
          creator:users!creator_id ( display_name, first_name, last_name )
        )
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false }),

    // Get pending participant requests for activities I host
    supabase
      .from('activity_participants')
      .select(`
        id, status, joined_at,
        activity_id,
        user:users!user_id ( id, display_name, first_name, last_name, avatar_url, area )
      `)
      .eq('status', 'requested')
      .in(
        'activity_id',
        // Subquery: my activity IDs
        (await supabase.from('activities').select('id').eq('creator_id', user.id)).data?.map(a => a.id) ?? []
      ),
  ])

  const created = createdResult.data ?? []

  const participating = (participatingResult.data ?? [])
    .map((p) => {
      const act = Array.isArray(p.activity) ? p.activity[0] : p.activity
      if (!act) return null
      const creator = Array.isArray(act.creator) ? act.creator[0] : act.creator
      return {
        ...act,
        participantStatus: p.status as string,
        creatorName: creator
          ? creator.first_name && creator.last_name
            ? `${creator.first_name} ${creator.last_name[0]}.`
            : creator.display_name
          : 'Unknown',
      }
    })
    .filter(Boolean) as Array<{
    id: string; title: string; sport_type: string; skill_level: string
    location_name: string; scheduled_at: string; status: string
    max_participants: number; participantStatus: string; creatorName: string
  }>

  // Group pending requests by activity
  const pendingByActivity = new Map<string, typeof pendingResult.data>()
  for (const p of pendingResult.data ?? []) {
    const list = pendingByActivity.get(p.activity_id) ?? []
    list.push(p)
    pendingByActivity.set(p.activity_id, list)
  }

  const now = new Date()

  const upcomingCreated = created.filter((a) => new Date(a.scheduled_at) >= now)
  const pastCreated = created.filter((a) => new Date(a.scheduled_at) < now)
  const upcomingParticipating = participating.filter((a) => new Date(a.scheduled_at) >= now)
  const pastParticipating = participating.filter((a) => new Date(a.scheduled_at) < now)

  const hasUpcoming = upcomingCreated.length > 0 || upcomingParticipating.length > 0
  const hasPast = pastCreated.length > 0 || pastParticipating.length > 0

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
      <h1 className="mb-6 text-xl font-bold sm:text-2xl">My Trips</h1>

      {!hasUpcoming && !hasPast && (
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">No trips yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create or join an activity from the Discover page.
          </p>
        </div>
      )}

      {hasUpcoming && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Upcoming
          </h2>
          <div className="space-y-3">
            {upcomingCreated.map((a) => (
              <TripCard
                key={a.id}
                activity={a}
                role="host"
                pendingRequests={pendingByActivity.get(a.id)}
                currentUserId={user.id}
              />
            ))}
            {upcomingParticipating.map((a) => (
              <TripCard
                key={a.id}
                activity={a}
                role="participant"
                participantStatus={a.participantStatus}
                creatorName={a.creatorName}
                currentUserId={user.id}
              />
            ))}
          </div>
        </section>
      )}

      {hasPast && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Past
          </h2>
          <div className="space-y-3">
            {pastCreated.map((a) => (
              <TripCard key={a.id} activity={a} role="host" isPast />
            ))}
            {pastParticipating.map((a) => (
              <TripCard
                key={a.id}
                activity={a}
                role="participant"
                participantStatus={a.participantStatus}
                creatorName={a.creatorName}
                isPast
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

interface TripCardProps {
  activity: {
    id: string; title: string; sport_type: string; skill_level: string
    location_name: string; scheduled_at: string; status: string; max_participants: number
  }
  role: 'host' | 'participant'
  participantStatus?: string
  creatorName?: string
  isPast?: boolean
  currentUserId?: string
  pendingRequests?: Array<{
    id: string; status: string; activity_id: string
    user: { id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null; area: string | null } | Array<{ id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null; area: string | null }>
  }> | null
}

function TripCard({ activity, role, participantStatus, creatorName, isPast, currentUserId, pendingRequests }: TripCardProps) {
  const scheduledDate = new Date(activity.scheduled_at)
  const dateStr = scheduledDate.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
  const timeStr = scheduledDate.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  })

  const normalizedRequests = (pendingRequests ?? []).map((r) => ({
    id: r.id,
    activityId: r.activity_id,
    user: Array.isArray(r.user) ? r.user[0] : r.user,
  }))

  return (
    <div className={`rounded-lg border border-border p-3 sm:p-4 ${isPast ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/activity/${activity.id}`} className="min-w-0 flex-1 hover:opacity-80 transition-opacity">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{activity.title}</h3>
            {role === 'host' ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                <Crown className="size-2.5" /> Host
              </span>
            ) : participantStatus === 'accepted' ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="size-2.5" /> Going
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Clock3 className="size-2.5" /> Requested
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> {dateStr} at {timeStr}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {activity.location_name}
            </span>
          </div>

          {role === 'participant' && creatorName && (
            <p className="mt-1 text-[11px] text-muted-foreground/70">Hosted by {creatorName}</p>
          )}
        </Link>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {SPORT_LABELS[activity.sport_type] ?? activity.sport_type}
          </span>
        </div>
      </div>

      {/* Host: pending requests */}
      {role === 'host' && normalizedRequests.length > 0 && !isPast && (
        <div className="mt-3 border-t border-border/50 pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {normalizedRequests.length} pending {normalizedRequests.length === 1 ? 'request' : 'requests'}
          </p>
          <ParticipantManager
            activityId={activity.id}
            requests={normalizedRequests}
          />
        </div>
      )}

      {/* Inline chat */}
      {!isPast && currentUserId && (
        <TripChat activityId={activity.id} currentUserId={currentUserId} />
      )}
    </div>
  )
}
