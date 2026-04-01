'use client'

import { useState } from 'react'
import { Car, Users, Clock, MapPin, RefreshCw, Footprints, Train, DollarSign, AlertCircle } from 'lucide-react'
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

  // Group participants by transport type
  const carpoolGroupMap = new Map<string, { group: CarpoolGroup; driver: ParticipantTimeline | null; passengers: ParticipantTimeline[] }>()
  const needRide: ParticipantTimeline[] = []
  const otherTransport: ParticipantTimeline[] = []

  for (const group of timeline.carpoolGroups) {
    carpoolGroupMap.set(group.id, { group, driver: null, passengers: [] })
  }

  for (const pt of timeline.participantTimelines) {
    if (pt.carpoolGroupId && carpoolGroupMap.has(pt.carpoolGroupId)) {
      const entry = carpoolGroupMap.get(pt.carpoolGroupId)!
      if (pt.role === 'driver') entry.driver = pt
      else entry.passengers.push(pt)
    } else if (pt.transportMode === 'carpool_passenger') {
      needRide.push(pt)
    } else {
      otherTransport.push(pt)
    }
  }

  const carpoolGroups = Array.from(carpoolGroupMap.values())

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
            {recomputing ? 'Computing...' : 'Update'}
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {/* Carpool Groups — each car gets its own timeline */}
        {carpoolGroups.map(({ group, driver, passengers }) => {
          if (!driver) return null
          const allInCar = [driver, ...passengers]
          const isMyGroup = allInCar.some((p) => p.userId === currentUserId)

          return (
            <div key={group.id} className={`rounded-xl border p-3 ${isMyGroup ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-muted/10'}`}>
              {/* Car header */}
              <div className="flex items-center gap-2 mb-3">
                <Car className="size-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {driver.displayName}&apos;s car
                </span>
                <div className="flex -space-x-1 ml-auto">
                  {allInCar.map((p) => (
                    <UserAvatar key={p.userId} src={p.avatarUrl} name={p.displayName} size="xs" className="ring-1 ring-card" />
                  ))}
                </div>
              </div>

              {/* Car timeline — vertical with detailed stops */}
              <div className="space-y-0 pl-1">
                {driver.nodes.map((node, i) => {
                  const isMe = driver.userId === currentUserId && node.type === 'leave_home'
                  const pickedUpPassenger = node.type === 'pickup'
                    ? passengers.find((p) => p.nodes.some((n) => n.type === 'pickup' && n.time === node.time))
                    : null

                  return (
                    <div key={i} className="flex gap-3">
                      {/* Timeline line + dot */}
                      <div className="flex flex-col items-center">
                        <div className={`size-3 rounded-full shrink-0 ${
                          node.type === 'leave_home' ? 'bg-primary' :
                          node.type === 'pickup' ? 'bg-accent' :
                          'bg-emerald-500'
                        }`} />
                        {i < driver.nodes.length - 1 && (
                          <div className="w-px flex-1 min-h-6 bg-border" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="pb-3 -mt-0.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold tabular-nums text-muted-foreground w-16 shrink-0">
                            {formatTime(node.time)}
                          </span>
                          <span className={`text-sm ${isMe ? 'font-semibold text-primary' : ''}`}>
                            {node.label}
                          </span>
                        </div>
                        {node.locationName && (
                          <p className="text-xs text-muted-foreground ml-18 pl-18" style={{ marginLeft: '4.5rem' }}>
                            <MapPin className="inline size-2.5 mr-0.5" />{node.locationName}
                          </p>
                        )}
                        {pickedUpPassenger && (
                          <div className="flex items-center gap-1.5 mt-1" style={{ marginLeft: '4.5rem' }}>
                            <UserAvatar src={pickedUpPassenger.avatarUrl} name={pickedUpPassenger.displayName} size="xs" />
                            <span className={`text-xs ${pickedUpPassenger.userId === currentUserId ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                              {pickedUpPassenger.displayName}{pickedUpPassenger.userId === currentUserId ? ' (you)' : ''} gets in
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Still need a ride */}
        {needRide.length > 0 && (
          <div className="rounded-xl border border-amber-200/50 bg-amber-50/50 p-3 dark:border-amber-800/30 dark:bg-amber-950/10">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="size-4 text-amber-600" />
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Need a ride ({needRide.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {needRide.map((pt) => {
                const isMe = pt.userId === currentUserId
                const leaveNode = pt.nodes[0]
                return (
                  <div key={pt.userId} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${isMe ? 'bg-amber-100/50 dark:bg-amber-900/20' : ''}`}>
                    <UserAvatar src={pt.avatarUrl} name={pt.displayName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${isMe ? 'font-semibold' : ''}`}>
                        {pt.displayName}{isMe ? ' (you)' : ''}
                      </span>
                      {leaveNode?.locationName && (
                        <p className="text-xs text-muted-foreground">
                          <MapPin className="inline size-2.5 mr-0.5" />{leaveNode.locationName}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Other transportation */}
        {otherTransport.length > 0 && (
          <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Train className="size-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Individual transport ({otherTransport.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {otherTransport.map((pt) => {
                const isMe = pt.userId === currentUserId
                const leaveNode = pt.nodes.find((n) => n.type === 'leave_home')
                const arriveNode = pt.nodes.find((n) => n.type === 'arrive_trailhead' || n.type === 'arrive_meeting')
                return (
                  <div key={pt.userId} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${isMe ? 'bg-primary/5' : ''}`}>
                    <UserAvatar src={pt.avatarUrl} name={pt.displayName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${isMe ? 'font-semibold' : ''}`}>
                        {pt.displayName}{isMe ? ' (you)' : ''}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {pt.transportMode === 'driving' ? 'Driving' :
                         pt.transportMode === 'transit' ? 'Transit' :
                         pt.transportMode === 'rideshare' ? 'Rideshare' :
                         pt.transportMode === 'walking' ? 'Walking' : pt.transportMode}
                        {leaveNode && <> &middot; Leaves {formatTime(leaveNode.time)}</>}
                      </p>
                    </div>
                    {arriveNode && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        Arrives {formatTime(arriveNode.time)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Convergence: everyone arrives at trailhead */}
        {timeline.convergencePoints.filter((cp) => cp.type === 'trailhead').map((cp, i) => (
          <div key={i} className="rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-1.5">
                {timeline.participantTimelines.slice(0, 6).map((pt) => (
                  <UserAvatar key={pt.userId} src={pt.avatarUrl} name={pt.displayName} size="xs" className="ring-1 ring-emerald-50 dark:ring-emerald-950" />
                ))}
                {timeline.participantTimelines.length > 6 && (
                  <div className="flex size-5 items-center justify-center rounded-full bg-emerald-200 text-[9px] font-bold text-emerald-800 ring-1 ring-emerald-50">
                    +{timeline.participantTimelines.length - 6}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Everyone at trailhead by {formatTime(cp.time)}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{cp.locationName}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Activity start */}
        <div className="flex items-center gap-2 px-1 text-sm">
          <span className="text-base">🥾</span>
          <span className="font-medium">Activity starts {formatTime(timeline.activityStartTime)}</span>
        </div>
      </div>
    </div>
  )
}
