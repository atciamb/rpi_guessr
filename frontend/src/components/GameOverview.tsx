import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet'
import { LatLng, Icon } from 'leaflet'
import { API_BASE } from '../config'

interface GameOverviewProps {
  gameId: string
  onBack: () => void
}

interface GameRound {
  round: number
  photo_id: string
  photo_url: string
  guess_longitude: number
  guess_latitude: number
  actual_longitude: number
  actual_latitude: number
  distance_km: number
  points: number
}

interface GameDetails {
  id: string
  player_name: string
  mode: number
  total_score: number
  completed_at: string
  rounds: GameRound[]
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

const suggestedIcon = new Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
      <path fill="#dc2626" d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

function ReportMapClickHandler({ onMapClick }: { onMapClick: (latlng: LatLng) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng)
    },
  })
  return null
}

function RoundMap({ round }: { round: GameRound }) {
  const guessPos = new LatLng(round.guess_latitude, round.guess_longitude)
  const actualPos = new LatLng(round.actual_latitude, round.actual_longitude)

  // Calculate center between guess and actual
  const centerLat = (round.guess_latitude + round.actual_latitude) / 2
  const centerLng = (round.guess_longitude + round.actual_longitude) / 2

  return (
    <div className="h-64 rounded-lg overflow-hidden">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={14}
        className="w-full h-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={guessPos} icon={guessIcon} />
        <Marker position={actualPos} icon={actualIcon} />
        <Polyline
          positions={[guessPos, actualPos]}
          color="#dc2626"
          weight={3}
          dashArray="10, 10"
        />
      </MapContainer>
    </div>
  )
}

