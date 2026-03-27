'use client'

import {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface ActivityMarker {
  id: string
  title: string
  sportType: string
  skillLevel: string
  locationLat: string | null
  locationLng: string | null
  locationName: string
  scheduledAt: string
  maxParticipants: number
  creator: {
    displayName: string
    firstName: string | null
    lastName: string | null
    area: string | null
  } | null
}

interface FriendPin {
  id: string
  name: string
  avatarUrl?: string | null
  initial: string
  lat: number
  lng: number
}

interface DiscoverMapProps {
  activities: ActivityMarker[]
  selectedSport: string | null
  hoveredActivityId: string | null
  onActivitySelect: (id: string) => void
  onUserLocationChange?: (lat: number, lng: number) => void
  friends?: FriendPin[]
}

export interface DiscoverMapHandle {
  flyTo: (lng: number, lat: number) => void
}

const LA_CENTER: [number, number] = [-118.2437, 34.0522]
const SOURCE_ID = 'activities'
const CLUSTER_LAYER = 'clusters'
const CLUSTER_COUNT_LAYER = 'cluster-count'
const POINT_LAYER = 'unclustered-point'
const POINT_LABEL_LAYER = 'unclustered-label'

const SKILL_COLORS: [string, string][] = [
  ['beginner', '#22c55e'],
  ['intermediate', '#3b82f6'],
  ['advanced', '#f97316'],
]

const SPORT_EMOJI: Record<string, string> = {
  hiking: '\u{1F97E}', climbing: '\u{1FA78}', trail_running: '\u{1F3C3}',
  surfing: '\u{1F3C4}', cycling: '\u{1F6B4}', mountain_biking: '\u{1F6B5}',
  skiing: '\u{26F7}', kayaking: '\u{1F6F6}', yoga: '\u{1F9D8}',
}

export const DiscoverMap = forwardRef<DiscoverMapHandle, DiscoverMapProps>(
  function DiscoverMap(
    { activities, selectedSport, hoveredActivityId, onActivitySelect, onUserLocationChange, friends = [] },
    ref
  ) {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<mapboxgl.Map | null>(null)
    const friendMarkersRef = useRef<mapboxgl.Marker[]>([])
    const [isMapReady, setIsMapReady] = useState(false)
    const prevHoveredRef = useRef<string | null>(null)

    useImperativeHandle(ref, () => ({
      flyTo(lng: number, lat: number) {
        map.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 800 })
      },
    }))

    // Initialize map
    useEffect(() => {
      if (!mapContainer.current || map.current) return

      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

      const m = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        center: LA_CENTER,
        zoom: 11,
      })

      m.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      })
      m.addControl(geolocate, 'bottom-right')

      geolocate.on('geolocate', (e: GeolocationPosition) => {
        onUserLocationChange?.(e.coords.latitude, e.coords.longitude)
      })

      m.on('load', () => {
        // Add empty source with clustering + per-sport count aggregation
        m.addSource(SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
          clusterProperties: {
            // Count each sport type in the cluster
            hiking:          ['+', ['case', ['==', ['get', 'sportType'], 'hiking'], 1, 0]],
            climbing:        ['+', ['case', ['==', ['get', 'sportType'], 'climbing'], 1, 0]],
            trail_running:   ['+', ['case', ['==', ['get', 'sportType'], 'trail_running'], 1, 0]],
            surfing:         ['+', ['case', ['==', ['get', 'sportType'], 'surfing'], 1, 0]],
            cycling:         ['+', ['case', ['==', ['get', 'sportType'], 'cycling'], 1, 0]],
            mountain_biking: ['+', ['case', ['==', ['get', 'sportType'], 'mountain_biking'], 1, 0]],
            skiing:          ['+', ['case', ['==', ['get', 'sportType'], 'skiing'], 1, 0]],
            kayaking:        ['+', ['case', ['==', ['get', 'sportType'], 'kayaking'], 1, 0]],
            yoga:            ['+', ['case', ['==', ['get', 'sportType'], 'yoga'], 1, 0]],
          },
        })

        // Cluster outer ring — warm dark background
        m.addLayer({
          id: CLUSTER_LAYER,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#1e293b',
            'circle-opacity': 0.92,
            'circle-radius': [
              'step', ['get', 'point_count'],
              20,
              5, 24,
              20, 30,
              50, 36,
            ],
            'circle-stroke-width': 3,
            'circle-stroke-color': '#f97316',
            'circle-stroke-opacity': 0.8,
          },
        })

        // Cluster count + emoji label (count on top, emojis handled via DOM below)
        m.addLayer({
          id: CLUSTER_COUNT_LAYER,
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-size': 14,
            'text-allow-overlap': true,
            'text-offset': [0, -0.1],
          },
          paint: {
            'text-color': '#ffffff',
          },
        })

        // Individual pins — orange/coral base, not green
        m.addLayer({
          id: POINT_LAYER,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': [
              'match', ['get', 'skillLevel'],
              'beginner', '#f59e0b',
              'intermediate', '#3b82f6',
              'advanced', '#ef4444',
              '#94a3b8',
            ],
            'circle-radius': [
              'case',
              ['boolean', ['feature-state', 'hovered'], false],
              12,
              9,
            ],
            'circle-stroke-width': [
              'case',
              ['boolean', ['feature-state', 'hovered'], false],
              3,
              2.5,
            ],
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9,
          },
        })

        // Emoji labels on individual pins
        m.addLayer({
          id: POINT_LABEL_LAYER,
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          layout: {
            'text-field': ['get', 'emoji'],
            'text-size': 14,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-offset': [0, 0],
          },
        })

        // Cluster emoji summary — show top sport emojis below count
        m.addLayer({
          id: 'cluster-emojis',
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': [
              'let', 'emojis', ['concat',
                ['case', ['>', ['get', 'hiking'], 0], '\u{1F97E}', ''],
                ['case', ['>', ['get', 'surfing'], 0], '\u{1F3C4}', ''],
                ['case', ['>', ['get', 'climbing'], 0], '\u{1FA78}', ''],
                ['case', ['>', ['get', 'trail_running'], 0], '\u{1F3C3}', ''],
                ['case', ['>', ['get', 'cycling'], 0], '\u{1F6B4}', ''],
                ['case', ['>', ['get', 'mountain_biking'], 0], '\u{1F6B5}', ''],
                ['case', ['>', ['get', 'skiing'], 0], '\u{26F7}', ''],
                ['case', ['>', ['get', 'kayaking'], 0], '\u{1F6F6}', ''],
                ['case', ['>', ['get', 'yoga'], 0], '\u{1F9D8}', ''],
              ],
              ['var', 'emojis'],
            ],
            'text-size': 10,
            'text-allow-overlap': true,
            'text-offset': [0, 1.3],
          },
        })

        // Click cluster → zoom in
        m.on('click', CLUSTER_LAYER, (e) => {
          const features = m.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] })
          if (!features.length) return
          const clusterId = features[0].properties?.cluster_id
          const source = m.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource
          source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err || zoom == null) return
            const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number]
            m.flyTo({ center: coords, zoom, duration: 500 })
          })
        })

        // Click individual pin → select activity
        m.on('click', POINT_LAYER, (e) => {
          const features = m.queryRenderedFeatures(e.point, { layers: [POINT_LAYER] })
          if (!features.length) return
          const id = features[0].properties?.id
          if (id) onActivitySelect(id)
        })

        // Cursor changes
        m.on('mouseenter', CLUSTER_LAYER, () => { m.getCanvas().style.cursor = 'pointer' })
        m.on('mouseleave', CLUSTER_LAYER, () => { m.getCanvas().style.cursor = '' })
        m.on('mouseenter', POINT_LAYER, () => { m.getCanvas().style.cursor = 'pointer' })
        m.on('mouseleave', POINT_LAYER, () => { m.getCanvas().style.cursor = '' })

        setIsMapReady(true)
        geolocate.trigger()
      })

      map.current = m

      return () => {
        m.remove()
        map.current = null
      }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Update GeoJSON data when activities or filter changes
    useEffect(() => {
      if (!map.current || !isMapReady) return

      const source = map.current.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      if (!source) return

      const filtered = selectedSport
        ? activities.filter((a) => a.sportType === selectedSport)
        : activities

      const features: GeoJSON.Feature<GeoJSON.Point>[] = filtered
        .filter((a) => a.locationLat && a.locationLng)
        .map((a) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(a.locationLng!), parseFloat(a.locationLat!)],
          },
          properties: {
            id: a.id,
            skillLevel: a.skillLevel,
            sportType: a.sportType,
            emoji: SPORT_EMOJI[a.sportType] ?? '\u{1F3DE}',
            title: a.title,
          },
          id: a.id,
        }))

      source.setData({ type: 'FeatureCollection', features })
    }, [activities, selectedSport, isMapReady])

    // Render friend location markers (DOM-based for avatar styling)
    useEffect(() => {
      if (!map.current || !isMapReady) return

      // Clear existing friend markers
      friendMarkersRef.current.forEach((m) => m.remove())
      friendMarkersRef.current = []

      friends.forEach((friend) => {
        const el = document.createElement('div')
        el.style.cssText = 'width:34px;height:34px;cursor:pointer;'

        let avatar: HTMLElement
        if (friend.avatarUrl) {
          const img = document.createElement('img')
          img.src = friend.avatarUrl
          img.style.cssText = 'width:34px;height:34px;border-radius:50%;object-fit:cover;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:block;'
          avatar = img
        } else {
          const div = document.createElement('div')
          div.style.cssText = 'width:34px;height:34px;border-radius:50%;background:#6366f1;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;box-shadow:0 2px 8px rgba(0,0,0,0.3);'
          div.textContent = friend.initial
          avatar = div
        }
        el.appendChild(avatar)

        // Name label below — positioned relative to the fixed-size container
        const label = document.createElement('div')
        label.style.cssText = 'position:absolute;top:38px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:10px;font-weight:600;color:#1e293b;background:white;padding:1px 6px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.15);pointer-events:none;'
        label.textContent = friend.name
        el.appendChild(label)

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([friend.lng, friend.lat])
          .addTo(map.current!)

        friendMarkersRef.current.push(marker)
      })
    }, [friends, isMapReady])

    // Hover highlight from feed
    useEffect(() => {
      if (!map.current || !isMapReady) return

      // Remove previous hover
      if (prevHoveredRef.current) {
        map.current.setFeatureState(
          { source: SOURCE_ID, id: prevHoveredRef.current },
          { hovered: false }
        )
      }

      // Set new hover
      if (hoveredActivityId) {
        map.current.setFeatureState(
          { source: SOURCE_ID, id: hoveredActivityId },
          { hovered: true }
        )
      }

      prevHoveredRef.current = hoveredActivityId
    }, [hoveredActivityId, isMapReady])

    return <div ref={mapContainer} className="size-full" />
  }
)
