import { useState } from 'react'

interface MainMenuProps {
  onPlayFreeplay: () => void
  onPlayRanked: (mode: 5 | 10 | 20, playerName: string) => void
  onShowLeaderboard: () => void
}

export default function MainMenu({ onPlayFreeplay, onPlayRanked, onShowLeaderboard }: MainMenuProps) {
  const [showRankedMenu, setShowRankedMenu] = useState(false)
  const [selectedMode, setSelectedMode] = useState<5 | 10 | 20 | null>(null)
  const [playerName, setPlayerName] = useState('')

  const handleStartRanked = () => {
    if (selectedMode && playerName.trim()) {
      onPlayRanked(selectedMode, playerName.trim())
    }
  }

  if (showRankedMenu) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <h1 className="text-4xl md:text-6xl font-bold text-red-500 tracking-tight mb-2">
          Ranked Mode
        </h1>

        {!selectedMode ? (
          <>
            <p className="text-gray-400 text-lg mb-4">Select number of rounds</p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              {([5, 10, 20] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSelectedMode(mode)}
                  className="px-8 py-4 text-xl font-bold text-white bg-red-600 rounded-xl
                           hover:bg-red-500 active:bg-red-700 transition-all duration-200
                           shadow-lg shadow-red-900/50 hover:scale-105"
                >
                  {mode} Rounds
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-gray-400 text-lg">
              {selectedMode} rounds selected
            </p>
            <div className="flex flex-col gap-4 w-full max-w-xs">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                maxLength={50}
                className="px-4 py-3 text-lg rounded-xl bg-gray-800 text-white border-2 border-gray-700
                         focus:border-red-500 focus:outline-none transition-colors"
                autoFocus
              />
              <button
                onClick={handleStartRanked}
                disabled={!playerName.trim()}
                className="px-8 py-4 text-xl font-bold text-white bg-red-600 rounded-xl
                         hover:bg-red-500 active:bg-red-700 transition-all duration-200
                         shadow-lg shadow-red-900/50 hover:scale-105
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Start Game
              </button>
              <button
                onClick={() => setSelectedMode(null)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Change rounds
              </button>
            </div>
          </>
        )}

        <button
          onClick={() => {
            setShowRankedMenu(false)
            setSelectedMode(null)
            setPlayerName('')
          }}
          className="mt-4 px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Back to menu
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-5xl md:text-6xl font-bold text-red-500 tracking-tight mb-4">
        RPI Guessr
      </h1>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onPlayFreeplay}
          className="px-8 py-5 text-xl font-bold text-white bg-red-600 rounded-xl
                   hover:bg-red-500 active:bg-red-700 transition-all duration-200
                   shadow-lg shadow-red-900/50 hover:scale-105"
        >
          Freeplay
        </button>

        <button
          onClick={() => setShowRankedMenu(true)}
          className="px-8 py-5 text-xl font-bold text-white bg-yellow-600 rounded-xl
                   hover:bg-yellow-500 active:bg-yellow-700 transition-all duration-200
                   shadow-lg shadow-yellow-900/50 hover:scale-105"
        >
          Ranked
        </button>

        <button
          onClick={onShowLeaderboard}
          className="px-8 py-5 text-xl font-bold text-white bg-gray-700 rounded-xl
                   hover:bg-gray-600 active:bg-gray-800 transition-all duration-200
                   shadow-lg shadow-gray-900/50 hover:scale-105"
        >
          Leaderboard
        </button>
      </div>
    </div>
  )
}
