'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { Calendar, Search, X } from 'lucide-react'

import { SPORT_LABELS } from '@groute/shared'

import { parseSearchQuery } from '@/lib/searchParser' // fallback for when AI search is unavailable

import { DiscoverMap, type DiscoverMapHandle } from '@/components/DiscoverMap'
import { ActivityFeed } from '@/components/ActivityFeed'
import { CreateActivityModal } from '@/components/CreateActivityModal'
import { ActivityDetailSheet } from '@/components/ActivityDetailSheet'
import { RecommendedRow } from '@/components/RecommendedRow'

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
  trail_osm_id: number | null
  trail_name: string | null
  trail_distance_meters: number | null
  trail_surface: string | null
  trail_sac_scale: string | null
  trailhead_lat: string | null
  trailhead_lng: string | null
  trail_approach_distance_m: number | null
  trail_approach_duration_s: number | null
  trail_geometry: string | null
  approach_geometry: string | null
  unsplash_image_url: string | null
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

export interface FriendLocation {
  id: string
  name: string
  avatarUrl: string | null
  initial: string
  lat: number
  lng: number
}

interface DiscoverViewProps {
  initialActivities: ActivityData[]
  currentUserId: string | null
  friends?: FriendLocation[]
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

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959 // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function DiscoverView({ initialActivities, currentUserId, friends = [] }: DiscoverViewProps) {
  const [recommended, setRecommended] = useState<ActivityData[]>([])
  const [selectedSport, setSelectedSport] = useState<string | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<ActivityData | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [specificDate, setSpecificDate] = useState<string | null>(null) // when set, show only this day
  const mapRef = useRef<DiscoverMapHandle>(null)

  // Fetch personalized recommendations on mount
  useEffect(() => {
    if (!currentUserId) return
    async function fetchRecommended() {
      try {
        const res = await fetch('/api/activities/recommended')
        if (res.ok) {
          const data = await res.json()
          setRecommended(data.data ?? [])
        }
      } catch {
        // fail silently — feed still works without recommendations
      }
    }
    fetchRecommended()
  }, [currentUserId])

  const today = todayStr()

  const filtered = useMemo(() => {
    const now = new Date()
    const q = searchQuery.trim().toLowerCase()

    const result = initialActivities
      .filter((a) => {
        const scheduled = new Date(a.scheduled_at)
        if (scheduled < now) return false
        if (specificDate) {
          // Show only activities on the specific selected date
          const activityDate = scheduled.toISOString().slice(0, 10)
          if (activityDate !== specificDate) return false
        } else {
          const end = endOfDay(endDate)
          if (scheduled > end) return false
        }
        if (selectedSport && a.sport_type !== selectedSport) return false
        if (selectedSkill && a.skill_level !== selectedSkill) return false
        if (q) {
          const matches =
            a.title.toLowerCase().includes(q) ||
            a.location_name.toLowerCase().includes(q) ||
            (SPORT_LABELS[a.sport_type] ?? '').toLowerCase().includes(q) ||
            (a.trail_name ?? '').toLowerCase().includes(q)
          if (!matches) return false
        }
        return true
      })
      .map((a) => {
        let distanceMiles: number | null = null
        if (userLocation && a.location_lat && a.location_lng) {
          distanceMiles = haversineDistance(userLocation.lat, userLocation.lng, parseFloat(a.location_lat), parseFloat(a.location_lng))
        }
        return { ...a, distanceMiles }
      })

    if (userLocation) {
      result.sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity))
    }

    return result
  }, [initialActivities, selectedSport, selectedSkill, endDate, specificDate, userLocation, searchQuery])

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
    setSpecificDate(null) // clear specific date when using presets
  }

  function handleSearch(query: string) {
    setSearchQuery(query)
    if (!query.trim()) return
    const parsed = parseSearchQuery(query)
    if (parsed.sport) setSelectedSport(parsed.sport)
    if (parsed.skill) setSelectedSkill(parsed.skill)
    if (parsed.timeframeDays !== null) setTimeframeDays(parsed.timeframeDays)
  }

  function clearSearch() {
    setSearchQuery('')
    setSelectedSport(null)
    setSpecificDate(null)
    setSelectedSkill(null)
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* Filter pills */}
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border/30 px-4 py-2 sm:py-2 scrollbar-none">
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
          const isActive = !specificDate && endDate === target.toISOString().slice(0, 10)
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
            value={specificDate ?? ''}
            min={today}
            onChange={(e) => {
              if (e.target.value) {
                setSpecificDate(e.target.value)
              } else {
                setSpecificDate(null)
              }
            }}
            className={`h-7 rounded-full border bg-transparent pl-6 pr-2 text-xs outline-none focus-visible:border-ring ${
              specificDate
                ? 'border-accent text-accent-foreground'
                : 'border-border text-muted-foreground'
            }`}
          />
        </div>

        {specificDate && (
          <button
            type="button"
            onClick={() => setSpecificDate(null)}
            className="shrink-0 rounded-full bg-accent/20 px-2.5 py-1.5 text-xs font-semibold text-accent-foreground ring-1 ring-accent/30 hover:bg-accent/30 transition-colors"
          >
            <X className="inline size-3 mr-0.5" />
            {new Date(specificDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </button>
        )}
      </div>

      {/* Sidebar + Map */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex w-full flex-col border-r border-border/50 sm:w-80 lg:w-96">
          {/* Search bar */}
          <div className="shrink-0 border-b border-border/50 px-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(searchQuery) }}
                placeholder="Search by name, location, trail..."
                className="h-9 w-full rounded-xl border border-border/50 bg-muted/30 pl-9 pr-8 text-sm outline-none placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? 'activity' : 'activities'}
            </span>
            <CreateActivityModal initialMapCenter={userLocation} />
          </div>

          <ActivityFeed
            activities={filtered}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onSelect={handleActivitySelect}
          />
        </div>

        <div className="relative hidden flex-1 sm:block">
          {/* For You panel */}
          {recommended.length > 0 && !selectedSport && !selectedSkill && (
            <div className="absolute right-3 top-3 z-10 w-72">
              <RecommendedRow
                activities={recommended}
                onSelect={handleActivitySelect}
              />
            </div>
          )}

          <DiscoverMap
            ref={mapRef}
            activities={mapActivities}
            selectedSport={selectedSport}
            hoveredActivityId={hoveredId}
            onActivitySelect={handleActivitySelect}
            onUserLocationChange={(lat, lng) => {
              setUserLocation({ lat, lng })
              fetch('/api/location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude: lat, longitude: lng }),
              }).catch(() => {})
            }}
            friends={friends}
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
