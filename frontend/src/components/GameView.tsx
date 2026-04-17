import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { LatLng, Icon } from 'leaflet'
import type { PhotoData } from '../App'

interface GameViewProps {
  photo: PhotoData
  onBack: () => void
}

const markerIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function MapClickHandler({ onMapClick }: { onMapClick: (latlng: LatLng) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng)
    },
  })
  return null
}

function MapResizeHandler({ expanded }: { expanded: boolean }) {
  const map = useMap()

  useEffect(() => {
    // Small delay to let the CSS transition start
    const timeout = setTimeout(() => {
      map.invalidateSize()
    }, 50)

    // Also invalidate after transition completes
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

export default function GameView({ photo, onBack }: GameViewProps) {
  const [guess, setGuess] = useState<LatLng | null>(null)
  const [mapHovered, setMapHovered] = useState(false)

  const handleMapClick = (latlng: LatLng) => {
    setGuess(latlng)
  }

  const handleGuess = () => {
    if (!guess) {
      alert('Click on the map to place your guess first!')
      return
    }
    // TODO: Implement guess logic
    console.log('Guessed:', guess.lat, guess.lng)
    alert(`Guessed: ${guess.lat.toFixed(4)}, ${guess.lng.toFixed(4)}`)
  }

  return (
    <div className="min-h-screen h-screen relative">
      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-4 left-4 z-50 px-4 py-2 bg-black/50 text-white
                   rounded-lg hover:bg-black/70 transition-colors"
      >
        ← Back
      </button>

      {/* Photo display - full screen background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${photo.photo_url})` }}
      />

      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Map widget - bottom right */}
      <div
        onMouseEnter={() => setMapHovered(true)}
        onMouseLeave={() => setMapHovered(false)}
        style={{
          width: mapHovered ? '50vw' : '200px',
          height: mapHovered ? '50vh' : '150px',
        }}
        className="absolute bottom-4 right-4 z-40 rounded-lg overflow-hidden shadow-2xl
                   border-2 border-red-600 transition-all duration-300 ease-out"
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
          <MapClickHandler onMapClick={handleMapClick} />
          <MapResizeHandler expanded={mapHovered} />
          {guess && <Marker position={guess} icon={markerIcon} />}
        </MapContainer>

        {/* Guess button */}
        <button
          onClick={handleGuess}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-50 px-6 py-2
                     bg-red-600 text-white font-bold rounded-lg hover:bg-red-500
                     transition-colors shadow-lg"
        >
          GUESS
        </button>
      </div>
    </div>
  )
}
