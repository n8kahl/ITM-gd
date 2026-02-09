'use client'

import { cn } from '@/lib/utils'

type LevelItem = {
  label: string
  value: number | null
  tone: 'resistance' | 'support' | 'neutral'
}

type LadderSymbol = {
  symbol: string
  currentPrice: number | null
  levels: LevelItem[]
}

function toneClass(tone: LevelItem['tone']): string {
  if (tone === 'resistance') return 'text-red-300'
  if (tone === 'support') return 'text-emerald-300'
  return 'text-white/65'
}

export function LevelLadder({
  symbols,
  onSelectSymbol,
}: {
  symbols: LadderSymbol[]
  onSelectSymbol?: (symbol: string) => void
}) {
  return (
    <section className="glass-card-heavy rounded-xl p-4 border border-white/10">
      <p className="text-[10px] text-white/35 uppercase tracking-wide mb-3">Level Ladder</p>

      {symbols.length === 0 ? (
        <p className="text-xs text-white/45">No key levels available yet.</p>
      ) : (
        <div className="space-y-3">
          {symbols.map((row) => (
            <button
              key={row.symbol}
              onClick={() => onSelectSymbol?.(row.symbol)}
              className="w-full text-left rounded-lg border border-white/10 bg-white/5 p-2.5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-white font-medium">{row.symbol}</span>
                <span className="text-emerald-300 font-mono">
                  {row.currentPrice != null ? `$${row.currentPrice.toFixed(2)}` : 'N/A'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {row.levels.map((level) => (
                  <div key={`${row.symbol}-${level.label}`} className="rounded border border-white/10 bg-black/20 px-1.5 py-1">
                    <p className="text-[10px] text-white/40 uppercase">{level.label}</p>
                    <p className={cn('text-[11px] font-mono mt-0.5', toneClass(level.tone))}>
                      {level.value != null ? level.value.toFixed(2) : '--'}
                    </p>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
