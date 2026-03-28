'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Clock, ArrowRight, Sparkles, Search, X } from 'lucide-react'

import { SPORT_LABELS, SKILL_LABELS } from '@groute/shared'
import { UserAvatar } from '@/components/UserAvatar'

const SPORT_EMOJIS: Record<string, string> = {
  hiking: '\u{1F97E}',
  trail_running: '\u{1F3C3}',
}

interface ActivityData {
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

interface RightNowViewProps {
  activities: ActivityData[]
  userSports: string[]
  userId: string
}

export function RightNowView({ activities, userSports, userId }: RightNowViewProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const userSportsSet = new Set(userSports)
  const now = new Date()
  const in6h = new Date(now.getTime() + 6 * 60 * 60 * 1000)
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Filter by search
  const filtered = searchQuery.trim()
    ? activities.filter((a) => {
        const q = searchQuery.toLowerCase()
        return (
          a.title.toLowerCase().includes(q) ||
          a.location_name.toLowerCase().includes(q) ||
          (SPORT_LABELS[a.sport_type] ?? a.sport_type).toLowerCase().includes(q)
        )
      })
    : activities

  const happeningSoon = filtered.filter((a) => new Date(a.scheduled_at) <= in6h)
  const upcoming = filtered.filter((a) => new Date(a.scheduled_at) > in6h)
  const forYou = filtered.filter((a) => userSportsSet.has(a.sport_type)).slice(0, 6)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">{greeting}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening around you
        </p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activities, locations, sports..."
            className="h-10 w-full rounded-xl border border-border/50 bg-muted/30 pl-10 pr-9 text-sm outline-none placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
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
              <ActivityCard key={a.id} activity={a} featured />
            ))}
          </div>
        </section>
      )}

      {/* For You */}
      {forYou.length > 0 && !searchQuery && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            <h2 className="text-lg font-semibold">For You</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {forYou.map((a) => (
              <ActivityCard key={a.id} activity={a} />
            ))}
          </div>
        </section>
      )}

      {/* Coming Up */}
      {upcoming.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold">
            {searchQuery ? `Results (${filtered.length})` : 'Coming Up'}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((a) => (
              <ActivityCard key={a.id} activity={a} />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-20 text-center">
          <p className="text-4xl">{searchQuery ? '\u{1F50D}' : '\u{1F3D4}'}</p>
          <p className="mt-4 text-sm font-medium">
            {searchQuery ? 'No results found' : 'Nothing happening right now'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {searchQuery
              ? 'Try a different search term'
              : <>Check back later or{' '}
                  <Link href="/explore" className="text-primary hover:underline">explore the map</Link>
                  {' '}to find activities.</>
            }
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

function ActivityCard({ activity, featured }: { activity: ActivityData; featured?: boolean }) {
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
      className="group block overflow-hidden rounded-2xl border border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-lg"
    >
      {activity.banner_url ? (
        <div className={`w-full overflow-hidden bg-muted ${featured ? 'h-40' : 'h-28'}`}>
          <img src={activity.banner_url} alt="" className="size-full object-cover transition-transform group-hover:scale-105" />
        </div>
      ) : (
        <div className={`flex w-full items-center justify-center bg-linear-to-br from-primary/10 via-primary/5 to-accent/10 ${featured ? 'h-40' : 'h-28'}`}>
          <span className={featured ? 'text-4xl' : 'text-3xl'}>{SPORT_EMOJIS[activity.sport_type] ?? '\u{1F3DE}'}</span>
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
                <UserAvatar key={p.id} src={p.avatar_url} name={p.first_name ?? p.display_name} size="xs" className="ring-2 ring-card" />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground">{goingCount}/{activity.max_participants}</span>
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
