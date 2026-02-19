'use client'

import { useMemo, useState } from 'react'
import { Filter } from 'lucide-react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { InfoTip } from '@/components/ui/info-tip'
import type { LevelCategory } from '@/lib/types/spx-command-center'
import { cn } from '@/lib/utils'

const CATEGORIES: Array<{ value: LevelCategory; label: string }> = [
  { value: 'structural', label: 'Structural' },
  { value: 'tactical', label: 'Tactical' },
  { value: 'intraday', label: 'Intraday' },
  { value: 'options', label: 'Options' },
  { value: 'spy_derived', label: 'SPY Impact' },
  { value: 'fibonacci', label: 'Fib' },
]

export function LevelMatrix() {
  const { levels } = useSPXAnalyticsContext()
  const {
    visibleLevelCategories,
    toggleLevelCategory,
    showSPYDerived,
    toggleSPYDerived,
  } = useSPXSetupContext()
  const { spxPrice } = useSPXPriceContext()
  const [showAll, setShowAll] = useState(false)

  const sorted = useMemo(() => {
    return [...levels].sort((a, b) => b.price - a.price)
  }, [levels])

  const simplified = useMemo(() => {
    if (showAll) return sorted
    if (!Number.isFinite(spxPrice) || spxPrice <= 0) return sorted.slice(0, 14)

    const nearPrice = [...sorted]
      .sort((a, b) => {
        const distanceA = Math.abs(a.price - spxPrice)
        const distanceB = Math.abs(b.price - spxPrice)
        return distanceA - distanceB
      })
      .slice(0, 14)
      .sort((a, b) => b.price - a.price)

    return nearPrice
  }, [showAll, sorted, spxPrice])

  return (
    <section className="glass-card-heavy relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.025] to-emerald-500/[0.02] p-3 md:p-4">
      <div className="pointer-events-none absolute -right-12 -top-10 h-28 w-28 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">Level Matrix</h3>
          <InfoTip label="How to use Level Matrix">
            Focused mode shows the closest decision levels to spot. Use Show All for complete context and backtesting.
          </InfoTip>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className={cn(
              'rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors',
              showAll
                ? 'border-champagne/45 bg-champagne/10 text-champagne'
                : 'border-white/20 bg-white/[0.03] text-white/65',
            )}
          >
            {showAll ? 'Focused' : 'Show All'}
          </button>
          <Filter className="h-4 w-4 text-white/50" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {CATEGORIES.map((category) => {
          const active = visibleLevelCategories.has(category.value)
          return (
            <button
              key={category.value}
              type="button"
              onClick={() => toggleLevelCategory(category.value)}
              className={cn(
                'rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition-colors',
                active
                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/20 bg-white/[0.03] text-white/50 hover:text-white/75',
              )}
            >
              {category.label}
            </button>
          )
        })}

        <button
          type="button"
          onClick={toggleSPYDerived}
          className={cn(
            'rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition-colors',
            showSPYDerived
              ? 'border-champagne/45 bg-champagne/10 text-champagne'
              : 'border-white/20 bg-white/[0.03] text-white/50',
          )}
        >
          SPY Impact Overlay
        </button>
      </div>

      <p className="relative z-10 mt-2 text-[11px] text-white/50">
        {showAll
          ? `Showing full matrix (${sorted.length} levels).`
          : `Showing ${simplified.length} closest levels to spot (${spxPrice > 0 ? spxPrice.toFixed(2) : '--'}).`}
      </p>

      <div className="relative z-10 mt-3 max-h-[260px] overflow-auto rounded-xl border border-white/10">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0A0A0B]/90 backdrop-blur-md">
            <tr className="text-white/60">
              <th className="px-2 py-2 text-left font-medium">Source</th>
              <th className="px-2 py-2 text-left font-medium">Cat</th>
              <th className="px-2 py-2 text-right font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            {simplified.map((level) => (
              <tr key={level.id} className="border-t border-white/5 text-white/80 hover:bg-white/[0.03]">
                <td className="px-2 py-1.5 truncate max-w-[160px]">{level.source}</td>
                <td className="px-2 py-1.5 uppercase text-[10px] text-white/55">
                  {level.category === 'spy_derived' ? 'spy impact' : level.category.replace('_', ' ')}
                </td>
                <td className="px-2 py-1.5 text-right font-mono">{level.price.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
