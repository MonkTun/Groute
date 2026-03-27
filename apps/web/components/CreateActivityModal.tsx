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
import { Plus, Check, ImagePlus, X } from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'

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
  const [coverPhoto, setCoverPhoto] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
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

  function handleCoverPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPEG, PNG, and WebP images are allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5MB')
      return
    }
    setCoverPhoto(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  function removeCoverPhoto() {
    setCoverPhoto(null)
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverPreview(null)
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
    removeCoverPhoto()
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

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create activity')
        setIsSubmitting(false)
        return
      }

      // Upload cover photo if selected
      if (coverPhoto && data.data?.id) {
        const formData = new FormData()
        formData.append('file', coverPhoto)
        await fetch(`/api/activities/${data.data.id}/photo`, {
          method: 'POST',
          body: formData,
        })
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

          {/* Cover photo */}
          <div className="space-y-1.5">
            <Label>Cover photo (optional)</Label>
            {coverPreview ? (
              <div className="relative h-32 w-full overflow-hidden rounded-lg">
                <img
                  src={coverPreview}
                  alt="Cover preview"
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={removeCoverPhoto}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70 transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex h-20 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-colors">
                <ImagePlus className="size-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Add a photo</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleCoverPhoto}
                />
              </label>
            )}
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
                      <UserAvatar src={friend.avatar_url} name={name} size="sm" />
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
