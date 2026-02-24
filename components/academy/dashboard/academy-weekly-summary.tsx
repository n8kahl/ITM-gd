'use client'

import { ArrowDown, ArrowUp, Clock, Minus } from 'lucide-react'

interface AcademyWeeklySummaryProps {
  daysActive: boolean[]
  lessonsThisWeek: number
  lessonsLastWeek: number
  timeSpentMinutes: number
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function AcademyWeeklySummary({
  daysActive,
  lessonsThisWeek,
  lessonsLastWeek,
  timeSpentMinutes,
}: AcademyWeeklySummaryProps) {
  const delta = lessonsThisWeek - lessonsLastWeek
  const days = daysActive.slice(0, 7)

  return (
    <section
      className="glass-card-heavy rounded-xl border border-white/10 p-4"
      data-testid="academy-weekly-summary"
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-300">
        This Week
      </h2>

      {/* 7-day heatmap */}
      <div className="mt-3 flex items-end gap-2" data-testid="weekly-heatmap">
        {days.map((active, index) => (
          <div key={index} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={[
                'h-8 w-full rounded-md transition-colors',
                active
                  ? 'bg-emerald-500/70 shadow-sm shadow-emerald-900/40'
                  : 'bg-white/5',
              ].join(' ')}
              title={active ? 'Active' : 'No activity'}
              data-testid={active ? 'heatmap-day-active' : 'heatmap-day-inactive'}
              aria-label={`${DAY_LABELS[index]}: ${active ? 'active' : 'no activity'}`}
            />
            <span className="text-[10px] font-medium text-zinc-500">
              {DAY_LABELS[index]}
            </span>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* Lessons this week */}
        <div className="space-y-0.5" data-testid="lessons-this-week">
          <p className="text-xs text-zinc-500">Lessons</p>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-lg font-bold text-white">
              {lessonsThisWeek}
            </span>
            {delta > 0 ? (
              <span
                className="flex items-center gap-0.5 rounded bg-emerald-500/15 px-1 py-0.5 font-mono text-[10px] font-semibold text-emerald-400"
                data-testid="lessons-delta-up"
                aria-label={`${delta} more than last week`}
              >
                <ArrowUp className="h-2.5 w-2.5" strokeWidth={1.5} aria-hidden="true" />
                {delta}
              </span>
            ) : delta < 0 ? (
              <span
                className="flex items-center gap-0.5 rounded bg-rose-500/15 px-1 py-0.5 font-mono text-[10px] font-semibold text-rose-400"
                data-testid="lessons-delta-down"
                aria-label={`${Math.abs(delta)} fewer than last week`}
              >
                <ArrowDown className="h-2.5 w-2.5" strokeWidth={1.5} aria-hidden="true" />
                {Math.abs(delta)}
              </span>
            ) : (
              <span
                className="flex items-center gap-0.5 rounded bg-zinc-700/50 px-1 py-0.5 font-mono text-[10px] font-semibold text-zinc-400"
                data-testid="lessons-delta-neutral"
                aria-label="Same as last week"
              >
                <Minus className="h-2.5 w-2.5" strokeWidth={1.5} aria-hidden="true" />
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-600">vs {lessonsLastWeek} last wk</p>
        </div>

        {/* Time spent */}
        <div className="space-y-0.5" data-testid="time-spent">
          <p className="text-xs text-zinc-500">Time spent</p>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-emerald-400/70" strokeWidth={1.5} aria-hidden="true" />
            <span className="font-mono text-lg font-bold text-white">
              {formatTime(timeSpentMinutes)}
            </span>
          </div>
          <p className="text-xs text-zinc-600">this week</p>
        </div>
      </div>
    </section>
  )
}
