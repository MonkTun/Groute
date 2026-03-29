import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack, useRouter, useLocalSearchParams } from 'expo-router'
import { WebView } from 'react-native-webview'
import * as Location from 'expo-location'
import Constants from 'expo-constants'

import DateTimePicker from '@react-native-community/datetimepicker'

import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { decode } from 'base64-arraybuffer'
import ConfettiCannon from 'react-native-confetti-cannon'

import { SPORT_LABELS, SKILL_LABELS } from '@groute/shared'
import { useSession } from '../lib/AuthProvider'
import { apiFetch, apiPost, apiUpload } from '../lib/api'

const mapboxToken = Constants.expoConfig?.extra?.mapboxToken as string

const C = {
  bg: '#fafafa',
  card: '#ffffff',
  primary: '#0f8a6e',
  primaryMuted: 'rgba(15,138,110,0.1)',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e5e5',
  inputBorder: '#e0e0e0',
}

function buildLocationPickerHtml(lat: number, lng: number, token: string): string {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link href="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js"></` + `script>
<style>
body{margin:0}
#map{width:100%;height:100vh}
.mapboxgl-ctrl-bottom-left,.mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-attrib{display:none}
.pin{position:absolute;top:50%;left:50%;transform:translate(-50%,-100%);font-size:36px;pointer-events:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));z-index:10}
</style>
</head><body>
<div id="map"></div>
<div class="pin">\u{1F4CD}</div>
<script>
mapboxgl.accessToken='${token}';
var map=new mapboxgl.Map({container:'map',style:'mapbox://styles/mapbox/outdoors-v12',center:[${lng},${lat}],zoom:14});
map.addControl(new mapboxgl.NavigationControl({showCompass:false}),'top-right');
map.on('moveend',function(){var c=map.getCenter();window.ReactNativeWebView.postMessage(JSON.stringify({type:'move',lat:c.lat,lng:c.lng}))});
</` + `script>
</body></html>`
}

export default function CreateActivityScreen() {
  const { user } = useSession()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>()
  const webViewRef = useRef<WebView>(null)

  // Initial center from explore map or fallback
  const initLat = params.lat ? parseFloat(params.lat) : 34.0522
  const initLng = params.lng ? parseFloat(params.lng) : -118.2437

  const [step, setStep] = useState(1)

  // Step 1: Location
  const [locationName, setLocationName] = useState('')
  const [locationLat, setLocationLat] = useState(initLat)
  const [locationLng, setLocationLng] = useState(initLng)
  const [userLat, setUserLat] = useState(initLat)
  const [userLng, setUserLng] = useState(initLng)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ name: string; lat: number; lng: number }>>([])
  const [locationReady, setLocationReady] = useState(false)
  const mapHtmlRef = useRef<string | null>(null)

  // Step 2: Date & Time
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date()
    d.setHours(d.getHours() + 2, 0, 0, 0) // Default: 2 hours from now, rounded
    return d
  })

  // Step 3: Details
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sportType, setSportType] = useState('')
  const [skillLevel, setSkillLevel] = useState('beginner')
  const [maxParticipants, setMaxParticipants] = useState('4')
  const [bannerUri, setBannerUri] = useState<string | null>(null)
  const [bannerAsset, setBannerAsset] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [createdActivityId, setCreatedActivityId] = useState<string | null>(null)
  const [friends, setFriends] = useState<Array<{ id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null }>>([])
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())

  // Fetch friends for invite modal
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data } = await apiFetch<Array<{ id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null }>>('/api/friends')
      setFriends(data ?? [])
    })()
  }, [user])

  // Build map HTML once — use passed coords from explore map, or GPS fallback
  useEffect(() => {
    (async () => {
      let lat = initLat
      let lng = initLng

      // Only use GPS if no coords were passed from explore map
      if (!params.lat) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync()
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
            lat = loc.coords.latitude
            lng = loc.coords.longitude
            setLocationLat(lat)
            setLocationLng(lng)
          }
        } catch {}
      }

      setUserLat(lat)
      setUserLng(lng)
      mapHtmlRef.current = buildLocationPickerHtml(lat, lng, mapboxToken)
      setLocationReady(true)
      // Reverse geocode initial position
      reverseGeocode(lat, lng)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Geocode search — proximity-biased to user location
  async function handleSearch(query: string) {
    setSearchQuery(query)
    if (query.length < 2) { setSearchResults([]); return }

    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=5&types=poi,address,place,locality&proximity=${userLng},${userLat}&country=us`
      )
      const data = await res.json()
      setSearchResults(
        (data.features ?? []).map((f: { place_name: string; text: string; center: [number, number] }) => ({
          name: f.place_name,
          lat: f.center[1],
          lng: f.center[0],
        }))
      )
    } catch {
      setSearchResults([])
    }
  }

  function selectResult(r: { name: string; lat: number; lng: number }) {
    setLocationName(r.name.split(',')[0])
    setLocationLat(r.lat)
    setLocationLng(r.lng)
    setSearchQuery(r.name.split(',')[0])
    setSearchResults([])
    webViewRef.current?.injectJavaScript(
      `map.flyTo({center:[${r.lng},${r.lat}],zoom:15,duration:800});true;`
    )
  }

  const reverseGeoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&limit=1&types=poi,address,place,neighborhood`
      )
      const data = await res.json()
      const feature = data.features?.[0]
      if (feature) {
        const name = feature.text || feature.place_name?.split(',')[0] || ''
        setLocationName(name)
        setSearchQuery(name)
      }
    } catch {}
  }

  function handleMapMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'move') {
        setLocationLat(msg.lat)
        setLocationLng(msg.lng)
        // Debounced reverse geocode
        if (reverseGeoTimeout.current) clearTimeout(reverseGeoTimeout.current)
        reverseGeoTimeout.current = setTimeout(() => reverseGeocode(msg.lat, msg.lng), 500)
      }
    } catch {}
  }

  async function handlePickBanner() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    })
    if (result.canceled || !result.assets[0]) return
    setBannerUri(result.assets[0].uri)
    setBannerAsset(result.assets[0])
  }

  async function handleCreate() {
    if (!title.trim()) return Alert.alert('Error', 'Title is required')
    if (!sportType) return Alert.alert('Error', 'Select an activity type')

    setIsSubmitting(true)
    const scheduledAt = scheduledDate.toISOString()

    const { data, error } = await apiPost<{ id: string }>('/api/activities', {
      title: title.trim(),
      description: description.trim() || null,
      sportType,
      skillLevel,
      visibility: 'public',
      location: { latitude: locationLat, longitude: locationLng },
      locationName: locationName.trim() || 'Dropped Pin',
      maxParticipants: parseInt(maxParticipants, 10) || 4,
      scheduledAt,
    })

    if (error || !data) {
      Alert.alert('Error', error ?? 'Failed to create activity')
      setIsSubmitting(false)
      return
    }

    // Upload banner if selected
    if (bannerAsset) {
      try {
        const ext = bannerAsset.uri.split('.').pop() ?? 'jpg'
        const mimeType = bannerAsset.mimeType ?? 'image/jpeg'
        const formData = new FormData()
        formData.append('file', {
          uri: bannerAsset.uri,
          name: `photo.${ext}`,
          type: mimeType,
        } as unknown as Blob)
        await apiUpload(`/api/activities/${data.id}/photo`, formData)
      } catch {}
    }

    setCreatedActivityId(data.id)

    setIsSubmitting(false)
    setShowConfetti(true)

    // Show invite modal if user has friends, otherwise go back after delay
    if (friends.length > 0) {
      setShowInvite(true)
    } else {
      setTimeout(() => router.back(), 1500)
    }
  }

  async function handleSendInvites() {
    if (!createdActivityId || invitedIds.size === 0) {
      router.back()
      return
    }

    const inviteArray = Array.from(invitedIds)

    // Send invite DMs to each selected friend via API
    await Promise.all(
      inviteArray.map((friendId) =>
        apiPost(`/api/dm/${friendId}`, {
          content: `[invite:${createdActivityId}] ${title}`,
        })
      )
    )

    router.back()
  }

  function toggleInvite(id: string) {
    setInvitedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canGoStep3 = scheduledDate > new Date()

  return (
    <View style={s.container}>
      <Stack.Screen options={{
        headerBackTitle: 'Cancel',
        headerTitle: () => (
          <View style={s.headerTitleWrap}>
            <Text style={s.headerTitleText}>
              {step === 1 ? 'Where?' : step === 2 ? 'When?' : 'Details'}
            </Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${(step / 3) * 100}%` }]} />
            </View>
          </View>
        ),
      }} />

      {/* ── Step 1: Location ── */}
      {step === 1 && (
        <View style={s.flex}>
          {/* Search */}
          <View style={s.searchWrap}>
            <TextInput
              style={s.searchInput}
              placeholder="Search for a place..."
              placeholderTextColor={C.textMuted}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchResults.length > 0 && (
              <View style={s.dropdown}>
                {searchResults.map((r, i) => (
                  <Pressable key={i} style={s.dropdownItem} onPress={() => selectResult(r)}>
                    <Text style={s.dropdownIcon}>{'\u{1F4CD}'}</Text>
                    <Text style={s.dropdownText} numberOfLines={2}>{r.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Map with center pin */}
          <View style={s.flex}>
            {locationReady && (
              <WebView
                ref={webViewRef}
                source={{ html: mapHtmlRef.current! }}
                style={s.map}
                onMessage={handleMapMessage}
                scrollEnabled={false}
                javaScriptEnabled
              />
            )}
          </View>

          {/* Confirm */}
          <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <Pressable style={[s.nextBtn, s.btnFlex]} onPress={() => {
              if (!locationName) setLocationName('Dropped Pin')
              setStep(2)
            }}>
              <Text style={s.nextBtnText}>Next</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Step 2: Date & Time ── */}
      {step === 2 && (
        <View style={s.flex}>
          <ScrollView contentContainerStyle={s.pickerSection}>
            <Text style={s.sectionTitle}>When is your activity?</Text>
            <Text style={s.pickerSummary}>
              {scheduledDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}{' '}
              at {scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>

            <DateTimePicker
              value={scheduledDate}
              mode="datetime"
              display="inline"
              minimumDate={new Date()}
              minuteInterval={5}
              themeVariant="light"
              onChange={(_event, date) => { if (date) setScheduledDate(date) }}
              style={s.picker}
            />
          </ScrollView>

          <View style={[s.bottomBtns, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <Pressable style={s.backBtn} onPress={() => setStep(1)}>
              <Text style={s.backBtnText}>Back</Text>
            </Pressable>
            <Pressable
              style={[s.nextBtn, s.btnFlex, !canGoStep3 && { opacity: 0.4 }]}
              onPress={() => canGoStep3 && setStep(3)}
              disabled={!canGoStep3}
            >
              <Text style={s.nextBtnText}>Next</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Step 3: Details ── */}
      {step === 3 && (
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.detailScroll} keyboardShouldPersistTaps="handled">
            {/* Summary */}
            <View style={s.summaryCard}>
              <Text style={s.summaryLabel}>Location</Text>
              <Text style={s.summaryVal}>{locationName}</Text>
              <Text style={s.summaryLabel}>When</Text>
              <Text style={s.summaryVal}>
                {scheduledDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </Text>
            </View>

            {/* Banner photo */}
            <Text style={s.fieldLabel}>Cover photo (optional)</Text>
            {bannerUri ? (
              <Pressable onPress={handlePickBanner} style={s.bannerPreview}>
                <Image source={{ uri: bannerUri }} style={s.bannerImage} />
                <View style={s.bannerChangeBtn}>
                  <Text style={s.bannerChangeText}>Change</Text>
                </View>
              </Pressable>
            ) : (
              <Pressable style={s.bannerPicker} onPress={handlePickBanner}>
                <Text style={s.bannerPickerEmoji}>{'\u{1F4F7}'}</Text>
                <Text style={s.bannerPickerText}>Add a cover photo</Text>
              </Pressable>
            )}

            <Text style={s.fieldLabel}>Title</Text>
            <TextInput
              style={s.input}
              placeholder="Morning hike at Griffith Park"
              placeholderTextColor={C.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={200}
            />

            <Text style={s.fieldLabel}>Description (optional)</Text>
            <TextInput
              style={[s.input, s.textarea]}
              placeholder="What should people know?"
              placeholderTextColor={C.textMuted}
              value={description}
              onChangeText={setDescription}
              maxLength={2000}
              multiline
            />

            <Text style={s.fieldLabel}>Activity type</Text>
            <View style={s.chips}>
              {Object.entries(SPORT_LABELS).map(([key, label]) => (
                <Pressable key={key} style={[s.chip, sportType === key && s.chipActive]} onPress={() => setSportType(key)}>
                  <Text style={[s.chipText, sportType === key && s.chipTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.fieldLabel}>Skill level</Text>
            <View style={s.chips}>
              {Object.entries(SKILL_LABELS).map(([key, label]) => (
                <Pressable key={key} style={[s.chip, skillLevel === key && s.chipActive]} onPress={() => setSkillLevel(key)}>
                  <Text style={[s.chipText, skillLevel === key && s.chipTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.fieldLabel}>Max participants</Text>
            <View style={s.counterRow}>
              <Pressable style={s.counterBtn} onPress={() => setMaxParticipants(String(Math.max(1, parseInt(maxParticipants) - 1)))}>
                <Text style={s.counterBtnText}>-</Text>
              </Pressable>
              <Text style={s.counterVal}>{maxParticipants}</Text>
              <Pressable style={s.counterBtn} onPress={() => setMaxParticipants(String(Math.min(50, parseInt(maxParticipants) + 1)))}>
                <Text style={s.counterBtnText}>+</Text>
              </Pressable>
            </View>
          </ScrollView>

          <View style={[s.bottomBtns, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <Pressable style={s.backBtn} onPress={() => setStep(2)}>
              <Text style={s.backBtnText}>Back</Text>
            </Pressable>
            <Pressable
              style={[s.createBtn, s.btnFlex, isSubmitting && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={isSubmitting}
            >
              <Text style={s.nextBtnText}>{isSubmitting ? 'Creating...' : 'Create Activity'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Confetti */}
      {showConfetti && (
        <ConfettiCannon count={80} origin={{ x: -10, y: 0 }} fadeOut autoStart />
      )}

      {/* Invite friends modal */}
      <Modal visible={showInvite} transparent animationType="slide">
        <View style={s.inviteBackdrop}>
          <View style={s.inviteSheet}>
            <Text style={s.inviteTitle}>{'\u{1F389}'} Activity Created!</Text>
            <Text style={s.inviteSubtitle}>Invite friends to join</Text>

            <ScrollView style={s.inviteList}>
              {friends.map((f) => {
                const name = f.first_name && f.last_name
                  ? `${f.first_name} ${f.last_name}`
                  : f.display_name
                const isInvited = invitedIds.has(f.id)
                return (
                  <Pressable key={f.id} style={s.inviteRow} onPress={() => toggleInvite(f.id)}>
                    {f.avatar_url ? (
                      <Image source={{ uri: f.avatar_url }} style={s.inviteAvatar} />
                    ) : (
                      <View style={s.inviteAvatarFallback}>
                        <Text style={s.inviteInitial}>{(f.first_name?.[0] ?? f.display_name[0]).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={s.inviteName}>{name}</Text>
                    <View style={[s.inviteCheck, isInvited && s.inviteCheckActive]}>
                      {isInvited && <Text style={s.inviteCheckMark}>{'\u2713'}</Text>}
                    </View>
                  </Pressable>
                )
              })}
            </ScrollView>

            <View style={s.inviteButtons}>
              <Pressable style={s.inviteSkip} onPress={() => router.back()}>
                <Text style={s.inviteSkipText}>Skip</Text>
              </Pressable>
              <Pressable style={[s.inviteSend, invitedIds.size === 0 && { opacity: 0.4 }]} onPress={handleSendInvites}>
                <Text style={s.inviteSendText}>
                  {invitedIds.size > 0 ? `Invite ${invitedIds.size} ${invitedIds.size === 1 ? 'friend' : 'friends'}` : 'Invite'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  // Steps
  headerTitleWrap: { alignItems: 'center', gap: 4, minWidth: 160 },
  headerTitleText: { fontSize: 17, fontWeight: '600', color: C.text },
  progressTrack: { height: 4, backgroundColor: '#f0f0f0', borderRadius: 2, width: '100%' },
  progressFill: { height: 4, backgroundColor: C.primary, borderRadius: 2 },

  // Step 1
  searchWrap: { paddingHorizontal: 14, paddingTop: 24, zIndex: 10 },
  searchInput: { backgroundColor: C.card, borderRadius: 12, padding: 14, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.inputBorder },
  dropdown: { position: 'absolute', top: 58, left: 14, right: 14, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8, zIndex: 20 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  dropdownIcon: { fontSize: 16 },
  dropdownText: { fontSize: 14, color: C.text, flex: 1 },
  map: { flex: 1, backgroundColor: '#e8e0d8' },
  bottomBar: { padding: 14, paddingBottom: 34, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.card },

  // Step 2
  pickerSection: { padding: 20, paddingBottom: 40 },
  picker: { minHeight: 480 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: C.text, marginBottom: 8 },
  pickerSummary: { fontSize: 15, color: C.primary, fontWeight: '500', marginBottom: 16 },


  // Step 3
  detailScroll: { padding: 20, paddingBottom: 20 },
  summaryCard: { backgroundColor: C.primaryMuted, borderRadius: 14, padding: 14, marginBottom: 16 },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryVal: { fontSize: 14, fontWeight: '500', color: C.text, marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: C.card, borderRadius: 12, padding: 14, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.inputBorder },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  chipActive: { backgroundColor: C.primary },
  chipText: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  counterBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  counterBtnText: { fontSize: 20, fontWeight: '600', color: C.text },
  counterVal: { fontSize: 24, fontWeight: '700', color: C.text, minWidth: 40, textAlign: 'center' },

  // Bottom buttons
  bottomBtns: { flexDirection: 'row', gap: 12, padding: 14, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.card },
  backBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  backBtnText: { fontSize: 15, fontWeight: '600', color: C.text },
  nextBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 18, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  btnFlex: { flex: 1 },
  nextBtnText: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  createBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', minHeight: 56 },

  // Banner picker
  bannerPicker: { height: 100, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f8f8', gap: 6 },
  bannerPickerEmoji: { fontSize: 24 },
  bannerPickerText: { fontSize: 13, color: C.textMuted },
  bannerPreview: { height: 140, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  bannerImage: { width: '100%', height: '100%' },
  bannerChangeBtn: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  bannerChangeText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  // Invite modal
  inviteBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  inviteSheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 24, paddingBottom: 34, maxHeight: '70%' },
  inviteTitle: { fontSize: 20, fontWeight: '700', color: C.text, textAlign: 'center' },
  inviteSubtitle: { fontSize: 14, color: C.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  inviteList: { paddingHorizontal: 20 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  inviteAvatar: { width: 40, height: 40, borderRadius: 20 },
  inviteAvatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  inviteInitial: { fontSize: 16, fontWeight: '700', color: C.text },
  inviteName: { flex: 1, fontSize: 15, fontWeight: '500', color: C.text },
  inviteCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  inviteCheckActive: { backgroundColor: C.primary, borderColor: C.primary },
  inviteCheckMark: { fontSize: 14, fontWeight: '700', color: '#fff' },
  inviteButtons: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16 },
  inviteSkip: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' },
  inviteSkipText: { fontSize: 15, fontWeight: '600', color: C.text },
  inviteSend: { flex: 1, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  inviteSendText: { fontSize: 15, fontWeight: '600', color: '#fff' },
})
