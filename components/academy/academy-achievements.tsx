'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Lock, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AcademyShell } from '@/components/academy/academy-shell'
import { fetchAcademyAchievements } from '@/lib/academy-v3/client'
import type { AcademyAchievementItem } from '@/lib/academy-v3/contracts/api'

const CATEGORY_LABELS: Record<string, string> = {
  completion: 'Completion',
  mastery: 'Mastery',
  streak: 'Streaks',
  engagement: 'Engagement',
}

function formatUnlockDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

export function AcademyAchievements() {
  const [achievements, setAchievements] = useState<AcademyAchievementItem[]>([])
  const [unlockedCount, setUnlockedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    fetchAcademyAchievements()
      .then((data) => {
        if (!active) return
        setAchievements(data.achievements)
        setUnlockedCount(data.unlockedCount)
        setTotalCount(data.totalCount)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load achievements')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  // Group achievements by category
  const grouped = achievements.reduce<Record<string, AcademyAchievementItem[]>>((acc, achievement) => {
    const cat = achievement.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(achievement)
    return acc
  }, {})

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const order = ['completion', 'mastery', 'streak', 'engagement']
    return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b))
  })

  return (
    <AcademyShell
      title="Achievements"
      description="Earn badges and XP by completing lessons, mastering concepts, and building learning streaks."
      maxWidthClassName="max-w-4xl"
    >
      {loading ? (
        <div
          className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-zinc-300"
          data-testid="academy-achievements-loading"
        >
          Loading achievements...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">
          {error}
        </div>
      ) : totalCount === 0 ? (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-8 text-center">
          <Trophy className="mx-auto h-12 w-12 text-zinc-600" strokeWidth={1.5} aria-hidden="true" />
          <p className="mt-3 text-sm text-zinc-400">Achievements are being set up. Check back soon!</p>
          <Link
            href="/members/academy"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            Back to Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-6" data-testid="academy-achievements">
          {/* Summary bar */}
          <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="h-5 w-5 text-emerald-400" strokeWidth={1.5} aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {unlockedCount} of {totalCount} Unlocked
                  </p>
                  <p className="text-xs text-zinc-400">
                    {totalCount - unlockedCount} remaining
                  </p>
                </div>
              </div>
              <div
                className="h-2 w-32 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuenow={totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${unlockedCount} of ${totalCount} achievements unlocked`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                  style={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Achievement groups by category */}
          {sortedCategories.map((category) => (
            <section key={category}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">
                {CATEGORY_LABELS[category] || category}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {grouped[category].map((achievement) => {
                  const isUnlocked = achievement.unlockedAt !== null

                  return (
                    <div
                      key={achievement.key}
                      className={`glass-card-heavy flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                        isUnlocked
                          ? 'border-emerald-500/20 bg-emerald-500/5'
                          : 'border-white/5 opacity-50'
                      }`}
                      data-testid={isUnlocked ? 'achievement-unlocked' : 'achievement-locked'}
                    >
                      {/* Icon */}
                      <div
                        className={`relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border ${
                          isUnlocked
                            ? 'border-emerald-500/30 bg-emerald-900/30'
                            : 'border-white/10 bg-white/5'
                        }`}
                      >
                        {isUnlocked && achievement.iconUrl ? (
                          <Image
                            src={achievement.iconUrl}
                            alt={achievement.title}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : (
                          <Lock className="h-5 w-5 text-zinc-500" strokeWidth={1.5} aria-hidden="true" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${isUnlocked ? 'text-white' : 'text-zinc-400'}`}>
                          {achievement.title}
                        </p>
                        {achievement.description && (
                          <p className="truncate text-xs text-zinc-500">{achievement.description}</p>
                        )}
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="font-mono text-[10px] text-emerald-500/70">
                            +{achievement.xpReward} XP
                          </span>
                          {isUnlocked && achievement.unlockedAt && (
                            <span className="font-mono text-[10px] text-zinc-600">
                              {formatUnlockDate(achievement.unlockedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </AcademyShell>
  )
}
