import { useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import DateTimePicker from '@react-native-community/datetimepicker'

import {
  SPORT_LABELS,
  SKILL_LABELS,
  COUNTRIES,
  REGIONS,
  PREFERRED_LANGUAGES,
  TERRAIN_COMFORT_LABELS,
  CERTIFICATION_LABELS,
  HAS_CAR_LABELS,
  WILLING_TO_CARPOOL_LABELS,
  MAX_DRIVE_DISTANCE_OPTIONS,
  PREFERRED_GROUP_SIZE_LABELS,
  PREFERRED_TIME_OF_DAY_LABELS,
  GEAR_LEVEL_LABELS,
  OVERNIGHT_COMFORT_LABELS,
  FITNESS_LEVEL_LABELS,
  COMFORT_WITH_STRANGERS_LABELS,
} from '@groute/shared'

import { apiPost } from '../lib/api'

const C = {
  bg: '#fafafa',
  card: '#ffffff',
  cardBorder: '#e5e5e5',
  primary: '#0f8a6e',
  primaryMuted: 'rgba(15,138,110,0.1)',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e5e5',
  destructive: '#dc2626',
}

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

interface SportEntry { sportType: string; selfReportedLevel: string }
interface ExperienceEntry {
  highestAltitudeFt?: number
  longestDistanceMi?: number
  tripsLast12Months?: number
  yearsExperience?: number
  certifications: string[]
  terrainComfort: string[]
  waterComfort?: string
}
interface Prefs {
  hasCar?: string
  willingToCarpool?: string
  maxDriveDistanceMi?: number
  preferredGroupSize?: string
  preferredTimeOfDay: string[]
  weekdayAvailability: boolean
  weekendAvailability: boolean
  gearLevel?: string
  overnightComfort?: string
  fitnessLevel?: string
  comfortWithStrangers?: string
  accessibilityNotes?: string
}

function Chip({ label, isSelected, onPress }: { label: string; isSelected: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[s.chip, isSelected && s.chipActive]}
      onPress={onPress}
    >
      <Text style={[s.chipText, isSelected && s.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

export default function OnboardingScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState<Step>('basics')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Basics
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [showRegionPicker, setShowRegionPicker] = useState(false)

  // Activities
  const [sports, setSports] = useState<SportEntry[]>([])

  // Experience
  const [experience, setExperience] = useState<Record<string, ExperienceEntry>>({})

  // Logistics
  const [prefs, setPrefs] = useState<Prefs>({
    preferredTimeOfDay: [],
    weekdayAvailability: false,
    weekendAvailability: true,
  })

  // Extras
  const [preferredLanguage, setPreferredLanguage] = useState('')
  const [eduEmail, setEduEmail] = useState('')
  const [showLanguagePicker, setShowLanguagePicker] = useState(false)

  const currentIndex = STEPS.indexOf(step)

  function goNext() {
    if (step === 'basics') {
      if (!firstName.trim() || !lastName.trim()) {
        Alert.alert('Required', 'First and last name are required.'); return
      }
      if (!dateOfBirth) { Alert.alert('Required', 'Date of birth is required. Tap to select.'); return }
      const age = new Date().getFullYear() - dateOfBirth.getFullYear()
      if (age < 18) { Alert.alert('Invalid', 'You must be at least 18 years old.'); return }
      if (age > 100) { Alert.alert('Invalid', 'Please enter a valid date of birth.'); return }
      if (!country || !region) { Alert.alert('Required', 'Country and region are required.'); return }
    }
    if (step === 'activities' && sports.length === 0) {
      Alert.alert('Required', 'Select at least one activity.'); return
    }
    const next = STEPS[currentIndex + 1]
    if (next) setStep(next)
  }

  function goBack() {
    const prev = STEPS[currentIndex - 1]
    if (prev) setStep(prev)
  }

  function toggleSport(key: string) {
    setSports((prev) => {
      if (prev.some((sp) => sp.sportType === key)) return prev.filter((sp) => sp.sportType !== key)
      return [...prev, { sportType: key, selfReportedLevel: 'beginner' }]
    })
  }

  function setSportLevel(key: string, level: string) {
    setSports((prev) => prev.map((sp) => sp.sportType === key ? { ...sp, selfReportedLevel: level } : sp))
  }

  function getExp(sport: string): ExperienceEntry {
    return experience[sport] ?? { certifications: [], terrainComfort: [] }
  }

  function updateExp(sport: string, field: string, value: unknown) {
    setExperience((prev) => ({ ...prev, [sport]: { ...getExp(sport), [field]: value } }))
  }

  function toggleExpArray(sport: string, field: 'certifications' | 'terrainComfort', val: string) {
    const cur = (getExp(sport)[field] as string[]) ?? []
    const next = cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val]
    updateExp(sport, field, next)
  }

  function updatePref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs((prev) => ({ ...prev, [key]: value }))
  }

  function toggleTimeOfDay(val: string) {
    setPrefs((prev) => {
      const cur = prev.preferredTimeOfDay
      return { ...prev, preferredTimeOfDay: cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val] }
    })
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    const expData = sports.map((sp) => ({
      sportType: sp.sportType,
      ...getExp(sp.sportType),
    }))

    const dobString = dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : ''

    const res = await apiPost<{ success: boolean }>('/api/profile', {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: dobString,
      area: `${region}, ${country}`,
      sports,
      experience: expData,
      preferences: prefs,
      preferredLanguage: preferredLanguage || undefined,
      eduEmail: eduEmail.trim() || undefined,
    })

    setIsSubmitting(false)
    if (res.error) {
      Alert.alert('Error', res.error)
      return
    }
    router.replace('/(tabs)')
  }

  const regionOptions = country && REGIONS[country] ? REGIONS[country] : null

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ title: STEP_TITLES[step], headerBackTitle: 'Back' }} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>{STEP_TITLES[step]}</Text>
      </View>

      {/* Progress */}
      <View style={s.progressRow}>
        {STEPS.map((_, i) => (
          <View key={i} style={[s.progressDot, i <= currentIndex && s.progressDotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.stepDescription}>{STEP_DESCRIPTIONS[step]}</Text>

        {/* ── BASICS ── */}
        {step === 'basics' && (
          <View style={s.card}>
            <View style={s.row}>
              <View style={s.field}>
                <Text style={s.label}>First name</Text>
                <TextInput style={s.input} value={firstName} onChangeText={setFirstName} placeholder="Jane" placeholderTextColor={C.textMuted} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Last name</Text>
                <TextInput style={s.input} value={lastName} onChangeText={setLastName} placeholder="Doe" placeholderTextColor={C.textMuted} />
              </View>
            </View>

            <View style={s.fieldFull}>
              <Text style={s.label}>Date of birth</Text>
              <Pressable style={s.select} onPress={() => setShowDatePicker(!showDatePicker)}>
                <Text style={dateOfBirth ? s.selectText : s.selectPlaceholder}>
                  {dateOfBirth
                    ? dateOfBirth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : 'Select date of birth'}
                </Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={dateOfBirth ?? new Date(2000, 0, 1)}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date(new Date().getFullYear() - 18, new Date().getMonth(), new Date().getDate())}
                  minimumDate={new Date(1920, 0, 1)}
                  themeVariant="light"
                  onChange={(_event, date) => {
                    if (date) setDateOfBirth(date)
                  }}
                />
              )}
            </View>

            <View style={s.row}>
              <View style={s.field}>
                <Text style={s.label}>Country</Text>
                <Pressable style={s.select} onPress={() => setShowCountryPicker(!showCountryPicker)}>
                  <Text style={country ? s.selectText : s.selectPlaceholder}>{country || 'Select'}</Text>
                </Pressable>
                {showCountryPicker && (
                  <ScrollView style={s.dropdown} nestedScrollEnabled>
                    {COUNTRIES.map((c) => (
                      <Pressable key={c} style={s.dropdownItem} onPress={() => { setCountry(c); setRegion(''); setShowCountryPicker(false) }}>
                        <Text style={[s.dropdownText, country === c && s.dropdownTextActive]}>{c}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
              <View style={s.field}>
                <Text style={s.label}>State / Province</Text>
                {regionOptions ? (
                  <>
                    <Pressable style={s.select} onPress={() => setShowRegionPicker(!showRegionPicker)}>
                      <Text style={region ? s.selectText : s.selectPlaceholder}>{region || 'Select'}</Text>
                    </Pressable>
                    {showRegionPicker && (
                      <ScrollView style={s.dropdown} nestedScrollEnabled>
                        {regionOptions.map((r) => (
                          <Pressable key={r} style={s.dropdownItem} onPress={() => { setRegion(r); setShowRegionPicker(false) }}>
                            <Text style={[s.dropdownText, region === r && s.dropdownTextActive]}>{r}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}
                  </>
                ) : (
                  <TextInput style={s.input} value={region} onChangeText={setRegion} placeholder={country ? 'Enter region' : 'Select country first'} placeholderTextColor={C.textMuted} editable={!!country} />
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── ACTIVITIES ── */}
        {step === 'activities' && (
          <View style={s.card}>
            <View style={s.chipGrid}>
              {Object.entries(SPORT_LABELS).map(([key, label]) => (
                <Chip key={key} label={label} isSelected={sports.some((sp) => sp.sportType === key)} onPress={() => toggleSport(key)} />
              ))}
            </View>

            {sports.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <Text style={s.subLabel}>Set your experience level:</Text>
                {sports.map((sp) => (
                  <View key={sp.sportType} style={s.levelRow}>
                    <Text style={s.levelName}>{SPORT_LABELS[sp.sportType]}</Text>
                    <View style={s.levelBtns}>
                      {Object.entries(SKILL_LABELS).map(([lv, lb]) => (
                        <Pressable key={lv} style={[s.levelBtn, sp.selfReportedLevel === lv && s.levelBtnActive]} onPress={() => setSportLevel(sp.sportType, lv)}>
                          <Text style={[s.levelBtnText, sp.selfReportedLevel === lv && s.levelBtnTextActive]}>{lb}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── EXPERIENCE ── */}
        {step === 'experience' && (
          <View style={s.card}>
            {sports.map((sp) => {
              const exp = getExp(sp.sportType)
              const isHiking = sp.sportType === 'hiking'
              return (
                <View key={sp.sportType} style={s.sportSection}>
                  <Text style={s.sportSectionTitle}>{SPORT_LABELS[sp.sportType]}</Text>

                  <View style={s.row}>
                    {isHiking && (
                      <View style={s.field}>
                        <Text style={s.label}>Highest altitude (ft)</Text>
                        <TextInput style={s.input} value={exp.highestAltitudeFt?.toString() ?? ''} onChangeText={(v) => updateExp(sp.sportType, 'highestAltitudeFt', v ? Number(v) : undefined)} placeholder="e.g. 14000" placeholderTextColor={C.textMuted} keyboardType="number-pad" />
                      </View>
                    )}
                    <View style={s.field}>
                      <Text style={s.label}>Longest distance (mi)</Text>
                      <TextInput style={s.input} value={exp.longestDistanceMi?.toString() ?? ''} onChangeText={(v) => updateExp(sp.sportType, 'longestDistanceMi', v ? Number(v) : undefined)} placeholder="e.g. 15" placeholderTextColor={C.textMuted} keyboardType="number-pad" />
                    </View>
                  </View>

                  <View style={s.row}>
                    <View style={s.field}>
                      <Text style={s.label}>Trips (last 12 months)</Text>
                      <TextInput style={s.input} value={exp.tripsLast12Months?.toString() ?? ''} onChangeText={(v) => updateExp(sp.sportType, 'tripsLast12Months', v ? Number(v) : undefined)} placeholder="e.g. 20" placeholderTextColor={C.textMuted} keyboardType="number-pad" />
                    </View>
                    <View style={s.field}>
                      <Text style={s.label}>Years of experience</Text>
                      <TextInput style={s.input} value={exp.yearsExperience?.toString() ?? ''} onChangeText={(v) => updateExp(sp.sportType, 'yearsExperience', v ? Number(v) : undefined)} placeholder="e.g. 3" placeholderTextColor={C.textMuted} keyboardType="number-pad" />
                    </View>
                  </View>

                  {isHiking && (
                    <>
                      <Text style={s.subLabel}>Terrain comfort</Text>
                      <View style={s.chipGrid}>
                        {Object.entries(TERRAIN_COMFORT_LABELS).map(([k, lb]) => (
                          <Chip key={k} label={lb} isSelected={exp.terrainComfort.includes(k)} onPress={() => toggleExpArray(sp.sportType, 'terrainComfort', k)} />
                        ))}
                      </View>
                    </>
                  )}

                  <Text style={[s.subLabel, { marginTop: 14 }]}>Certifications</Text>
                  <View style={s.chipGrid}>
                    {Object.entries(CERTIFICATION_LABELS).map(([k, lb]) => (
                      <Chip key={k} label={lb} isSelected={exp.certifications.includes(k)} onPress={() => toggleExpArray(sp.sportType, 'certifications', k)} />
                    ))}
                  </View>
                </View>
              )
            })}
            <Text style={s.hint}>All fields are optional.</Text>
          </View>
        )}

        {/* ── LOGISTICS ── */}
        {step === 'logistics' && (
          <View style={s.card}>
            <Text style={s.subLabel}>Do you have a car?</Text>
            <View style={s.chipGrid}>
              {Object.entries(HAS_CAR_LABELS).map(([k, lb]) => (
                <Chip key={k} label={lb} isSelected={prefs.hasCar === k} onPress={() => updatePref('hasCar', k)} />
              ))}
            </View>

            {prefs.hasCar && prefs.hasCar !== 'no' && (
              <>
                <Text style={s.subLabel}>Willing to carpool / give rides?</Text>
                <View style={s.chipGrid}>
                  {Object.entries(WILLING_TO_CARPOOL_LABELS).map(([k, lb]) => (
                    <Chip key={k} label={lb} isSelected={prefs.willingToCarpool === k} onPress={() => updatePref('willingToCarpool', k)} />
                  ))}
                </View>
              </>
            )}

            <Text style={s.subLabel}>Max drive distance</Text>
            <View style={s.chipGrid}>
              {MAX_DRIVE_DISTANCE_OPTIONS.map((d) => (
                <Chip key={d} label={d === 100 ? '100+ mi' : `${d} mi`} isSelected={prefs.maxDriveDistanceMi === d} onPress={() => updatePref('maxDriveDistanceMi', d)} />
              ))}
            </View>

            <Text style={s.subLabel}>Preferred group size</Text>
            <View style={s.chipGrid}>
              {Object.entries(PREFERRED_GROUP_SIZE_LABELS).map(([k, lb]) => (
                <Chip key={k} label={lb} isSelected={prefs.preferredGroupSize === k} onPress={() => updatePref('preferredGroupSize', k)} />
              ))}
            </View>

            <Text style={s.subLabel}>Preferred time of day</Text>
            <View style={s.chipGrid}>
              {Object.entries(PREFERRED_TIME_OF_DAY_LABELS).map(([k, lb]) => (
                <Chip key={k} label={lb} isSelected={prefs.preferredTimeOfDay.includes(k)} onPress={() => toggleTimeOfDay(k)} />
              ))}
            </View>

            <Text style={s.subLabel}>Availability</Text>
            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} onPress={() => updatePref('weekdayAvailability', !prefs.weekdayAvailability)}>
                <View style={[s.checkbox, prefs.weekdayAvailability && s.checkboxActive]} />
                <Text style={s.checkboxLabel}>Weekdays</Text>
              </Pressable>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} onPress={() => updatePref('weekendAvailability', !prefs.weekendAvailability)}>
                <View style={[s.checkbox, prefs.weekendAvailability && s.checkboxActive]} />
                <Text style={s.checkboxLabel}>Weekends</Text>
              </Pressable>
            </View>

            <Text style={s.subLabel}>Gear level</Text>
            <View style={s.chipGrid}>
              {Object.entries(GEAR_LEVEL_LABELS).map(([k, lb]) => (
                <Chip key={k} label={lb} isSelected={prefs.gearLevel === k} onPress={() => updatePref('gearLevel', k)} />
              ))}
            </View>

            <Text style={s.subLabel}>Overnight comfort</Text>
            <View style={s.chipGrid}>
              {Object.entries(OVERNIGHT_COMFORT_LABELS).map(([k, lb]) => (
                <Chip key={k} label={lb} isSelected={prefs.overnightComfort === k} onPress={() => updatePref('overnightComfort', k)} />
              ))}
            </View>

            <Text style={s.subLabel}>Fitness level</Text>
            <View style={s.chipGrid}>
              {Object.entries(FITNESS_LEVEL_LABELS).map(([k, lb]) => (
                <Chip key={k} label={lb} isSelected={prefs.fitnessLevel === k} onPress={() => updatePref('fitnessLevel', k)} />
              ))}
            </View>

            <Text style={s.subLabel}>Comfortable with strangers?</Text>
            <View style={s.chipGrid}>
              {Object.entries(COMFORT_WITH_STRANGERS_LABELS).map(([k, lb]) => (
                <Chip key={k} label={lb} isSelected={prefs.comfortWithStrangers === k} onPress={() => updatePref('comfortWithStrangers', k)} />
              ))}
            </View>

            <Text style={s.subLabel}>Accessibility needs (optional)</Text>
            <TextInput style={s.input} value={prefs.accessibilityNotes ?? ''} onChangeText={(v) => updatePref('accessibilityNotes', v)} placeholder="Any physical limitations..." placeholderTextColor={C.textMuted} />
          </View>
        )}

        {/* ── EXTRAS ── */}
        {step === 'extras' && (
          <View style={s.card}>
            <View style={s.fieldFull}>
              <Text style={s.label}>Preferred language</Text>
              <Pressable style={s.select} onPress={() => setShowLanguagePicker(!showLanguagePicker)}>
                <Text style={preferredLanguage ? s.selectText : s.selectPlaceholder}>{preferredLanguage || 'Select (optional)'}</Text>
              </Pressable>
              {showLanguagePicker && (
                <ScrollView style={s.dropdownSmall} nestedScrollEnabled>
                  <Pressable style={s.dropdownItem} onPress={() => { setPreferredLanguage(''); setShowLanguagePicker(false) }}>
                    <Text style={s.dropdownText}>None</Text>
                  </Pressable>
                  {PREFERRED_LANGUAGES.map((l) => (
                    <Pressable key={l} style={s.dropdownItem} onPress={() => { setPreferredLanguage(l); setShowLanguagePicker(false) }}>
                      <Text style={[s.dropdownText, preferredLanguage === l && s.dropdownTextActive]}>{l}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={s.fieldFull}>
              <Text style={s.label}>School email (.edu)</Text>
              <TextInput style={s.input} value={eduEmail} onChangeText={setEduEmail} placeholder="you@university.edu (optional)" placeholderTextColor={C.textMuted} keyboardType="email-address" autoCapitalize="none" />
              <Text style={s.hint}>Verify your school email to get a verified badge</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom nav */}
      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {currentIndex > 0 ? (
          <Pressable style={s.backBtn} onPress={goBack}>
            <Text style={s.backBtnText}>Back</Text>
          </Pressable>
        ) : <View />}

        {currentIndex < STEPS.length - 1 ? (
          <Pressable style={s.nextBtn} onPress={goNext}>
            <Text style={s.nextBtnText}>Continue</Text>
          </Pressable>
        ) : (
          <Pressable style={[s.nextBtn, isSubmitting && { opacity: 0.5 }]} onPress={handleSubmit} disabled={isSubmitting}>
            <Text style={s.nextBtnText}>{isSubmitting ? 'Saving...' : 'Complete Profile'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 100 },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: C.text },

  // Progress
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#e5e5e5' },
  progressDotActive: { backgroundColor: C.primary },

  stepDescription: { fontSize: 14, color: C.textSecondary, marginBottom: 16 },

  // Card
  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.cardBorder, padding: 16, marginBottom: 16 },

  // Form
  row: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  field: { flex: 1 },
  fieldFull: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '500', color: C.textSecondary, marginBottom: 6 },
  subLabel: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: C.text },

  // Select / Dropdown
  select: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between' },
  selectText: { fontSize: 15, color: C.text },
  selectPlaceholder: { fontSize: 15, color: C.textMuted },
  dropdown: { maxHeight: 200, backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder, borderRadius: 12, marginTop: 6, overflow: 'hidden' },
  dropdownSmall: { maxHeight: 160, backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder, borderRadius: 12, marginTop: 6, overflow: 'hidden' },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' },
  dropdownText: { fontSize: 14, color: C.text },
  dropdownTextActive: { color: C.primary, fontWeight: '600' },

  // Chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { borderColor: C.primary, backgroundColor: C.primaryMuted },
  chipText: { fontSize: 13, color: C.textSecondary },
  chipTextActive: { color: C.primary, fontWeight: '600' },

  // Skill levels
  levelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  levelName: { fontSize: 14, fontWeight: '500', color: C.text },
  levelBtns: { flexDirection: 'row', gap: 4 },
  levelBtn: { backgroundColor: '#f0f0f0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  levelBtnActive: { backgroundColor: C.primary },
  levelBtnText: { fontSize: 12, color: C.textSecondary },
  levelBtnTextActive: { color: '#fff', fontWeight: '600' },

  // Sport sections (experience)
  sportSection: { marginBottom: 24 },
  sportSectionTitle: { fontSize: 15, fontWeight: '700', color: C.primary, marginBottom: 12 },

  // Checkbox
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#d0d0d0' },
  checkboxActive: { backgroundColor: C.primary, borderColor: C.primary },
  checkboxLabel: { fontSize: 14, color: C.text },

  hint: { fontSize: 12, color: C.textMuted, marginTop: 6 },

  // Bottom bar
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  backBtn: { paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1, borderColor: C.border, borderRadius: 12 },
  backBtnText: { fontSize: 15, fontWeight: '500', color: C.text },
  nextBtn: { backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  nextBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
})
