'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Flame } from 'lucide-react'

interface StreakCalendarProps {
  /** Array of ISO date strings where the user was active */
  activeDays: string[]
  /** Current streak count */
  currentStreak: number
  className?: string
}

function getLast7Days(): Date[] {
  const days: Date[] = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push(d)
  }
  return days
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

export function StreakCalendar({
  activeDays,
  currentStreak,
  className,
}: StreakCalendarProps) {
  const last7 = useMemo(() => getLast7Days(), [])

  const activeDatesSet = useMemo(() => {
    return activeDays.map((d) => new Date(d))
  }, [activeDays])

  const isToday = (date: Date) => isSameDay(date, new Date())

  const isActive = (date: Date) =>
    activeDatesSet.some((ad) => isSameDay(ad, date))

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-semibold text-white">
            {currentStreak} Day Streak
          </span>
        </div>
      </div>

      {/* 7-day circles */}
      <div className="flex items-center justify-between gap-1">
        {last7.map((day, i) => {
          const active = isActive(day)
          const today = isToday(day)

          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all',
                  active
                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                    : 'bg-white/5 border border-white/10 text-white/30',
                  today && !active && 'border-white/20 text-white/50',
                  today && active && 'ring-1 ring-emerald-400/30'
                )}
              >
                {active ? (
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                ) : (
                  <span>{day.getDate()}</span>
                )}
              </div>
              <span className="text-[10px] text-white/40">
                {formatDayLabel(day)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
