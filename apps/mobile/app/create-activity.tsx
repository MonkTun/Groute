import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
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
import ConfettiCannon from 'react-native-confetti-cannon'

import { SPORT_LABELS, SKILL_LABELS, SAC_SCALE_LABELS, SURFACE_LABELS } from '@groute/shared'
import type { Trail } from '@groute/shared'
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
  trail: '#16a34a',
  approach: '#f97316',
}

const TOTAL_STEPS = 4

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`
  const miles = meters / 1609.344
  return `${miles.toFixed(1)} mi`
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

function buildTrailPickerMapHtml(
  token: string,
  locLat: number,
  locLng: number,
  trails: Trail[],
  selectedOsmId: number | null,
): string {
  const features = trails.map((t) => ({
    type: 'Feature',
    properties: { osmId: t.osmId, name: t.name },
    geometry: {
      type: 'LineString',
      coordinates: t.coordinates.map(([lat, lng]: [number, number]) => [lng, lat]),
    },
  }))
  const geojson = JSON.stringify({ type: 'FeatureCollection', features })

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link href="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js"></` + `script>
<style>body{margin:0}#map{width:100%;height:100vh}.mapboxgl-ctrl-bottom-left,.mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-attrib{display:none}</style>
</head><body>
<div id="map"></div>
<script>
mapboxgl.accessToken='${token}';
var map=new mapboxgl.Map({container:'map',style:'mapbox://styles/mapbox/outdoors-v12',center:[${locLng},${locLat}],zoom:13});
map.addControl(new mapboxgl.NavigationControl({showCompass:false}),'top-right');

new mapboxgl.Marker({color:'#1a1a1a',scale:0.7}).setLngLat([${locLng},${locLat}]).addTo(map);

var selectedId=${selectedOsmId ?? 'null'};
var mapReady=false;

map.on('load',function(){
  map.addSource('trails',{type:'geojson',data:${geojson}});
  map.addLayer({id:'trails-default',type:'line',source:'trails',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#94a3b8','line-width':3.5,'line-opacity':0.7}});
  map.addLayer({id:'trails-selected',type:'line',source:'trails',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#16a34a','line-width':5,'line-opacity':1},filter:['==',['get','osmId'],selectedId||-1]});

  // Approach route layer (empty until RN injects coordinates)
  map.addSource('approach',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[]}}});
  map.addLayer({id:'approach-line',type:'line',source:'approach',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#f97316','line-width':3,'line-opacity':0.8,'line-dasharray':[2,2]}});

  var bounds=new mapboxgl.LngLatBounds();
  bounds.extend([${locLng},${locLat}]);
  var fc=${geojson};
  if(fc.features.length){fc.features.forEach(function(f){f.geometry.coordinates.forEach(function(c){bounds.extend(c)})})}
  map.fitBounds(bounds,{padding:40,maxZoom:15,duration:0});

  map.on('click','trails-default',function(e){
    var f=e.features&&e.features[0];
    if(f){window.ReactNativeWebView.postMessage(JSON.stringify({type:'selectTrail',osmId:f.properties.osmId}))}
  });
  map.on('click','trails-selected',function(e){
    var f=e.features&&e.features[0];
    if(f){window.ReactNativeWebView.postMessage(JSON.stringify({type:'deselectTrail'}))}
  });
  mapReady=true;
});

// Called from RN to update trail selection highlight
window.updateSelection=function(osmId){
  if(!mapReady)return;
  selectedId=osmId;
  map.setFilter('trails-selected',['==',['get','osmId'],osmId||-1]);
  map.setPaintProperty('trails-default','line-opacity',osmId?0.3:0.7);
};

// Called from RN to set/clear approach route coordinates
window.setApproachCoords=function(coords){
  if(!mapReady||!map.getSource('approach'))return;
  if(coords&&coords.length){
    map.getSource('approach').setData({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}});
  }else{
    map.getSource('approach').setData({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[]}});
  }
};
</` + `script>
</body></html>`
}

