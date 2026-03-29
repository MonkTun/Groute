import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { useRouter, usePathname } from 'expo-router'
import { WebView } from 'react-native-webview'
import Constants from 'expo-constants'

import * as Location from 'expo-location'

import { SPORT_LABELS } from '@groute/shared'
import { useSession } from '../../lib/AuthProvider'
import { apiFetch, apiPost } from '../../lib/api'
import FloatingActionButton from '../../components/FloatingActionButton'
import SearchBar from '../../components/SearchBar'

const mapboxToken = Constants.expoConfig?.extra?.mapboxToken as string

const C = {
  bg: '#fafafa',
  primary: '#0f8a6e',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
}

interface Activity {
  id: string
  title: string
  sport_type: string
  skill_level: string
  creator_id: string
  location_name: string
  location_lat: string | null
  location_lng: string | null
  scheduled_at: string
  max_participants: number
  participantStatus: string | null
  isOwner: boolean
}

interface FriendPin {
  id: string
  name: string
  avatarUrl: string | null
  initial: string
  lat: number
  lng: number
}

const SPORT_EMOJI: Record<string, string> = {
  hiking: '\u{1F97E}',
  trail_running: '\u{1F3C3}',
}

const TIMEFRAMES = [
  { label: 'Today', days: 0 },
  { label: '3 days', days: 3 },
  { label: 'This week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: 'This month', days: 30 },
] as const

function buildMapHtml(activities: Activity[], friends: FriendPin[], userLocation: { lat: number; lng: number } | null, token: string): string {
  const features = activities
    .filter((a) => a.location_lat && a.location_lng)
    .map((a) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [parseFloat(a.location_lng!), parseFloat(a.location_lat!)] },
      properties: {
        id: a.id,
        title: a.title,
        sportType: a.sport_type,
        skillLevel: a.skill_level,
        emoji: SPORT_EMOJI[a.sport_type] ?? '\u{1F3DE}',
      },
    }))

  const geojson = JSON.stringify({ type: 'FeatureCollection', features })

  // Friend markers as JS array
  const friendsJs = JSON.stringify(friends.map((f) => ({
    name: f.name,
    initial: f.initial,
    avatarUrl: f.avatarUrl,
    lat: f.lat,
    lng: f.lng,
  })))

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link href="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js"></` + `script>
<style>
body{margin:0}
#map{width:100%;height:100vh}
.mapboxgl-ctrl-bottom-left,.mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-attrib{display:none}
.mapboxgl-ctrl-top-right{top:60px}
.activity-pin{width:28px;height:28px;border-radius:50%;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer}
.activity-pin.beginner{background:#f59e0b}
.activity-pin.intermediate{background:#3b82f6}
.activity-pin.advanced{background:#ef4444}
.cluster-pin{border-radius:50%;background:#1e293b;border:3px solid #f97316;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer}
.cluster-count{font-size:13px;font-weight:700;color:white;line-height:1}
.cluster-emojis{font-size:8px;line-height:1;margin-top:1px}
.user-loc{width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.25),0 2px 6px rgba(0,0,0,0.2)}
.friend-marker{display:flex;flex-direction:column;align-items:center;cursor:pointer}
.friend-avatar{width:32px;height:32px;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);object-fit:cover}
.friend-initial{width:32px;height:32px;border-radius:50%;background:#6366f1;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;box-shadow:0 2px 6px rgba(0,0,0,0.25)}
.friend-label{margin-top:2px;font-size:9px;font-weight:600;color:#1e293b;background:white;padding:1px 5px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.12);white-space:nowrap}
</style>
</head><body>
<div id="map"></div>
<script>
window.onerror=function(msg){window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',msg:String(msg)}))};
mapboxgl.accessToken='${token}';
var map=new mapboxgl.Map({
  container:'map',
  style:'mapbox://styles/mapbox/outdoors-v12',
  center:[${userLocation ? userLocation.lng : -118.2437},${userLocation ? userLocation.lat : 34.0522}],
  zoom:${userLocation ? 13 : 11}
});

map.addControl(new mapboxgl.NavigationControl({showCompass:false}),'top-right');

map.on('load',function(){
  var activities=${geojson};
  var activityMarkers=[];
  var clusterRadius=80; // pixels

  function renderMarkers(){
    // Remove old markers
    activityMarkers.forEach(function(m){m.remove()});
    activityMarkers=[];

    var features=activities.features;
    if(!features.length)return;

    // Simple clustering: group nearby points at current zoom
    var projected=features.map(function(f){
      var p=map.project(f.geometry.coordinates);
      return {f:f,x:p.x,y:p.y,clustered:false};
    });

    var clusters=[];
    for(var i=0;i<projected.length;i++){
      if(projected[i].clustered)continue;
      var cluster={items:[projected[i].f],x:projected[i].x,y:projected[i].y};
      projected[i].clustered=true;
      for(var j=i+1;j<projected.length;j++){
        if(projected[j].clustered)continue;
        var dx=projected[j].x-cluster.x;
        var dy=projected[j].y-cluster.y;
        if(Math.sqrt(dx*dx+dy*dy)<clusterRadius){
          cluster.items.push(projected[j].f);
          projected[j].clustered=true;
        }
      }
      clusters.push(cluster);
    }

    clusters.forEach(function(c){
      if(c.items.length>1){
        // Cluster marker
        var avgLng=0,avgLat=0;
        var emojis={};
        c.items.forEach(function(f){
          avgLng+=f.geometry.coordinates[0];
          avgLat+=f.geometry.coordinates[1];
          var e=f.properties.emoji;
          emojis[e]=true;
        });
        avgLng/=c.items.length;
        avgLat/=c.items.length;
        var size=Math.min(24+c.items.length*3,48);

        var el=document.createElement('div');
        el.className='cluster-pin';
        el.style.width=size+'px';
        el.style.height=size+'px';
        var countEl=document.createElement('div');
        countEl.className='cluster-count';
        countEl.textContent=c.items.length;
        el.appendChild(countEl);
        var emojiEl=document.createElement('div');
        emojiEl.className='cluster-emojis';
        emojiEl.textContent=Object.keys(emojis).join('');
        el.appendChild(emojiEl);

        el.addEventListener('click',function(){
          map.flyTo({center:[avgLng,avgLat],zoom:map.getZoom()+2,duration:500});
        });

        var m=new mapboxgl.Marker({element:el,anchor:'center'}).setLngLat([avgLng,avgLat]).addTo(map);
        activityMarkers.push(m);
      }else{
        // Single pin
        var f=c.items[0];
        var el=document.createElement('div');
        el.className='activity-pin '+(f.properties.skillLevel||'beginner');
        el.textContent=f.properties.emoji;
        el.addEventListener('click',function(){
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'pin',id:f.properties.id}));
        });
        var m=new mapboxgl.Marker({element:el,anchor:'center'}).setLngLat(f.geometry.coordinates).addTo(map);
        activityMarkers.push(m);
      }
    });
  }

  renderMarkers();
  map.on('moveend',renderMarkers);
  map.on('zoomend',renderMarkers);

  window.ReactNativeWebView.postMessage(JSON.stringify({type:'loaded',count:activities.features.length}));

  // Friend markers
  var friends=${friendsJs};
  friends.forEach(function(f){
    var el=document.createElement('div');
    el.className='friend-marker';
    if(f.avatarUrl){
      var img=document.createElement('img');
      img.src=f.avatarUrl;img.className='friend-avatar';
      el.appendChild(img);
    }else{
      var div=document.createElement('div');
      div.className='friend-initial';div.textContent=f.initial;
      el.appendChild(div);
    }
    var lbl=document.createElement('div');
    lbl.className='friend-label';lbl.textContent=f.name;
    el.appendChild(lbl);
    new mapboxgl.Marker({element:el,anchor:'center'}).setLngLat([f.lng,f.lat]).addTo(map);
  });

  // User location marker
  ${userLocation ? `
  var userEl=document.createElement('div');
  userEl.className='user-loc';
  new mapboxgl.Marker({element:userEl,anchor:'center'}).setLngLat([${userLocation.lng},${userLocation.lat}]).addTo(map);
  map.flyTo({center:[${userLocation.lng},${userLocation.lat}],zoom:12,duration:1000});
  ` : ''}
});

map.on('moveend',function(){var c=map.getCenter();window.ReactNativeWebView.postMessage(JSON.stringify({type:'center',lat:c.lat,lng:c.lng}))});
window.flyTo=function(lng,lat){map.flyTo({center:[lng,lat],zoom:14,duration:800})};
</` + `script>
</body></html>`
}

export default function ExploreScreen() {
  const { user } = useSession()
  const router = useRouter()
  const [activities, setActivities] = useState<Activity[]>([])
  const [friends, setFriends] = useState<FriendPin[]>([])
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSport, setSelectedSport] = useState<string | null>(null)
  const [timeframeDays, setTimeframeDays] = useState(7)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [locationReady, setLocationReady] = useState(false)
  const mapCenterRef = useRef({ lat: 34.0522, lng: -118.2437 })
  const webViewRef = useRef<WebView>(null)

  // Get user location — wait for it before showing map
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude })

          // Update server
          if (user) {
            apiPost('/api/location', {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            }).then(() => {})
          }
        }
      } catch {
        // Location failed — proceed with default
      }
      setLocationReady(true)
    })()

    // Don't block forever if location is slow
    timeout = setTimeout(() => setLocationReady(true), 2000)
    return () => clearTimeout(timeout)
  }, [user])

  const fetchData = useCallback(async () => {
    if (!user) return

    const [activitiesResult, friendsResult] = await Promise.all([
      apiFetch<Array<{
        id: string
        title: string
        sport_type: string
        skill_level: string
        creator_id: string
        location_name: string
        location_lat: string | null
        location_lng: string | null
        scheduled_at: string
        max_participants: number
      }>>('/api/activities'),

      apiFetch<Array<{
        id: string
        display_name: string
        first_name: string | null
        last_name: string | null
        avatar_url: string | null
        last_location_lat: string | null
        last_location_lng: string | null
        last_location_at: string | null
      }>>('/api/friends'),
    ])

    setActivities(
      (activitiesResult.data ?? []).map((a) => ({
        ...a,
        participantStatus: null,
        isOwner: a.creator_id === user.id,
      }))
    )

    // Filter friends to those with recent location data (within 24h)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const friendsData = friendsResult.data ?? []

    setFriends(
      friendsData
        .filter((f) =>
          f.last_location_lat &&
          f.last_location_lng &&
          f.last_location_at &&
          f.last_location_at >= cutoff
        )
        .map((f) => ({
          id: f.id,
          name: f.first_name && f.last_name ? `${f.first_name} ${f.last_name[0]}.` : f.display_name,
          avatarUrl: f.avatar_url,
          initial: (f.first_name?.[0] ?? f.display_name[0]).toUpperCase(),
          lat: parseFloat(f.last_location_lat!),
          lng: parseFloat(f.last_location_lng!),
        }))
    )
  }, [user])

  const pathname = usePathname()

  useEffect(() => {
    fetchData().finally(() => setIsLoading(false))
  }, [fetchData])

  // Refetch when navigating back to this tab
  useEffect(() => {
    if (pathname === '/explore' && !isLoading) {
      fetchData()
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = activities.filter((a) => {
    if (selectedSport && a.sport_type !== selectedSport) return false
    const scheduled = new Date(a.scheduled_at)
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + timeframeDays)
    endDate.setHours(23, 59, 59)
    if (scheduled > endDate) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      if (
        !a.title.toLowerCase().includes(q) &&
        !a.location_name.toLowerCase().includes(q) &&
        !(SPORT_LABELS[a.sport_type] ?? a.sport_type).toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const activeTimeLabel = TIMEFRAMES.find((t) => t.days === timeframeDays)?.label ?? 'Week'

  function handleMapMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'pin' && msg.id) {
        router.push(`/activity/${msg.id}`)
      } else if (msg.type === 'center') {
        mapCenterRef.current = { lat: msg.lat, lng: msg.lng }
      } else if (msg.type === 'error') {
        console.warn('Map error:', msg.msg)
      } else if (msg.type === 'loaded') {
        console.log('Map loaded with', msg.count, 'pins')
      }
    } catch {
      // ignore
    }
  }

  if (isLoading || !locationReady) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    )
  }

  return (
    <View style={s.container}>
      {/* Map */}
      <View style={s.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: buildMapHtml(filtered, friends, userLocation, mapboxToken) }}
          style={s.map}
          onMessage={handleMapMessage}
          scrollEnabled={false}
          javaScriptEnabled
        />

        {/* Search bar + results */}
        <View style={s.searchOverlay}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search activities, locations..."
            overlay
          />
          {searchQuery.trim().length > 0 && (
            <View style={s.searchResults}>
              {filtered.length === 0 ? (
                <View style={s.searchEmpty}>
                  <Text style={s.searchEmptyText}>No activities found</Text>
                </View>
              ) : (
                <ScrollView keyboardShouldPersistTaps="handled" style={s.searchScroll}>
                  {filtered.slice(0, 8).map((a) => {
                    const scheduled = new Date(a.scheduled_at)
                    const dateStr = scheduled.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    return (
                      <Pressable
                        key={a.id}
                        style={s.searchItem}
                        onPress={() => {
                          setSearchQuery('')
                          router.push(`/activity/${a.id}`)
                        }}
                      >
                        <Text style={s.searchEmoji}>{SPORT_EMOJI[a.sport_type] ?? '\u{1F3DE}'}</Text>
                        <View style={s.searchItemText}>
                          <Text style={s.searchTitle} numberOfLines={1}>{a.title}</Text>
                          <Text style={s.searchMeta} numberOfLines={1}>{a.location_name} · {dateStr}</Text>
                        </View>
                      </Pressable>
                    )
                  })}
                  {filtered.length > 8 && (
                    <Text style={s.searchMore}>{filtered.length - 8} more results</Text>
                  )}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        {/* Filter bar at bottom */}
        <View style={s.filterOverlay}>
          <BlurView intensity={80} tint="light" style={s.filterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterContent}>
              <Pressable
                style={[s.filterPill, !selectedSport && s.filterPillActive]}
                onPress={() => setSelectedSport(null)}
              >
                <Text style={[s.filterText, !selectedSport && s.filterTextActive]}>All</Text>
              </Pressable>
              {Object.entries(SPORT_LABELS).map(([key, label]) => (
                <Pressable
                  key={key}
                  style={[s.filterPill, selectedSport === key && s.filterPillActive]}
                  onPress={() => setSelectedSport(selectedSport === key ? null : key)}
                >
                  <Text style={[s.filterText, selectedSport === key && s.filterTextActive]}>{label}</Text>
                </Pressable>
              ))}

              <View style={s.filterDivider} />

              {/* Calendar button */}
              <Pressable
                style={[s.filterPill, s.calendarPill]}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={s.calendarIcon}>{'\u{1F4C5}'}</Text>
                <Text style={s.calendarLabel}>{activeTimeLabel}</Text>
              </Pressable>
            </ScrollView>
          </BlurView>
        </View>
      </View>

      <FloatingActionButton lat={mapCenterRef.current.lat} lng={mapCenterRef.current.lng} />

      {/* Time picker modal */}
      <Modal visible={showTimePicker} transparent animationType="fade">
        <Pressable style={s.modalBackdrop} onPress={() => setShowTimePicker(false)}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Show activities within</Text>
            {TIMEFRAMES.map(({ label, days }) => (
              <Pressable
                key={label}
                style={[s.modalOption, timeframeDays === days && s.modalOptionActive]}
                onPress={() => { setTimeframeDays(days); setShowTimePicker(false) }}
              >
                <Text style={[s.modalOptionText, timeframeDays === days && s.modalOptionTextActive]}>
                  {label}
                </Text>
                {timeframeDays === days && <Text style={s.modalCheck}>{'\u2713'}</Text>}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },

  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1, backgroundColor: '#e8e0d8' },

  searchOverlay: { position: 'absolute', top: 8, left: 0, right: 0, zIndex: 10 },
  searchResults: {
    marginHorizontal: 12,
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  searchScroll: { maxHeight: 280 },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  searchEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
  searchItemText: { flex: 1 },
  searchTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  searchMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  searchEmpty: { paddingVertical: 20, alignItems: 'center' },
  searchEmptyText: { fontSize: 14, color: '#9ca3af' },
  searchMore: { fontSize: 12, color: '#9ca3af', textAlign: 'center', paddingVertical: 10 },

  filterOverlay: { position: 'absolute', bottom: 16, left: 0, right: 0, paddingHorizontal: 8 },
  filterBar: { borderRadius: 16, overflow: 'hidden' },
  filterContent: { paddingHorizontal: 10, paddingVertical: 8, gap: 6, flexDirection: 'row', alignItems: 'center' },
  filterPill: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#e5e5e5' },
  filterPillActive: { backgroundColor: '#0f8a6e', borderColor: '#0f8a6e' },
  filterText: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  filterDivider: { width: 1, height: 20, backgroundColor: '#d1d5db', marginHorizontal: 2 },
  calendarPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calendarIcon: { fontSize: 14 },
  calendarLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280' },

  // Time picker modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: 280, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 16 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 16, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 4 },
  modalOptionActive: { backgroundColor: 'rgba(15,138,110,0.1)' },
  modalOptionText: { fontSize: 15, color: C.text },
  modalOptionTextActive: { color: C.primary, fontWeight: '600' },
  modalCheck: { fontSize: 16, color: C.primary, fontWeight: '700' },
})
