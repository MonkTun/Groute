'use client'

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// Only need sport emojis — detail is shown in the sheet now

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

interface DiscoverMapProps {
  activities: ActivityMarker[]
  selectedSport: string | null
  hoveredActivityId: string | null
  onActivitySelect: (id: string) => void
}

export interface DiscoverMapHandle {
  flyTo: (lng: number, lat: number) => void
}

const LA_CENTER: [number, number] = [-118.2437, 34.0522]

export const DiscoverMap = forwardRef<DiscoverMapHandle, DiscoverMapProps>(
  function DiscoverMap(
    { activities, selectedSport, hoveredActivityId, onActivitySelect },
    ref
  ) {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<mapboxgl.Map | null>(null)
    const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
    const [isMapReady, setIsMapReady] = useState(false)

    useImperativeHandle(ref, () => ({
      flyTo(lng: number, lat: number) {
        map.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 800 })
      },
    }))

    useEffect(() => {
      if (!mapContainer.current || map.current) return

      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: LA_CENTER,
        zoom: 11,
      })

      map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right')
      map.current.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
        }),
        'bottom-right'
      )

      map.current.on('load', () => setIsMapReady(true))

      return () => {
        map.current?.remove()
        map.current = null
      }
    }, [])

    const updateMarkers = useCallback(() => {
      // Clear existing markers
      markersRef.current.forEach((m) => m.remove())
      markersRef.current.clear()

      if (!map.current || !isMapReady) return

      const filtered = selectedSport
        ? activities.filter((a) => a.sportType === selectedSport)
        : activities

      filtered.forEach((activity) => {
        if (!activity.locationLat || !activity.locationLng) return

        const lng = parseFloat(activity.locationLng)
        const lat = parseFloat(activity.locationLat)
        if (isNaN(lng) || isNaN(lat)) return

        const el = document.createElement('div')
        el.className = 'activity-marker'
        el.dataset.activityId = activity.id

        const inner = document.createElement('div')
        inner.style.cssText =
          'width:32px;height:32px;border-radius:50%;background:#1a1a1a;border:2px solid white;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:scale 0.12s ease,box-shadow 0.12s ease;'
        inner.textContent = getSportEmoji(activity.sportType)
        el.appendChild(inner)
        el.addEventListener('click', () => onActivitySelect(activity.id))

        const marker = new mapboxgl.Marker(el)
          .setLngLat([lng, lat])
          .addTo(map.current!)

        markersRef.current.set(activity.id, marker)
      })
    }, [activities, selectedSport, isMapReady, onActivitySelect])

    useEffect(() => {
      updateMarkers()
    }, [updateMarkers])

    // Highlight hovered marker
    useEffect(() => {
      markersRef.current.forEach((marker, id) => {
        const inner = marker.getElement().querySelector('div') as HTMLDivElement | null
        if (!inner) return
        if (id === hoveredActivityId) {
          inner.style.scale = '1.3'
          inner.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)'
          marker.getElement().style.zIndex = '10'
        } else {
          inner.style.scale = '1'
          inner.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
          marker.getElement().style.zIndex = '1'
        }
      })
    }, [hoveredActivityId])

    return <div ref={mapContainer} className="size-full" />
  }
)

function getSportEmoji(sport: string): string {
  const emojis: Record<string, string> = {
    hiking: '\u{1F97E}',
    climbing: '\u{1FA78}',
    trail_running: '\u{1F3C3}',
    surfing: '\u{1F3C4}',
    cycling: '\u{1F6B4}',
    mountain_biking: '\u{1F6B5}',
    skiing: '\u{26F7}',
    kayaking: '\u{1F6F6}',
    yoga: '\u{1F9D8}',
  }
  return emojis[sport] ?? '\u{1F3DE}'
}

