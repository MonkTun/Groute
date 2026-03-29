'use client'

import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Loader2 } from 'lucide-react'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

const TRAIL_COLOR = '#16a34a'
const APPROACH_COLOR = '#f97316'

interface TrailMapViewProps {
  locationLat: number
  locationLng: number
  locationName: string
  trailOsmId: number
  trailName: string
  trailheadLat: number
  trailheadLng: number
  hasApproachRoute?: boolean
  /** Pre-loaded trail geometry JSON string — skips Overpass fetch */
  trailGeometry?: string | null
  /** Pre-loaded approach route geometry JSON string — skips Mapbox fetch */
  approachGeometry?: string | null
  height?: number
}

function parseGeometry(json: string | null | undefined): [number, number][] | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
    return null
  } catch {
    return null
  }
}

export function TrailMapView({
  locationLat,
  locationLng,
  locationName,
  trailOsmId,
  trailName,
  trailheadLat,
  trailheadLng,
  hasApproachRoute = true,
  trailGeometry,
  approachGeometry,
  height = 280,
}: TrailMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!containerRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [trailheadLng, trailheadLat],
      zoom: 14,
      interactive: true,
    })

    m.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    mapRef.current = m

    m.on('load', async () => { try {
      // Location marker (dark)
      new mapboxgl.Marker({ color: '#1a1a1a', scale: 0.8 })
        .setLngLat([locationLng, locationLat])
        .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setText(locationName))
        .addTo(m)

      // Trailhead marker (green)
      new mapboxgl.Marker({ color: TRAIL_COLOR, scale: 0.7 })
        .setLngLat([trailheadLng, trailheadLat])
        .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setText(`${trailName} trailhead`))
        .addTo(m)

      const bounds = new mapboxgl.LngLatBounds()
      bounds.extend([locationLng, locationLat])
      bounds.extend([trailheadLng, trailheadLat])

      // Use cached geometry if available, otherwise fetch from API
      const cachedTrail = parseGeometry(trailGeometry)
      const cachedApproach = parseGeometry(approachGeometry)

      let trailCoords: [number, number][] | null = cachedTrail
      let approachCoords: [number, number][] | null = cachedApproach

      if (!trailCoords || (!approachCoords && hasApproachRoute)) {
        try {
          const [fetchedTrail, fetchedApproach] = await Promise.all([
            !trailCoords ? fetchTrailGeometry(trailOsmId) : Promise.resolve(null),
            !approachCoords && hasApproachRoute
              ? fetchApproachRoute(locationLat, locationLng, trailheadLat, trailheadLng)
              : Promise.resolve(null),
          ])
          if (!trailCoords) trailCoords = fetchedTrail
          if (!approachCoords) approachCoords = fetchedApproach
        } catch {
          // Fetch failed — render map with just the markers
        }
      }

      // Render trail
      if (trailCoords && trailCoords.length > 0) {
        m.addSource('trail', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: trailCoords },
          },
        })

        m.addLayer({
          id: 'trail-line',
          type: 'line',
          source: 'trail',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': TRAIL_COLOR, 'line-width': 4, 'line-opacity': 0.9 },
        })

        for (const [lng, lat] of trailCoords) {
          bounds.extend([lng, lat])
        }
      }

      // Render approach route
      if (approachCoords && approachCoords.length > 0) {
        m.addSource('approach', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: approachCoords },
          },
        })

        m.addLayer({
          id: 'approach-line',
          type: 'line',
          source: 'approach',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': APPROACH_COLOR,
            'line-width': 3,
            'line-opacity': 0.8,
            'line-dasharray': [2, 2],
          },
        })
      }

      m.fitBounds(bounds, { padding: 45, maxZoom: 16, duration: 0 })
    } finally {
      setIsLoading(false)
    } })

    return () => {
      m.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailOsmId])

  return (
    <div className="relative overflow-hidden rounded-xl border border-border" style={{ height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/50">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-1 rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] shadow-sm backdrop-blur-sm dark:bg-black/80">
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 rounded-full" style={{ backgroundColor: TRAIL_COLOR }} />
          <span>Trail</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 rounded-full border-t border-dashed" style={{ borderColor: APPROACH_COLOR }} />
          <span>Walk to trailhead</span>
        </div>
      </div>
    </div>
  )
}

async function fetchTrailGeometry(osmId: number): Promise<[number, number][] | null> {
  try {
    const res = await fetch(`/api/trails/geometry?osmId=${osmId}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.data ?? null
  } catch {
    return null
  }
}

async function fetchApproachRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<[number, number][] | null> {
  try {
    const params = new URLSearchParams({
      fromLat: String(fromLat),
      fromLng: String(fromLng),
      toLat: String(toLat),
      toLng: String(toLng),
    })
    const res = await fetch(`/api/trails/approach?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.data?.coordinates ?? null
  } catch {
    return null
  }
}
