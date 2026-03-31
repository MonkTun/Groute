'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { SAC_SCALE_LABELS, SURFACE_LABELS } from '@groute/shared'
import type { Trail, ApproachRoute } from '@groute/shared'
import { MapPin, Search, X, Mountain, Ruler, Footprints, Loader2, Clock } from 'lucide-react'

interface LocationValue {
  name: string
  latitude: number
  longitude: number
}

interface LocationTrailStepProps {
  location: LocationValue | null
  onLocationChange: (location: LocationValue) => void
  isTrailSport: boolean
  selectedTrail: Trail | null
  onTrailSelect: (trail: Trail | null) => void
  onApproachRouteChange: (route: ApproachRoute | null) => void
  initialMapCenter?: { lat: number; lng: number } | null
}

interface GeocodingResult {
  id: string
  place_name: string
  center: [number, number]
}

const LA_CENTER: [number, number] = [-118.2437, 34.0522]
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

const TRAIL_COLOR_DEFAULT = '#94a3b8'
const TRAIL_COLOR_HOVER = '#3b82f6'
const TRAIL_COLOR_SELECTED = '#16a34a'
const APPROACH_COLOR = '#f97316' // orange-500
const TRAIL_SEARCH_RADIUS = 5000
const TRAIL_REFETCH_THRESHOLD = TRAIL_SEARCH_RADIUS / 2

