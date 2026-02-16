'use client'

import { useEffect, useMemo, useState } from 'react'
import { TradingChart, type LevelAnnotation } from '@/components/ai-coach/trading-chart'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { getChartData, type ChartBar } from '@/lib/api/ai-coach'
import { ClusterZoneBar } from '@/components/spx-command-center/cluster-zone-bar'
import { ProbabilityCone } from '@/components/spx-command-center/probability-cone'
import { FibOverlay } from '@/components/spx-command-center/fib-overlay'
import { InfoTip } from '@/components/ui/info-tip'

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
    clusterZones,
    fibLevels,
    prediction,
    spxPrice,
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
        const response = await getChartData('SPX', '5m', session.access_token)
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
  }, [session?.access_token])

  const levelAnnotations = useMemo<LevelAnnotation[]>(() => {
    return levels.map((level) => ({
      price: level.price,
      label: level.source,
      color: level.chartStyle.color,
      lineStyle: toLineStyle(level.chartStyle.lineStyle),
      lineWidth: level.chartStyle.lineWidth,
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

    return ranked.slice(0, selectedSetup ? 14 : 10).map((item) => item.annotation)
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
            type: annotation.type,
          },
          {
            price: annotation.priceHigh,
            label: `${annotation.label} High`,
            color: 'rgba(16,185,129,0.75)',
            lineStyle: 'dashed',
            lineWidth: 1,
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
            type: annotation.type,
          })
      }

      return acc
    }, [])
  }, [chartAnnotations, selectedSetup])

  return (
    <section className="glass-card-heavy rounded-2xl p-3 md:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">Price + Focus Levels</h3>
          <InfoTip label="How focused chart levels work">
            To reduce clutter, the chart shows the most decision-relevant levels near current price by default. Full level detail remains in Level Matrix.
          </InfoTip>
        </div>
        <span className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-white/60">
          {focusedLevelAnnotations.length}/{levelAnnotations.length} shown
        </span>
      </div>
      <div className="h-[440px] md:h-[540px]">
        <TradingChart
          symbol="SPX"
          timeframe="5m"
          bars={bars}
          levels={[...focusedLevelAnnotations, ...setupAnnotations]}
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <ClusterZoneBar zones={clusterZones.slice(0, 6)} />
        <ProbabilityCone prediction={prediction} />
        <FibOverlay levels={fibLevels.slice(0, 8)} />
      </div>
    </section>
  )
}
