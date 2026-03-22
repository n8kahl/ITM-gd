'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  BarChart3,
  Clock,
  Target,
  TrendingUp,
  Filter,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityStat {
  blockId: string
  blockType: string
  submissions: number
  passRate: number
  averageScore: number
  avgTimeToCompleteMs: number | null
}

interface ActivityAnalyticsProps {
  blockType?: string
  lessonId?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBlockType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSecs = seconds % 60
  return `${minutes}m ${remainingSecs}s`
}

function passRateColor(rate: number): string {
  if (rate >= 80) return 'text-emerald-400'
  if (rate >= 50) return 'text-amber-400'
  return 'text-rose-400'
}

function passRateBg(rate: number): string {
  if (rate >= 80) return 'bg-emerald-500/15'
  if (rate >= 50) return 'bg-amber-500/15'
  return 'bg-rose-500/15'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityAnalytics({ blockType: initialBlockType, lessonId }: ActivityAnalyticsProps) {
  const [activities, setActivities] = useState<ActivityStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [blockTypeFilter, setBlockTypeFilter] = useState(initialBlockType ?? '')

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (blockTypeFilter) params.set('blockType', blockTypeFilter)
      if (lessonId) params.set('lessonId', lessonId)
      params.set('limit', '50')

      const res = await fetch(`/api/admin/academy/analytics/activities?${params.toString()}`)
      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`)
      }

      const data = await res.json()
      setActivities(data.activities ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity analytics')
    } finally {
      setLoading(false)
    }
  }, [blockTypeFilter, lessonId])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Compute summary stats
  const totalSubmissions = activities.reduce((sum, a) => sum + a.submissions, 0)
  const avgPassRate = activities.length > 0
    ? Math.round(activities.reduce((sum, a) => sum + a.passRate, 0) / activities.length)
    : 0
  const avgScore = activities.length > 0
    ? Math.round(activities.reduce((sum, a) => sum + a.averageScore, 0) / activities.length)
    : 0

  // Unique block types for filter
  const blockTypes = [...new Set(activities.map((a) => a.blockType))].sort()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Activity Analytics</h2>
          <p className="text-sm text-white/50 mt-0.5">
            Per-activity pass rates, scores, and completion times
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 text-xs text-white/60 hover:bg-white/5 hover:text-white/80 transition-all disabled:opacity-40"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} strokeWidth={1.5} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
            <BarChart3 className="h-3.5 w-3.5" strokeWidth={1.5} />
            Total Submissions
          </div>
          <p className="text-2xl font-semibold font-mono text-white">{totalSubmissions.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
            <Target className="h-3.5 w-3.5" strokeWidth={1.5} />
            Avg Pass Rate
          </div>
          <p className={cn('text-2xl font-semibold font-mono', passRateColor(avgPassRate))}>{avgPassRate}%</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
            <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.5} />
            Avg Score
          </div>
          <p className={cn('text-2xl font-semibold font-mono', passRateColor(avgScore))}>{avgScore}%</p>
        </div>
      </div>

      {/* Filter */}
      {blockTypes.length > 1 && (
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-white/40" strokeWidth={1.5} />
          <select
            value={blockTypeFilter}
            onChange={(e) => setBlockTypeFilter(e.target.value)}
            className="rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white outline-none"
          >
            <option value="">All Activity Types</option>
            {blockTypes.map((type) => (
              <option key={type} value={type}>
                {formatBlockType(type)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {/* Activity Table */}
      {!loading && !error && activities.length > 0 && (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/50 text-xs">
                <th className="text-left px-4 py-3 font-medium">Activity Type</th>
                <th className="text-right px-4 py-3 font-medium">Submissions</th>
                <th className="text-right px-4 py-3 font-medium">Pass Rate</th>
                <th className="text-right px-4 py-3 font-medium">Avg Score</th>
                <th className="text-right px-4 py-3 font-medium">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr
                  key={activity.blockId}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-white/80 font-medium">{formatBlockType(activity.blockType)}</span>
                      <span className="block text-[10px] text-white/30 font-mono mt-0.5">
                        {activity.blockId.slice(0, 8)}...
                      </span>
                    </div>
                  </td>
                  <td className="text-right px-4 py-3 font-mono text-white/70">
                    {activity.submissions}
                  </td>
                  <td className="text-right px-4 py-3">
                    <span
                      className={cn(
                        'inline-block px-2 py-0.5 rounded text-xs font-mono font-medium',
                        passRateBg(activity.passRate),
                        passRateColor(activity.passRate)
                      )}
                    >
                      {activity.passRate}%
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 font-mono text-white/70">
                    {activity.averageScore}%
                  </td>
                  <td className="text-right px-4 py-3 text-white/50">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" strokeWidth={1.5} />
                      {formatDuration(activity.avgTimeToCompleteMs)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && activities.length === 0 && (
        <div className="text-center py-12 text-white/30 text-sm">
          No activity submissions found.
        </div>
      )}
    </div>
  )
}
