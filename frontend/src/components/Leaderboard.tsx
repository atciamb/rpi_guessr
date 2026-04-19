import { useState, useEffect } from 'react'
import { API_BASE } from '../config'

interface LeaderboardProps {
  onBack: () => void
}

interface LeaderboardEntry {
  rank: number
  player_name: string
  total_score: number
  completed_at: string
}

interface LeaderboardData {
  mode: number
  period: string
  entries: LeaderboardEntry[]
}

const MODES = [5, 10, 20] as const
const PERIODS = [
  { value: '1d', label: 'Today' },
  { value: '3d', label: '3 Days' },
  { value: '7d', label: '7 Days' },
  { value: 'all', label: 'All Time' },
] as const

export default function Leaderboard({ onBack }: LeaderboardProps) {
  const [mode, setMode] = useState<5 | 10 | 20>(5)
  const [period, setPeriod] = useState<string>('7d')
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_BASE}/api/leaderboard?mode=${mode}&period=${period}`)
        if (response.ok) {
          const leaderboardData: LeaderboardData = await response.json()
          setData(leaderboardData)
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [mode, period])

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-3xl md:text-4xl font-bold text-yellow-400">
            Leaderboard
          </h1>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>

        {/* Mode selector */}
        <div className="flex justify-center gap-2 mb-4">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                mode === m
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {m} Rounds
            </button>
          ))}
        </div>

        {/* Period selector */}
        <div className="flex justify-center gap-2 mb-6">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p.value
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Leaderboard table */}
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : !data || data.entries.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No games played yet for this mode and time period.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900 text-gray-400 text-sm">
                  <th className="py-3 px-4 text-left w-16">#</th>
                  <th className="py-3 px-4 text-left">Player</th>
                  <th className="py-3 px-4 text-right">Score</th>
                  <th className="py-3 px-4 text-right hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => (
                  <tr
                    key={`${entry.rank}-${entry.player_name}-${entry.completed_at}`}
                    className="border-t border-gray-700 hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      {entry.rank <= 3 ? (
                        <span className={`text-xl ${
                          entry.rank === 1 ? 'text-yellow-400' :
                          entry.rank === 2 ? 'text-gray-300' :
                          'text-amber-600'
                        }`}>
                          {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                        </span>
                      ) : (
                        <span className="text-gray-500">{entry.rank}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-white">
                      {entry.player_name}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-yellow-400 font-bold">
                        {entry.total_score.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500 hidden sm:table-cell">
                      {formatDate(entry.completed_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Max score info */}
        <p className="text-center text-gray-500 text-sm mt-4">
          Max possible: {(mode * 5000).toLocaleString()} points
        </p>
      </div>
    </div>
  )
}
