'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { SPORT_LABELS, SKILL_LABELS, VISIBILITY_LABELS, VISIBILITY_DESCRIPTIONS } from '@groute/shared'
import type { Trail, ApproachRoute } from '@groute/shared'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { LocationTrailStep } from '@/components/LocationTrailStep'
import { UserAvatar } from '@/components/UserAvatar'
import { Plus, Check, ImagePlus, X, ChevronLeft, ChevronRight, MapPin, Calendar, Users, Mountain, Car, Navigation, Pencil, Sparkles } from 'lucide-react'

interface FriendInfo {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

interface LocationValue {
  name: string
  latitude: number
  longitude: number
}

const STEPS = [
  { label: 'Trailhead', number: 1 },
  { label: 'Transport', number: 2 },
  { label: 'Details', number: 3 },
  { label: 'Invite', number: 4 },
] as const

const TOTAL_STEPS = STEPS.length

interface CreateActivityModalProps {
  initialMapCenter?: { lat: number; lng: number } | null
}

export function CreateActivityModal({ initialMapCenter }: CreateActivityModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Location/Trail
  const [location, setLocation] = useState<LocationValue | null>(null)
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null)
  const [approachRoute, setApproachRoute] = useState<ApproachRoute | null>(null)

  // Step 2: Transport
  const [parkingName, setParkingName] = useState('')
  const [parkingPaid, setParkingPaid] = useState<boolean | null>(null)
  const [parkingCost, setParkingCost] = useState('')
  const [parkingNotes, setParkingNotes] = useState('')
  const [transportNotes, setTransportNotes] = useState('')
  const [meetingPointName, setMeetingPointName] = useState('')
  const [carpoolMeetingNote, setCarpoolMeetingNote] = useState('')

  // AI suggestions
  interface AiSuggestions {
    parking: Array<{ name: string; description: string; paid: boolean; cost: string; notes: string }>
    meetingPoints: Array<{ name: string; description: string }>
    transportTips: string[]
    carpoolNotes: string
  }
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestions | null>(null)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [selectedTips, setSelectedTips] = useState<Set<number>>(new Set())

