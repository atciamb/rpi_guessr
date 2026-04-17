import { useRef, useState } from 'react'

interface MainMenuProps {
  onPlay: () => void
}

interface UploadProgress {
  current: number
  total: number
  succeeded: number
  failed: string[]
}

export default function MainMenu({ onPlay }: MainMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<UploadProgress | null>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const total = files.length
    setProgress({ current: 0, total, succeeded: 0, failed: [] })

    let succeeded = 0
    const failed: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgress(prev => prev ? { ...prev, current: i + 1 } : null)

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

        succeeded++
      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error)
        const reason = error instanceof Error ? error.message : 'Unknown error'
        failed.push(`${file.name}: ${reason}`)
      }

      setProgress(prev => prev ? { ...prev, succeeded, failed } : null)
    }

    if (failed.length === 0) {
      alert(`Successfully uploaded ${succeeded} photo${succeeded !== 1 ? 's' : ''}!`)
    } else {
      alert(
        `Uploaded ${succeeded}/${total} photos.\n\nFailed:\n${failed.join('\n')}`
      )
    }

    setProgress(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploading = progress !== null

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
          multiple
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
        <span className={`px-8 py-3 text-lg font-medium text-red-400 border-2 border-red-600
                        rounded-lg hover:bg-red-600/20 transition-all duration-200 inline-block
                        ${uploading ? 'opacity-50 cursor-wait' : ''}`}>
          {progress
            ? `Uploading ${progress.current}/${progress.total}...`
            : 'Upload Photos'}
        </span>
      </label>

      <p className="text-gray-500 text-sm">
        Select multiple JPG, PNG, or WebP files with GPS data
      </p>
    </div>
  )
}
