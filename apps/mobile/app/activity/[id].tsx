import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { WebView } from 'react-native-webview'
import * as ImagePicker from 'expo-image-picker'
import ConfettiCannon from 'react-native-confetti-cannon'
import Constants from 'expo-constants'

import { SPORT_LABELS, SKILL_LABELS, SAC_SCALE_LABELS, SURFACE_LABELS } from '@groute/shared'
import { useSession } from '../../lib/AuthProvider'
import { apiFetch, apiPost, apiDelete, apiUpload } from '../../lib/api'

const mapboxToken = Constants.expoConfig?.extra?.mapboxToken as string
const apiUrl = (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:3000'

const C = {
  bg: '#f5f0e8',
  card: '#fcf9f3',
  primary: '#1a7a5a',
  text: '#2d2418',
  textSecondary: '#6b5e4f',
  textMuted: '#9c8e7e',
  border: '#e0d8cc',
  trail: '#16a34a',
  approach: '#f97316',
}

interface ActivityDetail {
  id: string
  title: string
  description: string | null
  sport_type: string
  skill_level: string
  visibility: string
  creator_id: string
  banner_url: string | null
  location_name: string
  location_lat: string | null
  location_lng: string | null
  scheduled_at: string
  max_participants: number
  status: string
  trail_osm_id: number | null
  trail_name: string | null
  trail_distance_meters: number | null
  trail_surface: string | null
  trail_sac_scale: string | null
  trailhead_lat: string | null
  trailhead_lng: string | null
  trail_approach_distance_m: number | null
  trail_approach_duration_s: number | null
  trail_geometry: string | null
  approach_geometry: string | null
  creator: {
    id: string
    display_name: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    area: string | null
  } | null
}

interface Participant {
  id: string
  status: string
  user: {
    id: string
    display_name: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1609.344).toFixed(1)} mi`
}

function buildTrailMapHtml(
  token: string,
  locLat: number,
  locLng: number,
  locName: string,
  thLat: number,
  thLng: number,
  trailName: string,
  trailGeometry: string | null,
  approachGeometry: string | null,
  apiUrl: string,
  osmId: number,
): string {
  // Embed cached geometry directly as JS array literals, or null
  const trailLiteral = trailGeometry ?? 'null'
  const approachLiteral = approachGeometry ?? 'null'
  const safeLocName = locName.replace(/'/g, "\\'").replace(/\n/g, ' ')
  const safeTrailName = trailName.replace(/'/g, "\\'").replace(/\n/g, ' ')

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link href="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js"></` + `script>
<style>body{margin:0}#map{width:100%;height:100%}.mapboxgl-ctrl-bottom-left,.mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-attrib{display:none}
.legend{position:absolute;bottom:8px;left:8px;background:rgba(255,255,255,0.92);border-radius:8px;padding:6px 10px;font:11px/1.4 system-ui;box-shadow:0 1px 4px rgba(0,0,0,0.12)}
.legend div{display:flex;align-items:center;gap:6px;margin:2px 0}
.legend .line{width:16px;height:2px;border-radius:1px}
</style>
</head><body>
<div id="map" style="width:100%;height:100vh"></div>
<div class="legend">
  <div><div class="line" style="background:#16a34a"></div><span>Trail</span></div>
  <div><div class="line" style="background:#f97316;border-top:2px dashed #f97316;height:0"></div><span>Walk to trailhead</span></div>
</div>
<script>
mapboxgl.accessToken='${token}';
var map=new mapboxgl.Map({container:'map',style:'mapbox://styles/mapbox/outdoors-v12',center:[${(locLng + thLng) / 2},${(locLat + thLat) / 2}],zoom:14});
map.addControl(new mapboxgl.NavigationControl({showCompass:false}),'top-right');

new mapboxgl.Marker({color:'#1a1a1a',scale:0.8}).setLngLat([${locLng},${locLat}]).setPopup(new mapboxgl.Popup({offset:25,closeButton:false}).setText('${safeLocName}')).addTo(map);
new mapboxgl.Marker({color:'#16a34a',scale:0.7}).setLngLat([${thLng},${thLat}]).setPopup(new mapboxgl.Popup({offset:25,closeButton:false}).setText('${safeTrailName} trailhead')).addTo(map);

var bounds=new mapboxgl.LngLatBounds();
bounds.extend([${locLng},${locLat}]);
bounds.extend([${thLng},${thLat}]);

function addTrail(tc){
  if(!tc||!tc.length)return;
  map.addSource('trail',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:tc}}});
  map.addLayer({id:'trail-line',type:'line',source:'trail',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#16a34a','line-width':4,'line-opacity':0.9}});
  tc.forEach(function(c){bounds.extend(c)});
  map.fitBounds(bounds,{padding:40,maxZoom:16,duration:300});
}
function addApproach(ac){
  if(!ac||!ac.length)return;
  map.addSource('approach',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:ac}}});
  map.addLayer({id:'approach-line',type:'line',source:'approach',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#f97316','line-width':3,'line-opacity':0.8,'line-dasharray':[2,2]}});
}

map.on('load',function(){
  var tc=${trailLiteral};
  var ac=${approachLiteral};
  if(tc){addTrail(tc);addApproach(ac);map.fitBounds(bounds,{padding:40,maxZoom:16,duration:0});}
  else{
    // Fallback: fetch geometry from API if not cached
    fetch('${apiUrl}/api/trails/geometry?osmId=${osmId}').then(function(r){return r.json()}).then(function(d){
      if(d.data)addTrail(d.data);
    }).catch(function(){});
    fetch('${apiUrl}/api/trails/approach?fromLat=${locLat}&fromLng=${locLng}&toLat=${thLat}&toLng=${thLng}').then(function(r){return r.json()}).then(function(d){
      if(d.data&&d.data.coordinates)addApproach(d.data.coordinates);
      map.fitBounds(bounds,{padding:40,maxZoom:16,duration:300});
    }).catch(function(){});
  }
});
</` + `script>
</body></html>`
}

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useSession()
  const router = useRouter()
  const [activity, setActivity] = useState<ActivityDetail | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [myStatus, setMyStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await apiFetch<{
        id: string; title: string; description: string | null; sport_type: string
        skill_level: string; visibility: string; creator_id: string; banner_url: string | null
        location_name: string; location_lat: string | null; location_lng: string | null
        scheduled_at: string; max_participants: number; status: string
        trail_osm_id: number | null; trail_name: string | null
        trail_distance_meters: number | null; trail_surface: string | null; trail_sac_scale: string | null
        trailhead_lat: string | null; trailhead_lng: string | null
        trail_approach_distance_m: number | null; trail_approach_duration_s: number | null
        trail_geometry: string | null; approach_geometry: string | null
        creator: { id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null; area: string | null } | null
        participants: Array<{ id: string; userId: string; status: string; joinedAt: string; user: { id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null }>
        myStatus: string | null
        isOwner: boolean
      }>(`/api/activities/${id}`)

      if (error || !data) { setIsLoading(false); return }

      setActivity({
        id: data.id, title: data.title, description: data.description,
        sport_type: data.sport_type, skill_level: data.skill_level, visibility: data.visibility,
        creator_id: data.creator_id, banner_url: data.banner_url,
        location_name: data.location_name, location_lat: data.location_lat, location_lng: data.location_lng,
        scheduled_at: data.scheduled_at, max_participants: data.max_participants, status: data.status,
        trail_osm_id: data.trail_osm_id, trail_name: data.trail_name,
        trail_distance_meters: data.trail_distance_meters, trail_surface: data.trail_surface,
        trail_sac_scale: data.trail_sac_scale,
        trailhead_lat: data.trailhead_lat, trailhead_lng: data.trailhead_lng,
        trail_approach_distance_m: data.trail_approach_distance_m,
        trail_approach_duration_s: data.trail_approach_duration_s,
        trail_geometry: data.trail_geometry, approach_geometry: data.approach_geometry,
        creator: data.creator,
      })
      setBannerUrl(data.banner_url)
      setParticipants(data.participants.map((p) => ({ id: p.id, status: p.status, user: p.user })))
      setMyStatus(data.myStatus)
      setIsLoading(false)
    }
    load()
  }, [id, user])

  async function handleJoin() {
    setIsJoining(true)
    const { data, error } = await apiPost<{ status: string }>(`/api/activities/${id}/join`, {})
    if (error) {
      Alert.alert('Error', error)
    } else if (data) {
      setMyStatus(data.status)
      if (data.status === 'accepted') { setShowConfetti(true); Alert.alert('Joined!', 'You have joined this activity.') }
      else Alert.alert('Requested', 'Your request has been sent to the host.')
    }
    setIsJoining(false)
  }

  async function handleDelete() {
    Alert.alert('Delete Activity', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await apiDelete(`/api/activities/${id}`); router.back() } },
    ])
  }

  async function handleUploadBanner() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.8 })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    setIsUploadingBanner(true)
    try {
      const ext = asset.uri.split('.').pop() ?? 'jpg'
      const formData = new FormData()
      formData.append('file', { uri: asset.uri, name: `activity-photo.${ext}`, type: asset.mimeType ?? 'image/jpeg' } as unknown as Blob)
      const { data, error } = await apiUpload<{ bannerUrl: string }>(`/api/activities/${id}/photo`, formData)
      if (error) Alert.alert('Error', error)
      else if (data) setBannerUrl(`${data.bannerUrl}?t=${Date.now()}`)
    } catch { Alert.alert('Error', 'Failed to upload photo') }
    setIsUploadingBanner(false)
  }

  if (isLoading || !activity) {
    return (
      <View style={st.loading}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    )
  }

  const creator = activity.creator
  const isCreator = activity.creator_id === user?.id
  const creatorName = creator
    ? creator.first_name && creator.last_name ? `${creator.first_name} ${creator.last_name}` : creator.display_name
    : 'Unknown'

  const scheduled = new Date(activity.scheduled_at)
  const dateStr = scheduled.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const timeStr = scheduled.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const goingCount = participants.length + 1

  const hasTrail = !!activity.trail_name
  const hasTrailMap = hasTrail
    && activity.trail_osm_id != null
    && !!activity.location_lat && !!activity.location_lng
    && !!activity.trailhead_lat && !!activity.trailhead_lng

  return (
    <>
    <ScrollView style={st.container}>
      <Stack.Screen options={{ title: activity.title, headerBackTitle: 'Back' }} />

      {/* Banner */}
      <View>
        {bannerUrl ? (
          <Image source={{ uri: bannerUrl }} style={st.banner} />
        ) : (
          <View style={st.bannerFallback}>
            <Text style={st.bannerEmoji}>{'\u{1F3DE}'}</Text>
          </View>
        )}
        {isCreator && (
          <Pressable style={st.bannerEditButton} onPress={handleUploadBanner} disabled={isUploadingBanner}>
            {isUploadingBanner ? (
              <ActivityIndicator size="small" color={C.primary} />
            ) : (
              <Text style={st.bannerEditText}>{bannerUrl ? 'Change photo' : 'Add photo'}</Text>
            )}
          </Pressable>
        )}
      </View>

      <View style={st.body}>
        {/* Title + sport */}
        <View style={st.titleRow}>
          <Text style={st.title}>{activity.title}</Text>
          <View style={st.sportTag}>
            <Text style={st.sportTagText}>{SPORT_LABELS[activity.sport_type] ?? activity.sport_type}</Text>
          </View>
        </View>

        {activity.description && (
          <Text style={st.description}>{activity.description}</Text>
        )}

        {/* Details */}
        <View style={st.detailsGrid}>
          <View style={st.detailItem}>
            <Text style={st.detailLabel}>When</Text>
            <Text style={st.detailValue}>{dateStr}, {timeStr}</Text>
          </View>
          <View style={st.detailItem}>
            <Text style={st.detailLabel}>Where</Text>
            <Text style={st.detailValue} numberOfLines={1}>{activity.location_name}</Text>
          </View>
          <View style={st.detailItem}>
            <Text style={st.detailLabel}>Going</Text>
            <Text style={st.detailValue}>{goingCount} / {activity.max_participants}</Text>
          </View>
          <View style={st.detailItem}>
            <Text style={st.detailLabel}>Level</Text>
            <Text style={st.detailValue}>{SKILL_LABELS[activity.skill_level] ?? activity.skill_level}</Text>
          </View>
        </View>

        {/* Trail info + map */}
        {hasTrail && (
          <View style={st.trailSection}>
            <Text style={st.trailTitle}>{activity.trail_name}</Text>

            {/* Trail map via WebView — only when all coordinates available */}
            {hasTrailMap && (
              <View style={st.trailMapWrap}>
                <WebView
                  source={{ html: buildTrailMapHtml(
                    mapboxToken,
                    parseFloat(activity.location_lat!),
                    parseFloat(activity.location_lng!),
                    activity.location_name,
                    parseFloat(activity.trailhead_lat!),
                    parseFloat(activity.trailhead_lng!),
                    activity.trail_name!,
                    activity.trail_geometry,
                    activity.approach_geometry,
                    apiUrl,
                    activity.trail_osm_id!,
                  ) }}
                  style={st.trailMap}
                  scrollEnabled={false}
                  javaScriptEnabled
                />
              </View>
            )}

            {/* Trail metadata */}
            <View style={st.trailMeta}>
              {activity.trail_distance_meters != null && (
                <Text style={st.trailMetaText}>{formatDistance(activity.trail_distance_meters)} trail</Text>
              )}
              {activity.trail_sac_scale && (
                <Text style={st.trailMetaText}>{SAC_SCALE_LABELS[activity.trail_sac_scale] ?? activity.trail_sac_scale}</Text>
              )}
              {activity.trail_surface && (
                <Text style={st.trailMetaText}>{SURFACE_LABELS[activity.trail_surface] ?? activity.trail_surface}</Text>
              )}
            </View>

            {activity.trail_approach_duration_s != null && (
              <Text style={st.trailApproach}>
                {'\u{1F6B6}'} {Math.ceil(activity.trail_approach_duration_s / 60)} min walk to trailhead
                {activity.trail_approach_distance_m != null && ` (${formatDistance(activity.trail_approach_distance_m)})`}
              </Text>
            )}
          </View>
        )}

        {/* Getting There — visible to participants */}
        {(isCreator || myStatus === 'accepted') && (
          <View style={st.logisticsSection}>
            <Text style={st.sectionTitle}>Getting There</Text>

            {/* Open in Maps buttons */}
            <View style={st.mapsRow}>
              <Pressable
                style={st.mapButton}
                onPress={() => {
                  const lat = activity.trailhead_lat ?? activity.location_lat
                  const lng = activity.trailhead_lng ?? activity.location_lng
                  if (lat && lng) Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`)
                }}
              >
                <Text style={st.mapButtonText}>Google Maps</Text>
              </Pressable>
              <Pressable
                style={st.mapButton}
                onPress={() => {
                  const lat = activity.trailhead_lat ?? activity.location_lat
                  const lng = activity.trailhead_lng ?? activity.location_lng
                  if (lat && lng) Linking.openURL(`https://maps.apple.com/?daddr=${lat},${lng}`)
                }}
              >
                <Text style={st.mapButtonText}>Apple Maps</Text>
              </Pressable>
              <Pressable
                style={st.mapButton}
                onPress={() => {
                  const lat = activity.trailhead_lat ?? activity.location_lat
                  const lng = activity.trailhead_lng ?? activity.location_lng
                  if (lat && lng) Linking.openURL(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`)
                }}
              >
                <Text style={st.mapButtonText}>Waze</Text>
              </Pressable>
            </View>

            {/* Trip timeline */}
            <View style={st.timeline}>
              <View style={st.timelineItem}>
                <View style={st.timelineDot} />
                <View style={st.timelineContent}>
                  <Text style={st.timelineLabel}>Meet at {activity.location_name}</Text>
                  <Text style={st.timelineTime}>{timeStr}</Text>
                </View>
              </View>
              {activity.trail_approach_duration_s != null && activity.trail_approach_duration_s > 0 && (
                <View style={st.timelineItem}>
                  <View style={[st.timelineDot, { backgroundColor: C.textMuted }]} />
                  <View style={st.timelineContent}>
                    <Text style={st.timelineLabel}>Drive to trailhead</Text>
                    <Text style={st.timelineTime}>~{Math.round(activity.trail_approach_duration_s / 60)} min</Text>
                  </View>
                </View>
              )}
              <View style={st.timelineItem}>
                <View style={[st.timelineDot, { backgroundColor: C.approach }]} />
                <View style={st.timelineContent}>
                  <Text style={st.timelineLabel}>Activity starts</Text>
                  <Text style={st.timelineTime}>{timeStr}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Host */}
        <Pressable style={st.hostCard} onPress={() => creator && router.push(`/user/${creator.id}`)}>
          {creator?.avatar_url ? (
            <Image source={{ uri: creator.avatar_url }} style={st.avatar} />
          ) : (
            <View style={st.avatarFallback}>
              <Text style={st.avatarInitial}>
                {(creator?.first_name?.[0] ?? creator?.display_name[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={st.hostName}>{creatorName}</Text>
            <Text style={st.hostLabel}>Organizer</Text>
          </View>
        </Pressable>

        {/* Members */}
        <Text style={st.sectionTitle}>Going ({goingCount})</Text>
        {participants.map((p) => {
          if (!p.user) return null
          const name = p.user.first_name && p.user.last_name
            ? `${p.user.first_name} ${p.user.last_name}`
            : p.user.display_name
          return (
            <Pressable key={p.id} style={st.memberRow} onPress={() => router.push(`/user/${p.user!.id}`)}>
              {p.user.avatar_url ? (
                <Image source={{ uri: p.user.avatar_url }} style={st.memberAvatar} />
              ) : (
                <View style={st.memberAvatarFallback}>
                  <Text style={st.memberInitial}>{(p.user.first_name?.[0] ?? p.user.display_name[0]).toUpperCase()}</Text>
                </View>
              )}
              <Text style={st.memberName}>{name}</Text>
            </Pressable>
          )
        })}

        {/* Action */}
        <View style={st.actionSection}>
          {isCreator ? (
            <View style={st.manageSection}>
              <Text style={st.manageSectionTitle}>Manage Activity</Text>
              <Pressable style={st.manageButton} onPress={() => router.push(`/chat/${id}`)}>
                <Text style={st.manageButtonText}>Open Group Chat</Text>
              </Pressable>
              <Pressable style={st.deleteButton} onPress={handleDelete}>
                <Text style={st.deleteText}>Delete Activity</Text>
              </Pressable>
            </View>
          ) : myStatus === 'accepted' ? (
            <Pressable style={st.chatButton} onPress={() => router.push(`/chat/${id}`)}>
              <Text style={st.chatButtonText}>Open Group Chat</Text>
            </Pressable>
          ) : myStatus === 'requested' ? (
            <View style={st.pendingButton}>
              <Text style={st.pendingText}>Request Pending</Text>
            </View>
          ) : (
            <Pressable
              style={[st.joinButton, isJoining && { opacity: 0.6 }]}
              onPress={handleJoin}
              disabled={isJoining}
            >
              <Text style={st.joinText}>
                {isJoining ? 'Joining...' : activity.visibility === 'public' ? 'Join Activity' : 'Request to Join'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
    {showConfetti && <ConfettiCannon count={80} origin={{ x: -10, y: 0 }} fadeOut autoStart />}
    </>
  )
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  banner: { width: '100%', height: 200 },
  bannerFallback: { width: '100%', height: 160, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  bannerEmoji: { fontSize: 48 },
  body: { padding: 20 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  title: { fontSize: 22, fontWeight: 'bold', color: C.text, flex: 1 },
  sportTag: { backgroundColor: '#f0f0f0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  sportTagText: { fontSize: 12, fontWeight: '700', color: C.textSecondary },
  description: { fontSize: 14, color: C.textSecondary, marginTop: 12, lineHeight: 20 },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  detailItem: { backgroundColor: C.card, borderRadius: 12, padding: 12, width: '47%', borderWidth: 1, borderColor: C.border },
  detailLabel: { fontSize: 11, color: C.textMuted, marginBottom: 2 },
  detailValue: { fontSize: 13, color: C.text, fontWeight: '600' },

  // Trail section
  trailSection: { marginTop: 20, backgroundColor: '#f0fdf4', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#bbf7d0' },
  trailTitle: { fontSize: 16, fontWeight: '700', color: C.trail, marginBottom: 10 },
  trailMapWrap: { height: 220, borderRadius: 10, overflow: 'hidden', marginBottom: 10 },
  trailMap: { flex: 1, backgroundColor: '#e8e0d8' },
  trailMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  trailMetaText: { fontSize: 12, color: C.textSecondary },
  trailApproach: { fontSize: 12, color: C.approach, fontWeight: '500', marginTop: 6 },

  // Logistics
  logisticsSection: { marginTop: 20 },
  mapsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  mapButton: { flex: 1, backgroundColor: C.card, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  mapButtonText: { fontSize: 12, fontWeight: '600', color: C.primary },
  timeline: { marginTop: 16, gap: 4 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary, marginTop: 4 },
  timelineContent: { flex: 1, paddingBottom: 16, borderLeftWidth: 1, borderLeftColor: C.border, paddingLeft: 12, marginLeft: -16 },
  timelineLabel: { fontSize: 14, fontWeight: '600', color: C.text },
  timelineTime: { fontSize: 12, color: C.textSecondary, marginTop: 2 },

  hostCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, marginTop: 20, borderWidth: 1, borderColor: C.border },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 16, fontWeight: '700', color: C.text },
  hostName: { fontSize: 15, fontWeight: '600', color: C.text },
  hostLabel: { fontSize: 12, color: C.textMuted },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  memberAvatar: { width: 32, height: 32, borderRadius: 16 },
  memberAvatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  memberInitial: { fontSize: 13, fontWeight: '700', color: C.text },
  memberName: { fontSize: 14, color: C.text },
  actionSection: { marginTop: 32, marginBottom: 40 },
  joinButton: { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  joinText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  chatButton: { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  chatButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  pendingButton: { backgroundColor: '#f0f0f0', borderRadius: 12, padding: 16, alignItems: 'center' },
  pendingText: { fontSize: 16, fontWeight: '600', color: C.textSecondary },
  bannerEditButton: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  bannerEditText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  manageSection: { gap: 12 },
  manageSectionTitle: { fontSize: 12, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  manageButton: { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  manageButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  deleteButton: { borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 16, alignItems: 'center' },
  deleteText: { fontSize: 16, fontWeight: '600', color: '#dc2626' },
})