/** Haversine distance in meters between two points */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`
  const miles = meters / 1609.344
  return `${miles.toFixed(1)} mi`
}

function formatDuration(seconds: number): string {
  const mins = Math.ceil(seconds / 60)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}

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

function getTrailBounds(trails: Trail[]): mapboxgl.LngLatBoundsLike {
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

export function LocationTrailStep({
  location,
  onLocationChange,
  isTrailSport,
  selectedTrail,
  onTrailSelect,
  onApproachRouteChange,
  initialMapCenter,
}: LocationTrailStepProps) {
  // Search state
  const [query, setQuery] = useState(location?.name ?? '')
  const [results, setResults] = useState<GeocodingResult[]>([])
  const [trailNameResults, setTrailNameResults] = useState<Array<{ osmId: number; name: string; location: string; lat: number; lng: number }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Trail state
  const [trails, setTrails] = useState<Trail[]>([])
  const [isLoadingTrails, setIsLoadingTrails] = useState(false)
  const [hoveredOsmId, setHoveredOsmId] = useState<number | null>(null)

  // Approach route state
  const [approachRoute, setApproachRoute] = useState<ApproachRoute | null>(null)
  const [isLoadingApproach, setIsLoadingApproach] = useState(false)

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const mapReadyRef = useRef(false)
  const trailsAddedRef = useRef(false)
  const approachAddedRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Tracks the origin point of the last trail search so we only re-fetch
  // when the user moves the pin beyond half the search radius.
  const trailSearchOriginRef = useRef<{ lat: number; lng: number } | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Geocoding ────────────────────────────────────────────────────────────

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setTrailNameResults([]); return }
    setIsSearching(true)
    try {
      const proximity = initialMapCenter
        ? `${initialMapCenter.lng},${initialMapCenter.lat}`
        : `${LA_CENTER[0]},${LA_CENTER[1]}`

      // Geocoding first (fast) — show results immediately
      const geocodeRes = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${new URLSearchParams({
          access_token: MAPBOX_TOKEN,
          proximity,
          types: 'address,poi,place,neighborhood,locality',
          limit: '4',
          language: 'en',
        })}`
      )

      if (geocodeRes.ok) {
        const data = await geocodeRes.json()
        setResults(data.features ?? [])
        setShowResults(true)
      }

      setIsSearching(false)

      // Trail name search via Nominatim (direct, no auth needed)
      if (q.length >= 3) {
        const hasTrailKeyword = /trail|hike|path|peak|canyon|falls|landing/i.test(q)
        const nominatimQuery = hasTrailKeyword ? q : q + ' trail'
        fetch(
          `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
            q: nominatimQuery,
            format: 'json',
            limit: '4',
          })}`,
          { headers: { 'User-Agent': 'Groute/1.0' } }
        )
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json()
              const trails = data
                .filter((r: { lat: string; lon: string }) => r.lat && r.lon)
                .map((r: { place_id: number; lat: string; lon: string; display_name: string; name?: string }) => {
                  const parts = r.display_name.split(',').map((s: string) => s.trim())
                  return {
                    osmId: r.place_id,
                    name: r.name || parts[0],
                    location: parts.slice(1, 3).join(', '), // e.g. "Washington County, Utah"
                    lat: parseFloat(r.lat),
                    lng: parseFloat(r.lon),
                  }
                })
              setTrailNameResults(trails)
              if (trails.length > 0) setShowResults(true)
            }
          })
          .catch(() => setTrailNameResults([]))
      } else {
        setTrailNameResults([])
      }
    } catch {
      setIsSearching(false)
    }
  }, [initialMapCenter])

  function handleInputChange(val: string) {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  async function reverseGeocode(lng: number, lat: number) {
    try {
      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        types: 'address,poi,place,neighborhood',
        limit: '1',
        language: 'en',
      })
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?${params}`
      )
      if (res.ok) {
        const data = await res.json()
        const name = data.features?.[0]?.place_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        onLocationChange({ name, latitude: lat, longitude: lng })
        setQuery(name)
      }
    } catch {
      const name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      onLocationChange({ name, latitude: lat, longitude: lng })
      setQuery(name)
    }
  }

  function handleSelectResult(result: GeocodingResult) {
    const [lng, lat] = result.center
    // Explicit search selection — always re-fetch trails
    trailSearchOriginRef.current = null
    onLocationChange({ name: result.place_name, latitude: lat, longitude: lng })
    setQuery(result.place_name)
    setResults([])
    setShowResults(false)
    onTrailSelect(null)
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setShowResults(false)
  }

  // ── Map lifecycle ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapContainerRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    // Priority: existing location > initialMapCenter from explore > LA fallback
    let center: [number, number]
    let zoom: number
    if (location) {
      center = [location.longitude, location.latitude]
      zoom = 14
    } else if (initialMapCenter) {
      center = [initialMapCenter.lng, initialMapCenter.lat]
      zoom = 13
    } else {
      center = LA_CENTER
      zoom = 10
    }

    const m = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center,
      zoom,
    })

    m.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    m.on('load', () => {
      mapReadyRef.current = true
      if (location) {
        addMarker(m, location.longitude, location.latitude)
      }
    })

    mapRef.current = m
    return () => {
      mapReadyRef.current = false
      trailsAddedRef.current = false
      approachAddedRef.current = false
      m.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addMarker(m: mapboxgl.Map, lng: number, lat: number) {
    if (markerRef.current) markerRef.current.remove()

    markerRef.current = new mapboxgl.Marker({ draggable: true, color: '#1a1a1a' })
      .setLngLat([lng, lat])
      .addTo(m)

    markerRef.current.on('dragend', () => {
      const lngLat = markerRef.current!.getLngLat()
      reverseGeocode(lngLat.lng, lngLat.lat)
    })
  }

  // Fly to location when it changes
  useEffect(() => {
    const m = mapRef.current
    if (!m || !mapReadyRef.current || !location) return

    m.flyTo({ center: [location.longitude, location.latitude], zoom: 14, duration: 500 })
    addMarker(m, location.longitude, location.latitude)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude])

  // ── Trail fetching ───────────────────────────────────────────────────────
  // Only re-fetch when location moves > half the search radius from the
  // last search origin, or when switching to a trail sport for the first time.

  useEffect(() => {
    if (!location || !isTrailSport) {
      setTrails([])
      trailSearchOriginRef.current = null
      return
    }

    // Check if we're still within range of the previous search
    const origin = trailSearchOriginRef.current
    if (origin) {
      const moved = haversineMeters(origin.lat, origin.lng, location.latitude, location.longitude)
      if (moved < TRAIL_REFETCH_THRESHOLD) return // skip re-fetch
    }

    let cancelled = false
    setIsLoadingTrails(true)
    setTrails([])

    async function fetchTrails() {
      try {
        const params = new URLSearchParams({
          lat: String(location!.latitude),
          lng: String(location!.longitude),
          radius: String(TRAIL_SEARCH_RADIUS),
        })
        const res = await fetch(`/api/trails?${params}`)
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          setTrails(data.data ?? [])
          trailSearchOriginRef.current = { lat: location!.latitude, lng: location!.longitude }
        }
      } catch { /* silent */ } finally {
        if (!cancelled) setIsLoadingTrails(false)
      }
    }

    fetchTrails()
    return () => { cancelled = true }
  }, [location?.latitude, location?.longitude, isTrailSport])

  // ── Approach route fetching ──────────────────────────────────────────────

  useEffect(() => {
    if (!selectedTrail || !location) {
      clearApproachLayer()
      setApproachRoute(null)
      onApproachRouteChange(null)
      return
    }

    let cancelled = false
    setIsLoadingApproach(true)

    async function fetchApproach() {
      const params = new URLSearchParams({
        fromLat: String(location!.latitude),
        fromLng: String(location!.longitude),
        toLat: String(selectedTrail!.trailheadLat),
        toLng: String(selectedTrail!.trailheadLng),
      })
      try {
        const res = await fetch(`/api/trails/approach?${params}`)
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          const route: ApproachRoute | null = data.data ?? null
          setApproachRoute(route)
          onApproachRouteChange(route)
          if (route) renderApproachLine(route)
        }
      } catch { /* silent */ } finally {
        if (!cancelled) setIsLoadingApproach(false)
      }
    }

    fetchApproach()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrail?.osmId, location?.latitude, location?.longitude])

  // ── Render trails on the map ─────────────────────────────────────────────

  useEffect(() => {
    const m = mapRef.current
    if (!m || !mapReadyRef.current) return

    // Clean up previous trail layers/source
    if (trailsAddedRef.current) {
      if (m.getLayer('trails-selected')) m.removeLayer('trails-selected')
      if (m.getLayer('trails-hover')) m.removeLayer('trails-hover')
      if (m.getLayer('trails-default')) m.removeLayer('trails-default')
      if (m.getSource('trails')) m.removeSource('trails')
      trailsAddedRef.current = false
    }

    if (trails.length === 0) return

    m.addSource('trails', { type: 'geojson', data: trailsToGeoJSON(trails) })

    m.addLayer({
      id: 'trails-default',
      type: 'line',
      source: 'trails',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': TRAIL_COLOR_DEFAULT, 'line-width': 3.5, 'line-opacity': 0.7 },
    })
    m.addLayer({
      id: 'trails-hover',
      type: 'line',
      source: 'trails',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': TRAIL_COLOR_HOVER, 'line-width': 5, 'line-opacity': 0.9 },
      filter: ['==', ['get', 'osmId'], -1],
    })
    m.addLayer({
      id: 'trails-selected',
      type: 'line',
      source: 'trails',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': TRAIL_COLOR_SELECTED, 'line-width': 5, 'line-opacity': 1 },
      filter: ['==', ['get', 'osmId'], -1],
    })

    trailsAddedRef.current = true

    const bounds = getTrailBounds(trails)
    m.fitBounds(bounds, { padding: { top: 40, bottom: 40, left: 240, right: 40 }, maxZoom: 15, duration: 500 })
  }, [trails])

  // Hover highlight
  useEffect(() => {
    const m = mapRef.current
    if (!m || !mapReadyRef.current || !trailsAddedRef.current) return
    m.setFilter('trails-hover', ['==', ['get', 'osmId'], hoveredOsmId ?? -1])
  }, [hoveredOsmId])

  // Selection highlight + zoom
  useEffect(() => {
    const m = mapRef.current
    if (!m || !mapReadyRef.current || !trailsAddedRef.current) return

    if (selectedTrail) {
      m.setFilter('trails-selected', ['==', ['get', 'osmId'], selectedTrail.osmId])
      m.setPaintProperty('trails-default', 'line-opacity', 0.25)
      const bounds = getTrailBounds([selectedTrail])
      m.fitBounds(bounds, { padding: { top: 50, bottom: 50, left: 240, right: 50 }, maxZoom: 16, duration: 500 })
    } else {
      m.setFilter('trails-selected', ['==', ['get', 'osmId'], -1])
      m.setPaintProperty('trails-default', 'line-opacity', 0.7)
      if (trails.length > 0) {
        const bounds = getTrailBounds(trails)
        m.fitBounds(bounds, { padding: { top: 40, bottom: 40, left: 240, right: 40 }, maxZoom: 15, duration: 500 })
      }
    }
  }, [selectedTrail, trails])

  // ── Approach route rendering ─────────────────────────────────────────────

  function clearApproachLayer() {
    const m = mapRef.current
    if (!m || !mapReadyRef.current || !approachAddedRef.current) return
    if (m.getLayer('approach-route')) m.removeLayer('approach-route')
    if (m.getSource('approach-route')) m.removeSource('approach-route')
    approachAddedRef.current = false
  }

  function renderApproachLine(route: ApproachRoute) {
    const m = mapRef.current
    if (!m || !mapReadyRef.current) return

    clearApproachLayer()

    m.addSource('approach-route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: route.coordinates,
        },
      },
    })

    m.addLayer({
      id: 'approach-route',
      type: 'line',
      source: 'approach-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': APPROACH_COLOR,
        'line-width': 3,
        'line-opacity': 0.8,
        'line-dasharray': [2, 2],
      },
    })

    approachAddedRef.current = true
  }

  const handleHover = useCallback((osmId: number | null) => setHoveredOsmId(osmId), [])

  // ── Render ───────────────────────────────────────────────────────────────

  const showTrailPanel = isTrailSport && location && (trails.length > 0 || isLoadingTrails)

  return (
    <div className="space-y-2" ref={wrapperRef}>
      {/* Search bar */}
      <div className="relative z-20">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search for a trail, park, or address..."
          className="h-8 w-full rounded-lg border border-input bg-transparent pl-8 pr-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {(query || isSearching) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {isSearching ? (
              <div className="size-3.5 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
            ) : (
              <X className="size-3.5" />
            )}
          </button>
        )}

        {showResults && (results.length > 0 || trailNameResults.length > 0) && (
          <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg scrollbar-none">
            {/* Trail name results (shown first) */}
            {trailNameResults.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground bg-muted/30">
                  Trails
                </div>
                {trailNameResults.map((trail) => (
                  <button
                    key={trail.osmId}
                    type="button"
                    onClick={() => {
                      // Set location to the trail's center, then let trail search find it
                      trailSearchOriginRef.current = null
                      onLocationChange({ name: trail.name, latitude: trail.lat, longitude: trail.lng })
                      setQuery(trail.name)
                      setResults([])
                      setTrailNameResults([])
                      setShowResults(false)
                      onTrailSelect(null)
                    }}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                  >
                    <Mountain className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <span className="line-clamp-1">{trail.name}</span>
                      {trail.location && (
                        <span className="block text-xs text-muted-foreground line-clamp-1">{trail.location}</span>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}
            {/* Location results */}
            {results.length > 0 && (
              <>
                {trailNameResults.length > 0 && (
                  <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground bg-muted/30">
                    Locations
                  </div>
                )}
                {results.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => handleSelectResult(result)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                  >
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span className="line-clamp-2">{result.place_name}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Map + trail panel */}
      <div className="relative overflow-hidden rounded-lg border border-border" style={{ height: '380px' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* Trail list overlay */}
        {showTrailPanel && (
          <div className="absolute inset-y-0 left-0 z-10 w-52 overflow-y-auto border-r border-border/50 bg-popover/95 backdrop-blur-sm scrollbar-none">
            {isLoadingTrails ? (
              <div className="flex items-center gap-2 px-3 py-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Finding trails...</span>
              </div>
            ) : (
              <>
                <div className="sticky top-0 z-10 border-b border-border/50 bg-popover/95 px-3 py-2 backdrop-blur-sm">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {trails.length} trail{trails.length === 1 ? '' : 's'} nearby
                  </span>
                </div>
                {trails.map((trail) => {
                  const isSelected = selectedTrail?.osmId === trail.osmId
                  const isHovered = hoveredOsmId === trail.osmId

                  return (
                    <button
                      key={trail.osmId}
                      type="button"
                      onClick={() => onTrailSelect(isSelected ? null : trail)}
                      onMouseEnter={() => handleHover(trail.osmId)}
                      onMouseLeave={() => handleHover(null)}
                      className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors border-b border-border/20 last:border-b-0 ${
                        isSelected
                          ? 'bg-green-50 dark:bg-green-950/40'
                          : isHovered
                            ? 'bg-blue-50/80 dark:bg-blue-950/30'
                            : 'hover:bg-muted/60'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {isSelected && <Mountain className="size-3 shrink-0 text-green-600" />}
                        <span className={`truncate text-xs font-medium ${
                          isSelected ? 'text-green-700 dark:text-green-400' : ''
                        }`}>
                          {trail.name}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
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
                      {/* Approach distance */}
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                        <MapPin className="size-2.5" />
                        <span>{formatDistance(trail.distanceFromLocation)} away</span>
                      </div>
                      {/* Show approach walk time for selected trail */}
                      {isSelected && approachRoute && (
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-orange-600 dark:text-orange-400">
                          <Clock className="size-2.5" />
                          <span>{formatDuration(approachRoute.durationSeconds)} walk · {formatDistance(approachRoute.distanceMeters)}</span>
                        </div>
                      )}
                      {isSelected && isLoadingApproach && (
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                          <Loader2 className="size-2.5 animate-spin" />
                          <span>Finding route...</span>
                        </div>
                      )}
                    </button>
                  )
                })}

                {/* Custom trailhead pin drop */}
                <div className="border-t border-border/30 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!location) return
                      const customTrail = {
                        osmId: -1,
                        name: 'Custom Trailhead',
                        surface: 'unknown' as const,
                        sacScale: null,
                        distanceMeters: 0,
                        coordinates: [] as [number, number][],
                        centerLat: location.latitude,
                        centerLng: location.longitude,
                        trailheadLat: location.latitude,
                        trailheadLng: location.longitude,
                        distanceFromLocation: 0,
                      }
                      onTrailSelect(customTrail)
                    }}
                    className="flex w-full items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <MapPin className="size-3 text-primary" />
                    {trails.length === 0 ? "No trails found \u2014 drop a pin" : "Drop a pin for custom spot"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Selected trail chip with approach info */}
        {selectedTrail && (
          <div className="absolute right-2 top-2 z-10 flex flex-col gap-1 rounded-lg bg-white/90 px-2.5 py-1.5 shadow-sm backdrop-blur-sm dark:bg-black/80">
            <div className="flex items-center gap-2">
              <Mountain className="size-3.5 text-green-600" />
              <span className="max-w-40 truncate text-xs font-medium">{selectedTrail.name}</span>
              <button
                type="button"
                onClick={() => onTrailSelect(null)}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-3" />
              </button>
            </div>
            {approachRoute && (
              <div className="flex items-center gap-1.5 text-[10px] text-orange-600 dark:text-orange-400">
                <Clock className="size-2.5" />
                <span>{formatDuration(approachRoute.durationSeconds)} walk to trailhead</span>
              </div>
            )}
          </div>
        )}

        {/* Hint overlay when no location */}
        {!location && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/5 pointer-events-none">
            <div className="rounded-lg bg-popover/90 px-4 py-2 shadow-sm backdrop-blur-sm">
              <p className="text-sm text-muted-foreground">Search for a location above</p>
            </div>
          </div>
        )}
      </div>

      {/* Location name below map */}
      {location && (
        <p className="text-[11px] text-muted-foreground/70 line-clamp-1">
          <MapPin className="mr-1 inline size-3" />
          {location.name}
          {' '}
          <span className="text-muted-foreground/50">· Drag pin to adjust</span>
        </p>
      )}
    </div>
  )
}
