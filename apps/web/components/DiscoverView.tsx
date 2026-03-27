'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { Calendar } from 'lucide-react'

import { SPORT_LABELS } from '@groute/shared'

import { DiscoverMap, type DiscoverMapHandle } from '@/components/DiscoverMap'
import { ActivityFeed } from '@/components/ActivityFeed'
import { CreateActivityModal } from '@/components/CreateActivityModal'
import { ActivityDetailSheet } from '@/components/ActivityDetailSheet'

export interface ActivityData {
  id: string
  title: string
  description: string | null
  sport_type: string
  skill_level: string
  visibility: string
  creator_id: string
  banner_url: string | null
  location_lat: string | null
  location_lng: string | null
  location_name: string
  scheduled_at: string
  max_participants: number
  status: string
  participantStatus: string | null
  isOwner: boolean
  creator: {
    id: string
    display_name: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    area: string | null
  } | null
  participants: Array<{
    id: string
    display_name: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  }>
}

interface DiscoverViewProps {
  initialActivities: ActivityData[]
  currentUserId: string | null
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function endOfDay(dateStr: string): Date {
  return new Date(dateStr + 'T23:59:59')
}

const TIMEFRAME_OPTIONS = [
  { label: 'Today', days: 0 },
  { label: '3 days', days: 3 },
  { label: 'Week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: 'Month', days: 30 },
] as const

export function DiscoverView({ initialActivities, currentUserId }: DiscoverViewProps) {
  const [selectedSport, setSelectedSport] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<ActivityData | null>(null)
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const mapRef = useRef<DiscoverMapHandle>(null)

  const today = todayStr()

  const filtered = useMemo(() => {
    const now = new Date()
    const end = endOfDay(endDate)

    return initialActivities.filter((a) => {
      const scheduled = new Date(a.scheduled_at)
      if (scheduled < now || scheduled > end) return false
      if (selectedSport && a.sport_type !== selectedSport) return false
      return true
    })
  }, [initialActivities, selectedSport, endDate])

  const mapActivities = filtered.map((a) => ({
    id: a.id,
    title: a.title,
    sportType: a.sport_type,
    skillLevel: a.skill_level,
    locationLat: a.location_lat,
    locationLng: a.location_lng,
    locationName: a.location_name,
    scheduledAt: a.scheduled_at,
    maxParticipants: a.max_participants,
    creator: a.creator
      ? {
          displayName: a.creator.display_name,
          firstName: a.creator.first_name,
          lastName: a.creator.last_name,
          area: a.creator.area,
        }
      : null,
  }))

  const handleActivitySelect = useCallback(
    (id: string) => {
      const activity = initialActivities.find((a) => a.id === id)
      if (!activity) return

      // Fly to location on map
      if (activity.location_lat && activity.location_lng) {
        const lng = parseFloat(activity.location_lng)
        const lat = parseFloat(activity.location_lat)
        if (!isNaN(lng) && !isNaN(lat)) {
          mapRef.current?.flyTo(lng, lat)
        }
      }

      // Open detail sheet
      setSelectedActivity(activity)
    },
    [initialActivities]
  )

  function setTimeframeDays(days: number) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    setEndDate(d.toISOString().slice(0, 10))
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* Filter bar */}
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border/30 bg-card/50 px-4 py-2.5 sm:py-2.5 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedSport(null)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
            selectedSport === null
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          All
        </button>
        {Object.entries(SPORT_LABELS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelectedSport(selectedSport === key ? null : key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
              selectedSport === key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}

        <div className="mx-1 h-4 w-px shrink-0 bg-border" />

        {TIMEFRAME_OPTIONS.map(({ label, days }) => {
          const target = new Date()
          target.setDate(target.getDate() + days)
          const isActive = endDate === target.toISOString().slice(0, 10)
          return (
            <button
              key={label}
              type="button"
              onClick={() => setTimeframeDays(days)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-accent/20 text-accent-foreground ring-1 ring-accent/30'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {label}
            </button>
          )
        })}

        <div className="relative shrink-0">
          <Calendar className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="date"
            value={endDate}
            min={today}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-7 rounded-full border border-border bg-transparent pl-6 pr-2 text-xs text-muted-foreground outline-none focus-visible:border-ring"
          />
        </div>
      </div>

      {/* Sidebar + Map */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex w-full flex-col border-r border-border/50 sm:w-80 lg:w-96">
          <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? 'activity' : 'activities'}
            </span>
            <CreateActivityModal />
          </div>

          <ActivityFeed
            activities={filtered}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onSelect={handleActivitySelect}
          />
        </div>

        <div className="hidden flex-1 sm:block">
          <DiscoverMap
            ref={mapRef}
            activities={mapActivities}
            selectedSport={selectedSport}
            hoveredActivityId={hoveredId}
            onActivitySelect={handleActivitySelect}
          />
        </div>

        {/* Detail sheet overlay */}
        {selectedActivity && (
          <ActivityDetailSheet
            activity={selectedActivity}
            currentUserId={currentUserId}
            onClose={() => setSelectedActivity(null)}
          />
        )}
      </div>
    </div>
  )
}
