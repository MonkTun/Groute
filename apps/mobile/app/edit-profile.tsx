import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import DateTimePicker from '@react-native-community/datetimepicker'

import Constants from 'expo-constants'

import {
  SPORT_LABELS,
  SKILL_LABELS,
  COUNTRIES,
  REGIONS,
  PREFERRED_LANGUAGES,
} from '@groute/shared'
import { useSession } from '../lib/AuthProvider'
import { supabase } from '../lib/supabase'
import { apiFetch, apiPatch, apiUpload } from '../lib/api'

const APP_VERSION = Constants.expoConfig?.version ?? '0.3.0'

// ── Design tokens matching web ──
const C = {
  bg: '#fafafa',
  card: '#ffffff',
  cardBorder: '#e5e5e5',
  inputBg: '#ffffff',
  inputBorder: '#e0e0e0',
  primary: '#0f8a6e',
  primaryMuted: 'rgba(15,138,110,0.1)',
  primaryText: '#0f8a6e',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  destructive: '#dc2626',
  border: '#e5e5e5',
  ring: 'rgba(15,138,110,0.3)',
}

interface UserSportEntry {
  sportType: string
  selfReportedLevel: string
}

export default function EditProfileScreen() {
  const { user } = useSession()
  const router = useRouter()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')
  const [preferredLanguage, setPreferredLanguage] = useState('')
  const [eduEmail, setEduEmail] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [sports, setSports] = useState<UserSportEntry[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // Dropdown state
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [showRegionPicker, setShowRegionPicker] = useState(false)
  const [showLanguagePicker, setShowLanguagePicker] = useState(false)

  const fetchProfile = useCallback(async () => {
    if (!user) return

    const { data } = await apiFetch<{
      first_name: string | null
      last_name: string | null
      avatar_url: string | null
      bio: string | null
      area: string | null
      date_of_birth: string | null
      preferred_language: string | null
      edu_email: string | null
      sports: { sport_type: string; self_reported_level: string }[]
    }>('/api/profile')

    if (data) {
      setFirstName(data.first_name ?? '')
      setLastName(data.last_name ?? '')
      setDateOfBirth(data.date_of_birth ? new Date(data.date_of_birth + 'T00:00:00') : null)
      setBio(data.bio ?? '')
      setAvatarUrl(data.avatar_url)
      setPreferredLanguage(data.preferred_language ?? '')
      setEduEmail(data.edu_email ?? '')
      // Parse area: "Region, Country"
      if (data.area) {
        const parts = data.area.split(', ')
        if (parts.length === 2) {
          setRegion(parts[0])
          setCountry(parts[1])
        } else {
          setRegion(data.area)
        }
      }
      setSports((data.sports ?? []).map((s) => ({
        sportType: s.sport_type,
        selfReportedLevel: s.self_reported_level,
      })))
    }
  }, [user])

  useEffect(() => {
    fetchProfile().finally(() => setIsLoading(false))
  }, [fetchProfile])

  async function handlePickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    })
    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    setIsUploadingAvatar(true)

    try {
      const ext = asset.uri.split('.').pop() ?? 'jpg'
      const mimeType = asset.mimeType ?? 'image/jpeg'

      const formData = new FormData()
      formData.append('file', {
        uri: asset.uri,
        name: `avatar.${ext}`,
        type: mimeType,
      } as unknown as Blob)

      const { data, error } = await apiUpload<{ avatarUrl: string }>('/api/avatar', formData)

      if (error) {
        Alert.alert('Error', error)
        setIsUploadingAvatar(false)
        return
      }

      if (data?.avatarUrl) {
        setAvatarUrl(data.avatarUrl)
      }
    } catch {
      Alert.alert('Error', 'Failed to upload photo')
    }
    setIsUploadingAvatar(false)
  }

  function toggleSport(sportType: string) {
    setSports((prev) => {
      const exists = prev.find((s) => s.sportType === sportType)
      if (exists) return prev.filter((s) => s.sportType !== sportType)
      return [...prev, { sportType, selfReportedLevel: 'beginner' }]
    })
  }

  function updateSportLevel(sportType: string, level: string) {
    setSports((prev) =>
      prev.map((s) => s.sportType === sportType ? { ...s, selfReportedLevel: level } : s)
    )
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const area = region && country ? `${region}, ${country}` : region || country

      const { error } = await apiPatch('/api/profile', {
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        dateOfBirth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : null,
        area: area || null,
        bio: bio.trim() || null,
        preferredLanguage: preferredLanguage || null,
        eduEmail: eduEmail.trim() || null,
        sports: sports.map((s) => ({
          sportType: s.sportType,
          selfReportedLevel: s.selfReportedLevel,
        })),
      })

      if (error) {
        Alert.alert('Error', error)
        setIsSaving(false)
        return
      }

      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch {
      Alert.alert('Error', 'Failed to save profile')
    }
    setIsSaving(false)
  }

  if (isLoading) {
    return (
      <View style={s.loadingContainer}>
        <Stack.Screen options={{ title: 'Edit Profile', headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text }} />
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    )
  }

  const regionOptions = country && REGIONS[country] ? REGIONS[country] : null

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.text,
          headerRight: () => (
            <Pressable onPress={handleSave} disabled={isSaving} style={{ opacity: isSaving ? 0.5 : 1 }}>
              <Text style={{ color: C.primary, fontSize: 16, fontWeight: '600' }}>
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Avatar */}
        <Pressable style={s.avatarWrapper} onPress={handlePickAvatar} disabled={isUploadingAvatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatar} />
          ) : (
            <View style={s.avatarFallback}>
              <Text style={s.avatarInitial}>
                {(firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}
          {isUploadingAvatar ? (
            <View style={s.avatarOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <View style={s.avatarEditBadge}>
              <Text style={s.avatarEditText}>Edit</Text>
            </View>
          )}
        </Pressable>
        <Text style={s.avatarHint}>Tap to change photo</Text>

        {/* ── Card: Personal Info ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Personal Info</Text>

          <View style={s.row}>
            <View style={s.field}>
              <Text style={s.label}>First name</Text>
              <TextInput style={s.input} value={firstName} onChangeText={setFirstName} placeholderTextColor={C.textMuted} placeholder="First" />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Last name</Text>
              <TextInput style={s.input} value={lastName} onChangeText={setLastName} placeholderTextColor={C.textMuted} placeholder="Last" />
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
              <Text style={s.selectChevron}>{showDatePicker ? '\u25B2' : '\u25BC'}</Text>
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
                <Text style={country ? s.selectText : s.selectPlaceholder}>
                  {country || 'Select country'}
                </Text>
                <Text style={s.selectChevron}>{showCountryPicker ? '\u25B2' : '\u25BC'}</Text>
              </Pressable>
              {showCountryPicker && (
                <ScrollView style={s.dropdown} nestedScrollEnabled>
                  {COUNTRIES.map((c) => (
                    <Pressable
                      key={c}
                      style={[s.dropdownItem, country === c && s.dropdownItemActive]}
                      onPress={() => { setCountry(c); setRegion(''); setShowCountryPicker(false) }}
                    >
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
                    <Text style={region ? s.selectText : s.selectPlaceholder}>
                      {region || 'Select'}
                    </Text>
                    <Text style={s.selectChevron}>{showRegionPicker ? '\u25B2' : '\u25BC'}</Text>
                  </Pressable>
                  {showRegionPicker && (
                    <ScrollView style={s.dropdown} nestedScrollEnabled>
                      {regionOptions.map((r) => (
                        <Pressable
                          key={r}
                          style={[s.dropdownItem, region === r && s.dropdownItemActive]}
                          onPress={() => { setRegion(r); setShowRegionPicker(false) }}
                        >
                          <Text style={[s.dropdownText, region === r && s.dropdownTextActive]}>{r}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </>
              ) : (
                <TextInput
                  style={s.input}
                  value={region}
                  onChangeText={setRegion}
                  placeholderTextColor={C.textMuted}
                  placeholder={country ? 'Enter region' : 'Select country first'}
                  editable={!!country}
                />
              )}
            </View>
          </View>

          <View style={s.fieldFull}>
            <Text style={s.label}>Preferred language</Text>
            <Pressable style={s.select} onPress={() => setShowLanguagePicker(!showLanguagePicker)}>
              <Text style={preferredLanguage ? s.selectText : s.selectPlaceholder}>
                {preferredLanguage || 'None'}
              </Text>
              <Text style={s.selectChevron}>{showLanguagePicker ? '\u25B2' : '\u25BC'}</Text>
            </Pressable>
            {showLanguagePicker && (
              <ScrollView style={s.dropdownSmall} nestedScrollEnabled>
                <Pressable
                  style={[s.dropdownItem, !preferredLanguage && s.dropdownItemActive]}
                  onPress={() => { setPreferredLanguage(''); setShowLanguagePicker(false) }}
                >
                  <Text style={[s.dropdownText, !preferredLanguage && s.dropdownTextActive]}>None</Text>
                </Pressable>
                {PREFERRED_LANGUAGES.map((l) => (
                  <Pressable
                    key={l}
                    style={[s.dropdownItem, preferredLanguage === l && s.dropdownItemActive]}
                    onPress={() => { setPreferredLanguage(l); setShowLanguagePicker(false) }}
                  >
                    <Text style={[s.dropdownText, preferredLanguage === l && s.dropdownTextActive]}>{l}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={s.fieldFull}>
            <Text style={s.label}>School email (.edu)</Text>
            <TextInput
              style={s.input}
              value={eduEmail}
              onChangeText={setEduEmail}
              placeholderTextColor={C.textMuted}
              placeholder="you@university.edu"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={s.fieldFull}>
            <Text style={s.label}>Bio</Text>
            <TextInput
              style={[s.input, s.textarea]}
              value={bio}
              onChangeText={setBio}
              placeholderTextColor={C.textMuted}
              placeholder="Tell us about yourself..."
              multiline
              numberOfLines={3}
              maxLength={300}
            />
          </View>
        </View>

        {/* ── Card: Activities & Experience ── */}
        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitle}>Activities & Experience</Text>
            <Text style={s.cardSubtitle}>{sports.length} selected</Text>
          </View>

          <View style={s.sportGrid}>
            {Object.entries(SPORT_LABELS).map(([key, label]) => {
              const isSelected = sports.some((sp) => sp.sportType === key)
              return (
                <Pressable
                  key={key}
                  style={[s.sportButton, isSelected && s.sportButtonActive]}
                  onPress={() => toggleSport(key)}
                >
                  <Text style={[s.sportButtonText, isSelected && s.sportButtonTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {sports.length > 0 && (
            <View style={s.levelSection}>
              <Text style={s.levelTitle}>Experience level:</Text>
              {sports.map((sport) => (
                <View key={sport.sportType} style={s.levelRow}>
                  <Text style={s.levelSportName}>{SPORT_LABELS[sport.sportType]}</Text>
                  <View style={s.levelButtons}>
                    {Object.entries(SKILL_LABELS).map(([level, label]) => (
                      <Pressable
                        key={level}
                        style={[s.levelButton, sport.selfReportedLevel === level && s.levelButtonActive]}
                        onPress={() => updateSportLevel(sport.sportType, level)}
                      >
                        <Text style={[s.levelButtonText, sport.selfReportedLevel === level && s.levelButtonTextActive]}>
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Restart Onboarding */}
        <Pressable
          style={s.restartBtn}
          onPress={() => {
            Alert.alert(
              'Restart Onboarding',
              'This will take you through the onboarding flow to update your experience and preferences.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Restart',
                  onPress: async () => {
                    await apiPatch('/api/profile', { resetOnboarding: true })
                    router.replace('/onboarding')
                  },
                },
              ]
            )
          }}
        >
          <Text style={s.restartText}>Restart Onboarding</Text>
        </Pressable>

        {/* Sign out */}
        <Pressable style={s.signOutBtn} onPress={async () => { await supabase.auth.signOut(); router.replace('/') }}>
          <Text style={s.signOutText}>Sign out</Text>
        </Pressable>

        {/* Version */}
        <Text style={s.versionText}>Groute v{APP_VERSION}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loadingContainer: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 60 },

  // Avatar
  avatarWrapper: { alignSelf: 'center', marginBottom: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: C.cardBorder },
  avatarFallback: { width: 88, height: 88, borderRadius: 44, backgroundColor: C.primaryMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.cardBorder },
  avatarInitial: { fontSize: 32, fontWeight: '700', color: C.primaryText },
  avatarOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 44, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: -4, backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  avatarEditText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  avatarHint: { textAlign: 'center', fontSize: 12, color: C.textMuted, marginBottom: 20 },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 16 },
  cardSubtitle: { fontSize: 12, color: C.textSecondary },

  // Form fields
  row: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  field: { flex: 1 },
  fieldFull: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '500', color: C.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: C.text,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },

  // Select / Dropdown
  select: {
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: { fontSize: 15, color: C.text },
  selectPlaceholder: { fontSize: 15, color: C.textMuted },
  selectChevron: { fontSize: 10, color: C.textMuted },
  dropdown: {
    maxHeight: 200,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownSmall: {
    maxHeight: 160,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  dropdownItemActive: { backgroundColor: C.primaryMuted },
  dropdownText: { fontSize: 14, color: C.text },
  dropdownTextActive: { color: C.primaryText, fontWeight: '600' },

  // Sports
  sportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sportButton: {
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sportButtonActive: {
    borderColor: C.primary,
    backgroundColor: C.primaryMuted,
  },
  sportButtonText: { fontSize: 14, color: C.textSecondary },
  sportButtonTextActive: { color: C.primaryText, fontWeight: '600' },

  // Skill levels
  levelSection: { marginTop: 20 },
  levelTitle: { fontSize: 14, fontWeight: '500', color: C.textSecondary, marginBottom: 12 },
  levelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  levelSportName: { fontSize: 14, fontWeight: '500', color: C.text },
  levelButtons: { flexDirection: 'row', gap: 4 },
  levelButton: {
    backgroundColor: C.inputBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  levelButtonActive: { backgroundColor: C.primary },
  levelButtonText: { fontSize: 12, color: C.textSecondary },
  levelButtonTextActive: { color: '#fff', fontWeight: '600' },

  // Restart onboarding
  restartBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 24, borderWidth: 1, borderColor: C.border, borderRadius: 12 },
  restartText: { fontSize: 15, fontWeight: '500', color: C.textSecondary },

  // Sign out
  signOutBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 16 },
  signOutText: { fontSize: 15, fontWeight: '500', color: '#dc2626' },
  versionText: { textAlign: 'center', fontSize: 12, color: C.textMuted, marginTop: 16 },
})
