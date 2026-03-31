'use client'

import { useState } from 'react'
import { Car, UserPlus, Clock, MapPin, Check, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/UserAvatar'

interface RideUser {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

interface RidePassenger {
  id: string
  passenger_id: string
  status: string
  user: RideUser | RideUser[]
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
  passengers: RidePassenger[]
}

interface CarpoolBoardProps {
  activityId: string
  currentUserId: string
  rides: Ride[]
  isParticipant: boolean
  onRefresh: () => void
}

export function CarpoolBoard({
  activityId,
  currentUserId,
  rides,
  isParticipant,
  onRefresh,
}: CarpoolBoardProps) {
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'offer' | 'request'>('offer')
  const [seats, setSeats] = useState('3')
  const [pickup, setPickup] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const offers = rides.filter((r) => r.type === 'offer' && r.status === 'open')
  const requests = rides.filter((r) => r.type === 'request' && r.status === 'open')

  const userHasRide = rides.some((r) => r.user_id === currentUserId && r.status === 'open')

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        type: formType,
        note: note.trim() || undefined,
        pickupLocationName: pickup.trim() || undefined,
      }
      if (formType === 'offer') {
        body.availableSeats = parseInt(seats, 10) || 3
      }

      const res = await fetch(`/api/activities/${activityId}/rides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setShowForm(false)
        setNote('')
        setPickup('')
        onRefresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRequestRide(rideId: string) {
    await fetch(`/api/activities/${activityId}/rides/${rideId}/passengers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    onRefresh()
  }

  async function handlePassengerAction(
    rideId: string,
    passengerId: string,
    status: 'confirmed' | 'declined'
  ) {
    await fetch(`/api/activities/${activityId}/rides/${rideId}/passengers`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passengerId, status }),
    })
    onRefresh()
  }

  async function handleCancelRide(rideId: string) {
    await fetch(`/api/activities/${activityId}/rides/${rideId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    onRefresh()
  }

  function resolveUser(u: RideUser | RideUser[]): RideUser {
    return Array.isArray(u) ? u[0] : u
  }

  function userName(u: RideUser): string {
    if (u.first_name && u.last_name) return `${u.first_name} ${u.last_name[0]}.`
    return u.display_name
  }

  if (!isParticipant) return null

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Car className="size-4 text-primary" />
          Carpool
        </div>
        {isParticipant && !userHasRide && !showForm && (
          <Button size="xs" variant="ghost" onClick={() => setShowForm(true)}>
            <Plus className="size-3" data-icon="inline-start" />
            Add
          </Button>
        )}
      </div>

      {/* Ride Offers */}
      {offers.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Rides Offered
          </p>
          {offers.map((ride) => {
            const driver = resolveUser(ride.user)
            const isDriver = ride.user_id === currentUserId
            const alreadyRequested = ride.passengers.some(
              (p) => p.passenger_id === currentUserId
            )
            const confirmedCount = ride.passengers.filter(
              (p) => p.status === 'confirmed'
            ).length

            return (
              <div
                key={ride.id}
                className="rounded-xl bg-muted/40 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <UserAvatar
                    src={driver.avatar_url}
                    name={driver.display_name}
                    size="sm"
                  />
                  <div className="flex-1 text-sm">
                    <span className="font-medium">{userName(driver)}</span>
                    <span className="text-muted-foreground">
                      {' '}&middot; {confirmedCount}/{ride.available_seats} seats
                    </span>
                  </div>
                  {!isDriver && !alreadyRequested && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleRequestRide(ride.id)}
                    >
                      <UserPlus className="size-3" data-icon="inline-start" />
                      Join
                    </Button>
                  )}
                  {isDriver && (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleCancelRide(ride.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>

                {ride.pickup_location_name && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" />
                    {ride.pickup_location_name}
                  </p>
                )}
                {ride.departure_time && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    Leaving{' '}
                    {new Date(ride.departure_time).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                )}
                {ride.note && (
                  <p className="mt-1 text-xs text-muted-foreground italic">
                    &ldquo;{ride.note}&rdquo;
                  </p>
                )}

                {/* Pending passengers (visible to driver) */}
                {isDriver &&
                  ride.passengers.filter((p) => p.status === 'pending').length > 0 && (
                    <div className="mt-2 space-y-1.5 border-t border-border/30 pt-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Ride Requests
                      </p>
                      {ride.passengers
                        .filter((p) => p.status === 'pending')
                        .map((p) => {
                          const passenger = resolveUser(p.user)
                          return (
                            <div
                              key={p.id}
                              className="flex items-center gap-2"
                            >
                              <UserAvatar
                                src={passenger.avatar_url}
                                name={passenger.display_name}
                                size="xs"
                              />
                              <span className="flex-1 text-xs">
                                {userName(passenger)}
                              </span>
                              <Button
                                size="xs"
                                variant="ghost"
                                className="text-primary"
                                onClick={() =>
                                  handlePassengerAction(
                                    ride.id,
                                    p.passenger_id,
                                    'confirmed'
                                  )
                                }
                              >
                                <Check className="size-3" />
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() =>
                                  handlePassengerAction(
                                    ride.id,
                                    p.passenger_id,
                                    'declined'
                                  )
                                }
                              >
                                <X className="size-3" />
                              </Button>
                            </div>
                          )
                        })}
                    </div>
                  )}
              </div>
            )
          })}
        </div>
      )}

      {/* Ride Requests */}
      {requests.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Looking for Rides
          </p>
          {requests.map((ride) => {
            const requester = resolveUser(ride.user)
            return (
              <div key={ride.id} className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
                <UserAvatar
                  src={requester.avatar_url}
                  name={requester.display_name}
                  size="sm"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium">{userName(requester)}</span>
                  {ride.note && (
                    <p className="text-xs text-muted-foreground italic">
                      &ldquo;{ride.note}&rdquo;
                    </p>
                  )}
                </div>
                {ride.user_id === currentUserId && (
                  <Button
                    size="xs"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => handleCancelRide(ride.id)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {offers.length === 0 && requests.length === 0 && !showForm && (
        <p className="mt-3 text-sm text-muted-foreground">
          No carpool arrangements yet. Add a ride offer or request!
        </p>
      )}

      {/* Create form */}
      {showForm && (
        <div className="mt-3 space-y-2.5 rounded-xl border border-border/40 bg-muted/20 p-3">
          <div className="flex gap-1.5">
            <Button
              size="xs"
              variant={formType === 'offer' ? 'default' : 'outline'}
              onClick={() => setFormType('offer')}
            >
              Offer Ride
            </Button>
            <Button
              size="xs"
              variant={formType === 'request' ? 'default' : 'outline'}
              onClick={() => setFormType('request')}
            >
              Need Ride
            </Button>
          </div>

          {formType === 'offer' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Seats:</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                className="w-16"
              />
            </div>
          )}

          <Input
            placeholder="Pickup location (optional)"
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
          />

          <Input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Posting...' : 'Post'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
