'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Calendar, CalendarDays, Star, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'

type HeatmapView = 'month' | 'quarter' | 'year'

interface CalendarDay {
  date: string
  pnl: number
  trade_count: number
  win_rate?: number
  best_trade?: number | null
  worst_trade?: number | null
  mood?: string | null
}

type AnnotationType = 'best' | 'tilt' | 'streak'

const VIEW_MONTHS: Record<HeatmapView, number> = {
  month: 1,
  quarter: 3,
  year: 12,
}

const VIEW_LABELS: Record<HeatmapView, string> = {
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
}

function interpolateChannel(start: number, end: number, t: number): number {
  return Math.round(start + (end - start) * t)
}

function gradientColor(pnl: number, tradeCount: number, maxAbsPnl: number): string {
  if (tradeCount === 0) {
    return 'rgba(255, 255, 255, 0.03)'
  }
  if (maxAbsPnl <= 0) {
    return 'rgba(255, 255, 255, 0.2)'
  }

  const neutral = [236, 236, 236]
  const emerald = [16, 185, 129]
  const red = [239, 68, 68]
  const intensity = Math.min(1, Math.abs(pnl) / maxAbsPnl)
  const target = pnl >= 0 ? emerald : red

  const r = interpolateChannel(neutral[0], target[0], intensity)
  const g = interpolateChannel(neutral[1], target[1], intensity)
  const b = interpolateChannel(neutral[2], target[2], intensity)
  const alpha = 0.2 + intensity * 0.7
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`
}

function getMonthLabels(weeks: string[][]): { label: string; col: number }[] {
  const labels: { label: string; col: number }[] = []
  let lastMonth = -1

  weeks.forEach((week, colIndex) => {
    const firstDay = week.find((date) => date)
    if (!firstDay) return
    const month = new Date(firstDay).getMonth()
    if (month === lastMonth) return

    labels.push({
      label: new Date(firstDay).toLocaleString('en-US', { month: 'short' }),
      col: colIndex,
    })
    lastMonth = month
  })

  return labels
}

function buildAnnotations(days: CalendarDay[]): Map<string, Set<AnnotationType>> {
  const annotations = new Map<string, Set<AnnotationType>>()
  if (days.length === 0) return annotations

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  let bestDay = sorted[0]

  for (const day of sorted) {
    if (day.pnl > bestDay.pnl) {
      bestDay = day
    }
  }

  if (bestDay.pnl > 0 && bestDay.trade_count > 0) {
    annotations.set(bestDay.date, new Set<AnnotationType>(['best']))
  }

  let winStreak = 0
  let lossStreak = 0

  for (const day of sorted) {
    if (day.trade_count === 0) continue

    if (day.pnl > 0) {
      winStreak += 1
      lossStreak = 0
      if (winStreak > 0 && winStreak % 3 === 0) {
        const current = annotations.get(day.date) || new Set<AnnotationType>()
        current.add('streak')
        annotations.set(day.date, current)
      }
    } else if (day.pnl < 0) {
      lossStreak += 1
      winStreak = 0
      if (lossStreak >= 3) {
        const current = annotations.get(day.date) || new Set<AnnotationType>()
        current.add('tilt')
        annotations.set(day.date, current)
      }
    } else {
      winStreak = 0
      lossStreak = 0
    }
  }

  return annotations
}

function annotationIcon(type: AnnotationType) {
  switch (type) {
    case 'best':
      return <Star className="h-2 w-2 text-amber-300" />
    case 'tilt':
      return <AlertTriangle className="h-2 w-2 text-red-300" />
    case 'streak':
      return <Trophy className="h-2 w-2 text-emerald-300" />
    default:
      return null
  }
}

export function CalendarHeatmap() {
  const router = useRouter()
  const [data, setData] = useState<CalendarDay[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<HeatmapView>('quarter')
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)
  const { session, isLoading: isAuthLoading } = useMemberAuth()

  useEffect(() => {
    const accessToken = session?.access_token
    if (isAuthLoading) return
    if (!accessToken) {
      setLoading(false)
      return
    }

    async function fetchData() {
      setLoading(true)
      try {
        const res = await fetch(`/api/members/dashboard/calendar?view=${view}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        const result = await res.json()
        if (result.success && Array.isArray(result.data)) {
          setData(result.data)
        }
      } catch {
        // Silent fallback
      } finally {
        setLoading(false)
      }
    }

    void fetchData()
  }, [isAuthLoading, session?.access_token, view])

  const { weeks, dayMap } = useMemo(() => {
    const map = new Map<string, CalendarDay>()
    data.forEach((day) => map.set(day.date, day))

    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - VIEW_MONTHS[view])
    start.setDate(start.getDate() - start.getDay())
    start.setHours(0, 0, 0, 0)

    const allWeeks: string[][] = []
    let currentWeek: string[] = []
    const cursor = new Date(start)

    while (cursor <= end) {
      const dateStr = cursor.toISOString().slice(0, 10)
      currentWeek.push(dateStr)
      if (currentWeek.length === 7) {
        allWeeks.push(currentWeek)
        currentWeek = []
      }
      cursor.setDate(cursor.getDate() + 1)
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push('')
      allWeeks.push(currentWeek)
    }

    return { weeks: allWeeks, dayMap: map }
  }, [data, view])

  const monthLabels = useMemo(() => getMonthLabels(weeks), [weeks])
  const maxAbsPnl = useMemo(
    () => data.reduce((max, day) => Math.max(max, Math.abs(day.pnl)), 0),
    [data],
  )
  const annotations = useMemo(() => buildAnnotations(data), [data])
  const hoveredDay = hoveredDate ? dayMap.get(hoveredDate) || null : null
  const cellSize = view === 'year' ? 11 : 13

  return (
    <div className="glass-card-heavy flex h-full flex-col rounded-2xl p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-ivory">Trading Calendar Heatmap</h3>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-white/[0.03] p-1">
          {(Object.keys(VIEW_LABELS) as HeatmapView[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              className={cn(
                'rounded-md px-2 py-1 text-[10px] uppercase tracking-wide transition-colors',
                option === view
                  ? 'bg-emerald-900/35 text-emerald-300'
                  : 'text-muted-foreground hover:text-ivory',
              )}
            >
              {VIEW_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-24 w-full animate-pulse rounded-lg bg-white/[0.02]" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="mb-1 ml-6 flex gap-0">
            {monthLabels.map((label, index) => (
              <span
                key={`${label.label}-${label.col}`}
                className="text-[9px] text-muted-foreground"
                style={{
                  marginLeft: index === 0
                    ? 0
                    : `${(label.col - monthLabels[index - 1].col - 1) * (cellSize + 2)}px`,
                }}
              >
                {label.label}
              </span>
            ))}
          </div>

          <div className="flex gap-0.5">
            <div className="mr-1 flex flex-col gap-0.5">
              {['', 'M', '', 'W', '', 'F', ''].map((label, index) => (
                <div
                  key={`weekday-${index}`}
                  style={{ width: cellSize, height: cellSize }}
                  className="flex items-center justify-center text-[8px] text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            {weeks.map((week, weekIndex) => (
              <div key={`week-${weekIndex}`} className="flex flex-col gap-0.5">
                {week.map((dateStr, dayIndex) => {
                  const dayData = dateStr ? dayMap.get(dateStr) : null
                  const annotationSet = dateStr ? annotations.get(dateStr) : null
                  const firstAnnotation = annotationSet?.values().next().value as AnnotationType | undefined

                  return (
                    <button
                      key={`${weekIndex}-${dayIndex}`}
                      type="button"
                      disabled={!dateStr}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: dateStr
                          ? gradientColor(dayData?.pnl ?? 0, dayData?.trade_count ?? 0, maxAbsPnl)
                          : 'transparent',
                      }}
                      className={cn(
                        'relative rounded-[2px] transition-all duration-150',
                        dateStr ? 'cursor-pointer hover:ring-1 hover:ring-white/20' : 'cursor-default',
                        dateStr && (dayData?.trade_count ?? 0) === 0 && 'bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.02),rgba(255,255,255,0.02)_2px,rgba(255,255,255,0.04)_2px,rgba(255,255,255,0.04)_4px)]',
                      )}
                      onMouseEnter={() => setHoveredDate(dateStr || null)}
                      onMouseLeave={() => setHoveredDate(null)}
                      onClick={() => {
                        if (!dateStr) return
                        router.push(`/members/journal?from=${dateStr}&to=${dateStr}`)
                      }}
                      title={dateStr || ''}
                    >
                      {firstAnnotation && (
                        <span className="absolute -right-0.5 -top-0.5 rounded-full bg-black/60 p-[1px]">
                          {annotationIcon(firstAnnotation)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {hoveredDate && (
            <div className="mt-3 rounded-lg border border-white/[0.08] bg-black/30 p-2.5 text-[10px] text-muted-foreground">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-mono text-ivory">{hoveredDate}</span>
                {(hoveredDay?.trade_count || 0) > 0 ? (
                  <span className={cn(
                    'font-mono',
                    (hoveredDay?.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
                  )}>
                    {(hoveredDay?.pnl || 0) >= 0 ? '+' : ''}${(hoveredDay?.pnl || 0).toFixed(2)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    No trades
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono">
                <span>Trades: {hoveredDay?.trade_count || 0}</span>
                <span>Win Rate: {hoveredDay?.trade_count ? `${(hoveredDay.win_rate || 0).toFixed(1)}%` : '—'}</span>
                <span>Best: {hoveredDay?.best_trade != null ? `$${hoveredDay.best_trade.toFixed(2)}` : '—'}</span>
                <span>Worst: {hoveredDay?.worst_trade != null ? `$${hoveredDay.worst_trade.toFixed(2)}` : '—'}</span>
              </div>
              <div className="mt-1 text-[10px]">
                Mood: <span className="capitalize text-ivory/80">{hoveredDay?.mood || 'n/a'}</span>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-3 text-[9px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Loss</span>
              <div className="h-2.5 w-2.5 rounded-[1px]" style={{ backgroundColor: 'rgba(239,68,68,0.85)' }} />
              <div className="h-2.5 w-2.5 rounded-[1px]" style={{ backgroundColor: 'rgba(236,236,236,0.25)' }} />
              <div className="h-2.5 w-2.5 rounded-[1px]" style={{ backgroundColor: 'rgba(16,185,129,0.85)' }} />
              <span>Profit</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 text-amber-300" /> Best</span>
              <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-300" /> Tilt</span>
              <span className="inline-flex items-center gap-1"><Trophy className="h-3 w-3 text-emerald-300" /> Streak</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

