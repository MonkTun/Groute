'use client'

import { SPORT_LABELS, SKILL_LABELS } from '@groute/shared'
import { MapPin, Clock, Users } from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'

import type { ActivityData } from '@/components/DiscoverView'

interface ActivityFeedProps {
  activities: (ActivityData & { distanceMiles?: number | null })[]
  hoveredId: string | null
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}

const SPORT_COLORS: Record<string, string> = {
  hiking: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  climbing: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  trail_running: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  surfing: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  cycling: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  mountain_biking: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  skiing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  kayaking: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  yoga: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
}

export function ActivityFeed({
  activities,
  hoveredId,
  onHover,
  onSelect,
}: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-3 text-4xl">
          {'\u{1F3D4}'}
        </div>
        <p className="text-sm font-semibold">No activities found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Try a different filter or create one!
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-none">
      {activities.map((activity) => {
        const scheduledDate = new Date(activity.scheduled_at)
        const dateStr = scheduledDate.toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
        })
        const timeStr = scheduledDate.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit',
        })

        const creatorName = activity.creator
          ? activity.creator.first_name && activity.creator.last_name
            ? `${activity.creator.first_name} ${activity.creator.last_name[0]}.`
            : activity.creator.display_name
          : 'Unknown'

        const goingCount = (activity.participants?.length ?? 0) + 1
        const isHovered = hoveredId === activity.id
        const sportColor = SPORT_COLORS[activity.sport_type] ?? 'bg-muted text-muted-foreground'

        const spotsLeft = activity.max_participants - goingCount

        return (
          <button
            key={activity.id}
            type="button"
            onClick={() => onSelect(activity.id)}
            onMouseEnter={() => onHover(activity.id)}
            onMouseLeave={() => onHover(null)}
            className={`group w-full border-b border-border/30 px-4 py-3.5 text-left transition-all duration-150 ${
              isHovered
                ? 'bg-primary/5'
                : 'hover:bg-muted/40'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Cover photo thumbnail */}
              {activity.banner_url && (
                <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <img
                    src={activity.banner_url}
                    alt=""
                    className="size-full object-cover"
                  />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[13px] font-semibold leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                    {activity.title}
                  </h3>
                  <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold ${sportColor}`}>
                    {SPORT_LABELS[activity.sport_type] ?? activity.sport_type}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3 shrink-0 text-muted-foreground/60" />
                    <span>{dateStr}, {timeStr}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0 text-muted-foreground/60" />
                    <span className="line-clamp-1">{activity.location_name}</span>
                    {activity.distanceMiles != null && (
                      <span className="shrink-0 text-muted-foreground/50">
                        &middot; {activity.distanceMiles < 1
                          ? `${(activity.distanceMiles * 5280).toFixed(0)} ft`
                          : `${activity.distanceMiles.toFixed(1)} mi`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1">
                {/* Avatar stack */}
                <div className="flex -space-x-1.5">
                  {activity.creator && (
                    <UserAvatar
                      src={activity.creator.avatar_url}
                      name={creatorName}
                      size="xs"
                      className="ring-2 ring-background"
                    />
                  )}
                  {activity.participants?.slice(0, 2).map((p) => (
                    <UserAvatar
                      key={p.id}
                      src={p.avatar_url}
                      name={p.first_name ?? p.display_name}
                      size="xs"
                      className="ring-2 ring-background"
                    />
                  ))}
                </div>
                <span className="ml-1 text-[11px] text-muted-foreground">
                  {goingCount}/{activity.max_participants}
                </span>
                {spotsLeft > 0 && spotsLeft <= 3 && (
                  <span className="ml-1.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
                  </span>
                )}
              </div>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {SKILL_LABELS[activity.skill_level] ?? activity.skill_level}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
