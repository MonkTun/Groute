'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { SPORT_LABELS, SKILL_LABELS, VISIBILITY_LABELS, VISIBILITY_DESCRIPTIONS } from '@groute/shared'
import { fireConfetti } from '@/hooks/useConfetti'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { LocationPicker } from '@/components/LocationPicker'
import { Plus, Check } from 'lucide-react'

interface FriendInfo {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  area: string | null
}

interface LocationValue {
  name: string
  latitude: number
  longitude: number
}

export function CreateActivityModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sportType, setSportType] = useState('')
  const [skillLevel, setSkillLevel] = useState('beginner')
  const [visibility, setVisibility] = useState('public')
  const [location, setLocation] = useState<LocationValue | null>(null)
  const [maxParticipants, setMaxParticipants] = useState('4')
  const [scheduledAt, setScheduledAt] = useState('')
  const [friends, setFriends] = useState<FriendInfo[]>([])
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())

  // Fetch friends when modal opens
  useEffect(() => {
    if (!open) return
    async function fetchFriends() {
      try {
        const res = await fetch('/api/friends')
        if (res.ok) {
          const data = await res.json()
          setFriends(data.data ?? [])
        }
      } catch {
        // ignore
      }
    }
    fetchFriends()
  }, [open])

  function toggleInvite(id: string) {
    setInvitedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function resetForm() {
    setTitle('')
    setDescription('')
    setSportType('')
    setSkillLevel('beginner')
    setVisibility('public')
    setLocation(null)
    setMaxParticipants('4')
    setScheduledAt('')
    setInvitedIds(new Set())
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    if (!sportType) {
      setError('Please select an activity type')
      setIsSubmitting(false)
      return
    }

    if (!location) {
      setError('Please select a location')
      setIsSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || undefined,
          sportType,
          skillLevel,
          visibility,
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          locationName: location.name,
          maxParticipants: parseInt(maxParticipants, 10),
          scheduledAt: new Date(scheduledAt).toISOString(),
          invitedUserIds: Array.from(invitedIds),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create activity')
        setIsSubmitting(false)
        return
      }

      setOpen(false)
      resetForm()
      fireConfetti()
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="lg" className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">New Activity</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Activity</DialogTitle>
          <DialogDescription>
            Post an outdoor activity for others to join.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="act-title">Title</Label>
            <Input
              id="act-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Morning hike at Griffith Park"
              required
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="act-desc">Description (optional)</Label>
            <textarea
              id="act-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should people know about this activity?"
              maxLength={2000}
              rows={2}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Visibility</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(VISIBILITY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setVisibility(key)}
                  className={`rounded-lg border px-2 py-2 text-center text-xs transition-colors ${
                    visibility === key
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:border-primary/50 hover:bg-muted'
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground leading-tight">
                    {VISIBILITY_DESCRIPTIONS[key]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="act-sport">Activity type</Label>
            <select
              id="act-sport"
              value={sportType}
              onChange={(e) => setSportType(e.target.value)}
              required
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Select type</option>
              {Object.entries(SPORT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Location</Label>
            <LocationPicker value={location} onChange={setLocation} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="act-skill">Skill level</Label>
            <select
              id="act-skill"
              value={skillLevel}
              onChange={(e) => setSkillLevel(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {Object.entries(SKILL_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="act-date">Date & Time</Label>
              <Input
                id="act-date"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="act-max">Max participants</Label>
              <Input
                id="act-max"
                type="number"
                min={1}
                max={50}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
              />
            </div>
          </div>

          {/* Invite friends */}
          {friends.length > 0 && (
            <div className="space-y-2">
              <Label>Invite friends</Label>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-border/50 scrollbar-none">
                {friends.map((friend) => {
                  const name = friend.first_name && friend.last_name
                    ? `${friend.first_name} ${friend.last_name}`
                    : friend.display_name
                  const isInvited = invitedIds.has(friend.id)

                  return (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => toggleInvite(friend.id)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        isInvited
                          ? 'bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {(friend.first_name?.[0] ?? friend.display_name[0]).toUpperCase()}
                      </div>
                      <span className="flex-1 truncate text-sm">{name}</span>
                      <div
                        className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          isInvited
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border'
                        }`}
                      >
                        {isInvited && <Check className="size-3" />}
                      </div>
                    </button>
                  )
                })}
              </div>
              {invitedIds.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  {invitedIds.size} {invitedIds.size === 1 ? 'friend' : 'friends'} will be invited
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Activity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
