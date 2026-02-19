'use client'

import { useEffect, useMemo, useState } from 'react'
import { mergeRealtimeMicrobarIntoBars, mergeRealtimePriceIntoBars } from '@/components/ai-coach/chart-realtime'
import { TradingChart, type LevelAnnotation } from '@/components/ai-coach/trading-chart'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { getChartData, type ChartBar, type ChartTimeframe } from '@/lib/api/ai-coach'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import type { SPXLevel } from '@/lib/types/spx-command-center'

function toLineStyle(style: 'solid' | 'dashed' | 'dotted' | 'dot-dash'): 'solid' | 'dashed' | 'dotted' {
  if (style === 'dot-dash') return 'dashed'
  return style
}

function isSpyDerivedLevel(level: SPXLevel): boolean {
  return level.category === 'spy_derived'
    || level.symbol === 'SPY'
    || level.source.startsWith('spy_')
}

function labelFromSource(source: string): string {
  const normalized = source.toLowerCase()
  if (normalized.includes('call_wall')) return 'Call Wall'
  if (normalized.includes('put_wall')) return 'Put Wall'
  if (normalized.includes('flip_point')) return 'Flip'
  if (normalized.includes('zero_gamma')) return 'Zero Gamma'
  if (normalized.startsWith('fib_')) return source.replace(/^fib_/, '').replace(/_/g, ' ').toUpperCase()
  return source.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function chartLevelLabel(level: SPXLevel): string {
  const base = labelFromSource(level.source)
  if (isSpyDerivedLevel(level)) return `SPY→SPX ${base}`
  if (level.category === 'options') return `Options ${base}`
  return base
}

export function SPXChart() {
  const { session } = useMemberAuth()
  const { levels } = useSPXAnalyticsContext()
  const { selectedSetup, chartAnnotations } = useSPXSetupContext()
  const {
    spxPrice,
    spxTickTimestamp,
    spxPriceAgeMs,
    spxPriceSource,
    latestMicrobar,
    selectedTimeframe,
    setChartTimeframe,
  } = useSPXPriceContext()

  const [bars, setBars] = useState<ChartBar[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAllRelevantLevels, setShowAllRelevantLevels] = useState(false)

  useEffect(() => {
    // Always reset to 1m on page entry for command-center first-action consistency.
    setChartTimeframe('1m')
  }, [setChartTimeframe])

  useEffect(() => {
    let isCancelled = false
    let inFlight = false

    async function load(options?: { background?: boolean }) {
      if (inFlight) return
      inFlight = true
      if (!session?.access_token) {
        setBars([])
        setIsLoading(false)
        inFlight = false
        return
      }

      const background = options?.background === true
      if (!background) {
        setIsLoading(true)
      }

      try {
        const response = await getChartData('SPX', selectedTimeframe, session.access_token)
        if (!isCancelled) {
          if (Array.isArray(response.bars) && response.bars.length > 0) {
            setBars(response.bars)
          } else if (!background) {
            setBars([])
          }
        }
      } catch {
        if (!isCancelled && !background) {
          setBars([])
        }
      } finally {
        if (!isCancelled) {
          if (!background) {
            setIsLoading(false)
          }
        }
        inFlight = false
      }
    }

    if (!session?.access_token) {
      setBars([])
      setIsLoading(false)
      return () => {
        isCancelled = true
      }
    }

    void load()
    const refreshIntervalMs = selectedTimeframe === '1m' ? 30_000 : 60_000
    const refreshId = window.setInterval(() => {
      void load({ background: true })
    }, refreshIntervalMs)

    return () => {
      isCancelled = true
      window.clearInterval(refreshId)
    }
  }, [selectedTimeframe, session?.access_token])

  useEffect(() => {
    if (!latestMicrobar || selectedTimeframe !== '1m') return

    setBars((prev) => {
      const merged = mergeRealtimeMicrobarIntoBars(prev, selectedTimeframe, latestMicrobar)
      return merged.changed ? merged.bars : prev
    })
  }, [latestMicrobar, selectedTimeframe])

  useEffect(() => {
    if (!spxTickTimestamp || !Number.isFinite(spxPrice) || spxPrice <= 0) return
    const maxAgeMs = spxPriceSource === 'tick' ? 10_000 : 90_000
    if (spxPriceAgeMs != null && spxPriceAgeMs > maxAgeMs) return

    setBars((prev) => {
      const merged = mergeRealtimePriceIntoBars(prev, selectedTimeframe, spxPrice, spxTickTimestamp)
      return merged.changed ? merged.bars : prev
    })
  }, [selectedTimeframe, spxPrice, spxPriceAgeMs, spxPriceSource, spxTickTimestamp])

  const levelAnnotations = useMemo<LevelAnnotation[]>(() => {
    return levels.map((level) => ({
      price: level.price,
      label: chartLevelLabel(level),
      color: isSpyDerivedLevel(level) ? 'rgba(245, 237, 204, 0.72)' : level.chartStyle.color,
      lineStyle: toLineStyle(isSpyDerivedLevel(level) ? 'dot-dash' : level.chartStyle.lineStyle),
      lineWidth: level.chartStyle.lineWidth,
      axisLabelVisible: true,
      type: level.category,
      strength: level.strength,
      description: typeof level.metadata.description === 'string'
        ? level.metadata.description
        : `${chartLevelLabel(level)}${isSpyDerivedLevel(level) ? ' (SPY impact projection)' : ''}`,
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

    const baseFocused = ranked.slice(0, selectedSetup ? 8 : 6).map((item) => item.annotation)
    const nearestSpyDerived = ranked
      .filter((item) => item.annotation.type === 'spy_derived')
      .slice(0, 2)
      .map((item) => item.annotation)

    const merged = new Map<string, LevelAnnotation>()
    for (const annotation of [...baseFocused, ...nearestSpyDerived]) {
      const key = `${annotation.label}:${annotation.price}:${annotation.type || 'unknown'}`
      if (!merged.has(key)) merged.set(key, annotation)
    }

    return Array.from(merged.values())
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

  const displayedLevels = showAllRelevantLevels ? levelAnnotations : focusedLevelAnnotations

  return (
    <section className="glass-card-heavy rounded-2xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-white/60">Price + Levels</h3>
        <span className="text-[9px] font-mono text-white/40">
          {displayedLevels.length}/{levelAnnotations.length} shown
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <button
          type="button"
          onClick={() => {
            const nextValue = !showAllRelevantLevels
            setShowAllRelevantLevels(nextValue)
            trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.LEVEL_MAP_INTERACTION, {
              surface: 'chart_levels_toggle',
              mode: nextValue ? 'all_relevant' : 'focused',
              totalLevels: levelAnnotations.length,
            })
          }}
          className={
            showAllRelevantLevels
              ? 'rounded-md border border-champagne/45 bg-champagne/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] text-champagne'
              : 'rounded-md border border-white/15 bg-white/[0.02] px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] text-white/60 hover:text-white/80'
          }
          aria-pressed={showAllRelevantLevels}
        >
          {showAllRelevantLevels ? 'All Relevant' : 'Focus Only'}
        </button>
      </div>

      <div className="h-[400px] md:h-[500px]">
        <TradingChart
          symbol="SPX"
          timeframe={selectedTimeframe}
          bars={bars}
          levels={[...displayedLevels, ...setupAnnotations]}
          isLoading={isLoading}
        />
      </div>
    </section>
  )
}
