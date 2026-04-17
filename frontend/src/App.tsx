import { useState } from 'react'
import MainMenu from './components/MainMenu'
import GameView from './components/GameView'
import { API_BASE } from './config'

export type GameState = 'menu' | 'playing'

export interface PhotoData {
  id: string
  photo_url: string
}

function App() {
  const [gameState, setGameState] = useState<GameState>('menu')
  const [currentPhoto, setCurrentPhoto] = useState<PhotoData | null>(null)

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
    setGameState('menu')
    setCurrentPhoto(null)
  }

  return (
    <div className="min-h-screen">
      {gameState === 'menu' && (
        <MainMenu onPlay={handlePlay} />
      )}
      {gameState === 'playing' && currentPhoto && (
        <GameView photo={currentPhoto} onBack={handleBackToMenu} onPlayAgain={handlePlayAgain} />
      )}
    </div>
  )
}

export default App
