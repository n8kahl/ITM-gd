'use client'

import { useEffect, useMemo, useState } from 'react'
import { mergeRealtimePriceIntoBars } from '@/components/ai-coach/chart-realtime'
import { TradingChart, type LevelAnnotation } from '@/components/ai-coach/trading-chart'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { getChartData, type ChartBar, type ChartTimeframe } from '@/lib/api/ai-coach'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'

function toLineStyle(style: 'solid' | 'dashed' | 'dotted' | 'dot-dash'): 'solid' | 'dashed' | 'dotted' {
  if (style === 'dot-dash') return 'dashed'
  return style
}

export function SPXChart() {
  const { session } = useMemberAuth()
  const {
    levels,
    selectedSetup,
    chartAnnotations,
    spxPrice,
    spxTickTimestamp,
    selectedTimeframe,
    setChartTimeframe,
  } = useSPXCommandCenter()

  const [bars, setBars] = useState<ChartBar[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isCancelled = false

    async function load() {
      if (!session?.access_token) {
        setBars([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const response = await getChartData('SPX', selectedTimeframe, session.access_token)
        if (!isCancelled) {
          setBars(response.bars)
        }
      } catch {
        if (!isCancelled) {
          setBars([])
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [selectedTimeframe, session?.access_token])

  useEffect(() => {
    if (!spxTickTimestamp || !Number.isFinite(spxPrice) || spxPrice <= 0) return

    setBars((prev) => {
      const merged = mergeRealtimePriceIntoBars(prev, selectedTimeframe, spxPrice, spxTickTimestamp)
      return merged.changed ? merged.bars : prev
    })
  }, [selectedTimeframe, spxPrice, spxTickTimestamp])

  const levelAnnotations = useMemo<LevelAnnotation[]>(() => {
    return levels.map((level) => ({
      price: level.price,
      label: level.source,
      color: level.chartStyle.color,
      lineStyle: toLineStyle(level.chartStyle.lineStyle),
      lineWidth: level.chartStyle.lineWidth,
      axisLabelVisible: false,
      type: level.category,
      strength: level.strength,
      description: typeof level.metadata.description === 'string' ? level.metadata.description : level.source,
      testsToday: typeof level.metadata.testsToday === 'number' ? level.metadata.testsToday : undefined,
      lastTest: typeof level.metadata.lastTestAt === 'string' ? level.metadata.lastTestAt : null,
      holdRate: typeof level.metadata.holdRate === 'number' ? level.metadata.holdRate : null,
      displayContext: typeof level.metadata.displayContext === 'string' ? level.metadata.displayContext : undefined,
    }))
  }, [levels])

  const focusedLevelAnnotations = useMemo<LevelAnnotation[]>(() => {
    if (levelAnnotations.length === 0) return []
    const livePrice = bars[bars.length - 1]?.close || (spxPrice > 0 ? spxPrice : null)

    const strengthWeight = (strength?: string) => {
      if (strength === 'critical') return 1.5
      if (strength === 'strong') return 1.35
      if (strength === 'moderate') return 1.15
      return 1
    }

    const typeWeight = (type?: string) => {
      if (!type) return 1
      if (type === 'options') return 1.2
      if (type === 'structural') return 1.15
      if (type === 'fibonacci') return 0.95
      return 1
    }

    const ranked = [...levelAnnotations]
      .map((annotation) => {
        const distance = livePrice == null ? 0 : Math.abs(annotation.price - livePrice)
        const score = distance / (strengthWeight(annotation.strength) * typeWeight(annotation.type))
        return { annotation, score }
      })
      .sort((a, b) => a.score - b.score)

    return ranked.slice(0, selectedSetup ? 8 : 6).map((item) => item.annotation)
  }, [bars, levelAnnotations, selectedSetup, spxPrice])

  const setupAnnotations = useMemo<LevelAnnotation[]>(() => {
    if (!selectedSetup) return []

    return chartAnnotations.reduce<LevelAnnotation[]>((acc, annotation) => {
      if (annotation.type === 'entry_zone' && annotation.priceLow != null && annotation.priceHigh != null) {
        acc.push(
          {
            price: annotation.priceLow,
            label: `${annotation.label} Low`,
            color: 'rgba(16,185,129,0.75)',
            lineStyle: 'dashed',
            lineWidth: 1,
            axisLabelVisible: true,
            type: annotation.type,
          },
          {
            price: annotation.priceHigh,
            label: `${annotation.label} High`,
            color: 'rgba(16,185,129,0.75)',
            lineStyle: 'dashed',
            lineWidth: 1,
            axisLabelVisible: true,
            type: annotation.type,
          },
        )
        return acc
      }

      if (annotation.price != null) {
        acc.push({
            price: annotation.price,
            label: annotation.label,
            color: annotation.type === 'stop' ? 'rgba(251,113,133,0.75)' : 'rgba(244,208,120,0.75)',
            lineStyle: 'solid',
            lineWidth: 1.5,
            axisLabelVisible: true,
            type: annotation.type,
          })
      }

      return acc
    }, [])
  }, [chartAnnotations, selectedSetup])

  return (
    <section className="glass-card-heavy rounded-2xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-white/60">Price + Focus Levels</h3>
        <span className="text-[9px] font-mono text-white/40">
          {focusedLevelAnnotations.length}/{levelAnnotations.length} shown
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {(['1m', '5m', '15m', '1h', '4h', '1D'] as ChartTimeframe[]).map((timeframe) => (
          <button
            key={timeframe}
            type="button"
            onClick={() => {
              setChartTimeframe(timeframe)
              trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
                surface: 'chart_timeframe',
                timeframe,
              })
            }}
            className={
              selectedTimeframe === timeframe
                ? 'rounded-md border border-emerald-400/40 bg-emerald-500/12 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-emerald-200'
                : 'rounded-md border border-white/15 bg-white/[0.02] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-white/50 hover:text-white/70'
            }
          >
            {timeframe}
          </button>
        ))}
      </div>

      <div className="h-[400px] md:h-[500px]">
        <TradingChart
          symbol="SPX"
          timeframe={selectedTimeframe}
          bars={bars}
          levels={[...focusedLevelAnnotations, ...setupAnnotations]}
          isLoading={isLoading}
        />
      </div>
    </section>
  )
}