export default function CreateActivityScreen() {
  const { user } = useSession()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>()
  const webViewRef = useRef<WebView>(null)
  const trailMapRef = useRef<WebView>(null)

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

  // Step 2: Trail (for trail sports)
  const [trails, setTrails] = useState<Trail[]>([])
  const [isLoadingTrails, setIsLoadingTrails] = useState(false)
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null)
  const [approachDuration, setApproachDuration] = useState<number | null>(null)
  const [approachDistance, setApproachDistance] = useState<number | null>(null)

  // Step 3: Date & Time
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date()
    d.setHours(d.getHours() + 2, 0, 0, 0)
    return d
  })

  // Step 4: Details
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

  const isTrailSport = sportType === 'hiking' || sportType === 'trail_running'

  // Fetch friends for invite modal
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data } = await apiFetch<Array<{ id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null }>>('/api/friends')
      setFriends(data ?? [])
    })()
  }, [user])

  // Build map HTML
  useEffect(() => {
    (async () => {
      let lat = initLat
      let lng = initLng

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
      reverseGeocode(lat, lng)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch trails when entering step 2
  useEffect(() => {
    if (step !== 2 || !isTrailSport) return
    let cancelled = false
    setIsLoadingTrails(true)
    setTrails([])

    ;(async () => {
      const { data } = await apiFetch<Trail[]>(`/api/trails?lat=${locationLat}&lng=${locationLng}&radius=5000`)
      if (!cancelled) {
        setTrails(data ?? [])
        setIsLoadingTrails(false)
      }
    })()

    return () => { cancelled = true }
  }, [step, locationLat, locationLng, isTrailSport])

  // Fetch approach route when trail is selected — inject into WebView map
  useEffect(() => {
    if (!selectedTrail) {
      setApproachDuration(null)
      setApproachDistance(null)
      // Clear approach line on map
      trailMapRef.current?.injectJavaScript(`window.setApproachCoords(null);true;`)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await apiFetch<{ distanceMeters: number; durationSeconds: number; coordinates: [number, number][] }>(
        `/api/trails/approach?fromLat=${locationLat}&fromLng=${locationLng}&toLat=${selectedTrail.trailheadLat}&toLng=${selectedTrail.trailheadLng}`
      )
      if (!cancelled && data) {
        setApproachDuration(data.durationSeconds)
        setApproachDistance(data.distanceMeters)
        // Send coordinates to WebView map
        if (data.coordinates) {
          trailMapRef.current?.injectJavaScript(`window.setApproachCoords(${JSON.stringify(data.coordinates)});true;`)
        }
      }
    })()
    return () => { cancelled = true }
  }, [selectedTrail?.osmId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Geocoding
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
    setSelectedTrail(null)
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

    const { data, error } = await apiPost<{ id: string }>('/api/activities', {
      title: title.trim(),
      description: description.trim() || null,
      sportType,
      skillLevel,
      visibility: 'public',
      location: { latitude: locationLat, longitude: locationLng },
      locationName: locationName.trim() || 'Dropped Pin',
      maxParticipants: parseInt(maxParticipants, 10) || 4,
      scheduledAt: scheduledDate.toISOString(),
      trail: selectedTrail
        ? {
            osmId: selectedTrail.osmId,
            name: selectedTrail.name,
            surface: selectedTrail.surface,
            sacScale: selectedTrail.sacScale,
            distanceMeters: selectedTrail.distanceMeters,
            trailheadLat: selectedTrail.trailheadLat,
            trailheadLng: selectedTrail.trailheadLng,
            approachDistanceMeters: approachDistance ?? undefined,
            approachDurationSeconds: approachDuration ?? undefined,
          }
        : undefined,
    })

    if (error || !data) {
      Alert.alert('Error', error ?? 'Failed to create activity')
      setIsSubmitting(false)
      return
    }

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

    if (friends.length > 0) {
      setShowInvite(true)
    } else {
      setTimeout(() => router.back(), 1500)
    }
  }

  async function handleSendInvites() {
    if (!createdActivityId || invitedIds.size === 0) { router.back(); return }
    await Promise.all(
      Array.from(invitedIds).map((friendId) =>
        apiPost(`/api/dm/${friendId}`, { content: `[invite:${createdActivityId}] ${title}` })
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

  const stepLabel = step === 1 ? 'What & Where?' : step === 2 ? 'Trail' : step === 3 ? 'When?' : 'Details'
  const canGoStep3 = scheduledDate > new Date()

  function handleNextFromStep1() {
    if (!locationName) setLocationName('Dropped Pin')
    // Skip trail step if not a trail sport
    if (isTrailSport) {
      setStep(2)
    } else {
      setSelectedTrail(null)
      setStep(3)
    }
  }

  function handleBackFromStep(current: number) {
    if (current === 3 && !isTrailSport) {
      setStep(1)
    } else {
      setStep(current - 1)
    }
  }

  return (
    <View style={s.container}>
      <Stack.Screen options={{
        headerBackTitle: 'Cancel',
        headerTitle: () => (
          <View style={s.headerTitleWrap}>
            <Text style={s.headerTitleText}>{stepLabel}</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
            </View>
          </View>
        ),
      }} />

      {/* ── Step 1: Location ── */}
      {step === 1 && (
        <View style={s.flex}>
          {/* Activity type — must be selected first so we know whether to show trail step */}
          <View style={s.sportPickerWrap}>
            <Text style={s.sportPickerLabel}>Activity type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sportPickerChips}>
              {Object.entries(SPORT_LABELS).map(([key, label]) => (
                <Pressable
                  key={key}
                  style={[s.sportPickerChip, sportType === key && s.sportPickerChipActive]}
                  onPress={() => {
                    setSportType(key)
                    if (key !== 'hiking' && key !== 'trail_running') setSelectedTrail(null)
                  }}
                >
                  <Text style={[s.sportPickerChipText, sportType === key && s.sportPickerChipTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

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

          <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <Pressable
              style={[s.nextBtn, s.btnFlex, !sportType && { opacity: 0.4 }]}
              onPress={handleNextFromStep1}
              disabled={!sportType}
            >
              <Text style={s.nextBtnText}>Next</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Step 2: Trail Selection ── */}
      {step === 2 && (
        <View style={s.flex}>
          {/* Trail map — top half */}
          {!isLoadingTrails && trails.length > 0 && (
            <View style={s.trailPickerMapWrap}>
              <WebView
                ref={trailMapRef}
                source={{ html: buildTrailPickerMapHtml(
                  mapboxToken,
                  locationLat,
                  locationLng,
                  trails,
                  selectedTrail?.osmId ?? null,
                ) }}
                style={s.trailPickerMap}
                scrollEnabled={false}
                javaScriptEnabled
                onMessage={(event) => {
                  try {
                    const msg = JSON.parse(event.nativeEvent.data)
                    if (msg.type === 'selectTrail') {
                      const trail = trails.find((t) => t.osmId === msg.osmId)
                      if (trail) {
                        setSelectedTrail(trail)
                        trailMapRef.current?.injectJavaScript(`window.updateSelection(${msg.osmId});true;`)
                      }
                    } else if (msg.type === 'deselectTrail') {
                      setSelectedTrail(null)
                      trailMapRef.current?.injectJavaScript(`window.updateSelection(null);true;`)
                    }
                  } catch {}
                }}
              />
            </View>
          )}

          {/* Trail list — bottom half */}
          <ScrollView contentContainerStyle={s.trailScroll} style={s.flex}>
            <Text style={s.sectionTitle}>Select a trail (optional)</Text>
            <Text style={s.trailSubtitle}>
              {locationName ? `Near ${locationName}` : 'Nearby trails'}
            </Text>

            {isLoadingTrails ? (
              <View style={s.trailLoading}>
                <ActivityIndicator color={C.primary} />
                <Text style={s.trailLoadingText}>Searching for trails...</Text>
              </View>
            ) : trails.length === 0 ? (
              <View style={s.trailEmpty}>
                <Text style={s.trailEmptyText}>No named trails found nearby. You can skip this step.</Text>
              </View>
            ) : (
              trails.map((trail) => {
                const isSelected = selectedTrail?.osmId === trail.osmId
                return (
                  <Pressable
                    key={trail.osmId}
                    style={[s.trailCard, isSelected && s.trailCardSelected]}
                    onPress={() => {
                      const next = isSelected ? null : trail
                      setSelectedTrail(next)
                      trailMapRef.current?.injectJavaScript(`window.updateSelection(${next ? next.osmId : 'null'});true;`)
                    }}
                  >
                    <View style={s.trailCardHeader}>
                      {isSelected && <Text style={s.trailCheckMark}>{'\u2713'}</Text>}
                      <Text style={[s.trailName, isSelected && s.trailNameSelected]} numberOfLines={1}>
                        {trail.name}
                      </Text>
                    </View>
                    <View style={s.trailMeta}>
                      <Text style={s.trailMetaText}>{formatDistance(trail.distanceMeters)}</Text>
                      {trail.sacScale && (
                        <Text style={s.trailMetaText}>
                          {SAC_SCALE_LABELS[trail.sacScale]?.split(' — ')[0] ?? trail.sacScale}
                        </Text>
                      )}
                      <Text style={s.trailMetaText}>
                        {SURFACE_LABELS[trail.surface] ?? trail.surface}
                      </Text>
                      <Text style={s.trailMetaText}>
                        {formatDistance(trail.distanceFromLocation)} away
                      </Text>
                    </View>
                    {isSelected && approachDuration != null && (
                      <Text style={s.trailApproach}>
                        {'\u{1F6B6}'} {Math.ceil(approachDuration / 60)} min walk to trailhead
                        {approachDistance != null && ` (${formatDistance(approachDistance)})`}
                      </Text>
                    )}
                  </Pressable>
                )
              })
            )}
          </ScrollView>

          <View style={[s.bottomBtns, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <Pressable style={s.backBtn} onPress={() => setStep(1)}>
              <Text style={s.backBtnText}>Back</Text>
            </Pressable>
            <Pressable style={[s.nextBtn, s.btnFlex]} onPress={() => setStep(3)}>
              <Text style={s.nextBtnText}>{selectedTrail ? 'Next' : 'Skip'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Step 3: Date & Time ── */}
      {step === 3 && (
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
            <Pressable style={s.backBtn} onPress={() => handleBackFromStep(3)}>
              <Text style={s.backBtnText}>Back</Text>
            </Pressable>
            <Pressable
              style={[s.nextBtn, s.btnFlex, !canGoStep3 && { opacity: 0.4 }]}
              onPress={() => canGoStep3 && setStep(4)}
              disabled={!canGoStep3}
            >
              <Text style={s.nextBtnText}>Next</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Step 4: Details ── */}
      {step === 4 && (
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.detailScroll} keyboardShouldPersistTaps="handled">
            {/* Summary */}
            <View style={s.summaryCard}>
              <Text style={s.summaryLabel}>Location</Text>
              <Text style={s.summaryVal}>{locationName}</Text>
              {selectedTrail && (
                <>
                  <Text style={s.summaryLabel}>Trail</Text>
                  <Text style={[s.summaryVal, { color: C.trail }]}>{selectedTrail.name}</Text>
                </>
              )}
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
            <Pressable style={s.backBtn} onPress={() => setStep(3)}>
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

  headerTitleWrap: { alignItems: 'center', gap: 4, minWidth: 160 },
  headerTitleText: { fontSize: 17, fontWeight: '600', color: C.text },
  progressTrack: { height: 4, backgroundColor: '#f0f0f0', borderRadius: 2, width: '100%' },
  progressFill: { height: 4, backgroundColor: C.primary, borderRadius: 2 },

  // Step 1 — sport picker
  sportPickerWrap: { paddingHorizontal: 14, paddingTop: 14, gap: 6 },
  sportPickerLabel: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  sportPickerChips: { gap: 8, paddingRight: 14 },
  sportPickerChip: { backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  sportPickerChipActive: { backgroundColor: C.primary },
  sportPickerChipText: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
  sportPickerChipTextActive: { color: '#fff' },

  // Step 1 — search
  searchWrap: { paddingHorizontal: 14, paddingTop: 10, zIndex: 10 },
  searchInput: { backgroundColor: C.card, borderRadius: 12, padding: 14, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.inputBorder },
  dropdown: { position: 'absolute', top: 58, left: 14, right: 14, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8, zIndex: 20 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  dropdownIcon: { fontSize: 16 },
  dropdownText: { fontSize: 14, color: C.text, flex: 1 },
  map: { flex: 1, backgroundColor: '#e8e0d8' },
  bottomBar: { padding: 14, paddingBottom: 34, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.card },

  // Step 2: Trail
  trailPickerMapWrap: { height: 220, borderBottomWidth: 1, borderBottomColor: C.border },
  trailPickerMap: { flex: 1, backgroundColor: '#e8e0d8' },
  trailScroll: { padding: 20, paddingBottom: 20 },
  trailSubtitle: { fontSize: 14, color: C.textSecondary, marginBottom: 16 },
  trailLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20 },
  trailLoadingText: { fontSize: 14, color: C.textMuted },
  trailEmpty: { padding: 20, backgroundColor: '#f8f8f8', borderRadius: 12 },
  trailEmptyText: { fontSize: 14, color: C.textMuted, textAlign: 'center' },
  trailCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  trailCardSelected: { borderColor: C.trail, backgroundColor: '#f0fdf4' },
  trailCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trailCheckMark: { fontSize: 14, fontWeight: '700', color: C.trail },
  trailName: { fontSize: 15, fontWeight: '600', color: C.text, flex: 1 },
  trailNameSelected: { color: C.trail },
  trailMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  trailMetaText: { fontSize: 12, color: C.textSecondary },
  trailApproach: { fontSize: 12, color: C.approach, fontWeight: '500', marginTop: 6 },

  // Step 3
  pickerSection: { padding: 20, paddingBottom: 40 },
  picker: { minHeight: 480 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: C.text, marginBottom: 8 },
  pickerSummary: { fontSize: 15, color: C.primary, fontWeight: '500', marginBottom: 16 },

  // Step 4
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
