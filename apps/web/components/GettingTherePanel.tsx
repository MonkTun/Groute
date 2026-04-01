'use client'

import { useState, useEffect } from 'react'
import {
  Car, Train, UserPlus, Footprints, Navigation, Clock, ExternalLink,
  ChevronDown, ChevronUp, MapPin, DollarSign,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/UserAvatar'
import type { TransportOption, TransitRoute, TransitStep, CarpoolRouteDetails, DrivingDirections } from '@groute/shared'

interface RideUser {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

interface Ride {
  id: string
  user_id: string
  type: string
  available_seats: number | null
  pickup_location_name: string | null
  departure_time: string | null
  note: string | null
  status: string
  user: RideUser | RideUser[]
  passengers: Array<{ id: string; passenger_id: string; status: string; user: RideUser | RideUser[] }>
}

interface GettingTherePanelProps {
  activityId: string
  scheduledAt: string
  currentUserId: string
  destinationLat: number
  destinationLng: number
  destinationName: string
  meetingPointName?: string | null
  meetingPointLat?: string | null
  meetingPointLng?: string | null
  meetingTime?: string | null
  trailApproachDurationS?: number | null
  rides: Ride[]
  isParticipant: boolean
  onRefresh: () => void
}

type TabKey = 'drive' | 'transit' | 'rideshare' | 'carpool' | 'walk'

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'drive', label: 'Drive', icon: <Car className="size-3.5" /> },
  { key: 'transit', label: 'Transit', icon: <Train className="size-3.5" /> },
  { key: 'rideshare', label: 'Rideshare', icon: <DollarSign className="size-3.5" /> },
  { key: 'carpool', label: 'Carpool', icon: <UserPlus className="size-3.5" /> },
  { key: 'walk', label: 'Walk', icon: <Footprints className="size-3.5" /> },
]

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.round((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins} min`
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34
  return `${miles.toFixed(1)} mi`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function LeaveByBadge({ leaveAt }: { leaveAt: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1.5 text-sm font-semibold text-accent-foreground">
      <Clock className="size-3.5 text-accent" />
      Leave by {formatTime(leaveAt)}
    </div>
  )
}

function TransitStepRow({ step }: { step: TransitStep }) {
  const modeEmoji: Record<string, string> = {
    WALK: '\u{1F6B6}',
    BUS: '\u{1F68C}',
    SUBWAY: '\u{1F687}',
    RAIL: '\u{1F686}',
    TRAM: '\u{1F68A}',
    RIDESHARE: '\u{1F697}',
  }
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-sm">{modeEmoji[step.mode] ?? '\u{1F6B6}'}</span>
      <div className="flex-1 text-xs">
        <span className="font-medium">
          {step.mode === 'WALK'
            ? `Walk ${formatDuration(step.durationSeconds)}`
            : `${step.lineName ?? step.mode} ${step.numStops ? `(${step.numStops} stops)` : ''}`}
        </span>
        {step.departureStop && step.arrivalStop && (
          <p className="text-muted-foreground">
            {step.departureStop} → {step.arrivalStop}
          </p>
        )}
        {step.instructions && step.mode === 'WALK' && (
          <p className="text-muted-foreground">{step.instructions}</p>
        )}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatDuration(step.durationSeconds)}
      </span>
    </div>
  )
}

export function GettingTherePanel({
  activityId,
  scheduledAt,
  currentUserId,
  destinationLat,
  destinationLng,
  destinationName,
  meetingPointName,
  meetingPointLat,
  meetingPointLng,
  meetingTime,
  trailApproachDurationS,
  rides,
  isParticipant,
  onRefresh,
}: GettingTherePanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('drive')
  const [options, setOptions] = useState<TransportOption[]>([])
  const [loading, setLoading] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState(false)
  const [expandedTransit, setExpandedTransit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMode, setSavedMode] = useState<string | null>(null)

  // Carpool form state
  const [showCarpoolForm, setShowCarpoolForm] = useState(false)
  const [carpoolType, setCarpoolType] = useState<'offer' | 'request'>('offer')
  const [carpoolSeats, setCarpoolSeats] = useState('3')
  const [carpoolPickup, setCarpoolPickup] = useState('')
  const [carpoolNote, setCarpoolNote] = useState('')
  const [carpoolSubmitting, setCarpoolSubmitting] = useState(false)

  const targetLat = meetingPointLat ? parseFloat(meetingPointLat) : destinationLat
  const targetLng = meetingPointLng ? parseFloat(meetingPointLng) : destinationLng

  // Request geolocation
  useEffect(() => {
    if (!navigator.geolocation) { setLocationError(true); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError(true),
      { timeout: 10000, maximumAge: 300000 }
    )
  }, [])

  // Fetch transport options when location is available
  useEffect(() => {
    if (!userLocation) return
    setLoading(true)
    fetch(`/api/activities/${activityId}/transport-options?fromLat=${userLocation.lat}&fromLng=${userLocation.lng}`)
      .then((res) => res.json())
      .then((json) => { if (json.data) setOptions(json.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userLocation, activityId])

  // Fetch saved plan and auto-select the tab
  useEffect(() => {
    fetch(`/api/activities/${activityId}/transport-plan`)
      .then((res) => res.json())
      .then((json) => {
        if (json.data?.transport_mode) {
          setSavedMode(json.data.transport_mode)
          // Map transport mode to tab key
          const mode = json.data.transport_mode
          if (mode === 'driving') setActiveTab('drive')
          else if (mode === 'transit') setActiveTab('transit')
          else if (mode === 'rideshare') setActiveTab('rideshare')
          else if (mode === 'carpool_driver' || mode === 'carpool_passenger') setActiveTab('carpool')
          else if (mode === 'walking') setActiveTab('walk')
        }
      })
      .catch(() => {})
  }, [activityId])

  const optionByMode = (mode: string) => options.find((o) => o.mode === mode)
  const driveOpt = optionByMode('driving')
  const transitOpt = optionByMode('transit')
  const rideshareOpt = optionByMode('rideshare')
  const walkOpt = optionByMode('walking')
  const carpoolOpts = options.filter((o) => o.mode === 'carpool_passenger')

  // Available tabs — drive, transit, rideshare always visible; carpool always; walk if close enough
  const availableTabs = TABS.filter((t) => {
    if (t.key === 'drive') return true
    if (t.key === 'transit') return true // always show — falls back to Google Maps link
    if (t.key === 'rideshare') return true // always show
    if (t.key === 'carpool') return true
    if (t.key === 'walk') return !!walkOpt
    return false
  })

  // Auto-save plan when tab changes
  function handleTabSelect(tab: TabKey) {
    setActiveTab(tab)
    if (!userLocation) return
    const selectedOpt = optionByMode(tab) ?? driveOpt
    // Map tab to transport mode
    const modeMap: Record<TabKey, string> = {
      drive: 'driving',
      transit: 'transit',
      rideshare: 'rideshare',
      carpool: savedMode === 'carpool_driver' ? 'carpool_driver' : 'carpool_passenger',
      walk: 'walking',
    }
    fetch(`/api/activities/${activityId}/transport-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transportMode: modeMap[tab],
        originLat: userLocation.lat,
        originLng: userLocation.lng,
        estimatedTravelSeconds: selectedOpt?.durationSeconds,
        leaveAt: selectedOpt?.leaveAt,
      }),
    })
      .then(() => setSavedMode(modeMap[tab]))
      .catch(() => {})
  }

  async function handleCarpoolSubmit() {
    setCarpoolSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        type: carpoolType,
        note: carpoolNote.trim() || undefined,
        pickupLocationName: carpoolPickup.trim() || undefined,
      }
      if (carpoolType === 'offer') body.availableSeats = parseInt(carpoolSeats, 10) || 3
      const res = await fetch(`/api/activities/${activityId}/rides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setShowCarpoolForm(false)
        setCarpoolNote('')
        setCarpoolPickup('')
        onRefresh()
      }
    } finally {
      setCarpoolSubmitting(false)
    }
  }

  async function handleJoinRide(rideId: string) {
    await fetch(`/api/activities/${activityId}/rides/${rideId}/passengers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    onRefresh()
  }

  function resolveUser(u: RideUser | RideUser[]): RideUser {
    return Array.isArray(u) ? u[0] : u
  }

  // Maps deep links
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}`
  const appleMapsUrl = `https://maps.apple.com/?daddr=${targetLat},${targetLng}`
  const wazeUrl = `https://waze.com/ul?ll=${targetLat},${targetLng}&navigate=yes`
  const googleTransitUrl = `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}&travelmode=transit`
  const uberUrl = `https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${targetLat}&dropoff[longitude]=${targetLng}&dropoff[nickname]=${encodeURIComponent(destinationName)}`
  const lyftUrl = `https://lyft.com/ride?id=lyft&destination[latitude]=${targetLat}&destination[longitude]=${targetLng}`
  const googleWalkUrl = `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}&travelmode=walking`

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Navigation className="size-4 text-primary" />
        Getting There
        {savedMode && (
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            Plan saved
          </span>
        )}
      </div>

      {/* Trailhead info */}
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-primary/5 px-3 py-2.5">
        <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <div className="text-sm flex-1">
          <p className="font-medium">Trailhead</p>
          <p className="text-muted-foreground">{destinationName}</p>
          {meetingTime && (
            <p className="mt-1 flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3" />
              Meet at {formatTime(meetingTime)}
            </p>
          )}
        </div>
      </div>

      {loading && <p className="mt-3 text-sm text-muted-foreground">Finding routes...</p>}

      {locationError && !loading && (
        <p className="mt-3 text-xs text-muted-foreground">Enable location to see personalized routes</p>
      )}

      {/* Mode tabs */}
      {options.length > 0 && (
        <>
          <div className="mt-3 flex gap-1 overflow-x-auto scrollbar-none">
            {availableTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabSelect(tab.key)}
                className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Drive tab */}
          {activeTab === 'drive' && driveOpt && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                <LeaveByBadge leaveAt={driveOpt.leaveAt} />
                <span className="text-sm text-muted-foreground">
                  {formatDuration(driveOpt.durationSeconds)} · {driveOpt.distanceMeters ? formatDistance(driveOpt.distanceMeters) : ''}
                </span>
              </div>
              {trailApproachDurationS != null && trailApproachDurationS > 0 && (
                <p className="text-xs text-muted-foreground">
                  + {Math.ceil(trailApproachDurationS / 60)} min walk from parking to trailhead
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <MapLink href={googleMapsUrl} label="Google Maps" />
                <MapLink href={appleMapsUrl} label="Apple Maps" />
                <MapLink href={wazeUrl} label="Waze" />
              </div>
            </div>
          )}

          {/* Transit tab */}
          {activeTab === 'transit' && !transitOpt && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                Check public transit options for this route:
              </p>
              <MapLink href={googleTransitUrl} label="Plan transit in Google Maps" />
            </div>
          )}
          {activeTab === 'transit' && transitOpt && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                <LeaveByBadge leaveAt={transitOpt.leaveAt} />
                <span className="text-sm text-muted-foreground">
                  {formatDuration(transitOpt.durationSeconds)}
                </span>
              </div>
              {/* Steps */}
              <div>
                <button
                  type="button"
                  onClick={() => setExpandedTransit(!expandedTransit)}
                  className="flex items-center gap-1 text-xs font-medium text-primary"
                >
                  {expandedTransit ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  {expandedTransit ? 'Hide steps' : 'Show steps'}
                </button>
                {expandedTransit && (
                  <div className="mt-2 space-y-0.5 border-l-2 border-primary/20 pl-3">
                    {(transitOpt.details as TransitRoute).steps.map((step, i) => (
                      <TransitStepRow key={i} step={step} />
                    ))}
                  </div>
                )}
              </div>
              {trailApproachDurationS != null && trailApproachDurationS > 0 && (
                <p className="text-xs text-muted-foreground">
                  + {Math.ceil(trailApproachDurationS / 60)} min walk from stop to trailhead
                </p>
              )}
              <MapLink href={googleTransitUrl} label="Open in Google Maps" />
            </div>
          )}

          {/* Rideshare tab */}
          {activeTab === 'rideshare' && !rideshareOpt && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                Get a ride to the trailhead:
              </p>
              <div className="flex flex-wrap gap-2">
                <MapLink href={uberUrl} label="Uber" />
                <MapLink href={lyftUrl} label="Lyft" />
              </div>
            </div>
          )}
          {activeTab === 'rideshare' && rideshareOpt && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                <LeaveByBadge leaveAt={rideshareOpt.leaveAt} />
                <span className="text-sm text-muted-foreground">
                  {formatDuration(rideshareOpt.durationSeconds)} · {rideshareOpt.distanceMeters ? formatDistance(rideshareOpt.distanceMeters) : ''}
                </span>
              </div>
              {rideshareOpt.costEstimate && (
                <p className="flex items-center gap-1.5 text-sm">
                  <DollarSign className="size-3.5 text-muted-foreground" />
                  <span className="font-medium">Est. {rideshareOpt.costEstimate}</span>
                </p>
              )}
              {trailApproachDurationS != null && trailApproachDurationS > 0 && (
                <p className="text-xs text-muted-foreground">
                  + {Math.ceil(trailApproachDurationS / 60)} min walk from dropoff to trailhead
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <MapLink href={uberUrl} label="Uber" />
                <MapLink href={lyftUrl} label="Lyft" />
              </div>
            </div>
          )}

          {/* Carpool tab */}
          {activeTab === 'carpool' && (
            <div className="mt-3 space-y-3">
              {/* Existing ride offers */}
              {rides.filter((r) => r.type === 'offer' && r.status === 'open').map((ride) => {
                const driver = resolveUser(ride.user)
                const isDriver = ride.user_id === currentUserId
                const alreadyRequested = ride.passengers.some((p) => p.passenger_id === currentUserId)
                const confirmedCount = ride.passengers.filter((p) => p.status === 'confirmed').length
                const carpoolOpt = carpoolOpts.find((o) => (o.details as CarpoolRouteDetails).rideId === ride.id)

                return (
                  <div key={ride.id} className="rounded-xl bg-muted/40 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <UserAvatar src={driver.avatar_url} name={driver.display_name} size="sm" />
                      <div className="flex-1 text-sm">
                        <span className="font-medium">
                          {driver.first_name ? `${driver.first_name} ${driver.last_name?.[0]}.` : driver.display_name}
                        </span>
                        <span className="text-muted-foreground"> · {confirmedCount}/{ride.available_seats} seats</span>
                      </div>
                      {!isDriver && !alreadyRequested && (
                        <Button size="xs" variant="outline" onClick={() => handleJoinRide(ride.id)}>
                          Join
                        </Button>
                      )}
                    </div>
                    {ride.pickup_location_name && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" />{ride.pickup_location_name}
                      </p>
                    )}
                    {ride.departure_time && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />Leaving {formatTime(ride.departure_time)}
                      </p>
                    )}
                    {ride.note && (
                      <p className="mt-1 text-xs italic text-muted-foreground">&ldquo;{ride.note}&rdquo;</p>
                    )}
                    {carpoolOpt && (
                      <div className="mt-2">
                        <LeaveByBadge leaveAt={carpoolOpt.leaveAt} />
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Ride requests */}
              {rides.filter((r) => r.type === 'request' && r.status === 'open').length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Looking for Rides</p>
                  {rides.filter((r) => r.type === 'request' && r.status === 'open').map((ride) => {
                    const requester = resolveUser(ride.user)
                    return (
                      <div key={ride.id} className="mt-1.5 flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2">
                        <UserAvatar src={requester.avatar_url} name={requester.display_name} size="sm" />
                        <span className="text-sm font-medium">
                          {requester.first_name ? `${requester.first_name} ${requester.last_name?.[0]}.` : requester.display_name}
                        </span>
                        {ride.note && <span className="text-xs italic text-muted-foreground">&ldquo;{ride.note}&rdquo;</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {rides.filter((r) => r.status === 'open').length === 0 && !showCarpoolForm && (
                <p className="text-sm text-muted-foreground">No carpool arrangements yet.</p>
              )}

              {/* Post offer/request */}
              {isParticipant && !rides.some((r) => r.user_id === currentUserId && r.status === 'open') && (
                <>
                  {!showCarpoolForm ? (
                    <Button size="sm" variant="outline" onClick={() => setShowCarpoolForm(true)}>
                      Offer or request a ride
                    </Button>
                  ) : (
                    <div className="space-y-2 rounded-xl border border-border/40 bg-muted/20 p-3">
                      <div className="flex gap-1.5">
                        <Button size="xs" variant={carpoolType === 'offer' ? 'default' : 'outline'} onClick={() => setCarpoolType('offer')}>
                          Offer Ride
                        </Button>
                        <Button size="xs" variant={carpoolType === 'request' ? 'default' : 'outline'} onClick={() => setCarpoolType('request')}>
                          Need Ride
                        </Button>
                      </div>
                      {carpoolType === 'offer' && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground whitespace-nowrap">Seats:</label>
                          <input
                            type="number" min={1} max={10} value={carpoolSeats}
                            onChange={(e) => setCarpoolSeats(e.target.value)}
                            className="w-16 rounded-lg border border-input bg-transparent px-2 py-1 text-sm"
                          />
                        </div>
                      )}
                      <input
                        placeholder="Pickup location (optional)"
                        value={carpoolPickup}
                        onChange={(e) => setCarpoolPickup(e.target.value)}
                        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground"
                      />
                      <input
                        placeholder="Note (optional)"
                        value={carpoolNote}
                        onChange={(e) => setCarpoolNote(e.target.value)}
                        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleCarpoolSubmit} disabled={carpoolSubmitting}>
                          {carpoolSubmitting ? 'Posting...' : 'Post'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowCarpoolForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Walk tab */}
          {activeTab === 'walk' && walkOpt && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                <LeaveByBadge leaveAt={walkOpt.leaveAt} />
                <span className="text-sm text-muted-foreground">
                  {formatDuration(walkOpt.durationSeconds)} · {walkOpt.distanceMeters ? formatDistance(walkOpt.distanceMeters) : ''}
                </span>
              </div>
              <MapLink href={googleWalkUrl} label="Open in Google Maps" />
            </div>
          )}

        </>
      )}

      {/* Fallback: no options loaded yet but no location either */}
      {options.length === 0 && !loading && !locationError && (
        <div className="mt-3 flex flex-wrap gap-2">
          <MapLink href={googleMapsUrl} label="Google Maps" />
          <MapLink href={appleMapsUrl} label="Apple Maps" />
          <MapLink href={wazeUrl} label="Waze" />
        </div>
      )}
    </div>
  )
}

function MapLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[0.8rem] font-medium hover:bg-muted transition-colors"
    >
      <ExternalLink className="size-3" />
      {label}
    </a>
  )
}
