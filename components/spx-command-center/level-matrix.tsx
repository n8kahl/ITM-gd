'use client'

import { useMemo } from 'react'
import { Filter } from 'lucide-react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import type { LevelCategory } from '@/lib/types/spx-command-center'
import { cn } from '@/lib/utils'

const CATEGORIES: Array<{ value: LevelCategory; label: string }> = [
  { value: 'structural', label: 'Structural' },
  { value: 'tactical', label: 'Tactical' },
  { value: 'intraday', label: 'Intraday' },
  { value: 'options', label: 'Options' },
  { value: 'spy_derived', label: 'SPY' },
  { value: 'fibonacci', label: 'Fib' },
]

export function LevelMatrix() {
  const {
    levels,
    visibleLevelCategories,
    toggleLevelCategory,
    showSPYDerived,
    toggleSPYDerived,
  } = useSPXCommandCenter()

  const sorted = useMemo(() => {
    return [...levels].sort((a, b) => b.price - a.price)
  }, [levels])

  return (
    <section className="glass-card-heavy rounded-2xl p-3 md:p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">Level Matrix</h3>
        <Filter className="h-4 w-4 text-white/50" />
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
          SPY Overlay
        </button>
      </div>

      <div className="mt-3 max-h-[260px] overflow-auto rounded-xl border border-white/10">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0A0A0B]/90 backdrop-blur-md">
            <tr className="text-white/60">
              <th className="px-2 py-2 text-left font-medium">Source</th>
              <th className="px-2 py-2 text-left font-medium">Cat</th>
              <th className="px-2 py-2 text-right font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((level) => (
              <tr key={level.id} className="border-t border-white/5 text-white/80 hover:bg-white/[0.03]">
                <td className="px-2 py-1.5 truncate max-w-[160px]">{level.source}</td>
                <td className="px-2 py-1.5 uppercase text-[10px] text-white/55">{level.category.replace('_', ' ')}</td>
                <td className="px-2 py-1.5 text-right font-mono">{level.price.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
