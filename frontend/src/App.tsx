import { useState } from 'react'
import MainMenu from './components/MainMenu'
import GameView from './components/GameView'

export type GameState = 'menu' | 'playing'

export interface PhotoData {
  id: string
  photo_url: string
}

function App() {
  const [gameState, setGameState] = useState<GameState>('menu')
  const [currentPhoto, setCurrentPhoto] = useState<PhotoData | null>(null)

  const handlePlay = async () => {
    try {
      const response = await fetch('/api/photos/random')
      if (!response.ok) throw new Error('No photos available')
      const data: PhotoData = await response.json()
      setCurrentPhoto(data)
      setGameState('playing')
    } catch (error) {
      console.error('Failed to fetch photo:', error)
      alert('No photos available. Try uploading some first!')
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
        <GameView photo={currentPhoto} onBack={handleBackToMenu} />
      )}
    </div>
  )
}

export default App