  // Step 3: Details
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sportType, setSportType] = useState('')
  const [skillLevel, setSkillLevel] = useState('beginner')
  const [visibility, setVisibility] = useState('public')
  const [maxParticipants, setMaxParticipants] = useState('4')
  const [scheduledAt, setScheduledAt] = useState('')
  const [coverPhoto, setCoverPhoto] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)

  // Step 4: Invite
  const [friends, setFriends] = useState<FriendInfo[]>([])
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())

  const isTrailSport = sportType === 'hiking' || sportType === 'trail_running' || !sportType

  // Fetch AI suggestions when entering Step 2
  useEffect(() => {
    if (step === 2 && location && !aiSuggestions && !isLoadingSuggestions) {
      setIsLoadingSuggestions(true)
      fetch('/api/activities/suggest-logistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trailName: selectedTrail?.name ?? null,
          locationName: location.name,
          locationLat: location.latitude,
          locationLng: location.longitude,
          trailheadLat: selectedTrail?.trailheadLat,
          trailheadLng: selectedTrail?.trailheadLng,
          approachDurationMin: approachRoute ? Math.ceil(approachRoute.durationSeconds / 60) : undefined,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.data) {
            setAiSuggestions(d.data)
            // Auto-select all transport tips
            if (d.data.transportTips) {
              setSelectedTips(new Set(d.data.transportTips.map((_: string, i: number) => i)))
            }
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingSuggestions(false))
    }
  }, [step, location, selectedTrail, approachRoute, aiSuggestions, isLoadingSuggestions])

  useEffect(() => {
    if (step === 4 && friends.length === 0) {
      fetch('/api/friends')
        .then((r) => r.json())
        .then((d) => setFriends(d.data ?? []))
        .catch(() => {})
    }
  }, [step, friends.length])

  function toggleInvite(id: string) {
    setInvitedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
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
    setStep(1)
    setLocation(null)
    setSelectedTrail(null)
    setApproachRoute(null)
    setParkingName('')
    setParkingPaid(null)
    setParkingCost('')
    setParkingNotes('')
    setTransportNotes('')
    setMeetingPointName('')
    setCarpoolMeetingNote('')
    setAiSuggestions(null)
    setIsLoadingSuggestions(false)
    setSelectedTips(new Set())
    setTitle('')
    setDescription('')
    setSportType('')
    setSkillLevel('beginner')
    setVisibility('public')
    setMaxParticipants('4')
    setScheduledAt('')
    removeCoverPhoto()
    setInvitedIds(new Set())
    setError(null)
  }

  function validateStep(s: number): string | null {
    switch (s) {
      case 1:
        if (!location) return 'Please select a location'
        return null
      case 2:
        return null // transport is optional
      case 3:
        if (!sportType) return 'Please select an activity type'
        if (!title.trim()) return 'Please enter a title'
        if (!scheduledAt) return 'Please select a date and time'
        return null
      default:
        return null
    }
  }

  function handleNext() {
    const err = validateStep(step)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  }

  function handleBack() {
    setError(null)
    setStep((s) => Math.max(s - 1, 1))
  }

  async function handleSubmit() {
    if (!location) return
    setIsSubmitting(true)
    setError(null)

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
          trail: selectedTrail
            ? {
                osmId: selectedTrail.osmId,
                name: selectedTrail.name,
                surface: selectedTrail.surface,
                sacScale: selectedTrail.sacScale,
                distanceMeters: selectedTrail.distanceMeters,
                trailheadLat: selectedTrail.trailheadLat,
                trailheadLng: selectedTrail.trailheadLng,
                approachDistanceMeters: approachRoute?.distanceMeters,
                approachDurationSeconds: approachRoute?.durationSeconds,
              }
            : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create activity')
        setIsSubmitting(false)
        return
      }

      // Upload cover photo
      if (coverPhoto && data.data?.id) {
        const formData = new FormData()
        formData.append('file', coverPhoto)
        await fetch(`/api/activities/${data.data.id}/photo`, {
          method: 'POST',
          body: formData,
        })
      }

      // Always save logistics if we have any suggestions or user input
      if (data.data?.id) {
        const hasAny = meetingPointName || parkingName || transportNotes || carpoolMeetingNote || aiSuggestions
        if (hasAny) {
          // Build notes from all sources
          const notesParts: string[] = []
          if (carpoolMeetingNote) notesParts.push(`Carpool meeting: ${carpoolMeetingNote}`)

          // Build transport notes combining user input and selected AI tips
          const allTransportNotes: string[] = []
          if (transportNotes) allTransportNotes.push(transportNotes)
          if (aiSuggestions?.transportTips) {
            aiSuggestions.transportTips.forEach((tip, i) => {
              if (selectedTips.has(i)) allTransportNotes.push(tip)
            })
          }

          // Build checklist from AI suggestions
          const checklist: string[] = []
          if (approachRoute) {
            checklist.push(`${Math.ceil(approachRoute.durationSeconds / 60)} min walk from parking to trailhead`)
          }

          await fetch(`/api/activities/${data.data.id}/logistics`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meetingPointName: meetingPointName || undefined,
              parkingName: parkingName || undefined,
              parkingPaid: parkingPaid ?? undefined,
              parkingCost: parkingCost || undefined,
              parkingNotes: parkingNotes || undefined,
              transportNotes: allTransportNotes.join('\n') || undefined,
              checklistItems: checklist.length > 0 ? checklist : undefined,
              notes: notesParts.join('\n') || undefined,
            }),
          })
        }
      }

      setOpen(false)
      resetForm()
      router.refresh()
    } catch {
      setError('Something went wrong')
    }
    setIsSubmitting(false)
  }

  // Auto-generate title from trail/location
  function suggestTitle() {
    if (title) return
    const base = selectedTrail?.name ?? location?.name ?? ''
    if (base) setTitle(base)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm() }}>
      <DialogTrigger
        render={
          <Button size="lg" className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">New Activity</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Activity</DialogTitle>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 pt-1">
            {STEPS.map(({ label, number }) => (
              <div key={number} className="flex flex-1 flex-col gap-1">
                <div
                  className={`h-1 rounded-full transition-colors ${
                    number <= step ? 'bg-primary' : 'bg-border'
                  }`}
                />
                <span className={`text-[10px] transition-colors ${
                  number === step ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* Step content */}
        <div className="min-h-48">
          {error && (
            <p className="mb-3 text-sm text-destructive">{error}</p>
          )}

          {/* Step 1: Trailhead / Location */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Start by choosing where you want to go. Search for a location or select a trail.
              </p>
              <LocationTrailStep
                location={location}
                onLocationChange={(loc) => {
                  setLocation(loc)
                  setSelectedTrail(null)
                  setApproachRoute(null)
                }}
                isTrailSport={isTrailSport}
                selectedTrail={selectedTrail}
                onTrailSelect={(trail) => {
                  setSelectedTrail(trail)
                  if (!trail) setApproachRoute(null)
                }}
                onApproachRouteChange={setApproachRoute}
                initialMapCenter={initialMapCenter}
              />
            </div>
          )}

          {/* Step 2: Transport / Logistics (AI-powered) */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Destination summary */}
              {(selectedTrail || location) && (
                <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1.5">
                  <div className="space-y-1 text-sm">
                    {selectedTrail && (
                      <div className="flex items-center gap-2">
                        <Mountain className="size-3.5 text-primary" />
                        <span className="font-medium">{selectedTrail.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="size-3.5" />
                      <span>{location?.name}</span>
                    </div>
                  </div>
                </div>
              )}

              {isLoadingSuggestions && (
                <div className="space-y-2 py-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary animate-pulse" />
                    <span className="text-sm font-medium text-primary">AI is planning your trip...</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" style={{ animation: 'shimmer 1.5s ease-in-out infinite' }} />
                  </div>
                  <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes shimmer {
                      0% { transform: translateX(-100%); }
                      100% { transform: translateX(200%); }
                    }
                  `}} />
                </div>
              )}

              {/* Parking — AI suggestions + custom */}
              <div className="space-y-2">
                <Label><Car className="inline size-3.5 mr-1" />Parking</Label>
                {aiSuggestions?.parking && aiSuggestions.parking.length > 0 && (
                  <div className="space-y-1.5">
                    {aiSuggestions.parking.map((p, i) => {
                      const isSelected = parkingName === p.name
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setParkingName(''); setParkingPaid(null); setParkingCost(''); setParkingNotes('')
                            } else {
                              setParkingName(p.name); setParkingPaid(p.paid); setParkingCost(p.cost); setParkingNotes(p.notes)
                            }
                          }}
                          className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                            isSelected
                              ? 'bg-primary/10 ring-1 ring-primary/30'
                              : 'bg-muted/40 hover:bg-muted/60'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p.name}</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              p.paid ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {p.cost}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">{p.description}</span>
                          {p.notes && <span className="text-[11px] text-muted-foreground italic">{p.notes}</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
                <Input
                  value={parkingName}
                  onChange={(e) => setParkingName(e.target.value)}
                  placeholder="Or enter custom parking location..."
                />
                {parkingName && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={parkingPaid === true} onChange={(e) => { setParkingPaid(e.target.checked); if (!e.target.checked) setParkingCost('') }} className="rounded" />
                      Paid parking
                    </label>
                    {parkingPaid && (
                      <Input
                        value={parkingCost}
                        onChange={(e) => setParkingCost(e.target.value)}
                        placeholder="Cost (e.g. $10/day)"
                        className="w-32"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Meeting point — AI suggestions + custom */}
              <div className="space-y-2">
                <Label><MapPin className="inline size-3.5 mr-1" />Meeting point</Label>
                {aiSuggestions?.meetingPoints && aiSuggestions.meetingPoints.length > 0 && (
                  <div className="space-y-1.5">
                    {aiSuggestions.meetingPoints.map((mp, i) => {
                      const isSelected = meetingPointName === mp.name
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setMeetingPointName(isSelected ? '' : mp.name)}
                          className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                            isSelected
                              ? 'bg-primary/10 ring-1 ring-primary/30'
                              : 'bg-muted/40 hover:bg-muted/60'
                          }`}
                        >
                          <span className="font-medium">{mp.name}</span>
                          <span className="text-xs text-muted-foreground">{mp.description}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                <Input
                  value={meetingPointName}
                  onChange={(e) => setMeetingPointName(e.target.value)}
                  placeholder="Or enter custom meeting point..."
                />
              </div>

              {/* Carpool meeting — AI suggestion for pre-trail meetup */}
              <div className="space-y-2">
                <Label><Users className="inline size-3.5 mr-1" />Carpool meeting spot</Label>
                <p className="text-[11px] text-muted-foreground">
                  Where should people sharing rides meet before heading to the trail?
                </p>
                {aiSuggestions?.carpoolNotes && (
                  <button
                    type="button"
                    onClick={() => setCarpoolMeetingNote(aiSuggestions.carpoolNotes)}
                    className={`flex w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                      carpoolMeetingNote === aiSuggestions.carpoolNotes
                        ? 'bg-primary/10 ring-1 ring-primary/30'
                        : 'bg-muted/40 hover:bg-muted/60'
                    }`}
                  >
                    <span className="text-xs">{aiSuggestions.carpoolNotes}</span>
                  </button>
                )}
                <Input
                  value={carpoolMeetingNote}
                  onChange={(e) => setCarpoolMeetingNote(e.target.value)}
                  placeholder="Or enter custom carpool meeting spot..."
                />
              </div>

              {/* Transport tips — AI generated, toggleable */}
              {aiSuggestions?.transportTips && aiSuggestions.transportTips.length > 0 && (
                <div className="space-y-2">
                  <Label><Navigation className="inline size-3.5 mr-1" />Transport tips (uncheck to remove)</Label>
                  <div className="space-y-1">
                    {aiSuggestions.transportTips.map((tip, i) => {
                      const isChecked = selectedTips.has(i)
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setSelectedTips((prev) => {
                              const next = new Set(prev)
                              next.has(i) ? next.delete(i) : next.add(i)
                              return next
                            })
                          }}
                          className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                            isChecked ? 'bg-primary/5 text-foreground' : 'bg-muted/20 text-muted-foreground line-through'
                          }`}
                        >
                          <div className={`mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded border transition-colors ${
                            isChecked ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                          }`}>
                            {isChecked && <Check className="size-2" />}
                          </div>
                          <span>{tip}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Custom transport notes */}
              <div className="space-y-1.5">
                <Label htmlFor="transport-notes">
                  <Pencil className="inline size-3.5 mr-1" />
                  Additional notes (optional)
                </Label>
                <textarea
                  id="transport-notes"
                  value={transportNotes}
                  onChange={(e) => setTransportNotes(e.target.value)}
                  placeholder="Any other transport info for your group..."
                  rows={2}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 3: Activity Details */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="act-sport">Activity type</Label>
                <select
                  id="act-sport"
                  value={sportType}
                  onChange={(e) => setSportType(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Select type</option>
                  {Object.entries(SPORT_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="act-title">Title</Label>
                <Input
                  id="act-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onFocus={suggestTitle}
                  placeholder={selectedTrail ? `Hike at ${selectedTrail.name}` : 'Morning hike at Griffith Park'}
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

              <div className="grid grid-cols-2 gap-3">
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

              <div className="space-y-1.5">
                <Label htmlFor="act-date">Date & Time</Label>
                <Input
                  id="act-date"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
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
                  <label className="flex h-16 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-colors">
                    <ImagePlus className="size-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Add a photo (or we&apos;ll find one)</span>
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
            </div>
          )}

          {/* Step 4: Invite friends + review */}
          {step === 4 && (
            <div className="space-y-3">
              {/* Full summary */}
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Review</p>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{title}</p>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mountain className="size-3.5" />
                    <span>{SPORT_LABELS[sportType] ?? sportType}</span>
                    <span>·</span>
                    <span>{SKILL_LABELS[skillLevel] ?? skillLevel}</span>
                  </div>
                  {location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="size-3.5" />
                      <span className="truncate">{location.name}</span>
                    </div>
                  )}
                  {selectedTrail && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mountain className="size-3.5 text-primary" />
                      <span className="truncate">{selectedTrail.name}</span>
                    </div>
                  )}
                  {scheduledAt && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="size-3.5" />
                      <span>{new Date(scheduledAt).toLocaleString(undefined, {
                        weekday: 'short', month: 'short', day: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                      })}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="size-3.5" />
                    <span>Up to {maxParticipants} participants</span>
                    <span>·</span>
                    <span>{VISIBILITY_LABELS[visibility]}</span>
                  </div>
                  {meetingPointName && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Navigation className="size-3.5" />
                      <span>Meet at {meetingPointName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Invite friends */}
              {friends.length > 0 && (
                <div className="space-y-2">
                  <Label>Invite friends (optional)</Label>
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-border/50 scrollbar-none">
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
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            disabled={step === 1}
            className={step === 1 ? 'invisible' : ''}
          >
            <ChevronLeft className="mr-1 size-4" />
            Back
          </Button>

          {step < TOTAL_STEPS ? (
            <Button type="button" onClick={handleNext}>
              Next
              <ChevronRight className="ml-1 size-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Activity'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
