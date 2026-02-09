'use client'

import { useEffect, useState, useMemo } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'

// ============================================
// TYPES
// ============================================

interface CalendarDay {
  date: string
  pnl: number
  trade_count: number
}

// ============================================
// HELPERS
// ============================================

function getCellColor(pnl: number, tradeCount: number): string {
  if (tradeCount === 0) return 'bg-white/[0.03]'
  if (pnl > 0) {
    if (pnl > 500) return 'bg-emerald-500/70'
    if (pnl > 200) return 'bg-emerald-600/50'
    return 'bg-emerald-800/40'
  }
  if (pnl < -500) return 'bg-red-500/60'
  if (pnl < -200) return 'bg-red-600/45'
  return 'bg-red-800/35'
}

function getMonthLabels(weeks: string[][]): { label: string; col: number }[] {
  const labels: { label: string; col: number }[] = []
  let lastMonth = -1

  weeks.forEach((week, colIndex) => {
    const firstDay = week.find(d => d)
    if (firstDay) {
      const month = new Date(firstDay).getMonth()
      if (month !== lastMonth) {
        labels.push({
          label: new Date(firstDay).toLocaleString('en-US', { month: 'short' }),
          col: colIndex,
        })
        lastMonth = month
      }
    }
  })
  return labels
}

// ============================================
// COMPONENT
// ============================================

export function CalendarHeatmap() {
  const [data, setData] = useState<CalendarDay[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredDay, setHoveredDay] = useState<CalendarDay | null>(null)
  const { session, isLoading: isAuthLoading } = useMemberAuth()

  useEffect(() => {
    const accessToken = session?.access_token
    if (isAuthLoading) return
    if (!accessToken) {
      setLoading(false)
      return
    }

    async function fetchData() {
      try {
        const res = await fetch('/api/members/dashboard/calendar?months=6', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        const result = await res.json()
        if (result.success && Array.isArray(result.data)) {
          setData(result.data)
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [isAuthLoading, session?.access_token])

  // Build calendar grid (GitHub-style)
  const { weeks, dayMap } = useMemo(() => {
    const map = new Map<string, CalendarDay>()
    data.forEach(d => map.set(d.date, d))

    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - 6)
    // Align to Sunday
    start.setDate(start.getDate() - start.getDay())

    const allWeeks: string[][] = []
    let currentWeek: string[] = []
    const cursor = new Date(start)

    while (cursor <= end) {
      const dateStr = cursor.toISOString().split('T')[0]
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
  }, [data])

  const monthLabels = useMemo(() => getMonthLabels(weeks), [weeks])

  return (
    <div className="glass-card-heavy rounded-2xl p-4 lg:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-ivory">Trading Activity</h3>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full h-24 rounded-lg bg-white/[0.02] animate-pulse" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          {/* Month Labels */}
          <div className="flex gap-0 mb-1 ml-6">
            {monthLabels.map((m, i) => (
              <span
                key={i}
                className="text-[9px] text-muted-foreground"
                style={{ marginLeft: i === 0 ? 0 : `${(m.col - (i > 0 ? monthLabels[i - 1].col : 0) - 1) * 14}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-0.5">
            {/* Day labels */}
            <div className="flex flex-col gap-0.5 mr-1 pt-0">
              {['', 'M', '', 'W', '', 'F', ''].map((label, i) => (
                <div key={i} className="w-3 h-3 flex items-center justify-center text-[8px] text-muted-foreground">
                  {label}
                </div>
              ))}
            </div>

            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((dateStr, di) => {
                  const dayData = dateStr ? dayMap.get(dateStr) : null
                  const tradeCount = dayData?.trade_count ?? 0
                  const pnl = dayData?.pnl ?? 0

                  return (
                    <div
                      key={`${wi}-${di}`}
                      className={cn(
                        'w-3 h-3 rounded-[2px] transition-all duration-150',
                        dateStr ? getCellColor(pnl, tradeCount) : 'bg-transparent',
                        dateStr && 'hover:ring-1 hover:ring-white/20 cursor-pointer'
                      )}
                      onMouseEnter={() => dayData && setHoveredDay(dayData)}
                      onMouseLeave={() => setHoveredDay(null)}
                      title={dateStr ? `${dateStr}: ${tradeCount} trade${tradeCount !== 1 ? 's' : ''}, $${pnl.toFixed(0)}` : ''}
                    />
                  )
                })}
              </div>
            ))}
          </div>

          {/* Tooltip */}
          {hoveredDay && (
            <div className="mt-2 text-[10px] text-muted-foreground font-mono">
              {hoveredDay.date} &mdash; {hoveredDay.trade_count} trade{hoveredDay.trade_count !== 1 ? 's' : ''},{' '}
              <span className={hoveredDay.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {hoveredDay.pnl >= 0 ? '+' : ''}${hoveredDay.pnl.toFixed(0)}
              </span>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 text-[9px] text-muted-foreground">
            <span>Loss</span>
            <div className="flex gap-0.5">
              <div className="w-2.5 h-2.5 rounded-[1px] bg-red-800/35" />
              <div className="w-2.5 h-2.5 rounded-[1px] bg-red-600/45" />
              <div className="w-2.5 h-2.5 rounded-[1px] bg-white/[0.03]" />
              <div className="w-2.5 h-2.5 rounded-[1px] bg-emerald-800/40" />
              <div className="w-2.5 h-2.5 rounded-[1px] bg-emerald-500/70" />
            </div>
            <span>Profit</span>
          </div>
        </div>
      )}
    </div>
  )
}
