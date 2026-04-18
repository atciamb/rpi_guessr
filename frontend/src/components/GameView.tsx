import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Polyline } from 'react-leaflet'
import { LatLng, Icon } from 'leaflet'
import type { PhotoData } from '../App'
import { API_BASE } from '../config'

interface GameViewProps {
  photo: PhotoData
  onBack: () => void
  onPlayAgain: () => void
}

interface GuessResult {
  distance_km: number
  actual_location: {
    longitude: number
    latitude: number
  }
  other_guesses?: {
    longitude: number
    latitude: number
  }[]
}

const guessIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

const actualIcon = new Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
      <path fill="#16a34a" d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

// Orange marker for other users' guesses
const otherGuessIcon = new Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="16" height="24">
      <path fill="#f97316" fill-opacity="0.7" stroke="#c2410c" stroke-width="1" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12zm0 16c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/>
    </svg>
  `),
  iconSize: [16, 24],
  iconAnchor: [8, 24],
})

function MapClickHandler({ onMapClick, disabled }: { onMapClick: (latlng: LatLng) => void; disabled: boolean }) {
  useMapEvents({
    click: (e) => {
      if (!disabled) {
        onMapClick(e.latlng)
      }
    },
  })
  return null
}

function MapResizeHandler({ expanded }: { expanded: boolean }) {
  const map = useMap()

  useEffect(() => {
    const timeout = setTimeout(() => {
      map.invalidateSize()
    }, 50)

    const timeout2 = setTimeout(() => {
      map.invalidateSize()
    }, 350)

    return () => {
      clearTimeout(timeout)
      clearTimeout(timeout2)
    }
  }, [expanded, map])

  return null
}

function FitBoundsHandler({ guess, actual }: { guess: LatLng | null; actual: LatLng | null }) {
  const map = useMap()

  useEffect(() => {
    if (guess && actual) {
      const bounds = [
        [guess.lat, guess.lng],
        [actual.lat, actual.lng],
      ] as [[number, number], [number, number]]
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [guess, actual, map])

  return null
}

export default function GameView({ photo, onBack, onPlayAgain }: GameViewProps) {
  const [guess, setGuess] = useState<LatLng | null>(null)
  const [mapHovered, setMapHovered] = useState(false)
  const [result, setResult] = useState<GuessResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setGuess(null)
    setResult(null)
    setMapHovered(false)
  }, [photo])

  const handleMapClick = (latlng: LatLng) => {
    if (!result) {
      setGuess(latlng)
    }
  }

  const handleGuess = async () => {
    if (!guess) {
      alert('Click on the map to place your guess first!')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`${API_BASE}/api/photos/${photo.id}/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: guess.lat,
          longitude: guess.lng,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit guess')
      }

      const data: GuessResult = await response.json()
      setResult(data)
      setMapHovered(true) // Expand map to show result
    } catch (error) {
      console.error('Guess failed:', error)
      alert('Failed to submit guess')
    } finally {
      setSubmitting(false)
    }
  }

  const actualLocation = result
    ? new LatLng(result.actual_location.latitude, result.actual_location.longitude)
    : null

  const formatDistance = (km: number): string => {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`
    }
    return `${km.toFixed(1)} km`
  }

  return (
    <>
      {/* Mobile Layout */}
      <div className="md:hidden fixed inset-0 flex flex-col overflow-hidden">
        {/* Back button - mobile */}
        <button
          onClick={onBack}
          className="absolute top-2 left-2 z-50 px-3 py-1.5 bg-black/50 text-white text-sm
                     rounded-lg hover:bg-black/70 transition-colors"
        >
          ← Back
        </button>

        {/* Result overlay - mobile */}
        {result && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white
                          px-4 py-2 rounded-xl text-center">
            <p className="text-lg font-bold text-red-400">
              {formatDistance(result.distance_km)} away
            </p>
            <button
              onClick={onPlayAgain}
              className="mt-2 px-4 py-1.5 bg-red-600 rounded-lg hover:bg-red-500 font-medium text-sm"
            >
              Play Again
            </button>
          </div>
        )}

        {/* Photo - top portion */}
        <div
          className="h-[45%] bg-cover bg-center bg-no-repeat relative flex-shrink-0"
          style={{ backgroundImage: `url(${photo.photo_url})` }}
        >
          <div className="absolute inset-0 bg-black/10" />
        </div>

        {/* Map - bottom portion */}
        <div className="flex-1 min-h-0">
          <MapContainer
            center={[42.7302, -73.6788]}
            zoom={15}
            className="w-full h-full"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={handleMapClick} disabled={!!result} />
            {result && <FitBoundsHandler guess={guess} actual={actualLocation} />}

            {guess && <Marker position={guess} icon={guessIcon} />}
            {actualLocation && <Marker position={actualLocation} icon={actualIcon} />}
            {result?.other_guesses?.map((g, i) => (
              <Marker
                key={i}
                position={[g.latitude, g.longitude]}
                icon={otherGuessIcon}
              />
            ))}
            {guess && actualLocation && (
              <Polyline
                positions={[guess, actualLocation]}
                color="#dc2626"
                weight={3}
                dashArray="10, 10"
              />
            )}
          </MapContainer>
        </div>

        {/* Guess button - mobile, fixed at bottom */}
        {!result && (
          <button
            onClick={handleGuess}
            disabled={!guess || submitting}
            className="flex-shrink-0 w-full py-3 bg-red-600 text-white font-bold
                       hover:bg-red-500 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'GUESS'}
          </button>
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block min-h-screen h-screen relative">
        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 z-50 px-4 py-2 bg-black/50 text-white
                     rounded-lg hover:bg-black/70 transition-colors"
        >
          ← Back
        </button>

        {/* Result overlay */}
        {result && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white
                          px-8 py-4 rounded-xl text-center">
            <p className="text-2xl font-bold text-red-400">
              {formatDistance(result.distance_km)} away
            </p>
            <button
              onClick={onPlayAgain}
              className="mt-3 px-6 py-2 bg-red-600 rounded-lg hover:bg-red-500 font-medium"
            >
              Play Again
            </button>
          </div>
        )}

        {/* Photo display - full screen background */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${photo.photo_url})` }}
        />

        {/* Dark overlay for better contrast */}
        <div className="absolute inset-0 bg-black/20" />

        {/* Map and button container - bottom right */}
        <div
          onMouseEnter={() => setMapHovered(true)}
          onMouseLeave={() => !result && setMapHovered(false)}
          className="absolute bottom-4 right-4 z-40 flex flex-col gap-2"
        >
          {/* Guess button - below map */}
          {!result && (
            <button
              onClick={handleGuess}
              disabled={!guess || submitting}
              className="order-2 w-full py-3 bg-red-600 text-white font-bold rounded-lg
                         hover:bg-red-500 transition-colors shadow-lg
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'GUESS'}
            </button>
          )}

          {/* Map widget */}
          <div
            style={{
              width: mapHovered ? '35vw' : '200px',
              height: mapHovered ? '35vh' : '150px',
            }}
            className="order-1 rounded-lg overflow-hidden shadow-2xl border-2 border-red-600
                       transition-all duration-300 ease-out"
          >
            <MapContainer
              center={[42.7302, -73.6788]}
              zoom={15}
              className="w-full h-full"
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickHandler onMapClick={handleMapClick} disabled={!!result} />
              <MapResizeHandler expanded={mapHovered} />
              {result && <FitBoundsHandler guess={guess} actual={actualLocation} />}

              {guess && <Marker position={guess} icon={guessIcon} />}
              {actualLocation && <Marker position={actualLocation} icon={actualIcon} />}
              {result?.other_guesses?.map((g, i) => (
                <Marker
                  key={i}
                  position={[g.latitude, g.longitude]}
                  icon={otherGuessIcon}
                />
              ))}
              {guess && actualLocation && (
                <Polyline
                  positions={[guess, actualLocation]}
                  color="#dc2626"
                  weight={3}
                  dashArray="10, 10"
                />
              )}
            </MapContainer>
          </div>
        </div>
      </div>
    </>
  )
}
