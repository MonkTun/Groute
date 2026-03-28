import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { WebView } from 'react-native-webview'
import DateTimePicker from '@react-native-community/datetimepicker'
import Constants from 'expo-constants'

import { useSession } from '../lib/AuthProvider'
import { supabase } from '../lib/supabase'

const mapboxToken = Constants.expoConfig?.extra?.mapboxToken as string

const C = {
  bg: '#fafafa',
  card: '#ffffff',
  primary: '#0f8a6e',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e5e5',
  inputBorder: '#e0e0e0',
}

function buildPickerHtml(lat: number, lng: number, token: string): string {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link href="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js"></` + `script>
<style>body{margin:0}#map{width:100%;height:100vh}.mapboxgl-ctrl-bottom-left,.mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-attrib{display:none}.pin{position:absolute;top:50%;left:50%;transform:translate(-50%,-100%);font-size:36px;pointer-events:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));z-index:10}</style>
</head><body>
<div id="map"></div><div class="pin">\u{1F4CD}</div>
<script>
mapboxgl.accessToken='${token}';
var map=new mapboxgl.Map({container:'map',style:'mapbox://styles/mapbox/outdoors-v12',center:[${lng},${lat}],zoom:14});
map.addControl(new mapboxgl.NavigationControl({showCompass:false}),'top-right');
map.on('moveend',function(){var c=map.getCenter();window.ReactNativeWebView.postMessage(JSON.stringify({type:'move',lat:c.lat,lng:c.lng}))});
</` + `script>
</body></html>`
}

export default function EditActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useSession()
  const router = useRouter()
  const webViewRef = useRef<WebView>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [locationName, setLocationName] = useState('')
  const [locationLat, setLocationLat] = useState(34.0522)
  const [locationLng, setLocationLng] = useState(-118.2437)
  const [scheduledDate, setScheduledDate] = useState(new Date())
  const [maxParticipants, setMaxParticipants] = useState('4')
  const mapHtmlRef = useRef<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // Reverse geocode
  const reverseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&limit=1&types=poi,address,place,neighborhood`)
      const data = await res.json()
      if (data.features?.[0]) setLocationName(data.features[0].text || data.features[0].place_name?.split(',')[0] || '')
    } catch {}
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('activities')
        .select('title, description, location_name, location_lat, location_lng, scheduled_at, max_participants')
        .eq('id', id)
        .single()

      if (data) {
        setTitle(data.title)
        setDescription(data.description ?? '')
        setLocationName(data.location_name)
        const lat = data.location_lat ? parseFloat(data.location_lat) : 34.0522
        const lng = data.location_lng ? parseFloat(data.location_lng) : -118.2437
        setLocationLat(lat)
        setLocationLng(lng)
        setScheduledDate(new Date(data.scheduled_at))
        setMaxParticipants(String(data.max_participants))
        mapHtmlRef.current = buildPickerHtml(lat, lng, mapboxToken)
        setMapReady(true)
      }
      setIsLoading(false)
    })()
  }, [id])

  function handleMapMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'move') {
        setLocationLat(msg.lat)
        setLocationLng(msg.lng)
        if (reverseTimeout.current) clearTimeout(reverseTimeout.current)
        reverseTimeout.current = setTimeout(() => reverseGeocode(msg.lat, msg.lng), 500)
      }
    } catch {}
  }

  async function handleSave() {
    if (!title.trim()) return Alert.alert('Error', 'Title is required')
    setIsSaving(true)

    const { error } = await supabase
      .from('activities')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        location_name: locationName || 'Dropped Pin',
        location_lat: String(locationLat),
        location_lng: String(locationLng),
        scheduled_at: scheduledDate.toISOString(),
        max_participants: parseInt(maxParticipants, 10) || 4,
      })
      .eq('id', id)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Saved', 'Activity updated.', [{ text: 'OK', onPress: () => router.back() }])
    }
    setIsSaving(false)
  }

  if (isLoading) {
    return (
      <View style={s.loading}>
        <Stack.Screen options={{ title: 'Edit Activity' }} />
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{
        title: 'Edit Activity',
        headerBackTitle: 'Cancel',
        headerRight: () => (
          <Pressable onPress={handleSave} disabled={isSaving} style={{ opacity: isSaving ? 0.5 : 1 }}>
            <Text style={{ color: C.primary, fontSize: 16, fontWeight: '600' }}>{isSaving ? 'Saving...' : 'Save'}</Text>
          </Pressable>
        ),
      }} />

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>Title</Text>
        <TextInput style={s.input} value={title} onChangeText={setTitle} placeholderTextColor={C.textMuted} placeholder="Activity title" maxLength={200} />

        <Text style={s.label}>Description</Text>
        <TextInput style={[s.input, s.textarea]} value={description} onChangeText={setDescription} placeholderTextColor={C.textMuted} placeholder="Optional description" multiline maxLength={2000} />

        <Text style={s.label}>Date & Time</Text>
        <DateTimePicker
          value={scheduledDate}
          mode="datetime"
          display="spinner"
          minimumDate={new Date()}
          minuteInterval={5}
          onChange={(_e, date) => { if (date) setScheduledDate(date) }}
          style={s.picker}
        />

        <Text style={s.label}>Max participants</Text>
        <View style={s.counterRow}>
          <Pressable style={s.counterBtn} onPress={() => setMaxParticipants(String(Math.max(1, parseInt(maxParticipants) - 1)))}>
            <Text style={s.counterBtnText}>-</Text>
          </Pressable>
          <Text style={s.counterVal}>{maxParticipants}</Text>
          <Pressable style={s.counterBtn} onPress={() => setMaxParticipants(String(Math.min(50, parseInt(maxParticipants) + 1)))}>
            <Text style={s.counterBtnText}>+</Text>
          </Pressable>
        </View>

        <Text style={s.label}>Location</Text>
        <Text style={s.locationText}>{locationName || 'Drag the pin to adjust'}</Text>
        <View style={s.mapWrap}>
          {mapReady && (
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
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: C.card, borderRadius: 12, padding: 14, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.inputBorder },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  picker: { height: 180 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  counterBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  counterBtnText: { fontSize: 20, fontWeight: '600', color: C.text },
  counterVal: { fontSize: 24, fontWeight: '700', color: C.text, minWidth: 40, textAlign: 'center' },
  locationText: { fontSize: 14, fontWeight: '500', color: C.text, marginBottom: 8 },
  mapWrap: { height: 220, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  map: { flex: 1, backgroundColor: '#e8e0d8' },
})
