'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { SAC_SCALE_LABELS, SURFACE_LABELS } from '@groute/shared'
import type { Trail } from '@groute/shared'
import { Mountain, Ruler, Footprints, Loader2, X } from 'lucide-react'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

const TRAIL_COLOR_DEFAULT = '#94a3b8'
const TRAIL_COLOR_HOVER = '#3b82f6'
const TRAIL_COLOR_SELECTED = '#16a34a'

interface TrailPickerProps {
  latitude: number
  longitude: number
  selectedTrail: Trail | null
  onSelect: (trail: Trail | null) => void
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`
  const miles = meters / 1609.344
  return `${miles.toFixed(1)} mi`
}

/** Trail coordinates are stored as [lat, lng], GeoJSON needs [lng, lat] */
function trailsToGeoJSON(trails: Trail[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: trails.map((trail) => ({
      type: 'Feature',
      properties: { osmId: trail.osmId, name: trail.name },
      geometry: {
        type: 'LineString',
        coordinates: trail.coordinates.map(([lat, lng]) => [lng, lat]),
      },
    })),
  }
}

function getBounds(trails: Trail[]): mapboxgl.LngLatBoundsLike {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
  for (const trail of trails) {
    for (const [lat, lng] of trail.coordinates) {
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
    }
  }
  return [[minLng, minLat], [maxLng, maxLat]]
}

// ─── Trail Map (isolated so mapbox lifecycle is clean) ────────────────────────

function TrailMap({
  trails,
  centerLat,
  centerLng,
  hoveredOsmId,
  selectedTrail,
}: {
  trails: Trail[]
  centerLat: number
  centerLng: number
  hoveredOsmId: number | null
  selectedTrail: Trail | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const readyRef = useRef(false)

  // Create map on mount
  useEffect(() => {
    if (!containerRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [centerLng, centerLat],
      zoom: 13,
    })

    m.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    m.on('load', () => {
      // Location marker
      new mapboxgl.Marker({ color: '#1a1a1a', scale: 0.7 })
        .setLngLat([centerLng, centerLat])
        .addTo(m)

      // Trail source
      m.addSource('trails', {
        type: 'geojson',
        data: trailsToGeoJSON(trails),
      })

      // Default lines
      m.addLayer({
        id: 'trails-default',
        type: 'line',
        source: 'trails',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': TRAIL_COLOR_DEFAULT,
          'line-width': 3.5,
          'line-opacity': 0.7,
        },
      })

      // Hover layer
      m.addLayer({
        id: 'trails-hover',
        type: 'line',
        source: 'trails',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': TRAIL_COLOR_HOVER,
          'line-width': 5,
          'line-opacity': 0.9,
        },
        filter: ['==', ['get', 'osmId'], -1],
      })

      // Selected layer
      m.addLayer({
        id: 'trails-selected',
        type: 'line',
        source: 'trails',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': TRAIL_COLOR_SELECTED,
          'line-width': 5,
          'line-opacity': 1,
        },
        filter: ['==', ['get', 'osmId'], -1],
      })

      // Fit to all trails
      if (trails.length > 0) {
        m.fitBounds(getBounds(trails), { padding: 40, maxZoom: 15, duration: 0 })
      }

      readyRef.current = true
    })

    mapRef.current = m

    return () => {
      readyRef.current = false
      m.remove()
      mapRef.current = null
    }
    // Only re-create when the trail data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trails])

  // Hover highlight
  useEffect(() => {
    const m = mapRef.current
    if (!m || !readyRef.current) return
    m.setFilter('trails-hover', ['==', ['get', 'osmId'], hoveredOsmId ?? -1])
  }, [hoveredOsmId])

  // Selection highlight + fly
  useEffect(() => {
    const m = mapRef.current
    if (!m || !readyRef.current) return

    if (selectedTrail) {
      m.setFilter('trails-selected', ['==', ['get', 'osmId'], selectedTrail.osmId])
      m.setPaintProperty('trails-default', 'line-opacity', 0.25)
      m.fitBounds(getBounds([selectedTrail]), { padding: 50, maxZoom: 16, duration: 500 })
    } else {
      m.setFilter('trails-selected', ['==', ['get', 'osmId'], -1])
      m.setPaintProperty('trails-default', 'line-opacity', 0.7)
      if (trails.length > 0) {
        m.fitBounds(getBounds(trails), { padding: 40, maxZoom: 15, duration: 500 })
      }
    }
  }, [selectedTrail, trails])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// ─── Main TrailPicker component ───────────────────────────────────────────────

export function TrailPicker({ latitude, longitude, selectedTrail, onSelect }: TrailPickerProps) {
  const [trails, setTrails] = useState<Trail[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredOsmId, setHoveredOsmId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchTrails() {
      setIsLoading(true)
      setError(null)
      setTrails([])

      try {
        const params = new URLSearchParams({
          lat: String(latitude),
          lng: String(longitude),
          radius: '5000',
        })
        const res = await fetch(`/api/trails?${params}`)

        if (cancelled) return

        if (!res.ok) {
          setError('Could not load trails')
          return
        }

        const data = await res.json()
        setTrails(data.data ?? [])
      } catch {
        if (!cancelled) setError('Could not load trails')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchTrails()
    return () => { cancelled = true }
  }, [latitude, longitude])

  const handleHover = useCallback((osmId: number | null) => {
    setHoveredOsmId(osmId)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-3">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Searching for nearby trails...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-3">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (trails.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-3">
        <p className="text-sm text-muted-foreground">No named trails found nearby. You can still create the activity without a trail.</p>
      </div>
    )
  }

  return (
    <div className="flex overflow-hidden rounded-lg border border-border/50" style={{ height: '320px' }}>
      {/* Trail list */}
      <div className="w-52 shrink-0 overflow-y-auto border-r border-border/50 scrollbar-none">
        {trails.map((trail) => {
          const isSelected = selectedTrail?.osmId === trail.osmId
          const isHovered = hoveredOsmId === trail.osmId

          return (
            <button
              key={trail.osmId}
              type="button"
              onClick={() => onSelect(isSelected ? null : trail)}
              onMouseEnter={() => handleHover(trail.osmId)}
              onMouseLeave={() => handleHover(null)}
              className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors border-b border-border/30 last:border-b-0 ${
                isSelected
                  ? 'bg-green-50 dark:bg-green-950/30'
                  : isHovered
                    ? 'bg-blue-50 dark:bg-blue-950/20'
                    : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {isSelected && <Mountain className="size-3.5 shrink-0 text-green-600" />}
                <span className={`truncate text-sm font-medium ${
                  isSelected ? 'text-green-700 dark:text-green-400' : ''
                }`}>
                  {trail.name}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Ruler className="size-2.5" />
                  {formatDistance(trail.distanceMeters)}
                </span>
                {trail.sacScale && (
                  <span className="flex items-center gap-0.5">
                    <Footprints className="size-2.5" />
                    {SAC_SCALE_LABELS[trail.sacScale]?.split(' — ')[0] ?? trail.sacScale}
                  </span>
                )}
                <span>{SURFACE_LABELS[trail.surface] ?? trail.surface}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Map */}
      <div className="relative flex-1">
        <TrailMap
          trails={trails}
          centerLat={latitude}
          centerLng={longitude}
          hoveredOsmId={hoveredOsmId}
          selectedTrail={selectedTrail}
        />

        {/* Selected trail chip */}
        {selectedTrail && (
          <div className="absolute left-2 top-2 z-10 flex items-center gap-2 rounded-lg bg-white/90 px-2.5 py-1.5 shadow-sm backdrop-blur-sm dark:bg-black/80">
            <Mountain className="size-3.5 text-green-600" />
            <span className="max-w-40 truncate text-xs font-medium">{selectedTrail.name}</span>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
