'use client'

import { Flame, Snowflake, Trophy } from 'lucide-react'

interface AcademyStreakBannerProps {
  currentStreak: number
  longestStreak: number
  streakFreezeAvailable: boolean
}

const MILESTONE_DAYS = [7, 30, 100]

function isMilestone(streak: number): boolean {
  return MILESTONE_DAYS.includes(streak)
}

export function AcademyStreakBanner({
  currentStreak,
  longestStreak,
  streakFreezeAvailable,
}: AcademyStreakBannerProps) {
  const milestone = isMilestone(currentStreak)

  return (
    <section
      className="glass-card-heavy rounded-xl border border-white/10 p-4"
      data-testid="academy-streak-banner"
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-300">
        Daily Streak
      </h2>

      <div className="mt-3 flex items-center gap-4">
        {/* Current streak */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <Flame
              className={[
                'h-8 w-8 transition-colors',
                currentStreak > 0 ? 'text-orange-400' : 'text-zinc-600',
                milestone ? 'animate-streak-pulse' : '',
              ].join(' ')}
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {milestone && (
              <span className="absolute -right-1 -top-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-500" />
              </span>
            )}
          </div>
          <div>
            <p
              className="font-mono text-2xl font-bold leading-none text-white"
              data-testid="current-streak-count"
            >
              {currentStreak}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {currentStreak === 1 ? 'day' : 'days'}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-10 w-px bg-white/10" aria-hidden="true" />

        {/* Longest streak */}
        <div className="flex items-center gap-2">
          <Trophy
            className="h-4 w-4 text-yellow-400/70"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <div>
            <p className="font-mono text-sm font-semibold text-zinc-200" data-testid="longest-streak-count">
              {longestStreak}
            </p>
            <p className="text-xs text-zinc-500">best</p>
          </div>
        </div>

        {/* Streak freeze indicator */}
        {streakFreezeAvailable && (
          <>
            <div className="h-10 w-px bg-white/10" aria-hidden="true" />
            <div
              className="flex items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1"
              title="Streak freeze available — one missed day won't break your streak"
              data-testid="streak-freeze-indicator"
            >
              <Snowflake
                className="h-3.5 w-3.5 text-sky-400"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <span className="text-xs text-sky-300">Freeze ready</span>
            </div>
          </>
        )}

        {/* Milestone badge */}
        {milestone && (
          <div
            className="ml-auto rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-1"
            data-testid="streak-milestone-badge"
          >
            <p className="font-mono text-xs font-bold text-emerald-300">
              🔥 {currentStreak}-day milestone!
            </p>
          </div>
        )}
      </div>

      {/* Milestone sub-text */}
      {milestone && (
        <p className="mt-2 text-xs text-emerald-400/80">
          Incredible consistency — you have reached a {currentStreak}-day milestone.
        </p>
      )}
    </section>
  )
}
