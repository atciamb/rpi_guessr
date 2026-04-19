import type { GameData, RoundResult } from '../App'

interface GameSummaryProps {
  gameData: GameData
  roundResults: RoundResult[]
  onBackToMenu: () => void
  onShowLeaderboard: () => void
}

export default function GameSummary({ gameData, roundResults, onBackToMenu, onShowLeaderboard }: GameSummaryProps) {
  const formatDistance = (km: number): string => {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`
    }
    return `${km.toFixed(1)} km`
  }

  const maxPossibleScore = gameData.mode * 5000

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-8">
      <h1 className="text-4xl md:text-5xl font-bold text-yellow-400 tracking-tight">
        Game Complete!
      </h1>

      <div className="text-center">
        <p className="text-gray-400 text-lg">{gameData.player_name}</p>
        <p className="text-6xl md:text-7xl font-bold text-white mt-2">
          {gameData.total_score.toLocaleString()}
        </p>
        <p className="text-gray-400 text-lg">
          out of {maxPossibleScore.toLocaleString()} points
        </p>
      </div>

      {/* Round breakdown */}
      <div className="w-full max-w-md bg-gray-800 rounded-xl p-4 mt-4">
        <h2 className="text-lg font-bold text-white mb-3">Round Breakdown</h2>
        <div className="space-y-2">
          {roundResults.map((result, index) => (
            <div key={index} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
              <span className="text-gray-400">Round {index + 1}</span>
              <div className="text-right">
                <span className="text-yellow-400 font-bold">{result.points.toLocaleString()} pts</span>
                <span className="text-gray-500 text-sm ml-2">({formatDistance(result.distance_km)})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-8 text-center mt-2">
        <div>
          <p className="text-2xl font-bold text-white">
            {Math.round((gameData.total_score / maxPossibleScore) * 100)}%
          </p>
          <p className="text-gray-400 text-sm">Accuracy</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">
            {Math.round(gameData.total_score / gameData.mode).toLocaleString()}
          </p>
          <p className="text-gray-400 text-sm">Avg Points</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">
            {formatDistance(roundResults.reduce((sum, r) => sum + r.distance_km, 0) / roundResults.length)}
          </p>
          <p className="text-gray-400 text-sm">Avg Distance</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
        <button
          onClick={onShowLeaderboard}
          className="px-8 py-4 text-xl font-bold text-white bg-yellow-600 rounded-xl
                   hover:bg-yellow-500 active:bg-yellow-700 transition-all duration-200
                   shadow-lg shadow-yellow-900/50 hover:scale-105"
        >
          View Leaderboard
        </button>
        <button
          onClick={onBackToMenu}
          className="px-8 py-4 text-xl font-bold text-white bg-gray-700 rounded-xl
                   hover:bg-gray-600 active:bg-gray-800 transition-all duration-200
                   shadow-lg shadow-gray-900/50 hover:scale-105"
        >
          Back to Menu
        </button>
      </div>
    </div>
  )
}
