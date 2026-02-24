'use client'

import { Star, Zap } from 'lucide-react'

interface XpEvent {
  source: string
  amount: number
  timestamp: string
}

interface AcademyXpLevelCardProps {
  totalXp: number
  currentLevel: number
  recentXpEvents: XpEvent[]
}

/** XP thresholds per level. Level n requires XP_PER_LEVEL * n total XP. */
const XP_PER_LEVEL = 500

function getNextLevelThreshold(level: number): number {
  return XP_PER_LEVEL * (level + 1)
}

function getCurrentLevelBaseXp(level: number): number {
  return XP_PER_LEVEL * level
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60))
      return diffMins <= 1 ? 'just now' : `${diffMins}m ago`
    }
    if (diffHours < 24) return `${diffHours}h ago`

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  } catch {
    return ''
  }
}

export function AcademyXpLevelCard({
  totalXp,
  currentLevel,
  recentXpEvents,
}: AcademyXpLevelCardProps) {
  const baseXp = getCurrentLevelBaseXp(currentLevel)
  const nextThreshold = getNextLevelThreshold(currentLevel)
  const xpIntoLevel = totalXp - baseXp
  const xpNeeded = nextThreshold - baseXp
  const progressPercent = Math.min(100, Math.max(0, Math.round((xpIntoLevel / xpNeeded) * 100)))

  const recentFive = recentXpEvents.slice(0, 5)

  return (
    <section
      className="glass-card-heavy rounded-xl border border-white/10 p-4"
      data-testid="academy-xp-level-card"
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-300">
        XP &amp; Level
      </h2>

      <div className="mt-3 flex items-start justify-between gap-3">
        {/* Level badge */}
        <div
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-900/40"
          data-testid="xp-level-badge"
          aria-label={`Level ${currentLevel}`}
        >
          <span className="font-mono text-lg font-bold text-white">{currentLevel}</span>
        </div>

        {/* XP details */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-yellow-400" strokeWidth={1.5} aria-hidden="true" />
              <span className="font-mono text-sm font-semibold text-white" data-testid="total-xp-value">
                {totalXp.toLocaleString()} XP
              </span>
            </div>
            <span className="font-mono text-xs text-zinc-400">
              Lv.{currentLevel + 1} in {(xpNeeded - xpIntoLevel).toLocaleString()} XP
            </span>
          </div>

          {/* Progress bar */}
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Level progress ${progressPercent}%`}
            data-testid="xp-progress-bar"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <p className="text-xs text-zinc-500">
            {xpIntoLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP to next level
          </p>
        </div>
      </div>

      {/* Recent XP events */}
      {recentFive.length > 0 && (
        <div className="mt-4" data-testid="recent-xp-events">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
            Recent XP
          </p>
          <ul className="space-y-1.5">
            {recentFive.map((event, index) => (
              <li
                key={`${event.source}-${index}`}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <Zap
                    className="h-3 w-3 text-emerald-400/70"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-zinc-300">{event.source}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-emerald-400">
                    +{event.amount}
                  </span>
                  <span className="text-xs text-zinc-600">{formatTimestamp(event.timestamp)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
