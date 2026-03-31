'use client'

import { useState } from 'react'
import { Clock, MapPin, Mountain, ArrowDown, CheckSquare, StickyNote, Pencil, Plus, X, Save, Car, Navigation, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/UserAvatar'

interface LogisticsData {
  meeting_point_name: string | null
  meeting_point_lat: string | null
  meeting_point_lng: string | null
  meeting_time: string | null
  estimated_return_time: string | null
  parking_name: string | null
  parking_paid: boolean | null
  parking_cost: string | null
  parking_notes: string | null
  transport_notes: string | null
  checklist_items: string[] | null
  notes: string | null
}

interface ParticipantInfo {
  id: string
  displayName: string
  avatarUrl: string | null
  area: string | null
  transportMode?: string | null
  leaveAt?: string | null
}

interface LogisticsTabProps {
  activityId: string
  scheduledAt: string
  locationName: string
  trailName?: string | null
  trailApproachDurationS?: number | null
  logistics: LogisticsData | null
  isCreator: boolean
  participants: ParticipantInfo[]
  currentUserId: string
  onRefresh: () => void
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function LogisticsTab({
  activityId,
  scheduledAt,
  locationName,
  trailName,
  trailApproachDurationS,
  logistics,
  isCreator,
  participants,
  currentUserId,
  onRefresh,
}: LogisticsTabProps) {
  const [editing, setEditing] = useState(false)
  const [meetingPointName, setMeetingPointName] = useState(logistics?.meeting_point_name ?? '')
  const [meetingTime, setMeetingTime] = useState(logistics?.meeting_time ?? '')
  const [returnTime, setReturnTime] = useState(logistics?.estimated_return_time ?? '')
  const [notes, setNotes] = useState(logistics?.notes ?? '')
  const [checklistItems, setChecklistItems] = useState<string[]>(
    logistics?.checklist_items ?? []
  )
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)

  const meetingDisplay = logistics?.meeting_point_name || locationName
  const meetingTimeDisplay = logistics?.meeting_time || scheduledAt

  async function handleSave() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        meetingPointName: meetingPointName.trim() || undefined,
        checklistItems,
        notes: notes.trim() || undefined,
      }
      if (meetingTime) body.meetingTime = new Date(meetingTime).toISOString()
      if (returnTime) body.estimatedReturnTime = new Date(returnTime).toISOString()

      const res = await fetch(`/api/activities/${activityId}/logistics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setEditing(false)
        onRefresh()
      }
    } finally {
      setSaving(false)
    }
  }

  function addChecklistItem() {
    const item = newItem.trim()
    if (item && checklistItems.length < 20) {
      setChecklistItems([...checklistItems, item])
      setNewItem('')
    }
  }

  function removeChecklistItem(index: number) {
    setChecklistItems(checklistItems.filter((_, i) => i !== index))
  }

  // Build timeline items
  const timeline: { icon: React.ReactNode; label: string; time: string; detail?: string }[] = []

  timeline.push({
    icon: <MapPin className="size-3.5 text-primary" />,
    label: `Meet at ${meetingDisplay}`,
    time: formatTime(meetingTimeDisplay),
    detail: formatDate(meetingTimeDisplay),
  })

  if (trailApproachDurationS && trailApproachDurationS > 0) {
    const mins = Math.round(trailApproachDurationS / 60)
    timeline.push({
      icon: <ArrowDown className="size-3.5 text-muted-foreground" />,
      label: `Drive to trailhead`,
      time: `~${mins} min`,
      detail: trailName ?? undefined,
    })
  }

  timeline.push({
    icon: <Mountain className="size-3.5 text-accent" />,
    label: 'Activity starts',
    time: formatTime(scheduledAt),
  })

  if (logistics?.estimated_return_time) {
    timeline.push({
      icon: <Clock className="size-3.5 text-muted-foreground" />,
      label: 'Estimated return',
      time: formatTime(logistics.estimated_return_time),
    })
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Clock className="size-4 text-primary" />
          Trip Plan
        </div>
        {isCreator && !editing && (
          <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="size-3" data-icon="inline-start" />
            Edit
          </Button>
        )}
      </div>

      {/* Timeline */}
      {!editing && (
        <>
          <div className="mt-3 space-y-0">
            {timeline.map((item, i) => (
              <div key={i} className="flex gap-3">
                {/* Vertical line + dot */}
                <div className="flex flex-col items-center">
                  <div className="flex size-6 items-center justify-center rounded-full bg-muted">
                    {item.icon}
                  </div>
                  {i < timeline.length - 1 && (
                    <div className="h-8 w-px bg-border" />
                  )}
                </div>
                {/* Content */}
                <div className="pb-2 pt-0.5">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.time}
                    {item.detail && ` · ${item.detail}`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Participant journeys — converging timelines */}
          {participants.length > 0 && (
            <div className="mt-4 border-t border-border/30 pt-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="size-3" />
                Who&apos;s Coming
              </p>
              <div className="mt-2 space-y-2">
                {participants.map((p) => {
                  const isMe = p.id === currentUserId
                  return (
                    <div key={p.id} className="flex items-center gap-2.5 rounded-lg bg-muted/30 px-3 py-2">
                      <UserAvatar src={p.avatarUrl} name={p.displayName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">
                            {p.displayName}
                            {isMe && <span className="text-muted-foreground"> (you)</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {p.area && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-2.5" />
                              {p.area}
                            </span>
                          )}
                          {p.transportMode && (
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              {p.transportMode === 'driving' ? 'Driving' :
                               p.transportMode === 'transit' ? 'Transit' :
                               p.transportMode === 'rideshare' ? 'Rideshare' :
                               p.transportMode === 'carpool_driver' ? 'Driving (carpool)' :
                               p.transportMode === 'carpool_passenger' ? 'Getting a ride' :
                               p.transportMode === 'walking' ? 'Walking' : p.transportMode}
                            </span>
                          )}
                          {p.leaveAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="size-2.5" />
                              Leaves {formatTime(p.leaveAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Parking info */}
          {logistics?.parking_name && (
            <div className="mt-4 border-t border-border/30 pt-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Car className="size-3" />
                Parking
              </p>
              <div className="mt-2 rounded-lg bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{logistics.parking_name}</span>
                  {logistics.parking_cost && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      logistics.parking_paid ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    }`}>
                      {logistics.parking_cost}
                    </span>
                  )}
                </div>
                {logistics.parking_notes && (
                  <p className="mt-1 text-xs text-muted-foreground">{logistics.parking_notes}</p>
                )}
              </div>
            </div>
          )}

          {/* Transport tips */}
          {logistics?.transport_notes && (
            <div className="mt-4 border-t border-border/30 pt-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Navigation className="size-3" />
                Getting There
              </p>
              <div className="mt-2 space-y-1.5">
                {logistics.transport_notes.split('\n').map((line, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/40" />
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checklist */}
          {checklistItems.length > 0 && (
            <div className="mt-4 border-t border-border/30 pt-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <CheckSquare className="size-3" />
                What to Bring
              </p>
              <ul className="mt-2 space-y-1">
                {checklistItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="size-1.5 rounded-full bg-primary/40" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {logistics?.notes && (
            <div className="mt-4 border-t border-border/30 pt-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <StickyNote className="size-3" />
                Notes from Host
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground whitespace-pre-wrap">
                {logistics.notes}
              </p>
            </div>
          )}
        </>
      )}

      {/* Editor (host only) */}
      {editing && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Meeting Point</label>
            <Input
              placeholder="e.g. REI parking lot on Colorado Blvd"
              value={meetingPointName}
              onChange={(e) => setMeetingPointName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Meeting Time</label>
              <Input
                type="datetime-local"
                value={meetingTime ? new Date(meetingTime).toISOString().slice(0, 16) : ''}
                onChange={(e) => setMeetingTime(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Est. Return</label>
              <Input
                type="datetime-local"
                value={returnTime ? new Date(returnTime).toISOString().slice(0, 16) : ''}
                onChange={(e) => setReturnTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">What to Bring</label>
            <div className="mt-1 space-y-1.5">
              {checklistItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-1 text-sm">{item}</span>
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(i)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-1.5">
                <Input
                  placeholder="Add item..."
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                />
                <Button size="icon-sm" variant="outline" onClick={addChecklistItem}>
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              placeholder="Any extra info for participants..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="size-3" data-icon="inline-start" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
