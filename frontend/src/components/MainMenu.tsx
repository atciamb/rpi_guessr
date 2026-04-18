interface MainMenuProps {
  onPlay: () => void
}

export default function MainMenu({ onPlay }: MainMenuProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8">
      <h1 className="text-6xl font-bold text-red-500 tracking-tight mb-4">
        RPI Guessr
      </h1>

      <button
        onClick={onPlay}
        className="px-16 py-6 text-2xl font-bold text-white bg-red-600 rounded-xl
                   hover:bg-red-500 active:bg-red-700 transition-all duration-200
                   shadow-lg shadow-red-900/50 hover:shadow-red-800/60 hover:scale-105"
      >
        PLAY
      </button>
    </div>
  )
}
