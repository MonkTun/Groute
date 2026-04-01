'use client'

import { useState } from 'react'
import { Car, Users, Clock, MapPin, RefreshCw, Footprints, Train, DollarSign, ArrowDown } from 'lucide-react'
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
    case 'carpool_driver': return <Car className="size-3" />
    case 'carpool_passenger': return <Users className="size-3" />
    case 'transit': return <Train className="size-3" />
    case 'rideshare': return <DollarSign className="size-3" />
    case 'walking': return <Footprints className="size-3" />
    default: return <MapPin className="size-3" />
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

  // Separate timelines by type
  const carpoolGroupMap = new Map<string, { group: CarpoolGroup; timelines: ParticipantTimeline[] }>()
  const soloTimelines: ParticipantTimeline[] = []

  for (const group of timeline.carpoolGroups) {
    carpoolGroupMap.set(group.id, { group, timelines: [] })
  }
  for (const pt of timeline.participantTimelines) {
    if (pt.carpoolGroupId && carpoolGroupMap.has(pt.carpoolGroupId)) {
      carpoolGroupMap.get(pt.carpoolGroupId)!.timelines.push(pt)
    } else {
      soloTimelines.push(pt)
    }
  }

  const allBranches = [
    ...Array.from(carpoolGroupMap.values()),
    ...soloTimelines.map((pt) => ({ group: null, timelines: [pt] })),
  ]

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

      {/* Tree: branches at top, converging to trunk at bottom */}
      <div className="mt-4">
        {/* Individual branches */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-3">
          {allBranches.map((branch, branchIdx) => {
            const isCarpool = branch.group != null
            const driver = isCarpool ? branch.timelines.find((t) => t.role === 'driver') : null
            const passengers = isCarpool ? branch.timelines.filter((t) => t.role === 'passenger') : []
            const solo = !isCarpool ? branch.timelines[0] : null

            return (
              <div
                key={branchIdx}
                className="flex-shrink-0 w-48 rounded-xl border border-border/40 bg-muted/10 p-2.5"
              >
                {/* Branch header */}
                {isCarpool && driver ? (
                  <div className="flex items-center gap-1.5 mb-2">
                    <UserAvatar src={driver.avatarUrl} name={driver.displayName} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium truncate ${driver.userId === currentUserId ? 'text-primary' : ''}`}>
                        {driver.displayName}{driver.userId === currentUserId ? ' (you)' : ''}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        <Car className="inline size-2.5 mr-0.5" />
                        Driver &middot; {passengers.length} passenger{passengers.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                ) : solo ? (
                  <div className="flex items-center gap-1.5 mb-2">
                    <UserAvatar src={solo.avatarUrl} name={solo.displayName} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium truncate ${solo.userId === currentUserId ? 'text-primary' : ''}`}>
                        {solo.displayName}{solo.userId === currentUserId ? ' (you)' : ''}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {modeIcon(solo.transportMode)}
                        <span className="ml-0.5">{modeLabel(solo.transportMode)}</span>
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Branch timeline nodes */}
                <div className="space-y-0">
                  {(isCarpool && driver ? driver.nodes : solo?.nodes ?? []).map((node, i, arr) => (
                    <div key={i} className="flex gap-2">
                      <div className="flex flex-col items-center">
                        <div className={`size-3 rounded-full ${
                          node.type === 'leave_home' ? 'bg-primary' :
                          node.type === 'pickup' ? 'bg-accent' :
                          node.type === 'arrive_trailhead' || node.type === 'arrive_meeting' ? 'bg-emerald-500' :
                          'bg-muted-foreground'
                        }`} />
                        {i < arr.length - 1 && <div className="h-5 w-px bg-border" />}
                      </div>
                      <div className="pb-1 min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground">{formatTime(node.time)}</p>
                        <p className="text-[11px] leading-tight truncate">{node.label}</p>
                        {/* Show passenger joining at pickup */}
                        {node.type === 'pickup' && passengers.length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {passengers
                              .filter((p) => p.nodes.some((n) => n.type === 'pickup' && n.time === node.time))
                              .map((p) => (
                                <UserAvatar key={p.userId} src={p.avatarUrl} name={p.displayName} size="xs" />
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Passengers waiting (for carpool) */}
                {passengers.length > 0 && (
                  <div className="mt-2 border-t border-border/20 pt-1.5 space-y-1">
                    {passengers.map((p) => {
                      const pickupNode = p.nodes.find((n) => n.type === 'pickup')
                      const isMe = p.userId === currentUserId
                      return (
                        <div key={p.userId} className={`flex items-center gap-1.5 rounded px-1 py-0.5 ${isMe ? 'bg-primary/5' : ''}`}>
                          <UserAvatar src={p.avatarUrl} name={p.displayName} size="xs" />
                          <span className={`text-[10px] flex-1 truncate ${isMe ? 'font-semibold' : ''}`}>
                            {p.displayName}{isMe ? ' (you)' : ''}
                          </span>
                          {pickupNode && (
                            <span className="text-[9px] text-muted-foreground shrink-0">
                              {formatTime(pickupNode.time)}
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
        </div>

        {/* Converging arrows */}
        <div className="flex justify-center py-1">
          <div className="flex items-center gap-1 text-muted-foreground">
            {allBranches.length > 1 && (
              <>
                <div className="h-px w-8 bg-border" />
                <ArrowDown className="size-4" />
                <div className="h-px w-8 bg-border" />
              </>
            )}
          </div>
        </div>

        {/* Convergence: everyone arrives */}
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
                  Everyone arrives by {formatTime(cp.time)}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{cp.locationName}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Activity start */}
        <div className="mt-3 flex items-center gap-2 px-1 text-sm">
          <span className="text-base">🥾</span>
          <span className="font-medium">Activity starts {formatTime(timeline.activityStartTime)}</span>
        </div>
      </div>
    </div>
  )
}
