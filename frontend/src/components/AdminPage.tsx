import { useState, useEffect, useRef } from 'react'
import { GoogleLogin, googleLogout } from '@react-oauth/google'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { API_BASE, GOOGLE_CLIENT_ID } from '../config'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

interface Photo {
  id: string
  photo_url: string
  longitude: number
  latitude: number
  created_at: string
}

interface UploadProgress {
  current: number
  total: number
  succeeded: number
  failed: string[]
}

interface AdminPageProps {
  onBack: () => void
}

export default function AdminPage({ onBack }: AdminPageProps) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('admin_token'))
  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem('admin_email'))
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null)
  const [editLocation, setEditLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Skip auth if no client ID configured (local dev)
  const authRequired = GOOGLE_CLIENT_ID !== ''
  const isAuthenticated = !authRequired || token !== null

  const handleLoginSuccess = (credentialResponse: { credential?: string }) => {
    if (credentialResponse.credential) {
      // Decode JWT to get email (just for display, backend will verify)
      const payload = JSON.parse(atob(credentialResponse.credential.split('.')[1]))

      setToken(credentialResponse.credential)
      setUserEmail(payload.email)
      localStorage.setItem('admin_token', credentialResponse.credential)
      localStorage.setItem('admin_email', payload.email)
    }
  }

  const logout = () => {
    googleLogout()
    setToken(null)
    setUserEmail(null)
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_email')
  }

  const getAuthHeaders = (): HeadersInit => {
    if (token) {
      return { Authorization: `Bearer ${token}` }
    }
    return {}
  }

  const fetchPhotos = async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_BASE}/api/photos`, {
        headers: getAuthHeaders()
      })
      if (response.status === 401 || response.status === 403) {
        logout()
        return
      }
      if (response.ok) {
        const data = await response.json()
        setPhotos(Array.isArray(data) ? data : [])
      } else {
        console.error('Failed to fetch photos:', response.status)
      }
    } catch (error) {
      console.error('Failed to fetch photos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPhotos()
  }, [isAuthenticated])

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

        const response = await fetch(`${API_BASE}/api/photos`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        })

        if (response.status === 401 || response.status === 403) {
          logout()
          return
        }

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

    setProgress(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    fetchPhotos()

    if (failed.length > 0) {
      alert(`Uploaded ${succeeded}/${total} photos.\n\nFailed:\n${failed.join('\n')}`)
    }
  }

  const handleDelete = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return

    setDeleting(photoId)
    try {
      const response = await fetch(`${API_BASE}/api/photos/${photoId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      if (response.status === 401 || response.status === 403) {
        logout()
        return
      }

      if (response.ok) {
        setPhotos(photos.filter(p => p.id !== photoId))
      } else {
        alert('Failed to delete photo')
      }
    } catch (error) {
      console.error('Delete failed:', error)
      alert('Failed to delete photo')
    } finally {
      setDeleting(null)
    }
  }

  const uploading = progress !== null

  const openEditLocation = (photo: Photo) => {
    setEditingPhoto(photo)
    setEditLocation({ lat: photo.latitude, lng: photo.longitude })
  }

  const saveLocation = async () => {
    if (!editingPhoto || !editLocation) return

    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/api/photos/${editingPhoto.id}/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          latitude: editLocation.lat,
          longitude: editLocation.lng,
        }),
      })

      if (response.status === 401 || response.status === 403) {
        logout()
        return
      }

      if (response.ok) {
        setPhotos(photos.map(p =>
          p.id === editingPhoto.id
            ? { ...p, latitude: editLocation.lat, longitude: editLocation.lng }
            : p
        ))
        setEditingPhoto(null)
        setEditLocation(null)
      } else {
        alert('Failed to update location')
      }
    } catch (error) {
      console.error('Update failed:', error)
      alert('Failed to update location')
    } finally {
      setSaving(false)
    }
  }

  function LocationPicker() {
    useMapEvents({
      click(e) {
        setEditLocation({ lat: e.latlng.lat, lng: e.latlng.lng })
      },
    })
    return editLocation ? (
      <Marker position={[editLocation.lat, editLocation.lng]} icon={markerIcon} />
    ) : null
  }

  // Show login screen if auth is required and not authenticated
  if (authRequired && !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8">
        <h1 className="text-4xl font-bold text-red-500">Admin Login</h1>
        <p className="text-gray-400">Sign in with your organization account</p>
        <GoogleLogin
          onSuccess={handleLoginSuccess}
          onError={() => alert('Login failed')}
        />
        <button
          onClick={onBack}
          className="text-red-400 hover:text-red-300"
        >
          Back to Menu
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-red-500">Admin</h1>
          <div className="flex items-center gap-4">
            {userEmail && (
              <span className="text-gray-400 text-sm">{userEmail}</span>
            )}
            {authRequired && (
              <button
                onClick={logout}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-600 rounded
                           hover:bg-gray-800 transition-colors"
              >
                Sign Out
              </button>
            )}
            <button
              onClick={onBack}
              className="px-6 py-2 text-red-400 border-2 border-red-600 rounded-lg
                         hover:bg-red-600/20 transition-colors"
            >
              Back to Menu
            </button>
          </div>
        </div>

        <div className="mb-8">
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
            <span className={`inline-block px-8 py-3 text-lg font-medium text-white bg-red-600
                            rounded-lg hover:bg-red-500 transition-colors
                            ${uploading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}>
              {progress
                ? `Uploading ${progress.current}/${progress.total}...`
                : 'Upload Photos'}
            </span>
          </label>
          <p className="text-gray-500 text-sm mt-2">
            Select JPG, PNG, or WebP files with GPS data
          </p>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading photos...</p>
        ) : photos.length === 0 ? (
          <p className="text-gray-400">No photos uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map(photo => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.photo_url}
                  alt="Uploaded photo"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100
                                transition-opacity rounded-lg flex flex-col justify-between p-3">
                  <div className="text-xs text-gray-300">
                    <p>Lat: {photo.latitude.toFixed(6)}</p>
                    <p>Lon: {photo.longitude.toFixed(6)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => openEditLocation(photo)}
                      className="w-full py-2 bg-blue-600 text-white rounded
                                 hover:bg-blue-500 transition-colors text-sm"
                    >
                      Edit Location
                    </button>
                    <button
                      onClick={() => handleDelete(photo.id)}
                      disabled={deleting === photo.id}
                      className="w-full py-2 bg-red-600 text-white rounded
                                 hover:bg-red-500 transition-colors text-sm
                                 disabled:opacity-50"
                    >
                      {deleting === photo.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-gray-500 text-sm mt-8">
          Total: {photos.length} photo{photos.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Edit Location Modal */}
      {editingPhoto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Edit Photo Location</h2>
              <button
                onClick={() => { setEditingPhoto(null); setEditLocation(null); }}
                className="text-gray-400 hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 overflow-hidden min-h-0">
              <div className="md:w-1/3">
                <img
                  src={editingPhoto.photo_url}
                  alt="Photo being edited"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="mt-4 text-sm text-gray-300">
                  <p>Current: {editingPhoto.latitude.toFixed(6)}, {editingPhoto.longitude.toFixed(6)}</p>
                  {editLocation && (
                    <p className="text-green-400">
                      New: {editLocation.lat.toFixed(6)}, {editLocation.lng.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-[400px] rounded-lg overflow-hidden">
                <MapContainer
                  center={[editingPhoto.latitude, editingPhoto.longitude]}
                  zoom={15}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationPicker />
                </MapContainer>
              </div>
            </div>

            <div className="p-4 border-t border-gray-700 flex justify-end gap-4">
              <button
                onClick={() => { setEditingPhoto(null); setEditLocation(null); }}
                className="px-6 py-2 text-gray-400 border border-gray-600 rounded-lg
                           hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveLocation}
                disabled={saving || !editLocation}
                className="px-6 py-2 bg-green-600 text-white rounded-lg
                           hover:bg-green-500 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
