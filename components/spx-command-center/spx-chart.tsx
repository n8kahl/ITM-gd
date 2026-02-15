'use client'

import { useEffect, useMemo, useState } from 'react'
import { TradingChart, type LevelAnnotation } from '@/components/ai-coach/trading-chart'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { getChartData, type ChartBar } from '@/lib/api/ai-coach'
import { ClusterZoneBar } from '@/components/spx-command-center/cluster-zone-bar'
import { ProbabilityCone } from '@/components/spx-command-center/probability-cone'
import { FibOverlay } from '@/components/spx-command-center/fib-overlay'

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
      <div className="h-[440px] md:h-[540px]">
        <TradingChart
          symbol="SPX"
          timeframe="5m"
          bars={bars}
          levels={[...levelAnnotations, ...setupAnnotations]}
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
