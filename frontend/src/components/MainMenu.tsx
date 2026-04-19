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

      <a
        href="https://github.com/icanthink42/rpi_guessr"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 text-gray-500 hover:text-white transition-colors"
        title="View on GitHub"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      </a>
    </div>
  )
}
