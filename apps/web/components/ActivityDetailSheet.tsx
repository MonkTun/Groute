'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, MapPin, Clock, Users, Eye, Lock, Globe, Mountain, Ruler, Footprints, Car, Backpack, Check } from 'lucide-react'

import { SPORT_LABELS, SKILL_LABELS, VISIBILITY_LABELS, SAC_SCALE_LABELS, SURFACE_LABELS } from '@groute/shared'
import { fireConfetti } from '@/hooks/useConfetti'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/UserAvatar'
import { TrailMapView } from '@/components/TrailMapView'

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
import type { ActivityData } from '@/components/DiscoverView'

interface ActivityDetailSheetProps {
  activity: ActivityData
  currentUserId: string | null
  onClose: () => void
}

export function ActivityDetailSheet({
  activity,
  currentUserId,
  onClose,
}: ActivityDetailSheetProps) {
  const router = useRouter()
  const [joinState, setJoinState] = useState<string | null>(activity.participantStatus)
  const [isJoining, setIsJoining] = useState(false)
  const [showPostJoin, setShowPostJoin] = useState(false)
  const [postJoinTown, setPostJoinTown] = useState('')
  const [postJoinTransport, setPostJoinTransport] = useState<'drive_others' | 'need_ride' | 'solo' | null>(null)
  const [postJoinSeats, setPostJoinSeats] = useState('3')
  const [postJoinSoloMode, setPostJoinSoloMode] = useState<'driving' | 'transit' | 'rideshare' | 'walking'>('driving')
  const [postJoinEquipment, setPostJoinEquipment] = useState<Set<string>>(new Set())
  const [isSavingTripInfo, setIsSavingTripInfo] = useState(false)

  const isOwner = activity.isOwner

  const scheduledDate = new Date(activity.scheduled_at)
  const dateStr = scheduledDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const timeStr = scheduledDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  const creatorName = activity.creator
    ? activity.creator.first_name && activity.creator.last_name
      ? `${activity.creator.first_name} ${activity.creator.last_name}`
      : activity.creator.display_name
    : 'Unknown'

  const visibilityIcon =
    activity.visibility === 'public' ? Globe :
    activity.visibility === 'discoverable' ? Eye : Lock

  const VisIcon = visibilityIcon

  // All people going: creator + participants
  const allGoing: Array<{
    id: string
    name: string
    avatarUrl: string | null
    initial: string
  }> = []

  if (activity.creator) {
    allGoing.push({
      id: activity.creator.id,
      name: creatorName,
      avatarUrl: activity.creator.avatar_url,
      initial: (activity.creator.first_name?.[0] ?? activity.creator.display_name[0]).toUpperCase(),
    })
  }

  for (const p of activity.participants) {
    if (p.id !== activity.creator_id) {
      const pName = p.first_name && p.last_name
        ? `${p.first_name} ${p.last_name}`
        : p.display_name
      allGoing.push({
        id: p.id,
        name: pName,
        avatarUrl: p.avatar_url,
        initial: (p.first_name?.[0] ?? p.display_name[0]).toUpperCase(),
      })
    }
  }

  async function handleSaveTripInfo() {
    setIsSavingTripInfo(true)
    try {
      const transportMode =
        postJoinTransport === 'drive_others' ? 'carpool_driver' :
        postJoinTransport === 'need_ride' ? 'carpool_passenger' :
        postJoinSoloMode

      await fetch(`/api/activities/${activity.id}/transport-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transportMode,
          originName: postJoinTown || undefined,
          originLat: 0,
          originLng: 0,
          vehicleCapacity: postJoinTransport === 'drive_others' ? parseInt(postJoinSeats, 10) : undefined,
          needsRide: postJoinTransport === 'need_ride' ? true : false,
        }),
      })

      // Save equipment if any selected
      if (postJoinEquipment.size > 0) {
        await fetch(`/api/activities/${activity.id}/equipment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: Array.from(postJoinEquipment).map((name) => ({
              itemName: name,
              status: 'have',
            })),
          }),
        })
      }

      // Trigger timeline recompute
      fetch(`/api/activities/${activity.id}/compute-timeline`, { method: 'POST' }).catch(() => {})

      setShowPostJoin(false)
      onClose()
      router.refresh()
    } catch {
      // ignore
    } finally {
      setIsSavingTripInfo(false)
    }
  }

  async function handleJoin() {
    setIsJoining(true)
    try {
      const res = await fetch(`/api/activities/${activity.id}/join`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        setJoinState(data.data.status)
        if (data.data.status === 'accepted') {
          fireConfetti()
          setShowPostJoin(true) // Show trip info form after joining
        }
        router.refresh()
      }
    } catch {
      // ignore
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet — centered card */}
      <div className="absolute inset-x-0 bottom-0 z-50 flex max-h-[92%] flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl ring-1 ring-border/50 animate-in slide-in-from-bottom duration-300 sm:inset-x-0 sm:inset-y-0 sm:m-auto sm:h-fit sm:max-h-[90%] sm:w-105 sm:rounded-3xl">
        {/* Banner */}
        {(activity.banner_url || activity.unsplash_image_url) ? (
          <div className="relative h-44 w-full overflow-hidden bg-muted sm:rounded-t-3xl">
            <img
              src={(activity.banner_url || activity.unsplash_image_url)!}
              alt={activity.title}
              className="size-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded-full bg-black/30 p-1.5 text-white/90 backdrop-blur-md hover:bg-black/50 transition-all"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="relative flex h-36 w-full items-center justify-center bg-linear-to-br from-primary/15 via-primary/8 to-accent/10 sm:rounded-t-3xl">
            <span className="text-5xl drop-shadow-sm">{getSportEmoji(activity.sport_type)}</span>
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded-full bg-foreground/10 p-1.5 text-foreground/70 hover:bg-foreground/20 hover:text-foreground transition-all"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4 scrollbar-none">
          {/* Title + sport badge */}
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold leading-snug">{activity.title}</h2>
            <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold ${SPORT_COLORS[activity.sport_type] ?? 'bg-muted text-muted-foreground'}`}>
              {SPORT_LABELS[activity.sport_type] ?? activity.sport_type}
            </span>
          </div>

          {activity.description && (
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              {activity.description}
            </p>
          )}

          {/* Details grid */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
              <Clock className="size-4 shrink-0 text-primary/70" />
              <div>
                <p className="text-[11px] text-muted-foreground">When</p>
                <p className="text-xs font-medium">{dateStr}, {timeStr}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
              <MapPin className="size-4 shrink-0 text-primary/70" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Where</p>
                <p className="text-xs font-medium truncate">{activity.location_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
              <Users className="size-4 shrink-0 text-primary/70" />
              <div>
                <p className="text-[11px] text-muted-foreground">Going</p>
                <p className="text-xs font-medium">{allGoing.length} / {activity.max_participants}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
              <VisIcon className="size-4 shrink-0 text-primary/70" />
              <div>
                <p className="text-[11px] text-muted-foreground">Type</p>
                <p className="text-xs font-medium">{VISIBILITY_LABELS[activity.visibility] ?? activity.visibility}</p>
              </div>
            </div>
          </div>

          {/* Trail info + map */}
          {activity.trail_name && (
            <div className="mt-3 space-y-2">
              {/* Map — only when all coordinates are available */}
              {activity.trail_osm_id != null && activity.location_lat && activity.location_lng && activity.trailhead_lat && activity.trailhead_lng && (
                <TrailMapView
                  locationLat={parseFloat(activity.location_lat)}
                  locationLng={parseFloat(activity.location_lng)}
                  locationName={activity.location_name}
                  trailOsmId={activity.trail_osm_id}
                  trailName={activity.trail_name}
                  trailheadLat={parseFloat(activity.trailhead_lat)}
                  trailheadLng={parseFloat(activity.trailhead_lng)}
                  hasApproachRoute={activity.trail_approach_duration_s != null}
                  trailGeometry={activity.trail_geometry}
                  approachGeometry={activity.approach_geometry}
                  height={200}
                />
              )}
              {/* Trail text info — always shown when trail_name exists */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium text-green-700 dark:text-green-400">
                  <Mountain className="size-3" />
                  {activity.trail_name}
                </span>
                {activity.trail_distance_meters != null && (
                  <span className="flex items-center gap-1">
                    <Ruler className="size-3" />
                    {activity.trail_distance_meters < 1000
                      ? `${activity.trail_distance_meters}m`
                      : `${(activity.trail_distance_meters / 1609.344).toFixed(1)} mi`}
                  </span>
                )}
                {activity.trail_sac_scale && (
                  <span className="flex items-center gap-1">
                    <Footprints className="size-3" />
                    {SAC_SCALE_LABELS[activity.trail_sac_scale] ?? activity.trail_sac_scale}
                  </span>
                )}
                {activity.trail_surface && (
                  <span>{SURFACE_LABELS[activity.trail_surface] ?? activity.trail_surface}</span>
                )}
                {activity.trail_approach_duration_s != null && (
                  <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                    <Clock className="size-3" />
                    {Math.ceil(activity.trail_approach_duration_s / 60)} min walk
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Host */}
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-primary/5 px-3.5 py-3 ring-1 ring-primary/10">
            <UserAvatar
              src={activity.creator?.avatar_url}
              name={creatorName}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{creatorName}</p>
              <p className="text-[11px] text-muted-foreground">Organizer</p>
            </div>
          </div>

          {/* People going */}
          {allGoing.length > 0 && (
            <div className="mt-4">
              <p className="mb-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Going ({allGoing.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allGoing.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-1.5 rounded-full bg-muted/70 px-1.5 py-1 ring-1 ring-border/30"
                  >
                    <UserAvatar src={person.avatarUrl} name={person.name} size="xs" />
                    <span className="text-xs font-medium pr-1">{person.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Action area — fixed at bottom */}
        <div className="shrink-0 border-t border-border/30 bg-card px-5 py-3">
          {showPostJoin ? (
            /* Post-join trip info form */
            <div className="space-y-3">
              <p className="text-sm font-semibold">You&apos;re in! Help plan the trip:</p>

              {/* Town */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Where are you coming from?</label>
                <Input
                  value={postJoinTown}
                  onChange={(e) => setPostJoinTown(e.target.value)}
                  placeholder="e.g. Santa Monica, Downtown LA"
                />
              </div>

              {/* Transport */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">How are you getting there?</label>
                <div className="flex gap-1.5">
                  {([
                    ['drive_others', 'I can drive others', Car],
                    ['need_ride', 'I need a ride', Users],
                    ['solo', 'On my own', MapPin],
                  ] as const).map(([val, label, Icon]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPostJoinTransport(val)}
                      className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                        postJoinTransport === val
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Icon className="inline size-3 mr-1" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Seats selector for drivers */}
                {postJoinTransport === 'drive_others' && (
                  <div className="flex items-center gap-2 pt-1">
                    <label className="text-xs text-muted-foreground">Available seats:</label>
                    <select
                      value={postJoinSeats}
                      onChange={(e) => setPostJoinSeats(e.target.value)}
                      className="h-7 rounded-lg border border-input bg-transparent px-2 text-xs"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Solo mode selector */}
                {postJoinTransport === 'solo' && (
                  <div className="flex gap-1 pt-1">
                    {(['driving', 'transit', 'rideshare', 'walking'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPostJoinSoloMode(mode)}
                        className={`rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${
                          postJoinSoloMode === mode
                            ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {mode === 'driving' ? 'Driving solo' : mode === 'transit' ? 'Transit' : mode === 'rideshare' ? 'Rideshare' : 'Walking'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Equipment (placeholder) */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  <Backpack className="inline size-3 mr-1" />
                  Equipment you have (optional)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['Water bottle', 'Hiking poles', 'First aid kit', 'Headlamp', 'Snacks'].map((item) => {
                    const isSelected = postJoinEquipment.has(item)
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setPostJoinEquipment((prev) => {
                            const next = new Set(prev)
                            next.has(item) ? next.delete(item) : next.add(item)
                            return next
                          })
                        }}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          isSelected
                            ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {isSelected && <Check className="inline size-2.5 mr-0.5" />}
                        {item}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button className="flex-1 rounded-xl h-10" onClick={handleSaveTripInfo} disabled={isSavingTripInfo}>
                  {isSavingTripInfo ? 'Saving...' : 'Save & View Trip'}
                </Button>
                <Button className="rounded-xl h-10" variant="ghost" onClick={() => { setShowPostJoin(false); onClose(); router.refresh() }}>
                  Skip
                </Button>
              </div>
            </div>
          ) : isOwner ? (
            <Button className="w-full rounded-xl h-10" variant="outline" onClick={() => { onClose(); router.push(`/activity/${activity.id}`) }}>
              Manage Activity
            </Button>
          ) : joinState === 'accepted' ? (
            <div className="flex gap-2">
              <Button className="flex-1 rounded-xl h-10" variant="outline" onClick={() => { onClose(); router.push(`/trips`) }}>
                Open Chat
              </Button>
              <Button className="flex-1 rounded-xl h-10" variant="outline" onClick={() => { onClose(); router.push(`/activity/${activity.id}`) }}>
                View Details
              </Button>
            </div>
          ) : joinState === 'requested' ? (
            <Button className="w-full rounded-xl h-10" disabled variant="secondary">
              Request Pending
            </Button>
          ) : (
            <Button className="w-full rounded-xl h-10 shadow-md" onClick={handleJoin} disabled={isJoining}>
              {isJoining
                ? 'Joining...'
                : activity.visibility === 'public'
                  ? 'Join Activity'
                  : 'Request to Join'}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

function getSportEmoji(sport: string): string {
  const emojis: Record<string, string> = {
    hiking: '\u{1F97E}', climbing: '\u{1FA78}', trail_running: '\u{1F3C3}',
    surfing: '\u{1F3C4}', cycling: '\u{1F6B4}', mountain_biking: '\u{1F6B5}',
    skiing: '\u{26F7}', kayaking: '\u{1F6F6}', yoga: '\u{1F9D8}',
  }
  return emojis[sport] ?? '\u{1F3DE}'
}
