import { useState, useEffect } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import MainMenu from './components/MainMenu'
import GameView from './components/GameView'
import AdminPage from './components/AdminPage'
import Leaderboard from './components/Leaderboard'
import GameSummary from './components/GameSummary'
import { API_BASE, GOOGLE_CLIENT_ID } from './config'

export type GameState = 'menu' | 'playing' | 'admin' | 'leaderboard' | 'summary'
export type GameMode = 'freeplay' | 5 | 10 | 20

function getInitialState(): GameState {
  if (window.location.pathname === '/admin') return 'admin'
  if (window.location.pathname === '/leaderboard') return 'leaderboard'
  return 'menu'
}

export interface PhotoData {
  id: string
  photo_url: string
}

export interface GameData {
  id: string
  player_name: string
  mode: number
  total_score: number
  rounds_played: number
  completed: boolean
  current_photo?: PhotoData
}

export interface RoundResult {
  distance_km: number
  points: number
  actual_location: {
    longitude: number
    latitude: number
  }
}

function App() {
  const [gameState, setGameState] = useState<GameState>(getInitialState)
  const [currentPhoto, setCurrentPhoto] = useState<PhotoData | null>(null)
  const [gameMode, setGameMode] = useState<GameMode>('freeplay')
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [roundResults, setRoundResults] = useState<RoundResult[]>([])

  useEffect(() => {
    const handlePopState = () => {
      setGameState(getInitialState())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const fetchRandomPhoto = async () => {
    const response = await fetch(`${API_BASE}/api/photos/random`)
    if (!response.ok) throw new Error('No photos available')
    return await response.json() as PhotoData
  }

  const handlePlayFreeplay = async () => {
    try {
      const data = await fetchRandomPhoto()
      setCurrentPhoto(data)
      setGameMode('freeplay')
      setGameData(null)
      setRoundResults([])
      setGameState('playing')
    } catch (error) {
      console.error('Failed to fetch photo:', error)
      alert('No photos available. Try uploading some first!')
    }
  }

  const handlePlayRanked = async (mode: 5 | 10 | 20, playerName: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name: playerName, mode }),
      })
      if (!response.ok) throw new Error('Failed to create game')
      const data: GameData = await response.json()

      setGameMode(mode)
      setGameData(data)
      setCurrentPhoto(data.current_photo || null)
      setRoundResults([])
      setGameState('playing')
    } catch (error) {
      console.error('Failed to start ranked game:', error)
      alert('Failed to start game. Please try again.')
    }
  }

  const handleFreeplayAgain = async () => {
    try {
      const data = await fetchRandomPhoto()
      setCurrentPhoto(data)
    } catch (error) {
      console.error('Failed to fetch photo:', error)
      alert('No more photos available!')
    }
  }

  const handleRankedGuessComplete = async (result: RoundResult) => {
    if (!gameData) return

    const newResults = [...roundResults, result]
    setRoundResults(newResults)

    // Fetch updated game state
    const response = await fetch(`${API_BASE}/api/games/${gameData.id}`)
    if (response.ok) {
      const updatedGame: GameData = await response.json()
      setGameData(updatedGame)

      if (updatedGame.completed) {
        setGameState('summary')
      } else if (updatedGame.current_photo) {
        setCurrentPhoto(updatedGame.current_photo)
      }
    }
  }

  const handleBackToMenu = () => {
    window.history.pushState({}, '', '/')
    setGameState('menu')
    setCurrentPhoto(null)
    setGameData(null)
    setRoundResults([])
  }

  const handleShowLeaderboard = () => {
    window.history.pushState({}, '', '/leaderboard')
    setGameState('leaderboard')
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen">
        {gameState === 'menu' && (
          <MainMenu
            onPlayFreeplay={handlePlayFreeplay}
            onPlayRanked={handlePlayRanked}
            onShowLeaderboard={handleShowLeaderboard}
          />
        )}
        {gameState === 'playing' && currentPhoto && (
          <GameView
            photo={currentPhoto}
            gameMode={gameMode}
            gameData={gameData}
            onBack={handleBackToMenu}
            onPlayAgain={handleFreeplayAgain}
            onRankedGuessComplete={handleRankedGuessComplete}
          />
        )}
        {gameState === 'summary' && gameData && (
          <GameSummary
            gameData={gameData}
            roundResults={roundResults}
            onBackToMenu={handleBackToMenu}
            onShowLeaderboard={handleShowLeaderboard}
          />
        )}
        {gameState === 'leaderboard' && (
          <Leaderboard onBack={handleBackToMenu} />
        )}
        {gameState === 'admin' && (
          <AdminPage onBack={handleBackToMenu} />
        )}
      </div>
    </GoogleOAuthProvider>
  )
}

export default App
