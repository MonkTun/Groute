'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Camera, MapPin, Calendar } from 'lucide-react'

import {
  SPORT_LABELS,
  SKILL_LABELS,
  COUNTRIES,
  REGIONS,
  PREFERRED_LANGUAGES,
  CERTIFICATION_OPTIONS,
  CERTIFICATION_LABELS,
  TERRAIN_COMFORT_OPTIONS,
  TERRAIN_COMFORT_LABELS,
  WATER_COMFORT_OPTIONS,
  WATER_COMFORT_LABELS,
  FITNESS_LEVEL_OPTIONS,
  FITNESS_LEVEL_LABELS,
  GEAR_LEVEL_OPTIONS,
  GEAR_LEVEL_LABELS,
  OVERNIGHT_COMFORT_OPTIONS,
  OVERNIGHT_COMFORT_LABELS,
  PREFERRED_GROUP_SIZE_OPTIONS,
  PREFERRED_GROUP_SIZE_LABELS,
  PREFERRED_TIME_OF_DAY_OPTIONS,
  PREFERRED_TIME_OF_DAY_LABELS,
  HAS_CAR_OPTIONS,
  HAS_CAR_LABELS,
  WILLING_TO_CARPOOL_OPTIONS,
  WILLING_TO_CARPOOL_LABELS,
  MAX_DRIVE_DISTANCE_OPTIONS,
  COMFORT_WITH_STRANGERS_OPTIONS,
  COMFORT_WITH_STRANGERS_LABELS,
  type UserSportInput,
} from '@groute/shared'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserAvatar } from '@/components/UserAvatar'
import { FollowButton } from '@/components/FollowButton'
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
  avatar_url: string | null
  bio: string | null
  date_of_birth: string | null
  area: string | null
  preferred_language: string | null
  edu_email: string | null
  edu_verified: boolean
  strava_connected: boolean
  created_at: string
}

interface ExperienceData {
  sport_type: string
  highest_altitude_ft: number | null
  longest_distance_mi: number | null
  trips_last_12_months: number | null
  years_experience: number | null
  certifications: string[] | null
  terrain_comfort: string[] | null
  water_comfort: string | null
}

interface PreferencesData {
  has_car: string | null
  willing_to_carpool: string | null
  max_drive_distance_mi: number | null
  preferred_group_size: string | null
  preferred_time_of_day: string[] | null
  weekday_availability: boolean | null
  weekend_availability: boolean | null
  gear_level: string | null
  overnight_comfort: string | null
  fitness_level: string | null
  comfort_with_strangers: string | null
  accessibility_notes: string | null
}

interface SportData {
  sport_type: string
  self_reported_level: string
  strava_verified_level: string | null
}

interface UserInfo {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  area: string | null
}

interface PastActivity {
  id: string
  title: string
  sport_type: string
  location_name: string
  scheduled_at: string
  banner_url: string | null
  isCreator: boolean
}

