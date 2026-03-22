'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Lock, Trophy, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

import { AcademyShell } from '@/components/academy/academy-shell'
import { fetchAcademyAchievements } from '@/lib/academy-v3/client'
import type { AcademyAchievementItem } from '@/lib/academy-v3/contracts/api'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  completion: 'Completion',
  mastery: 'Mastery',
  streak: 'Streaks',
  engagement: 'Engagement',
  trading: 'Trading',
  social: 'Social',
}

const RARITY_CONFIG: Record<string, {
  label: string
  border: string
  bg: string
  text: string
  glow: string
  iconBorder: string
  iconBg: string
}> = {
  common: {
    label: 'Common',
    border: 'border-white/10',
    bg: 'bg-white/5',
    text: 'text-white/40',
    glow: '',
    iconBorder: 'border-white/10',
    iconBg: 'bg-white/5',
  },
  uncommon: {
    label: 'Uncommon',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/5',
    text: 'text-emerald-400/60',
    glow: '',
    iconBorder: 'border-emerald-500/30',
    iconBg: 'bg-emerald-900/20',
  },
  rare: {
    label: 'Rare',
    border: 'border-sky-500/25',
    bg: 'bg-sky-500/5',
    text: 'text-sky-400/70',
    glow: 'shadow-[0_0_12px_rgba(56,189,248,0.08)]',
    iconBorder: 'border-sky-500/30',
    iconBg: 'bg-sky-900/20',
  },
  epic: {
    label: 'Epic',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/5',
    text: 'text-purple-400/80',
    glow: 'shadow-[0_0_16px_rgba(168,85,247,0.12)]',
    iconBorder: 'border-purple-500/30',
    iconBg: 'bg-purple-900/20',
  },
  legendary: {
    label: 'Legendary',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    text: 'text-amber-400',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    iconBorder: 'border-amber-500/40',
    iconBg: 'bg-amber-900/20',
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function getRarityConfig(rarity: string) {
  return RARITY_CONFIG[rarity] ?? RARITY_CONFIG.common
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AcademyAchievements() {
  const [achievements, setAchievements] = useState<AcademyAchievementItem[]>([])
  const [unlockedCount, setUnlockedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recentlyUnlocked, setRecentlyUnlocked] = useState<Set<string>>(new Set())

  useEffect(() => {
    let active = true

    fetchAcademyAchievements()
      .then((data) => {
        if (!active) return
        setAchievements(data.achievements)
        setUnlockedCount(data.unlockedCount)
        setTotalCount(data.totalCount)
        setError(null)

        // Detect recently unlocked (within last 24h) for animation
        const recent = new Set<string>()
        const dayAgo = Date.now() - 86400000
        for (const a of data.achievements) {
          if (a.unlockedAt && new Date(a.unlockedAt).getTime() > dayAgo) {
            recent.add(a.key)
          }
        }
        setRecentlyUnlocked(recent)
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
    const order = ['completion', 'mastery', 'streak', 'engagement', 'trading', 'social']
    return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b))
  })

  return (
    <AcademyShell
      title="Achievements"
      description="Earn badges and XP by completing lessons, mastering concepts, and building learning streaks."
      maxWidthClassName="max-w-6xl"
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[category].map((achievement) => {
                  const isUnlocked = achievement.unlockedAt !== null
                  const isRecent = recentlyUnlocked.has(achievement.key)
                  const rarity = getRarityConfig(achievement.rarity ?? 'common')
                  const progressTarget = achievement.progressTarget ?? 1
                  const progressCurrent = achievement.progressCurrent ?? (isUnlocked ? progressTarget : 0)
                  const progressPercent = progressTarget > 0
                    ? Math.min(100, Math.round((progressCurrent / progressTarget) * 100))
                    : 0

                  return (
                    <div
                      key={achievement.key}
                      className={cn(
                        'glass-card-heavy rounded-xl border p-3 transition-all duration-300',
                        isUnlocked ? rarity.border : 'border-white/5',
                        isUnlocked ? rarity.bg : 'bg-white/[0.02]',
                        isUnlocked && rarity.glow,
                        !isUnlocked && 'opacity-60',
                        isRecent && 'animate-[achievement-unlock_0.6s_ease-out]'
                      )}
                      data-testid={isUnlocked ? 'achievement-unlocked' : 'achievement-locked'}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div
                          className={cn(
                            'relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border',
                            isUnlocked ? rarity.iconBorder : 'border-white/10',
                            isUnlocked ? rarity.iconBg : 'bg-white/5'
                          )}
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
                          {isRecent && (
                            <div className="absolute -top-1 -right-1">
                              <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-pulse" strokeWidth={1.5} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className={cn('truncate text-sm font-semibold', isUnlocked ? 'text-white' : 'text-zinc-400')}>
                              {achievement.title}
                            </p>
                            <span className={cn('text-[9px] font-medium uppercase tracking-wider', rarity.text)}>
                              {rarity.label}
                            </span>
                          </div>
                          {achievement.description && (
                            <p className="truncate text-xs text-zinc-500 mt-0.5">{achievement.description}</p>
                          )}
                          <div className="mt-1 flex items-center gap-2">
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

                      {/* Progress bar (shown for locked or partially complete) */}
                      {!isUnlocked && progressTarget > 1 && (
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="font-mono text-white/30">
                              {progressCurrent}/{progressTarget}
                            </span>
                            <span className="text-white/20">{progressPercent}%</span>
                          </div>
                          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-white/20 transition-all duration-500"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Keyframe animation for recently unlocked achievements */}
      <style jsx>{`
        @keyframes achievement-unlock {
          0% {
            transform: scale(0.95);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.02);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </AcademyShell>
  )
}
