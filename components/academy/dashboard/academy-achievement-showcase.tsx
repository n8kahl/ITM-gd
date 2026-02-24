'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, Lock, Trophy } from 'lucide-react'

interface Achievement {
  key: string
  title: string
  description: string
  iconUrl: string
  unlockedAt: string
}

interface AcademyAchievementShowcaseProps {
  unlockedAchievements: Achievement[]
  totalAchievements: number
}

function formatUnlockDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

export function AcademyAchievementShowcase({
  unlockedAchievements,
  totalAchievements,
}: AcademyAchievementShowcaseProps) {
  const shown = unlockedAchievements.slice(0, 3)
  const lockedCount = Math.max(0, totalAchievements - unlockedAchievements.length)
  // Show up to 3 locked silhouettes to fill the row (visual only)
  const lockedSilhouettes = Math.min(lockedCount, Math.max(0, 3 - shown.length))

  return (
    <section
      className="glass-card-heavy rounded-xl border border-white/10 p-4"
      data-testid="academy-achievement-showcase"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-300">
          Achievements
        </h2>
        <Link
          href="/members/academy/achievements"
          className="flex items-center gap-0.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          data-testid="view-all-achievements-link"
        >
          View all
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </div>

      {/* Unlocked count */}
      <p className="mt-1 font-mono text-xs text-zinc-500">
        {unlockedAchievements.length} / {totalAchievements} unlocked
      </p>

      {/* Achievement list */}
      {shown.length === 0 && lockedSilhouettes === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
          <Trophy className="h-8 w-8 text-zinc-600" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-xs text-zinc-500">Complete lessons to earn achievements.</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2.5" data-testid="achievement-list">
          {/* Unlocked achievements */}
          {shown.map((achievement) => (
            <li
              key={achievement.key}
              className="flex items-center gap-3"
              data-testid="achievement-unlocked"
            >
              {/* Icon */}
              <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-900/30">
                <Image
                  src={achievement.iconUrl}
                  alt={achievement.title}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              </div>
              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{achievement.title}</p>
                <p className="truncate text-xs text-zinc-400">{achievement.description}</p>
              </div>
              {/* Date */}
              <span className="flex-shrink-0 font-mono text-[10px] text-zinc-600">
                {formatUnlockDate(achievement.unlockedAt)}
              </span>
            </li>
          ))}

          {/* Locked silhouettes */}
          {Array.from({ length: lockedSilhouettes }).map((_, index) => (
            <li
              key={`locked-${index}`}
              className="flex items-center gap-3 opacity-20"
              aria-hidden="true"
              data-testid="achievement-locked"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                <Lock className="h-4 w-4 text-zinc-400" strokeWidth={1.5} />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-3/4 rounded bg-white/10" />
                <div className="h-2 w-1/2 rounded bg-white/10" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
