'use client'

import { useState } from 'react'
import { Car, Users, Clock, MapPin, ArrowRight, RefreshCw, Footprints, Train, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/UserAvatar'
import type { ComputedTimeline, ParticipantTimeline, CarpoolGroup } from '@groute/shared'

interface TimelineWebProps {
  timeline: ComputedTimeline
  currentUserId: string
  isCreator: boolean
  activityId: string
  onRecompute?: () => void
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function modeIcon(mode: string) {
  switch (mode) {
    case 'driving':
    case 'carpool_driver':
      return <Car className="size-3.5" />
    case 'carpool_passenger':
      return <Users className="size-3.5" />
    case 'transit':
      return <Train className="size-3.5" />
    case 'rideshare':
      return <DollarSign className="size-3.5" />
    case 'walking':
      return <Footprints className="size-3.5" />
    default:
      return <MapPin className="size-3.5" />
  }
}

function modeLabel(mode: string): string {
  switch (mode) {
    case 'driving': return 'Driving'
    case 'carpool_driver': return 'Driver'
    case 'carpool_passenger': return 'Passenger'
    case 'transit': return 'Transit'
    case 'rideshare': return 'Rideshare'
    case 'walking': return 'Walking'
    default: return mode
  }
}

export function TimelineWeb({
  timeline,
  currentUserId,
  isCreator,
  activityId,
  onRecompute,
}: TimelineWebProps) {
  const [recomputing, setRecomputing] = useState(false)

  async function handleRecompute() {
    setRecomputing(true)
    try {
      await fetch(`/api/activities/${activityId}/compute-timeline`, { method: 'POST' })
      onRecompute?.()
    } finally {
      setRecomputing(false)
    }
  }

  // Group timelines by carpool group
  const carpoolTimelines = new Map<string, ParticipantTimeline[]>()
  const soloTimelines: ParticipantTimeline[] = []

  for (const pt of timeline.participantTimelines) {
    if (pt.carpoolGroupId) {
      const list = carpoolTimelines.get(pt.carpoolGroupId) ?? []
      list.push(pt)
      carpoolTimelines.set(pt.carpoolGroupId, list)
    } else {
      soloTimelines.push(pt)
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Clock className="size-4 text-primary" />
          Trip Timeline
        </div>
        {isCreator && (
          <Button size="xs" variant="ghost" onClick={handleRecompute} disabled={recomputing}>
            <RefreshCw className={`size-3 ${recomputing ? 'animate-spin' : ''}`} data-icon="inline-start" />
            {recomputing ? 'Computing...' : 'Recompute'}
          </Button>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {/* Carpool groups */}
        {timeline.carpoolGroups.map((group) => {
          const groupTimelines = carpoolTimelines.get(group.id) ?? []
          const driverTimeline = groupTimelines.find((t) => t.role === 'driver')
          const passengerTimelines = groupTimelines.filter((t) => t.role === 'passenger')

          return (
            <div key={group.id} className="rounded-xl border border-border/40 bg-muted/20 p-3">
              {/* Group header */}
              <div className="flex items-center gap-2 mb-2">
                <Car className="size-3.5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Carpool &middot; {group.passengerIds.length + 1} people
                </span>
              </div>

              {/* Driver timeline */}
              {driverTimeline && (
                <div className="space-y-0">
                  {driverTimeline.nodes.map((node, i) => {
                    const isMe = driverTimeline.userId === currentUserId
                    const isPickup = node.type === 'pickup'
                    const pickedUpPassenger = isPickup
                      ? passengerTimelines.find((pt) =>
                          pt.nodes.some((n) => n.type === 'pickup' && n.time === node.time)
                        )
                      : null

                    return (
                      <div key={i} className="flex gap-3">
                        {/* Vertical line + dot */}
                        <div className="flex flex-col items-center">
                          <div className={`flex size-5 items-center justify-center rounded-full ${
                            node.type === 'leave_home' ? 'bg-primary/20' :
                            node.type === 'pickup' ? 'bg-accent/20' :
                            'bg-emerald-100 dark:bg-emerald-900/30'
                          }`}>
                            {node.type === 'leave_home' ? <Car className="size-2.5 text-primary" /> :
                             node.type === 'pickup' ? <ArrowRight className="size-2.5 text-accent" /> :
                             <MapPin className="size-2.5 text-emerald-600" />}
                          </div>
                          {i < driverTimeline.nodes.length - 1 && (
                            <div className="h-6 w-px bg-border" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="pb-1 pt-0.5 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">{formatTime(node.time)}</span>
                            <span className={`text-sm ${isMe ? 'font-semibold' : ''}`}>{node.label}</span>
                          </div>
                          {node.locationName && (
                            <span className="text-[11px] text-muted-foreground">{node.locationName}</span>
                          )}
                          {/* Show picked up passenger avatar */}
                          {pickedUpPassenger && (
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <UserAvatar src={pickedUpPassenger.avatarUrl} name={pickedUpPassenger.displayName} size="xs" />
                              <span className="text-[11px] text-muted-foreground">joins the car</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Passenger summaries (compact) */}
              {passengerTimelines.length > 0 && (
                <div className="mt-2 border-t border-border/30 pt-2 space-y-1">
                  {passengerTimelines.map((pt) => {
                    const readyNode = pt.nodes.find((n) => n.type === 'get_ready')
                    const pickupNode = pt.nodes.find((n) => n.type === 'pickup')
                    const isMe = pt.userId === currentUserId
                    return (
                      <div key={pt.userId} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isMe ? 'bg-primary/5' : ''}`}>
                        <UserAvatar src={pt.avatarUrl} name={pt.displayName} size="xs" />
                        <span className={`text-xs flex-1 ${isMe ? 'font-semibold' : ''}`}>
                          {pt.displayName}{isMe ? ' (you)' : ''}
                        </span>
                        {readyNode && (
                          <span className="text-[10px] text-muted-foreground">
                            Ready by {formatTime(readyNode.time)}
                          </span>
                        )}
                        {pickupNode && (
                          <span className="text-[10px] text-accent-foreground">
                            Pickup {formatTime(pickupNode.time)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Solo travelers */}
        {soloTimelines.map((pt) => {
          const isMe = pt.userId === currentUserId
          return (
            <div key={pt.userId} className={`rounded-xl border border-border/40 bg-muted/20 p-3 ${isMe ? 'ring-1 ring-primary/20' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                {modeIcon(pt.transportMode)}
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {modeLabel(pt.transportMode)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <UserAvatar src={pt.avatarUrl} name={pt.displayName} size="sm" />
                <div className="flex-1">
                  <span className={`text-sm ${isMe ? 'font-semibold' : ''}`}>
                    {pt.displayName}{isMe ? ' (you)' : ''}
                  </span>
                </div>
              </div>
              <div className="mt-2 space-y-0">
                {pt.nodes.map((node, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-muted-foreground">{formatTime(node.time)}</span>
                    <span className="size-1.5 rounded-full bg-primary/40" />
                    <span>{node.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Convergence bar */}
        {timeline.convergencePoints.filter((cp) => cp.type === 'trailhead').map((cp, i) => (
          <div key={i} className="rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {timeline.participantTimelines.slice(0, 5).map((pt) => (
                  <UserAvatar key={pt.userId} src={pt.avatarUrl} name={pt.displayName} size="xs" className="ring-1 ring-emerald-50 dark:ring-emerald-950" />
                ))}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Everyone arrives by {formatTime(cp.time)}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{cp.locationName}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Activity start */}
        <div className="flex items-center gap-2 px-2 text-sm">
          <span className="text-lg">🥾</span>
          <span className="font-medium">Activity starts {formatTime(timeline.activityStartTime)}</span>
        </div>
      </div>
    </div>
  )
}
