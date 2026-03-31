'use client'

import { useState } from 'react'
import { SPORT_LABELS } from '@groute/shared'
import { MapPin, Users, Sparkles, X, Mountain } from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'

import type { ActivityData } from '@/components/DiscoverView'

const SPORT_COLORS: Record<string, string> = {
  hiking: 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  climbing: 'bg-orange-100/80 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  trail_running: 'bg-lime-100/80 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400',
  surfing: 'bg-cyan-100/80 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  cycling: 'bg-violet-100/80 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  mountain_biking: 'bg-amber-100/80 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  skiing: 'bg-sky-100/80 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  kayaking: 'bg-teal-100/80 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  yoga: 'bg-rose-100/80 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
}

const SPORT_EMOJIS: Record<string, string> = {
  hiking: '\u{1F97E}', climbing: '\u{1FA78}', trail_running: '\u{1F3C3}',
  surfing: '\u{1F3C4}', cycling: '\u{1F6B4}', mountain_biking: '\u{1F6B5}',
  skiing: '\u{26F7}', kayaking: '\u{1F6F6}', yoga: '\u{1F9D8}',
}

interface RecommendedRowProps {
  activities: ActivityData[]
  onSelect: (id: string) => void
}

export function RecommendedRow({ activities, onSelect }: RecommendedRowProps) {
  const [dismissed, setDismissed] = useState(false)

  if (activities.length === 0 || dismissed) return null

  return (
    <div className="rounded-xl bg-card/90 shadow-lg ring-1 ring-border/50 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            For You
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Scrollable card list */}
      <div className="max-h-80 overflow-y-auto scrollbar-none p-2 space-y-1.5">
        {activities.slice(0, 5).map((activity) => {
          const scheduledDate = new Date(activity.scheduled_at)
          const dateStr = scheduledDate.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
          })

          const creatorName = activity.creator
            ? activity.creator.first_name && activity.creator.last_name
              ? `${activity.creator.first_name} ${activity.creator.last_name[0]}.`
              : activity.creator.display_name
            : 'Unknown'

          const goingCount = (activity.participants?.length ?? 0) + 1
          const spotsLeft = activity.max_participants - goingCount
          const sportColor = SPORT_COLORS[activity.sport_type] ?? 'bg-muted text-muted-foreground'

          return (
            <button
              key={activity.id}
              type="button"
              onClick={() => onSelect(activity.id)}
              className="group flex w-full gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-muted/60"
            >
              {/* Thumbnail */}
              {(activity.banner_url || activity.unsplash_image_url) ? (
                <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <img src={(activity.banner_url || activity.unsplash_image_url)!} alt="" className="size-full object-cover" />
                </div>
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-primary/10 to-accent/10">
                  <span className="text-xl">{SPORT_EMOJIS[activity.sport_type] ?? '\u{1F3DE}'}</span>
                </div>
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-1">
                  <h4 className="text-[11px] font-semibold leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                    {activity.title}
                  </h4>
                  <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${sportColor}`}>
                    {SPORT_LABELS[activity.sport_type] ?? activity.sport_type}
                  </span>
                </div>

                <p className="mt-0.5 text-[10px] text-muted-foreground">{dateStr}</p>

                <div className="mt-1 flex items-center gap-2">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="size-2.5" />
                    <span className="truncate max-w-20">{activity.trail_name ?? activity.location_name}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {activity.creator && (
                      <UserAvatar src={activity.creator.avatar_url} name={creatorName} size="xs" />
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {goingCount}/{activity.max_participants}
                    </span>
                    {spotsLeft > 0 && spotsLeft <= 3 && (
                      <span className="ml-0.5 rounded bg-amber-100 px-1 py-px text-[9px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        {spotsLeft} left
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
