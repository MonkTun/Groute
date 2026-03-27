'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'

import {
  SPORT_LABELS,
  SKILL_LABELS,
  COUNTRIES,
  REGIONS,
  PREFERRED_LANGUAGES,
  type UserSportInput,
} from '@groute/shared'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card'
import { SignOutButton } from '@/components/SignOutButton'

interface ProfileData {
  first_name: string | null
  last_name: string | null
  email: string
  date_of_birth: string | null
  area: string | null
  preferred_language: string | null
  edu_email: string | null
  edu_verified: boolean
  strava_connected: boolean
}

interface SportData {
  sport_type: string
  self_reported_level: string
  strava_verified_level: string | null
}

interface ProfileViewProps {
  profile: ProfileData
  sports: SportData[]
}

export function ProfileView({ profile, sports: initialSports }: ProfileViewProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [firstName, setFirstName] = useState(profile.first_name ?? '')
  const [lastName, setLastName] = useState(profile.last_name ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(profile.date_of_birth ?? '')
  const [country, setCountry] = useState(profile.area?.split(', ')[1] ?? '')
  const [region, setRegion] = useState(profile.area?.split(', ')[0] ?? '')
  const [preferredLanguage, setPreferredLanguage] = useState(profile.preferred_language ?? '')
  const [eduEmail, setEduEmail] = useState(profile.edu_email ?? '')
  const [sports, setSports] = useState<UserSportInput[]>(
    initialSports.map((s) => ({
      sportType: s.sport_type as UserSportInput['sportType'],
      selfReportedLevel: s.self_reported_level as UserSportInput['selfReportedLevel'],
    }))
  )

  function handleCancel() {
    setFirstName(profile.first_name ?? '')
    setLastName(profile.last_name ?? '')
    setDateOfBirth(profile.date_of_birth ?? '')
    setCountry(profile.area?.split(', ')[1] ?? '')
    setRegion(profile.area?.split(', ')[0] ?? '')
    setPreferredLanguage(profile.preferred_language ?? '')
    setEduEmail(profile.edu_email ?? '')
    setSports(
      initialSports.map((s) => ({
        sportType: s.sport_type as UserSportInput['sportType'],
        selfReportedLevel: s.self_reported_level as UserSportInput['selfReportedLevel'],
      }))
    )
    setError(null)
    setIsEditing(false)
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          dateOfBirth,
          area: region && country ? `${region}, ${country}` : region || country,
          preferredLanguage: preferredLanguage || undefined,
          eduEmail: eduEmail || undefined,
          sports,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save')
        setIsSaving(false)
        return
      }

      setIsEditing(false)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setIsSaving(false)
    }
  }

  function toggleSport(sportType: string) {
    setSports((prev) => {
      const exists = prev.find((s) => s.sportType === sportType)
      if (exists) return prev.filter((s) => s.sportType !== sportType)
      return [...prev, { sportType, selfReportedLevel: 'beginner' } as UserSportInput]
    })
  }

  function updateSportLevel(sportType: string, level: string) {
    setSports((prev) =>
      prev.map((s) =>
        s.sportType === sportType
          ? { ...s, selfReportedLevel: level as UserSportInput['selfReportedLevel'] }
          : s
      )
    )
  }

  const dob = profile.date_of_birth ? new Date(profile.date_of_birth) : null
  const age = dob
    ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  // ── View mode ──
  if (!isEditing) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
        <div className="mb-4 flex items-center justify-between sm:mb-6">
          <h1 className="text-xl font-bold sm:text-2xl">Profile</h1>
          <div className="flex items-center gap-2">
            {profile.edu_verified && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                .edu Verified
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1.5">
              <Pencil className="size-3" />
              Edit
            </Button>
            <SignOutButton />
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium">{profile.first_name} {profile.last_name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Age</dt>
                  <dd className="font-medium">{age ?? '\u2014'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Location</dt>
                  <dd className="font-medium">{profile.area ?? '\u2014'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="truncate font-medium">{profile.email}</dd>
                </div>
                {profile.preferred_language && (
                  <div>
                    <dt className="text-muted-foreground">Language</dt>
                    <dd className="font-medium">{profile.preferred_language}</dd>
                  </div>
                )}
                {profile.edu_email && (
                  <div>
                    <dt className="text-muted-foreground">School</dt>
                    <dd className="truncate font-medium">{profile.edu_email}</dd>
                  </div>
                )}
                {profile.strava_connected && (
                  <div>
                    <dt className="text-muted-foreground">Strava</dt>
                    <dd className="font-medium text-green-600">Connected</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activities & Experience</CardTitle>
            </CardHeader>
            <CardContent>
              {initialSports.length > 0 ? (
                <div className="space-y-2 sm:space-y-3">
                  {initialSports.map((sport) => (
                    <div
                      key={sport.sport_type}
                      className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3"
                    >
                      <span className="text-sm font-medium">
                        {SPORT_LABELS[sport.sport_type] ?? sport.sport_type}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-muted px-2 py-1 text-xs">
                          {SKILL_LABELS[sport.self_reported_level] ?? sport.self_reported_level}
                        </span>
                        {sport.strava_verified_level && (
                          <span className="rounded-md bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Strava: {SKILL_LABELS[sport.strava_verified_level]}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No activities added yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Edit mode ──
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">Edit Profile</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Personal Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-fn">First name</Label>
                <Input id="edit-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-ln">Last name</Label>
                <Input id="edit-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-dob">Date of birth</Label>
              <Input id="edit-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-country">Country</Label>
                <select
                  id="edit-country"
                  value={country}
                  onChange={(e) => { setCountry(e.target.value); setRegion('') }}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-region">State / Province</Label>
                {country && REGIONS[country] ? (
                  <select
                    id="edit-region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="">Select state/province</option>
                    {REGIONS[country].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="edit-region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="Enter state/province"
                    disabled={!country}
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-lang">Preferred language</Label>
              <select
                id="edit-lang"
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">None</option>
                {PREFERRED_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-edu">School email (.edu)</Label>
              <Input
                id="edit-edu"
                type="email"
                value={eduEmail}
                onChange={(e) => setEduEmail(e.target.value)}
                placeholder="you@university.edu"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activities & Experience</CardTitle>
            <CardAction>
              <span className="text-xs text-muted-foreground">
                {sports.length} selected
              </span>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(SPORT_LABELS).map(([key, label]) => {
                const isSelected = sports.some((s) => s.sportType === key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleSport(key)}
                    className={`rounded-lg border px-3 py-2.5 text-sm transition-colors sm:py-2 ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border hover:border-primary/50 hover:bg-muted'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {sports.length > 0 && (
              <div className="space-y-3 pt-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Experience level:
                </p>
                {sports.map((sport) => (
                  <div
                    key={sport.sportType}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <span className="text-sm font-medium">
                      {SPORT_LABELS[sport.sportType]}
                    </span>
                    <div className="flex gap-1">
                      {Object.entries(SKILL_LABELS).map(([level, label]) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => updateSportLevel(sport.sportType, level)}
                          className={`rounded-md px-2 py-1.5 text-xs transition-colors sm:py-1 ${
                            sport.selfReportedLevel === level
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
