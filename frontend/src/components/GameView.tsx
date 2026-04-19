import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Polyline } from 'react-leaflet'
import { LatLng, Icon } from 'leaflet'
import type { PhotoData, GameData, GameMode, RoundResult } from '../App'
import { API_BASE } from '../config'

interface GameViewProps {
  photo: PhotoData
  gameMode: GameMode
  gameData: GameData | null
  onBack: () => void
  onPlayAgain: () => void
  onRankedGuessComplete: (result: RoundResult) => void
}

interface GuessResult {
  distance_km: number
  points: number
  total_score?: number
  rounds_played?: number
  game_completed?: boolean
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

function useDragToPan() {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const isDragging = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const translatePos = useRef({ x: 0, y: 0 })
  const currentTranslate = useRef({ x: 0, y: 0 })
  const currentScale = useRef(1)
  const lastPinchDist = useRef(0)

  const MIN_SCALE = 1
  const MAX_SCALE = 3

  const clampTranslate = useCallback(() => {
    const container = containerRef.current
    const image = imageRef.current
    if (!container || !image) return

    const containerRect = container.getBoundingClientRect()
    const scaledWidth = image.offsetWidth * currentScale.current
    const scaledHeight = image.offsetHeight * currentScale.current
    const maxX = Math.max(0, (scaledWidth - containerRect.width) / 2)
    const maxY = Math.max(0, (scaledHeight - containerRect.height) / 2)

    currentTranslate.current.x = Math.max(-maxX, Math.min(maxX, currentTranslate.current.x))
    currentTranslate.current.y = Math.max(-maxY, Math.min(maxY, currentTranslate.current.y))
  }, [])

  const updateTransform = useCallback(() => {
    if (!imageRef.current) return
    clampTranslate()
    imageRef.current.style.transform = `translate(${currentTranslate.current.x}px, ${currentTranslate.current.y}px) scale(${currentScale.current})`
  }, [clampTranslate])

  const getPinchDistance = (touches: TouchList) => {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    )
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch start
        isDragging.current = false
        lastPinchDist.current = getPinchDistance(e.touches)
      } else if (e.touches.length === 1) {
        isDragging.current = true
        startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        translatePos.current = { ...currentTranslate.current }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()

      if (e.touches.length === 2) {
        // Pinch zoom
        const dist = getPinchDistance(e.touches)
        const delta = dist - lastPinchDist.current
        const scaleChange = delta * 0.01
        currentScale.current = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentScale.current + scaleChange))
        lastPinchDist.current = dist
        updateTransform()
      } else if (isDragging.current && e.touches.length === 1) {
        const dx = e.touches[0].clientX - startPos.current.x
        const dy = e.touches[0].clientY - startPos.current.y
        currentTranslate.current.x = translatePos.current.x + dx
        currentTranslate.current.y = translatePos.current.y + dy
        updateTransform()
      }
    }

    const handleTouchEnd = () => {
      isDragging.current = false
      lastPinchDist.current = 0
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = -e.deltaY * 0.001
      currentScale.current = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentScale.current + delta))
      updateTransform()
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('wheel', handleWheel)
    }
  }, [updateTransform])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startPos.current = { x: e.clientX, y: e.clientY }
    translatePos.current = { ...currentTranslate.current }
    if (containerRef.current) containerRef.current.style.cursor = 'grabbing'
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - startPos.current.x
    const dy = e.clientY - startPos.current.y
    currentTranslate.current.x = translatePos.current.x + dx
    currentTranslate.current.y = translatePos.current.y + dy
    updateTransform()
  }, [updateTransform])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    if (containerRef.current) containerRef.current.style.cursor = 'grab'
  }, [])

  // Reset position and zoom when photo changes
  const reset = useCallback(() => {
    currentTranslate.current = { x: 0, y: 0 }
    currentScale.current = 1
    if (imageRef.current) imageRef.current.style.transform = 'translate(0px, 0px) scale(1)'
  }, [])

  return {
    containerRef,
    imageRef,
    reset,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseUp,
    }
  }
}

