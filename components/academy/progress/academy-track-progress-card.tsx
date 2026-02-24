'use client'

import { Clock } from 'lucide-react'

interface TrackProgressCardProps {
  track: {
    title: string
    code: string
    modules: Array<{
      title: string
      slug: string
      lessonsTotal: number
      lessonsCompleted: number
      estimatedMinutes: number
    }>
  }
  totalTimeSpent: number // minutes
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

interface RingProps {
  percent: number
  size?: number
  strokeWidth?: number
}

function Ring({ percent, size = 72, strokeWidth = 6 }: RingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.max(0, Math.min(100, percent)) / 100) * circumference

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className="flex-shrink-0 -rotate-90"
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={strokeWidth}
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgb(52, 211, 153)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  )
}

export function AcademyTrackProgressCard({ track, totalTimeSpent }: TrackProgressCardProps) {
  const totalLessons = track.modules.reduce((acc, m) => acc + m.lessonsTotal, 0)
  const completedLessons = track.modules.reduce((acc, m) => acc + m.lessonsCompleted, 0)
  const totalEstimatedMinutes = track.modules.reduce((acc, m) => acc + m.estimatedMinutes, 0)
  const overallPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  return (
    <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
      {/* Header row */}
      <div className="flex items-start gap-4">
        {/* Ring */}
        <div className="relative flex-shrink-0">
          <Ring percent={overallPercent} size={72} strokeWidth={6} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-base font-semibold text-white">{overallPercent}%</span>
          </div>
        </div>

        {/* Track info */}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-zinc-500">{track.code}</p>
          <h3 className="mt-0.5 text-sm font-semibold text-white">{track.title}</h3>
          <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-zinc-400">
            <span>
              <span className="font-mono text-white">{completedLessons}</span>/{totalLessons} lessons
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} strokeWidth={1.5} />
              <span className="font-mono text-white">{formatMinutes(totalTimeSpent)}</span> spent
            </span>
            <span className="text-zinc-500">
              est. <span className="font-mono">{formatMinutes(totalEstimatedMinutes)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Module breakdown */}
      {track.modules.length > 0 ? (
        <div className="mt-4 space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">Modules</p>
          {track.modules.map((mod) => {
            const modPercent =
              mod.lessonsTotal > 0 ? Math.round((mod.lessonsCompleted / mod.lessonsTotal) * 100) : 0
            return (
              <div key={mod.slug}>
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs text-zinc-300">{mod.title}</p>
                  <div className="flex flex-shrink-0 items-center gap-2 text-xs">
                    <span className="font-mono text-zinc-400">
                      {mod.lessonsCompleted}/{mod.lessonsTotal}
                    </span>
                    <span
                      className={`font-mono font-medium ${modPercent === 100 ? 'text-emerald-400' : 'text-zinc-400'}`}
                    >
                      {modPercent}%
                    </span>
                  </div>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      modPercent === 100 ? 'bg-emerald-400' : 'bg-emerald-500/70'
                    }`}
                    style={{ width: `${Math.max(modPercent > 0 ? 2 : 0, modPercent)}%` }}
                  />
                </div>
                <p className="mt-0.5 text-right text-[10px] text-zinc-600">
                  est. {formatMinutes(mod.estimatedMinutes)}
                </p>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
