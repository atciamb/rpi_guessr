import { useRef, useState } from 'react'

interface MainMenuProps {
  onPlay: () => void
}

export default function MainMenu({ onPlay }: MainMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('photo', file)

      const response = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      alert('Photo uploaded successfully!')
    } catch (error) {
      console.error('Upload failed:', error)
      alert(error instanceof Error ? error.message : 'Failed to upload photo')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

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

      <label className="cursor-pointer">
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
        <span className={`px-8 py-3 text-lg font-medium text-red-400 border-2 border-red-600
                        rounded-lg hover:bg-red-600/20 transition-all duration-200 inline-block
                        ${uploading ? 'opacity-50 cursor-wait' : ''}`}>
          {uploading ? 'Uploading...' : 'Upload Photo'}
        </span>
      </label>

      <p className="text-gray-500 text-sm">
        JPG, PNG, or WebP with GPS data
      </p>
    </div>
  )
}
