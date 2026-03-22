'use client'

import { useEffect, useState, useCallback } from 'react'
import { Trophy, Clock, CheckCircle2, Flame, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Challenge {
  id: string
  title: string
  description: string
  challengeType: 'daily' | 'weekly' | 'monthly' | 'seasonal'
  criteria: { action: string; count: number }
  xpReward: number
  startsAt: string
  endsAt: string
}

interface ChallengeProgress {
  challengeId: string
  progress: number
  completedAt: string | null
  xpAwarded: boolean
  challenge: Challenge
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeRemaining(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h left`
  if (hours > 0) return `${hours}h left`
  const minutes = Math.floor(diff / 60000)
  return `${minutes}m left`
}

function challengeTypeLabel(type: string): string {
  switch (type) {
    case 'daily': return 'Daily'
    case 'weekly': return 'Weekly'
    case 'monthly': return 'Monthly'
    case 'seasonal': return 'Seasonal'
    default: return type
  }
}

function challengeTypeBadgeColor(type: string): string {
  switch (type) {
    case 'daily': return 'bg-sky-500/15 border-sky-500/30 text-sky-400'
    case 'weekly': return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
    case 'monthly': return 'bg-purple-500/15 border-purple-500/30 text-purple-400'
    case 'seasonal': return 'bg-amber-500/15 border-amber-500/30 text-amber-400'
    default: return 'bg-white/10 border-white/20 text-white/60'
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AcademyChallengesProps {
  userId: string
}

export function AcademyChallenges({ userId }: AcademyChallengesProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, ChallengeProgress>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [challengesRes, progressRes] = await Promise.all([
        fetch('/api/academy-v3/challenges'),
        fetch(`/api/academy-v3/challenges/user/${userId}`),
      ])

      if (!challengesRes.ok || !progressRes.ok) {
        throw new Error('Failed to load challenges')
      }

      const challengesData = await challengesRes.json()
      const progressData = await progressRes.json()

      setChallenges(challengesData.challenges ?? [])

      const map = new Map<string, ChallengeProgress>()
      for (const p of progressData.progress ?? []) {
        map.set(p.challengeId, p)
      }
      setProgressMap(map)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load challenges')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        {error}
      </div>
    )
  }

  if (challenges.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <Flame className="mx-auto h-10 w-10 text-white/20" strokeWidth={1.5} />
        <p className="mt-3 text-sm text-white/40">No active challenges right now. Check back soon!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Flame className="h-5 w-5 text-amber-400" strokeWidth={1.5} />
          Challenges
        </h2>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 text-xs text-white/60 hover:bg-white/5 hover:text-white/80 transition-all"
        >
          <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {challenges.map((challenge) => {
          const userProgress = progressMap.get(challenge.id)
          const progress = userProgress?.progress ?? 0
          const target = challenge.criteria.count
          const isComplete = userProgress?.completedAt !== null && userProgress?.completedAt !== undefined
          const progressPercent = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0

          return (
            <div
              key={challenge.id}
              className={cn(
                'rounded-xl border p-4 transition-colors',
                isComplete
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : 'border-white/10 bg-white/5 backdrop-blur-sm'
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        'inline-block rounded px-1.5 py-0.5 text-[10px] font-medium border',
                        challengeTypeBadgeColor(challenge.challengeType)
                      )}
                    >
                      {challengeTypeLabel(challenge.challengeType)}
                    </span>
                    <span className="font-mono text-[10px] text-emerald-500/70">
                      +{challenge.xpReward} XP
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white truncate">{challenge.title}</h3>
                  <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{challenge.description}</p>
                </div>
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" strokeWidth={1.5} />
                ) : (
                  <Trophy className="h-5 w-5 shrink-0 text-white/20" strokeWidth={1.5} />
                )}
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="font-mono text-white/40">
                    {progress}/{target}
                  </span>
                  <span className="flex items-center gap-1 text-white/30">
                    <Clock className="h-2.5 w-2.5" strokeWidth={1.5} />
                    {timeRemaining(challenge.endsAt)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      isComplete
                        ? 'bg-emerald-400'
                        : progressPercent >= 50
                          ? 'bg-amber-400'
                          : 'bg-white/30'
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
