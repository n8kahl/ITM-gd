'use client'

import { BookOpen, CheckCircle, Star, Zap, Trophy, FlameKindling, Target } from 'lucide-react'

interface LearningTimelineProps {
  events: Array<{
    id: string
    type: string // 'lesson_started' | 'lesson_completed' | 'achievement_unlocked' | etc.
    title: string
    description: string
    timestamp: string
    metadata?: Record<string, unknown>
  }>
}

function getRelativeTime(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffMs = now - then
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? '' : 's'} ago`
  return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) === 1 ? '' : 's'} ago`
}

interface EventConfig {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  dotClass: string
  iconClass: string
  label: string
}

const EVENT_CONFIG: Record<string, EventConfig> = {
  lesson_started: {
    icon: BookOpen,
    dotClass: 'bg-amber-500/30 border-amber-500/60',
    iconClass: 'text-amber-400',
    label: 'Lesson Started',
  },
  lesson_completed: {
    icon: CheckCircle,
    dotClass: 'bg-emerald-500/30 border-emerald-500/60',
    iconClass: 'text-emerald-400',
    label: 'Lesson Completed',
  },
  achievement_unlocked: {
    icon: Trophy,
    dotClass: 'bg-purple-500/30 border-purple-500/60',
    iconClass: 'text-purple-400',
    label: 'Achievement Unlocked',
  },
  assessment_passed: {
    icon: Star,
    dotClass: 'bg-emerald-500/30 border-emerald-500/60',
    iconClass: 'text-emerald-400',
    label: 'Assessment Passed',
  },
  assessment_failed: {
    icon: Target,
    dotClass: 'bg-rose-500/30 border-rose-500/60',
    iconClass: 'text-rose-400',
    label: 'Assessment Attempted',
  },
  xp_earned: {
    icon: Zap,
    dotClass: 'bg-amber-500/30 border-amber-500/60',
    iconClass: 'text-amber-400',
    label: 'XP Earned',
  },
  streak_milestone: {
    icon: FlameKindling,
    dotClass: 'bg-orange-500/30 border-orange-500/60',
    iconClass: 'text-orange-400',
    label: 'Streak Milestone',
  },
  review_completed: {
    icon: CheckCircle,
    dotClass: 'bg-emerald-500/30 border-emerald-500/60',
    iconClass: 'text-emerald-400',
    label: 'Review Completed',
  },
  block_completed: {
    icon: CheckCircle,
    dotClass: 'bg-emerald-500/30 border-emerald-500/60',
    iconClass: 'text-emerald-400',
    label: 'Block Completed',
  },
}

const DEFAULT_EVENT_CONFIG: EventConfig = {
  icon: BookOpen,
  dotClass: 'bg-zinc-600/40 border-zinc-500/40',
  iconClass: 'text-zinc-400',
  label: 'Activity',
}

function getEventConfig(type: string): EventConfig {
  return EVENT_CONFIG[type] ?? DEFAULT_EVENT_CONFIG
}

export function AcademyLearningTimeline({ events }: LearningTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-zinc-300">Recent Activity</h2>
        <p className="mt-3 text-sm text-zinc-400">No learning activity yet. Complete lessons to see your timeline.</p>
      </div>
    )
  }

  return (
    <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-zinc-300">Recent Activity</h2>
      <div className="relative mt-4">
        {/* Vertical connector line */}
        <div className="absolute left-[18px] top-0 h-full w-px bg-white/10" aria-hidden="true" />

        <ol className="space-y-1">
          {events.map((event, idx) => {
            const config = getEventConfig(event.type)
            const Icon = config.icon
            const isLast = idx === events.length - 1

            return (
              <li key={event.id} className={`relative flex gap-3 ${isLast ? '' : 'pb-1'}`}>
                {/* Dot */}
                <div
                  className={`relative z-10 mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border ${config.dotClass}`}
                  aria-hidden="true"
                >
                  <Icon size={15} strokeWidth={1.5} className={config.iconClass} />
                </div>

                {/* Content card */}
                <div className="mb-2 min-w-0 flex-1 rounded-lg border border-white/8 bg-white/5 px-3 py-2.5 backdrop-blur-sm">
                  <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5">
                    <p className="text-xs font-medium text-white">{event.title}</p>
                    <time
                      dateTime={event.timestamp}
                      className="flex-shrink-0 font-mono text-xs text-zinc-500"
                      title={new Date(event.timestamp).toLocaleString()}
                    >
                      {getRelativeTime(event.timestamp)}
                    </time>
                  </div>
                  {event.description ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{event.description}</p>
                  ) : null}
                  <span
                    className={`mt-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${config.iconClass} bg-white/5`}
                  >
                    {config.label}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