export default function GameView({ photo, gameMode, gameData, onBack, onPlayAgain, onRankedGuessComplete }: GameViewProps) {
  const [guess, setGuess] = useState<LatLng | null>(null)
  const [mapHovered, setMapHovered] = useState(false)
  const [result, setResult] = useState<GuessResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const mobilePan = useDragToPan()
  const desktopPan = useDragToPan()

  const isRanked = gameMode !== 'freeplay'
  const currentRound = gameData ? gameData.rounds_played + 1 : 1
  const totalRounds = typeof gameMode === 'number' ? gameMode : 0

  useEffect(() => {
    setGuess(null)
    setResult(null)
    setMapHovered(false)
    mobilePan.reset()
    desktopPan.reset()
  }, [photo, mobilePan.reset, desktopPan.reset])

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
      let response: Response

      if (isRanked && gameData) {
        // Ranked game - use game API
        response = await fetch(`${API_BASE}/api/games/${gameData.id}/guess`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photo_id: photo.id,
            latitude: guess.lat,
            longitude: guess.lng,
          }),
        })
      } else {
        // Freeplay - use original API
        response = await fetch(`${API_BASE}/api/photos/${photo.id}/guess`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: guess.lat,
            longitude: guess.lng,
          }),
        })
      }

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

  const handleNextRound = () => {
    if (result) {
      onRankedGuessComplete({
        distance_km: result.distance_km,
        points: result.points,
        actual_location: result.actual_location,
      })
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

  const mapContent = (showResizeHandler: boolean) => (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler onMapClick={handleMapClick} disabled={!!result} />
      {showResizeHandler && <MapResizeHandler expanded={mapHovered} />}
      {result && <FitBoundsHandler guess={guess} actual={actualLocation} />}
      {guess && <Marker position={guess} icon={guessIcon} />}
      {actualLocation && <Marker position={actualLocation} icon={actualIcon} />}
      {result?.other_guesses?.slice(1).map((g, i) => (
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
    </>
  )

  const renderResultOverlay = (isMobile: boolean) => {
    if (!result) return null

    const sizeClasses = isMobile
      ? "px-4 py-2 text-2xl"
      : "px-8 py-4 text-4xl"
    const distanceClasses = isMobile ? "text-sm" : "text-lg"
    const buttonClasses = isMobile
      ? "mt-2 px-4 py-1.5 text-sm"
      : "mt-3 px-6 py-2"

    return (
      <div className={`absolute top-2 md:top-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white
                      rounded-xl text-center ${isMobile ? 'px-4 py-2' : 'px-8 py-4'}`}>
        {isRanked && (
          <p className="text-xs text-gray-400 mb-1">
            Round {currentRound} of {totalRounds}
          </p>
        )}
        <p className={`font-bold text-yellow-400 ${isMobile ? 'text-2xl' : 'text-4xl'}`}>
          {result.points.toLocaleString()} pts
        </p>
        {isRanked && result.total_score !== undefined && (
          <p className="text-sm text-gray-300">
            Total: {result.total_score.toLocaleString()} pts
          </p>
        )}
        <p className={`text-red-400 ${distanceClasses}`}>
          {formatDistance(result.distance_km)} away
        </p>
        {isRanked ? (
          <button
            onClick={handleNextRound}
            className={`${buttonClasses} bg-yellow-600 rounded-lg hover:bg-yellow-500 font-medium`}
          >
            {result.game_completed ? 'See Results' : 'Next Round'}
          </button>
        ) : (
          <button
            onClick={onPlayAgain}
            className={`${buttonClasses} bg-red-600 rounded-lg hover:bg-red-500 font-medium`}
          >
            Play Again
          </button>
        )}
      </div>
    )
  }

  const renderRoundIndicator = (isMobile: boolean) => {
    if (!isRanked) return null

    return (
      <div className={`absolute ${isMobile ? 'top-2 right-2' : 'top-4 right-4'} z-50
                      bg-yellow-600 text-white px-3 py-1 rounded-lg font-bold`}>
        {currentRound}/{totalRounds}
      </div>
    )
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

        {renderRoundIndicator(true)}
        {renderResultOverlay(true)}

        {/* Photo - top portion (drag to pan) */}
        <div
          ref={mobilePan.containerRef}
          {...mobilePan.handlers}
          className="h-[45%] relative flex-shrink-0 overflow-hidden cursor-grab select-none touch-none flex items-center justify-center"
        >
          <img
            ref={mobilePan.imageRef}
            src={photo.photo_url}
            alt="Guess this location"
            className="min-w-[120%] min-h-[120%] object-cover pointer-events-none"
            draggable={false}
          />
        </div>

        {/* Map - bottom portion */}
        <div className="flex-1 min-h-0">
          <MapContainer
            center={[42.7302, -73.6788]}
            zoom={15}
            className="w-full h-full"
            zoomControl={false}
          >
            {mapContent(false)}
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

        {renderRoundIndicator(false)}
        {renderResultOverlay(false)}

        {/* Photo display - full screen, drag to pan */}
        <div
          ref={desktopPan.containerRef}
          {...desktopPan.handlers}
          className="absolute inset-0 overflow-hidden cursor-grab select-none flex items-center justify-center"
        >
          <img
            ref={desktopPan.imageRef}
            src={photo.photo_url}
            alt="Guess this location"
            className="min-w-[110%] min-h-[110%] object-cover pointer-events-none"
            draggable={false}
          />
        </div>

        {/* Dark overlay for better contrast */}
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />

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
              {mapContent(true)}
            </MapContainer>
          </div>
        </div>
      </div>
    </>
  )
}
