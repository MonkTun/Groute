'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  SPORT_LABELS,
  SKILL_LABELS,
  COUNTRIES,
  REGIONS,
  PREFERRED_LANGUAGES,
  TERRAIN_COMFORT_LABELS,
  CERTIFICATION_LABELS,
  WATER_COMFORT_LABELS,
  HAS_CAR_LABELS,
  WILLING_TO_CARPOOL_LABELS,
  MAX_DRIVE_DISTANCE_OPTIONS,
  PREFERRED_GROUP_SIZE_LABELS,
  PREFERRED_TIME_OF_DAY_LABELS,
  GEAR_LEVEL_LABELS,
  OVERNIGHT_COMFORT_LABELS,
  FITNESS_LEVEL_LABELS,
  COMFORT_WITH_STRANGERS_LABELS,
  type OnboardingProfileExtendedInput,
  type UserSportInput,
  type UserExperienceInput,
  type UserPreferencesInput,
} from '@groute/shared'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type Step = 'basics' | 'activities' | 'experience' | 'logistics' | 'extras'

const STEPS: Step[] = ['basics', 'activities', 'experience', 'logistics', 'extras']

const STEP_TITLES: Record<Step, string> = {
  basics: 'About You',
  activities: 'Your Activities',
  experience: 'Your Experience',
  logistics: 'Logistics & Availability',
  extras: 'Almost Done',
}

const STEP_DESCRIPTIONS: Record<Step, string> = {
  basics: 'Tell us a bit about yourself',
  activities: 'What do you like to do outdoors?',
  experience: 'Help us understand your experience level',
  logistics: 'So we can match you with compatible partners',
  extras: 'Optional details to enhance your profile',
}

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8'

