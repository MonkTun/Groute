'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  SPORT_LABELS,
  SKILL_LABELS,
  COUNTRIES,
  REGIONS,
  PREFERRED_LANGUAGES,
  type OnboardingProfileInput,
  type UserSportInput,
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

type Step = 'basics' | 'activities' | 'extras'

const STEPS: Step[] = ['basics', 'activities', 'extras']

const STEP_TITLES: Record<Step, string> = {
  basics: 'About You',
  activities: 'Your Activities',
  extras: 'Almost Done',
}

const STEP_DESCRIPTIONS: Record<Step, string> = {
  basics: 'Tell us a bit about yourself',
  activities: 'What do you like to do outdoors?',
  extras: 'Optional details to enhance your profile',
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('basics')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')
  const [sports, setSports] = useState<UserSportInput[]>([])
  const [preferredLanguage, setPreferredLanguage] = useState('')
  const [eduEmail, setEduEmail] = useState('')

  // Validation errors per step
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

  async function handleSubmit() {
    setIsSubmitting(true)
    setError(null)

    const payload: OnboardingProfileInput = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth,
      area: `${region}, ${country}`,
      sports,
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

      router.push('/discover')
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
                      className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8"
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
                      className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8"
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
                        className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8"
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

            {step === 'extras' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="language">Preferred language</Label>
                  <select
                    id="language"
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8"
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
              <Button onClick={handleNext}>Continue</Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
