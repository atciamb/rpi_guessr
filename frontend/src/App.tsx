import { useState, useEffect } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import MainMenu from './components/MainMenu'
import GameView from './components/GameView'
import AdminPage from './components/AdminPage'
import { API_BASE, GOOGLE_CLIENT_ID } from './config'

export type GameState = 'menu' | 'playing' | 'admin'

function getInitialState(): GameState {
  return window.location.pathname === '/admin' ? 'admin' : 'menu'
}

export interface PhotoData {
  id: string
  photo_url: string
}

function App() {
  const [gameState, setGameState] = useState<GameState>(getInitialState)
  const [currentPhoto, setCurrentPhoto] = useState<PhotoData | null>(null)

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

  const handlePlay = async () => {
    try {
      const data = await fetchRandomPhoto()
      setCurrentPhoto(data)
      setGameState('playing')
    } catch (error) {
      console.error('Failed to fetch photo:', error)
      alert('No photos available. Try uploading some first!')
    }
  }

  const handlePlayAgain = async () => {
    try {
      const data = await fetchRandomPhoto()
      setCurrentPhoto(data)
    } catch (error) {
      console.error('Failed to fetch photo:', error)
      alert('No more photos available!')
    }
  }

  const handleBackToMenu = () => {
    window.history.pushState({}, '', '/')
    setGameState('menu')
    setCurrentPhoto(null)
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen">
        {gameState === 'menu' && (
          <MainMenu onPlay={handlePlay} />
        )}
        {gameState === 'playing' && currentPhoto && (
          <GameView photo={currentPhoto} onBack={handleBackToMenu} onPlayAgain={handlePlayAgain} />
        )}
        {gameState === 'admin' && (
          <AdminPage onBack={handleBackToMenu} />
        )}
      </div>
    </GoogleOAuthProvider>
  )
}

export default App