interface NotificationData {
  id: string
  type: string
  read: boolean
  createdAt: string
  activityId: string | null
  fromUser: { id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null
}

interface ProfileViewProps {
  profile: ProfileData
  sports: SportData[]
  experience?: ExperienceData[]
  preferences?: PreferencesData | null
  friends?: UserInfo[]
  incomingFollows?: UserInfo[]
  notifications?: NotificationData[]
  currentUserId?: string
  pastActivities?: PastActivity[]
}

export function ProfileView({ profile, sports: initialSports, experience = [], preferences = null, friends = [], incomingFollows = [], notifications = [], currentUserId, pastActivities = [] }: ProfileViewProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/avatar', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setAvatarUrl(data.data.avatarUrl)
        router.refresh()
      }
    } catch {
      // ignore
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  // Edit state
  const [firstName, setFirstName] = useState(profile.first_name ?? '')
  const [lastName, setLastName] = useState(profile.last_name ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
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

  interface EditExperience {
    sportType: string
    yearsExperience: number | null
    tripsLast12Months: number | null
    longestDistanceMi: number | null
    highestAltitudeFt: number | null
    terrainComfort: string[]
    waterComfort: string | null
    certifications: string[]
  }

  interface EditPreferences {
    fitnessLevel: string | null
    gearLevel: string | null
    overnightComfort: string | null
    preferredGroupSize: string | null
    comfortWithStrangers: string | null
    hasCar: string | null
    willingToCarpool: string | null
    maxDriveDistanceMi: number | null
    weekdayAvailability: boolean
    weekendAvailability: boolean
    preferredTimeOfDay: string[]
    accessibilityNotes: string | null
  }

  const [editExperience, setEditExperience] = useState<EditExperience[]>(
    experience.map((e) => ({
      sportType: e.sport_type,
      yearsExperience: e.years_experience,
      tripsLast12Months: e.trips_last_12_months,
      longestDistanceMi: e.longest_distance_mi,
      highestAltitudeFt: e.highest_altitude_ft,
      terrainComfort: e.terrain_comfort ?? [],
      waterComfort: e.water_comfort,
      certifications: e.certifications ?? [],
    }))
  )

  const [editPreferences, setEditPreferences] = useState<EditPreferences>({
    fitnessLevel: preferences?.fitness_level ?? null,
    gearLevel: preferences?.gear_level ?? null,
    overnightComfort: preferences?.overnight_comfort ?? null,
    preferredGroupSize: preferences?.preferred_group_size ?? null,
    comfortWithStrangers: preferences?.comfort_with_strangers ?? null,
    hasCar: preferences?.has_car ?? null,
    willingToCarpool: preferences?.willing_to_carpool ?? null,
    maxDriveDistanceMi: preferences?.max_drive_distance_mi ?? null,
    weekdayAvailability: preferences?.weekday_availability ?? false,
    weekendAvailability: preferences?.weekend_availability ?? true,
    preferredTimeOfDay: preferences?.preferred_time_of_day ?? [],
    accessibilityNotes: preferences?.accessibility_notes ?? null,
  })

  function handleCancel() {
    setFirstName(profile.first_name ?? '')
    setLastName(profile.last_name ?? '')
    setBio(profile.bio ?? '')
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
    setEditExperience(
      experience.map((e) => ({
        sportType: e.sport_type,
        yearsExperience: e.years_experience,
        tripsLast12Months: e.trips_last_12_months,
        longestDistanceMi: e.longest_distance_mi,
        highestAltitudeFt: e.highest_altitude_ft,
        terrainComfort: e.terrain_comfort ?? [],
        waterComfort: e.water_comfort,
        certifications: e.certifications ?? [],
      }))
    )
    setEditPreferences({
      fitnessLevel: preferences?.fitness_level ?? null,
      gearLevel: preferences?.gear_level ?? null,
      overnightComfort: preferences?.overnight_comfort ?? null,
      preferredGroupSize: preferences?.preferred_group_size ?? null,
      comfortWithStrangers: preferences?.comfort_with_strangers ?? null,
      hasCar: preferences?.has_car ?? null,
      willingToCarpool: preferences?.willing_to_carpool ?? null,
      maxDriveDistanceMi: preferences?.max_drive_distance_mi ?? null,
      weekdayAvailability: preferences?.weekday_availability ?? false,
      weekendAvailability: preferences?.weekend_availability ?? true,
      preferredTimeOfDay: preferences?.preferred_time_of_day ?? [],
      accessibilityNotes: preferences?.accessibility_notes ?? null,
    })
    setError(null)
    setIsEditing(false)
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          bio: bio || null,
          dateOfBirth,
          area: region && country ? `${region}, ${country}` : region || country,
          preferredLanguage: preferredLanguage || undefined,
          eduEmail: eduEmail || undefined,
          sports,
          experience: editExperience,
          preferences: editPreferences,
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
      if (exists) {
        setEditExperience((exp) => exp.filter((e) => e.sportType !== sportType))
        return prev.filter((s) => s.sportType !== sportType)
      }
      setEditExperience((exp) => [...exp, {
        sportType,
        yearsExperience: null,
        tripsLast12Months: null,
        longestDistanceMi: null,
        highestAltitudeFt: null,
        terrainComfort: [],
        waterComfort: null,
        certifications: [],
      }])
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
        {/* Avatar + header */}
        <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative"
              disabled={isUploadingAvatar}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="size-20 rounded-full object-cover ring-2 ring-border sm:size-16"
                />
              ) : (
                <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary ring-2 ring-border sm:size-16 sm:text-xl">
                  {(profile.first_name?.[0] ?? profile.email[0]).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="size-5 text-white" />
              </div>
              {isUploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <div className="text-center sm:text-left">
              <h1 className="text-xl font-bold sm:text-2xl">
                {profile.first_name} {profile.last_name}
              </h1>
              <p className="text-sm text-muted-foreground">{profile.area ?? profile.email}</p>
            </div>
          </div>
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
          {/* Bio */}
          {profile.bio && (
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{profile.bio}</p>
              </CardContent>
            </Card>
          )}

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
                <div>
                  <dt className="text-muted-foreground">Member since</dt>
                  <dd className="font-medium">
                    {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </dd>
                </div>
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
                  {initialSports.map((sport) => {
                    const exp = experience.find((e) => e.sport_type === sport.sport_type)
                    return (
                      <div
                        key={sport.sport_type}
                        className="rounded-lg border border-border p-3 sm:px-4 sm:py-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                        {exp && (
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                            {exp.years_experience != null && (
                              <span>{exp.years_experience} yr{exp.years_experience !== 1 ? 's' : ''} experience</span>
                            )}
                            {exp.trips_last_12_months != null && (
                              <span>{exp.trips_last_12_months} trips last year</span>
                            )}
                            {exp.longest_distance_mi != null && (
                              <span>{exp.longest_distance_mi} mi longest</span>
                            )}
                            {exp.highest_altitude_ft != null && (
                              <span>{exp.highest_altitude_ft.toLocaleString()} ft highest</span>
                            )}
                            {exp.terrain_comfort && exp.terrain_comfort.length > 0 && (
                              <span>Terrain: {exp.terrain_comfort.map((t) => TERRAIN_COMFORT_LABELS[t] ?? t).join(', ')}</span>
                            )}
                            {exp.water_comfort && (
                              <span>Water: {WATER_COMFORT_LABELS[exp.water_comfort] ?? exp.water_comfort}</span>
                            )}
                          </div>
                        )}
                        {exp?.certifications && exp.certifications.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {exp.certifications.map((cert) => (
                              <span key={cert} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                {CERTIFICATION_LABELS[cert] ?? cert}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No activities added yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Preferences */}
          {preferences && (
            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                  {preferences.fitness_level && (
                    <div>
                      <dt className="text-muted-foreground">Fitness level</dt>
                      <dd className="font-medium">{FITNESS_LEVEL_LABELS[preferences.fitness_level] ?? preferences.fitness_level}</dd>
                    </div>
                  )}
                  {preferences.gear_level && (
                    <div>
                      <dt className="text-muted-foreground">Gear</dt>
                      <dd className="font-medium">{GEAR_LEVEL_LABELS[preferences.gear_level] ?? preferences.gear_level}</dd>
                    </div>
                  )}
                  {preferences.overnight_comfort && (
                    <div>
                      <dt className="text-muted-foreground">Overnight</dt>
                      <dd className="font-medium">{OVERNIGHT_COMFORT_LABELS[preferences.overnight_comfort] ?? preferences.overnight_comfort}</dd>
                    </div>
                  )}
                  {preferences.preferred_group_size && (
                    <div>
                      <dt className="text-muted-foreground">Group size</dt>
                      <dd className="font-medium">{PREFERRED_GROUP_SIZE_LABELS[preferences.preferred_group_size] ?? preferences.preferred_group_size}</dd>
                    </div>
                  )}
                  {preferences.comfort_with_strangers && (
                    <div>
                      <dt className="text-muted-foreground">Meeting new people</dt>
                      <dd className="font-medium">{COMFORT_WITH_STRANGERS_LABELS[preferences.comfort_with_strangers] ?? preferences.comfort_with_strangers}</dd>
                    </div>
                  )}
                  {preferences.has_car && (
                    <div>
                      <dt className="text-muted-foreground">Has car</dt>
                      <dd className="font-medium">{HAS_CAR_LABELS[preferences.has_car] ?? preferences.has_car}</dd>
                    </div>
                  )}
                  {preferences.willing_to_carpool && (
                    <div>
                      <dt className="text-muted-foreground">Carpool</dt>
                      <dd className="font-medium">
                        {WILLING_TO_CARPOOL_LABELS[preferences.willing_to_carpool] ?? preferences.willing_to_carpool}
                        {preferences.max_drive_distance_mi && ` (up to ${preferences.max_drive_distance_mi} mi)`}
                      </dd>
                    </div>
                  )}
                  {(preferences.weekday_availability || preferences.weekend_availability) && (
                    <div>
                      <dt className="text-muted-foreground">Availability</dt>
                      <dd className="font-medium">
                        {[
                          preferences.weekday_availability && 'Weekdays',
                          preferences.weekend_availability && 'Weekends',
                        ].filter(Boolean).join(' & ')}
                      </dd>
                    </div>
                  )}
                  {preferences.preferred_time_of_day && preferences.preferred_time_of_day.length > 0 && (
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground">Preferred times</dt>
                      <dd className="font-medium">
                        {preferences.preferred_time_of_day.map((t) => PREFERRED_TIME_OF_DAY_LABELS[t] ?? t).join(', ')}
                      </dd>
                    </div>
                  )}
                  {preferences.accessibility_notes && (
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground">Accessibility</dt>
                      <dd className="font-medium">{preferences.accessibility_notes}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Past Activities */}
          {pastActivities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Past Activities</CardTitle>
                <CardAction>
                  <span className="text-xs text-muted-foreground">
                    {pastActivities.length} trip{pastActivities.length !== 1 ? 's' : ''}
                  </span>
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pastActivities.map((activity) => (
                    <a
                      key={activity.id}
                      href={`/activity/${activity.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted/50"
                    >
                      {activity.banner_url ? (
                        <img
                          src={activity.banner_url}
                          alt=""
                          className="size-12 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex size-12 items-center justify-center rounded-md bg-muted text-lg">
                          {SPORT_LABELS[activity.sport_type]?.[0] ?? '?'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{activity.title}</p>
                          {activity.isCreator && (
                            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              HOST
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" />
                            {activity.location_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {new Date(activity.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <span className="rounded-md bg-muted px-2 py-1 text-[10px]">
                        {SPORT_LABELS[activity.sport_type] ?? activity.sport_type}
                      </span>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Friends */}
          <Card>
            <CardHeader>
              <CardTitle>Friends ({friends.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {incomingFollows.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Wants to follow you</p>
                  <div className="space-y-2">
                    {incomingFollows.map((u) => {
                      const name = u.first_name && u.last_name
                        ? `${u.first_name} ${u.last_name}`
                        : u.display_name
                      return (
                        <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar src={u.avatar_url} name={name} size="sm" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{name}</p>
                              {u.area && <p className="text-xs text-muted-foreground">{u.area}</p>}
                            </div>
                          </div>
                          <FollowButton userId={u.id} isFollowing={false} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {friends.length > 0 ? (
                <div className="space-y-2">
                  {friends.map((u) => {
                    const name = u.first_name && u.last_name
                      ? `${u.first_name} ${u.last_name}`
                      : u.display_name
                    return (
                      <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar src={u.avatar_url} name={name} size="sm" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{name}</p>
                            {u.area && <p className="text-xs text-muted-foreground">{u.area}</p>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : incomingFollows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No friends yet. Follow someone and have them follow back!</p>
              ) : null}
            </CardContent>
          </Card>

          {/* Notifications */}
          {notifications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {notifications.slice(0, 10).map((n) => {
                    const name = n.fromUser
                      ? n.fromUser.first_name ?? n.fromUser.display_name
                      : 'Someone'
                    const message =
                      n.type === 'invite' ? `${name} invited you to an activity`
                      : n.type === 'follow' ? `${name} started following you`
                      : n.type === 'join_request' ? `${name} wants to join your activity`
                      : n.type === 'join_accepted' ? `${name} accepted your request`
                      : `${name} sent a notification`
                    return (
                      <div key={n.id} className={`flex items-center gap-2.5 rounded-lg p-2.5 text-sm ${!n.read ? 'bg-primary/5' : ''}`}>
                        {n.fromUser && (
                          <UserAvatar src={n.fromUser.avatar_url} name={name} size="sm" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">{message}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  }

  async function handleRestartOnboarding() {
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetOnboarding: true }),
      })
      router.push('/onboarding')
      router.refresh()
    } catch {
      // ignore
    }
  }

  // ── Edit mode ──
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
      <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative"
            disabled={isUploadingAvatar}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="size-20 rounded-full object-cover ring-2 ring-border sm:size-16"
              />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary ring-2 ring-border sm:size-16 sm:text-xl">
                {(profile.first_name?.[0] ?? profile.email[0]).toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="size-5 text-white" />
            </div>
            {isUploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarUpload}
            className="hidden"
          />
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Edit Profile</h1>
            <p className="text-xs text-muted-foreground">Click photo to change</p>
          </div>
        </div>
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
              <Label htmlFor="edit-bio">Bio</Label>
              <textarea
                id="edit-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="Tell others about yourself..."
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <p className="text-xs text-muted-foreground">{bio.length}/300</p>
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

        {/* Experience per sport */}
        {sports.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Experience Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {sports.map((sport) => {
                const exp = editExperience.find((e) => e.sportType === sport.sportType) ?? {
                  sportType: sport.sportType,
                  yearsExperience: null,
                  tripsLast12Months: null,
                  longestDistanceMi: null,
                  highestAltitudeFt: null,
                  terrainComfort: [] as string[],
                  waterComfort: null as string | null,
                  certifications: [] as string[],
                }

                function updateExp(field: string, value: unknown) {
                  setEditExperience((prev) => {
                    const exists = prev.find((e) => e.sportType === sport.sportType)
                    if (exists) {
                      return prev.map((e) => e.sportType === sport.sportType ? { ...e, [field]: value } : e)
                    }
                    return [...prev, { ...exp, [field]: value }]
                  })
                }

                return (
                  <div key={sport.sportType} className="space-y-3">
                    <p className="text-sm font-medium">{SPORT_LABELS[sport.sportType]}</p>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Years experience</Label>
                        <Input
                          type="number"
                          min={0}
                          max={80}
                          value={exp.yearsExperience ?? ''}
                          onChange={(e) => updateExp('yearsExperience', e.target.value ? Number(e.target.value) : null)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Trips last 12 mo</Label>
                        <Input
                          type="number"
                          min={0}
                          max={365}
                          value={exp.tripsLast12Months ?? ''}
                          onChange={(e) => updateExp('tripsLast12Months', e.target.value ? Number(e.target.value) : null)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Longest dist (mi)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={500}
                          value={exp.longestDistanceMi ?? ''}
                          onChange={(e) => updateExp('longestDistanceMi', e.target.value ? Number(e.target.value) : null)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Highest alt (ft)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={30000}
                          value={exp.highestAltitudeFt ?? ''}
                          onChange={(e) => updateExp('highestAltitudeFt', e.target.value ? Number(e.target.value) : null)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Terrain comfort</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {TERRAIN_COMFORT_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const current = exp.terrainComfort
                              updateExp('terrainComfort', current.includes(opt) ? current.filter((t) => t !== opt) : [...current, opt])
                            }}
                            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                              exp.terrainComfort.includes(opt)
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted hover:bg-muted/80'
                            }`}
                          >
                            {TERRAIN_COMFORT_LABELS[opt]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Water comfort</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {WATER_COMFORT_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => updateExp('waterComfort', exp.waterComfort === opt ? null : opt)}
                            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                              exp.waterComfort === opt
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted hover:bg-muted/80'
                            }`}
                          >
                            {WATER_COMFORT_LABELS[opt]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Certifications</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {CERTIFICATION_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const current = exp.certifications
                              updateExp('certifications', current.includes(opt) ? current.filter((c) => c !== opt) : [...current, opt])
                            }}
                            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                              exp.certifications.includes(opt)
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted hover:bg-muted/80'
                            }`}
                          >
                            {CERTIFICATION_LABELS[opt]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {sports.indexOf(sport) < sports.length - 1 && <hr className="border-border" />}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Fitness level</Label>
                <div className="flex flex-wrap gap-1.5">
                  {FITNESS_LEVEL_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setEditPreferences((p) => ({ ...p, fitnessLevel: p.fitnessLevel === opt ? null : opt }))}
                      className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                        editPreferences.fitnessLevel === opt
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {FITNESS_LEVEL_LABELS[opt]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Gear level</Label>
                <div className="flex flex-wrap gap-1.5">
                  {GEAR_LEVEL_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setEditPreferences((p) => ({ ...p, gearLevel: p.gearLevel === opt ? null : opt }))}
                      className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                        editPreferences.gearLevel === opt
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {GEAR_LEVEL_LABELS[opt]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Overnight comfort</Label>
                <div className="flex flex-wrap gap-1.5">
                  {OVERNIGHT_COMFORT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setEditPreferences((p) => ({ ...p, overnightComfort: p.overnightComfort === opt ? null : opt }))}
                      className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                        editPreferences.overnightComfort === opt
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {OVERNIGHT_COMFORT_LABELS[opt]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Preferred group size</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PREFERRED_GROUP_SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setEditPreferences((p) => ({ ...p, preferredGroupSize: p.preferredGroupSize === opt ? null : opt }))}
                      className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                        editPreferences.preferredGroupSize === opt
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {PREFERRED_GROUP_SIZE_LABELS[opt]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Meeting new people</Label>
                <div className="flex flex-wrap gap-1.5">
                  {COMFORT_WITH_STRANGERS_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setEditPreferences((p) => ({ ...p, comfortWithStrangers: p.comfortWithStrangers === opt ? null : opt }))}
                      className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                        editPreferences.comfortWithStrangers === opt
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {COMFORT_WITH_STRANGERS_LABELS[opt]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Has car</Label>
                <div className="flex flex-wrap gap-1.5">
                  {HAS_CAR_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setEditPreferences((p) => ({ ...p, hasCar: p.hasCar === opt ? null : opt }))}
                      className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                        editPreferences.hasCar === opt
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {HAS_CAR_LABELS[opt]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Willing to carpool</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WILLING_TO_CARPOOL_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setEditPreferences((p) => ({ ...p, willingToCarpool: p.willingToCarpool === opt ? null : opt }))}
                      className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                        editPreferences.willingToCarpool === opt
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {WILLING_TO_CARPOOL_LABELS[opt]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Max drive distance</Label>
                <div className="flex flex-wrap gap-1.5">
                  {MAX_DRIVE_DISTANCE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setEditPreferences((p) => ({ ...p, maxDriveDistanceMi: p.maxDriveDistanceMi === opt ? null : opt }))}
                      className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                        editPreferences.maxDriveDistanceMi === opt
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {opt} mi
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preferred times</Label>
              <div className="flex flex-wrap gap-1.5">
                {PREFERRED_TIME_OF_DAY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() =>
                      setEditPreferences((p) => ({
                        ...p,
                        preferredTimeOfDay: p.preferredTimeOfDay.includes(opt)
                          ? p.preferredTimeOfDay.filter((t) => t !== opt)
                          : [...p.preferredTimeOfDay, opt],
                      }))
                    }
                    className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                      editPreferences.preferredTimeOfDay.includes(opt)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {PREFERRED_TIME_OF_DAY_LABELS[opt]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editPreferences.weekdayAvailability}
                  onChange={(e) => setEditPreferences((p) => ({ ...p, weekdayAvailability: e.target.checked }))}
                  className="rounded"
                />
                Weekdays
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editPreferences.weekendAvailability}
                  onChange={(e) => setEditPreferences((p) => ({ ...p, weekendAvailability: e.target.checked }))}
                  className="rounded"
                />
                Weekends
              </label>
            </div>

            <div className="space-y-2">
              <Label>Accessibility notes</Label>
              <textarea
                value={editPreferences.accessibilityNotes ?? ''}
                onChange={(e) => setEditPreferences((p) => ({ ...p, accessibilityNotes: e.target.value || null }))}
                maxLength={500}
                rows={2}
                placeholder="Any physical limitations or accessibility needs..."
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </CardContent>
        </Card>

        {/* Restart Onboarding */}
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground"
            onClick={handleRestartOnboarding}
          >
            Restart Onboarding
          </Button>
        </div>
      </div>
    </div>
  )
}