function ToggleChip({
  label,
  isSelected,
  onClick,
}: {
  label: string
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs transition-colors sm:py-1.5 ${
        isSelected
          ? 'border-primary bg-primary/10 text-primary font-medium'
          : 'border-border hover:border-primary/50 hover:bg-muted'
      }`}
    >
      {label}
    </button>
  )
}

function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: Record<string, string>
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(options).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-lg border px-3 py-2 text-xs transition-colors sm:py-1.5 ${
            value === key
              ? 'border-primary bg-primary/10 text-primary font-medium'
              : 'border-border hover:border-primary/50 hover:bg-muted'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('basics')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: basics
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')

  // Step 2: activities
  const [sports, setSports] = useState<UserSportInput[]>([])

  // Step 3: experience (per sport)
  const [experience, setExperience] = useState<Record<string, Partial<UserExperienceInput>>>({})

  // Step 4: logistics/preferences
  const [preferences, setPreferences] = useState<Partial<UserPreferencesInput>>({
    preferredTimeOfDay: [],
    weekdayAvailability: false,
    weekendAvailability: true,
  })

  // Step 5: extras
  const [preferredLanguage, setPreferredLanguage] = useState('')
  const [eduEmail, setEduEmail] = useState('')

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const currentStepIndex = STEPS.indexOf(step)
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === STEPS.length - 1

  function validateBasics(): boolean {
    const errors: Record<string, string> = {}
    if (!firstName.trim()) errors.firstName = 'First name is required'
    if (!lastName.trim()) errors.lastName = 'Last name is required'
    if (!dateOfBirth) {
      errors.dateOfBirth = 'Date of birth is required'
    } else {
      const dob = new Date(dateOfBirth)
      const now = new Date()
      const age = now.getFullYear() - dob.getFullYear()
      if (age < 18) errors.dateOfBirth = 'You must be at least 18 years old'
      if (age > 100) errors.dateOfBirth = 'Please enter a valid date of birth'
    }
    if (!country || !region) errors.area = 'Country and state/province are required'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  function validateActivities(): boolean {
    if (sports.length === 0) {
      setFieldErrors({ sports: 'Select at least one activity' })
      return false
    }
    setFieldErrors({})
    return true
  }

  function handleNext() {
    if (step === 'basics' && !validateBasics()) return
    if (step === 'activities' && !validateActivities()) return
    setFieldErrors({})
    const next = STEPS[currentStepIndex + 1]
    if (next) setStep(next)
  }

  function handleBack() {
    setFieldErrors({})
    const prev = STEPS[currentStepIndex - 1]
    if (prev) setStep(prev)
  }

  function toggleSport(sportType: string) {
    setSports((prev) => {
      const exists = prev.find((s) => s.sportType === sportType)
      if (exists) {
        return prev.filter((s) => s.sportType !== sportType)
      }
      return [
        ...prev,
        { sportType, selfReportedLevel: 'beginner' } as UserSportInput,
      ]
    })
    setFieldErrors({})
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

  function updateExperience(sportType: string, field: string, value: unknown) {
    setExperience((prev) => {
      const updated = { ...prev[sportType], [field]: value }
      return { ...prev, [sportType]: updated }
    })
  }

  function toggleExperienceArray(sportType: string, field: 'terrainComfort' | 'certifications', value: string) {
    setExperience((prev) => {
      const current = (prev[sportType]?.[field] as string[] | undefined) ?? []
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      const updated = { ...prev[sportType], [field]: next }
      return { ...prev, [sportType]: updated }
    })
  }

  function updatePref<K extends keyof UserPreferencesInput>(key: K, value: UserPreferencesInput[K]) {
    setPreferences((prev) => ({ ...prev, [key]: value }))
  }

  function togglePrefTimeOfDay(value: string) {
    setPreferences((prev) => {
      const current = prev.preferredTimeOfDay ?? []
      const next = current.includes(value as typeof current[number])
        ? current.filter((v) => v !== value)
        : [...current, value as typeof current[number]]
      return { ...prev, preferredTimeOfDay: next }
    })
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    setError(null)

    const experienceData: UserExperienceInput[] = sports.map((s) => ({
      sportType: s.sportType as UserExperienceInput['sportType'],
      highestAltitudeFt: experience[s.sportType]?.highestAltitudeFt,
      longestDistanceMi: experience[s.sportType]?.longestDistanceMi,
      tripsLast12Months: experience[s.sportType]?.tripsLast12Months,
      yearsExperience: experience[s.sportType]?.yearsExperience,
      certifications: (experience[s.sportType]?.certifications ?? []) as UserExperienceInput['certifications'],
      terrainComfort: (experience[s.sportType]?.terrainComfort ?? []) as UserExperienceInput['terrainComfort'],
      waterComfort: experience[s.sportType]?.waterComfort as UserExperienceInput['waterComfort'],
    }))

    const payload: OnboardingProfileExtendedInput = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth,
      area: `${region}, ${country}`,
      sports,
      experience: experienceData,
      preferences: preferences as UserPreferencesInput,
      preferredLanguage: preferredLanguage || undefined,
      eduEmail: eduEmail || undefined,
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Something went wrong')
        setIsSubmitting(false)
        return
      }

      router.push('/rightnow')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="mb-4 flex gap-2 sm:mb-6">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= currentStepIndex ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">{STEP_TITLES[step]}</CardTitle>
            <CardDescription>{STEP_DESCRIPTIONS[step]}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            {step === 'basics' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      aria-invalid={!!fieldErrors.firstName}
                    />
                    {fieldErrors.firstName && (
                      <p className="text-xs text-destructive">{fieldErrors.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      aria-invalid={!!fieldErrors.lastName}
                    />
                    {fieldErrors.lastName && (
                      <p className="text-xs text-destructive">{fieldErrors.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dob">Date of birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    aria-invalid={!!fieldErrors.dateOfBirth}
                  />
                  {fieldErrors.dateOfBirth && (
                    <p className="text-xs text-destructive">{fieldErrors.dateOfBirth}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <select
                      id="country"
                      value={country}
                      onChange={(e) => {
                        setCountry(e.target.value)
                        setRegion('')
                      }}
                      className={selectClass}
                      aria-invalid={!!fieldErrors.area}
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">State / Province</Label>
                    <select
                      id="region"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className={selectClass}
                      disabled={!country}
                      aria-invalid={!!fieldErrors.area}
                    >
                      <option value="">
                        {country && REGIONS[country]
                          ? 'Select state/province'
                          : country
                            ? 'Type your region below'
                            : 'Select country first'}
                      </option>
                      {(REGIONS[country] ?? []).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    {country && !REGIONS[country] && (
                      <input
                        type="text"
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        placeholder="Enter your state/province"
                        className={selectClass}
                      />
                    )}
                  </div>
                </div>
                {fieldErrors.area && (
                  <p className="text-xs text-destructive">{fieldErrors.area}</p>
                )}
              </>
            )}

            {step === 'activities' && (
              <>
                {fieldErrors.sports && (
                  <p className="text-sm text-destructive">{fieldErrors.sports}</p>
                )}
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
                      Set your experience level:
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
                              onClick={() =>
                                updateSportLevel(sport.sportType, level)
                              }
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
              </>
            )}

            {step === 'experience' && (
              <div className="space-y-6">
                {sports.map((sport) => {
                  const exp = experience[sport.sportType] ?? {}
                  const isHiking = sport.sportType === 'hiking'
                  return (
                    <div key={sport.sportType} className="space-y-4">
                      <h3 className="text-sm font-semibold text-primary">
                        {SPORT_LABELS[sport.sportType]}
                      </h3>

                      <div className="grid grid-cols-2 gap-3">
                        {isHiking && (
                          <div className="space-y-1.5">
                            <Label className="text-xs">Highest altitude (ft)</Label>
                            <Input
                              type="number"
                              placeholder="e.g. 14000"
                              value={exp.highestAltitudeFt ?? ''}
                              onChange={(e) =>
                                updateExperience(sport.sportType, 'highestAltitudeFt', e.target.value ? Number(e.target.value) : undefined)
                              }
                            />
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <Label className="text-xs">Longest distance (mi)</Label>
                          <Input
                            type="number"
                            placeholder="e.g. 15"
                            value={exp.longestDistanceMi ?? ''}
                            onChange={(e) =>
                              updateExperience(sport.sportType, 'longestDistanceMi', e.target.value ? Number(e.target.value) : undefined)
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Trips (last 12 months)</Label>
                          <Input
                            type="number"
                            placeholder="e.g. 20"
                            value={exp.tripsLast12Months ?? ''}
                            onChange={(e) =>
                              updateExperience(sport.sportType, 'tripsLast12Months', e.target.value ? Number(e.target.value) : undefined)
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Years of experience</Label>
                          <Input
                            type="number"
                            placeholder="e.g. 3"
                            value={exp.yearsExperience ?? ''}
                            onChange={(e) =>
                              updateExperience(sport.sportType, 'yearsExperience', e.target.value ? Number(e.target.value) : undefined)
                            }
                          />
                        </div>
                      </div>

                      {isHiking && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Terrain comfort</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(TERRAIN_COMFORT_LABELS).map(([key, label]) => (
                              <ToggleChip
                                key={key}
                                label={label}
                                isSelected={((exp.terrainComfort as string[] | undefined) ?? []).includes(key)}
                                onClick={() => toggleExperienceArray(sport.sportType, 'terrainComfort', key)}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-xs">Certifications</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(CERTIFICATION_LABELS).map(([key, label]) => (
                            <ToggleChip
                              key={key}
                              label={label}
                              isSelected={((exp.certifications as string[] | undefined) ?? []).includes(key)}
                              onClick={() => toggleExperienceArray(sport.sportType, 'certifications', key)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <p className="text-xs text-muted-foreground">
                  All fields are optional — fill in what you can.
                </p>
              </div>
            )}

            {step === 'logistics' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm">Do you have a car?</Label>
                  <RadioGroup
                    options={HAS_CAR_LABELS}
                    value={preferences.hasCar ?? ''}
                    onChange={(v) => updatePref('hasCar', v as UserPreferencesInput['hasCar'])}
                  />
                </div>

                {preferences.hasCar && preferences.hasCar !== 'no' && (
                  <div className="space-y-2">
                    <Label className="text-sm">Willing to carpool / give rides?</Label>
                    <RadioGroup
                      options={WILLING_TO_CARPOOL_LABELS}
                      value={preferences.willingToCarpool ?? ''}
                      onChange={(v) => updatePref('willingToCarpool', v as UserPreferencesInput['willingToCarpool'])}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm">How far will you drive for an activity?</Label>
                  <div className="flex flex-wrap gap-2">
                    {MAX_DRIVE_DISTANCE_OPTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => updatePref('maxDriveDistanceMi', d)}
                        className={`rounded-lg border px-3 py-2 text-xs transition-colors sm:py-1.5 ${
                          preferences.maxDriveDistanceMi === d
                            ? 'border-primary bg-primary/10 text-primary font-medium'
                            : 'border-border hover:border-primary/50 hover:bg-muted'
                        }`}
                      >
                        {d === 100 ? '100+ mi' : `${d} mi`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Preferred group size</Label>
                  <RadioGroup
                    options={PREFERRED_GROUP_SIZE_LABELS}
                    value={preferences.preferredGroupSize ?? ''}
                    onChange={(v) => updatePref('preferredGroupSize', v as UserPreferencesInput['preferredGroupSize'])}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Preferred time of day</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(PREFERRED_TIME_OF_DAY_LABELS).map(([key, label]) => (
                      <ToggleChip
                        key={key}
                        label={label}
                        isSelected={(preferences.preferredTimeOfDay ?? []).includes(key as typeof preferences.preferredTimeOfDay extends (infer T)[] | undefined ? T : never)}
                        onClick={() => togglePrefTimeOfDay(key)}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Availability</Label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={preferences.weekdayAvailability ?? false}
                        onChange={(e) => updatePref('weekdayAvailability', e.target.checked)}
                        className="rounded"
                      />
                      Weekdays
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={preferences.weekendAvailability ?? true}
                        onChange={(e) => updatePref('weekendAvailability', e.target.checked)}
                        className="rounded"
                      />
                      Weekends
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Gear level</Label>
                  <RadioGroup
                    options={GEAR_LEVEL_LABELS}
                    value={preferences.gearLevel ?? ''}
                    onChange={(v) => updatePref('gearLevel', v as UserPreferencesInput['gearLevel'])}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Overnight comfort</Label>
                  <RadioGroup
                    options={OVERNIGHT_COMFORT_LABELS}
                    value={preferences.overnightComfort ?? ''}
                    onChange={(v) => updatePref('overnightComfort', v as UserPreferencesInput['overnightComfort'])}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Fitness level</Label>
                  <RadioGroup
                    options={FITNESS_LEVEL_LABELS}
                    value={preferences.fitnessLevel ?? ''}
                    onChange={(v) => updatePref('fitnessLevel', v as UserPreferencesInput['fitnessLevel'])}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Comfortable hiking with strangers?</Label>
                  <RadioGroup
                    options={COMFORT_WITH_STRANGERS_LABELS}
                    value={preferences.comfortWithStrangers ?? ''}
                    onChange={(v) => updatePref('comfortWithStrangers', v as UserPreferencesInput['comfortWithStrangers'])}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="accessibility" className="text-sm">Accessibility needs (optional)</Label>
                  <Input
                    id="accessibility"
                    value={preferences.accessibilityNotes ?? ''}
                    onChange={(e) => updatePref('accessibilityNotes', e.target.value)}
                    placeholder="Any physical limitations or needs..."
                  />
                </div>
              </div>
            )}

            {step === 'extras' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="language">Preferred language</Label>
                  <select
                    id="language"
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Select language (optional)</option>
                    {PREFERRED_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eduEmail">School email (.edu)</Label>
                  <Input
                    id="eduEmail"
                    type="email"
                    value={eduEmail}
                    onChange={(e) => setEduEmail(e.target.value)}
                    placeholder="you@university.edu (optional)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Verify your school email to get a verified badge
                  </p>
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="flex justify-between gap-4">
            {isFirstStep ? (
              <div />
            ) : (
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}
            {isLastStep ? (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Complete Profile'}
              </Button>
            ) : (
              <Button onClick={handleNext}>
                {step === 'experience' || step === 'logistics' ? 'Continue' : 'Continue'}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
