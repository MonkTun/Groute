'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MapPin, Search, X } from 'lucide-react'

interface LocationPickerProps {
  value: {
    name: string
    latitude: number
    longitude: number
  } | null
  onChange: (location: {
    name: string
    latitude: number
    longitude: number
  }) => void
}

interface GeocodingResult {
  id: string
  place_name: string
  center: [number, number] // [lng, lat]
}

const LA_CENTER: [number, number] = [-118.2437, 34.0522]
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodingResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showMap, setShowMap] = useState(false)

  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const marker = useRef<mapboxgl.Marker | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Geocoding search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }

    setIsSearching(true)
    try {
      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        proximity: `${LA_CENTER[0]},${LA_CENTER[1]}`,
        types: 'address,poi,place,neighborhood,locality',
        limit: '5',
        language: 'en',
      })
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`
      )
      if (res.ok) {
        const data = await res.json()
        setResults(data.features ?? [])
        setShowResults(true)
      }
    } catch {
      // Silently fail
    } finally {
      setIsSearching(false)
    }
  }, [])

  function handleInputChange(val: string) {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  function handleSelectResult(result: GeocodingResult) {
    const [lng, lat] = result.center
    const location = {
      name: result.place_name,
      latitude: lat,
      longitude: lng,
    }
    onChange(location)
    setQuery(result.place_name)
    setResults([])
    setShowResults(false)
    setShowMap(true)
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setShowResults(false)
    setShowMap(false)
  }

  // Initialize/update mini map when showMap becomes true or value changes
  useEffect(() => {
    if (!showMap || !value || !mapContainer.current) return

    if (!map.current) {
      mapboxgl.accessToken = MAPBOX_TOKEN

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [value.longitude, value.latitude],
        zoom: 15,
        interactive: true,
      })

      map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

      marker.current = new mapboxgl.Marker({
        draggable: true,
        color: '#1a1a1a',
      })
        .setLngLat([value.longitude, value.latitude])
        .addTo(map.current)

      marker.current.on('dragend', () => {
        const lngLat = marker.current!.getLngLat()
        // Reverse geocode the new position
        reverseGeocode(lngLat.lng, lngLat.lat)
      })
    } else {
      map.current.flyTo({
        center: [value.longitude, value.latitude],
        zoom: 15,
        duration: 500,
      })
      marker.current?.setLngLat([value.longitude, value.latitude])
    }

    return () => {
      // Cleanup only on unmount, not on value change
    }
  }, [showMap, value?.latitude, value?.longitude]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      map.current?.remove()
      map.current = null
      marker.current = null
    }
  }, [])

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
        onChange({ name, latitude: lat, longitude: lng })
        setQuery(name)
      }
    } catch {
      onChange({ name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, latitude: lat, longitude: lng })
    }
  }

  return (
    <div className="space-y-2" ref={wrapperRef}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search for a place or address..."
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

        {/* Results dropdown */}
        {showResults && results.length > 0 && (
          <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
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
          </div>
        )}
      </div>

      {/* Mini map for pin adjustment */}
      {showMap && value && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Drag the pin to adjust the exact location
          </p>
          <div className="h-48 overflow-hidden rounded-lg border border-border">
            <div ref={mapContainer} className="size-full" />
          </div>
          <p className="text-[11px] text-muted-foreground/70 line-clamp-1">
            {value.name}
          </p>
        </div>
      )}
    </div>
  )
}