export default function GameOverview({ gameId, onBack }: GameOverviewProps) {
  const [game, setGame] = useState<GameDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedRound, setExpandedRound] = useState<number | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  // Report state
  const [reportingRound, setReportingRound] = useState<GameRound | null>(null)
  const [reportLocation, setReportLocation] = useState<LatLng | null>(null)
  const [reportComment, setReportComment] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)

  useEffect(() => {
    const fetchGameDetails = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/games/${gameId}/details`)
        if (response.ok) {
          const data: GameDetails = await response.json()
          setGame(data)
        }
      } catch (error) {
        console.error('Failed to fetch game details:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchGameDetails()
  }, [gameId])

  const formatDistance = (km: number): string => {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`
    }
    return `${km.toFixed(1)} km`
  }

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleOpenReport = (round: GameRound) => {
    setReportingRound(round)
    setReportLocation(new LatLng(round.actual_latitude, round.actual_longitude))
    setReportComment('')
  }

  const handleSubmitReport = async () => {
    if (!reportingRound || !reportLocation) {
      alert('Please click on the map to place the correct location')
      return
    }

    setReportSubmitting(true)
    try {
      const response = await fetch(`${API_BASE}/api/photos/${reportingRound.photo_id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: reportLocation.lat,
          longitude: reportLocation.lng,
          comment: reportComment,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit report')
      }

      setReportingRound(null)
      setReportLocation(null)
      setReportComment('')
      alert('Thank you! Your report has been submitted for review.')
    } catch (error) {
      console.error('Report failed:', error)
      alert('Failed to submit report')
    } finally {
      setReportSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Game not found</p>
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          ← Back to Leaderboard
        </button>
      </div>
    )
  }

  const maxPossibleScore = game.mode * 5000

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
        </div>

        {/* Game summary */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-1">{game.player_name}</h1>
          <p className="text-gray-400 text-sm mb-4">
            {game.mode} rounds • {formatDate(game.completed_at)}
          </p>
          <p className="text-5xl font-bold text-yellow-400">
            {game.total_score.toLocaleString()}
          </p>
          <p className="text-gray-400">
            out of {maxPossibleScore.toLocaleString()} points
          </p>

          {/* Stats */}
          <div className="flex justify-center gap-8 mt-6 pt-6 border-t border-gray-700">
            <div>
              <p className="text-2xl font-bold text-white">
                {Math.round((game.total_score / maxPossibleScore) * 100)}%
              </p>
              <p className="text-gray-400 text-sm">Accuracy</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {Math.round(game.total_score / game.mode).toLocaleString()}
              </p>
              <p className="text-gray-400 text-sm">Avg Points</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {game.rounds.length > 0
                  ? formatDistance(game.rounds.reduce((sum, r) => sum + r.distance_km, 0) / game.rounds.length)
                  : '0 m'}
              </p>
              <p className="text-gray-400 text-sm">Avg Distance</p>
            </div>
          </div>
        </div>

        {/* Rounds */}
        <div className="space-y-3">
          {game.rounds.map((round) => (
            <div key={round.round} className="bg-gray-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedRound(expandedRound === round.round ? null : round.round)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-gray-400">Round {round.round}</span>
                  <span className="text-yellow-400 font-bold">
                    {round.points.toLocaleString()} pts
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm">
                    {formatDistance(round.distance_km)}
                  </span>
                  <span className={`transition-transform ${expandedRound === round.round ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>
              </button>

              {expandedRound === round.round && (
                <div className="px-4 pb-4">
                  {/* Photo thumbnail */}
                  <div
                    className="mb-3 rounded-lg overflow-hidden h-32 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setLightboxImage(round.photo_url)}
                  >
                    <img
                      src={round.photo_url}
                      alt={`Round ${round.round}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Map */}
                  <RoundMap round={round} />
                  <div className="mt-2 flex justify-between items-center">
                    <div className="flex gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full" />
                        <span className="text-gray-400">Your guess</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full" />
                        <span className="text-gray-400">Actual location</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenReport(round)}
                      className="text-sm text-red-400 hover:text-red-300 transition-colors underline"
                    >
                      Report location
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 transition-colors"
            onClick={() => setLightboxImage(null)}
          >
            &times;
          </button>
          <img
            src={lightboxImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Report Location Modal */}
      {reportingRound && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col" style={{ zIndex: 10001 }}>
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Report Incorrect Location</h2>
              <button
                onClick={() => setReportingRound(null)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 overflow-hidden min-h-0">
              <div className="md:w-1/3 flex-shrink-0">
                <img
                  src={reportingRound.photo_url}
                  alt="Photo being reported"
                  className="w-full h-32 md:h-48 object-cover rounded-lg"
                />
                <p className="text-gray-400 text-sm mt-3">
                  Click on the map to place the correct location for this photo.
                </p>
                <div className="mt-3">
                  <label className="text-gray-300 text-sm block mb-1">Comment (optional)</label>
                  <textarea
                    value={reportComment}
                    onChange={(e) => setReportComment(e.target.value)}
                    placeholder="Any additional details..."
                    className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700
                               focus:border-red-500 focus:outline-none resize-none text-sm"
                    rows={3}
                  />
                </div>
                {reportLocation && (
                  <p className="text-green-400 text-sm mt-2">
                    Location: {reportLocation.lat.toFixed(5)}, {reportLocation.lng.toFixed(5)}
                  </p>
                )}
                <p className="text-yellow-500/80 text-xs mt-3">
                  Note: If accepted, leaderboard scores will be recalculated based on the corrected location.
                </p>
              </div>

              <div className="flex-1 min-h-[250px] md:min-h-[400px] rounded-lg overflow-hidden">
                <MapContainer
                  center={[reportingRound.actual_latitude, reportingRound.actual_longitude]}
                  zoom={17}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <ReportMapClickHandler onMapClick={(latlng) => setReportLocation(latlng)} />
                  {reportLocation && <Marker position={reportLocation} icon={suggestedIcon} />}
                  <Marker
                    position={[reportingRound.actual_latitude, reportingRound.actual_longitude]}
                    icon={actualIcon}
                  />
                </MapContainer>
              </div>
            </div>

            <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setReportingRound(null)}
                className="px-5 py-2 text-gray-400 border border-gray-600 rounded-lg
                           hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={reportSubmitting || !reportLocation}
                className="px-5 py-2 bg-red-600 text-white rounded-lg
                           hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {reportSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
