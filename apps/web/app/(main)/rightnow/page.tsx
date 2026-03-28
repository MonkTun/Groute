import { redirect } from 'next/navigation'
import Link from 'next/link'

import { createServerClient } from '@/lib/supabase/server'
import { SPORT_LABELS, SKILL_LABELS } from '@groute/shared'
import { MapPin, Clock, Users, ArrowRight, Sparkles } from 'lucide-react'

import { UserAvatar } from '@/components/UserAvatar'

export default async function RightNowPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const now = new Date()
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  const [activitiesResult, userSportsResult, participantsResult, allParticipantsResult] = await Promise.all([
    supabase
      .from('activities')
      .select(`
        id, title, description, sport_type, skill_level, banner_url, visibility,
        creator_id, location_name, scheduled_at, max_participants, status,
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
  ])

  const userSports = new Set((userSportsResult.data ?? []).map((s) => s.sport_type))
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

  // Split into "happening soon" (next 6h) and "later today / tomorrow"
  const in6h = new Date(now.getTime() + 6 * 60 * 60 * 1000)
  const happeningSoon = activities.filter((a) => new Date(a.scheduled_at) <= in6h)
  const upcoming = activities.filter((a) => new Date(a.scheduled_at) > in6h)

  // Activities matching user's sports
  const forYou = activities.filter((a) => userSports.has(a.sport_type)).slice(0, 6)

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{greeting}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening around you
        </p>
      </div>

      {/* Happening Soon */}
      {happeningSoon.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <div className="size-2 animate-pulse rounded-full bg-green-500" />
            <h2 className="text-lg font-semibold">Happening Soon</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {happeningSoon.map((a) => (
              <ActivityCard key={a.id} activity={a} userId={user.id} featured />
            ))}
          </div>
        </section>
      )}

      {/* For You */}
      {forYou.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            <h2 className="text-lg font-semibold">For You</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {forYou.map((a) => (
              <ActivityCard key={a.id} activity={a} userId={user.id} />
            ))}
          </div>
        </section>
      )}

      {/* Coming Up */}
      {upcoming.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold">Coming Up</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((a) => (
              <ActivityCard key={a.id} activity={a} userId={user.id} />
            ))}
          </div>
        </section>
      )}

      {activities.length === 0 && (
        <div className="flex flex-col items-center py-20 text-center">
          <p className="text-4xl">{'\u{1F3D4}'}</p>
          <p className="mt-4 text-sm font-medium">Nothing happening right now</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check back later or{' '}
            <Link href="/explore" className="text-primary hover:underline">explore the map</Link>
            {' '}to find activities.
          </p>
        </div>
      )}

      {/* CTA to explore */}
      <div className="flex justify-center">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          Explore the map <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  )
}

// ── Activity Card ──

const SPORT_EMOJIS: Record<string, string> = {
  hiking: '\u{1F97E}',
  trail_running: '\u{1F3C3}',
}

interface ActivityCardProps {
  activity: {
    id: string
    title: string
    description: string | null
    sport_type: string
    skill_level: string
    banner_url: string | null
    location_name: string
    scheduled_at: string
    max_participants: number
    creator_id: string
    isOwner: boolean
    participantStatus: string | null
    creator: { id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null
    participants: Array<{ id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null }>
  }
  userId: string
  featured?: boolean
}

function ActivityCard({ activity, featured }: ActivityCardProps) {
  const scheduled = new Date(activity.scheduled_at)
  const dateStr = scheduled.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const timeStr = scheduled.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const creatorName = activity.creator
    ? activity.creator.first_name && activity.creator.last_name
      ? `${activity.creator.first_name} ${activity.creator.last_name[0]}.`
      : activity.creator.display_name
    : 'Unknown'
  const goingCount = activity.participants.length + 1
  const spotsLeft = activity.max_participants - goingCount

  return (
    <Link
      href={`/activity/${activity.id}`}
      className={`group block overflow-hidden rounded-2xl border border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-lg ${featured ? '' : ''}`}
    >
      {/* Banner */}
      {activity.banner_url ? (
        <div className={`w-full overflow-hidden bg-muted ${featured ? 'h-40' : 'h-28'}`}>
          <img
            src={activity.banner_url}
            alt=""
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        </div>
      ) : (
        <div className={`flex w-full items-center justify-center bg-linear-to-br from-primary/10 via-primary/5 to-accent/10 ${featured ? 'h-40' : 'h-28'}`}>
          <span className={featured ? 'text-4xl' : 'text-3xl'}>
            {SPORT_EMOJIS[activity.sport_type] ?? '\u{1F3DE}'}
          </span>
        </div>
      )}

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`font-semibold leading-tight line-clamp-1 group-hover:text-primary transition-colors ${featured ? 'text-base' : 'text-sm'}`}>
            {activity.title}
          </h3>
          <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {SPORT_LABELS[activity.sport_type] ?? activity.sport_type}
          </span>
        </div>

        {featured && activity.description && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{activity.description}</p>
        )}

        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {dateStr}, {timeStr}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          <span className="line-clamp-1">{activity.location_name}</span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1.5">
              {activity.creator && (
                <UserAvatar src={activity.creator.avatar_url} name={creatorName} size="xs" className="ring-2 ring-card" />
              )}
              {activity.participants.slice(0, 2).map((p) => (
                <UserAvatar
                  key={p.id}
                  src={p.avatar_url}
                  name={p.first_name ?? p.display_name}
                  size="xs"
                  className="ring-2 ring-card"
                />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {goingCount}/{activity.max_participants}
            </span>
            {spotsLeft > 0 && spotsLeft <= 3 && (
              <span className="rounded bg-amber-100 px-1 py-px text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {spotsLeft} left
              </span>
            )}
          </div>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {SKILL_LABELS[activity.skill_level] ?? activity.skill_level}
          </span>
        </div>
      </div>
    </Link>
  )
}
