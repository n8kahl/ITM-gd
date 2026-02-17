'use client'

import type { ContractRecommendation } from '@/lib/types/spx-command-center'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

function spreadPct(contract: ContractRecommendation): number | null {
  if (contract.ask <= 0) return null
  const spread = Math.max(contract.ask - contract.bid, 0)
  return (spread / contract.ask) * 100
}

function spreadHealth(pct: number | null): { color: string; label: string } {
  if (pct == null) return { color: 'bg-white/20', label: '--' }
  if (pct <= 5) return { color: 'bg-emerald-400', label: 'Tight' }
  if (pct <= 12) return { color: 'bg-amber-400', label: 'Fair' }
  return { color: 'bg-rose-400', label: 'Wide' }
}

export function ContractCard({ contract }: { contract: ContractRecommendation }) {
  const [expanded, setExpanded] = useState(false)
  const spread = spreadPct(contract)
  const health = spreadHealth(spread)

  // R:R visual bar — loss zone (red) | profit zone (green) with T1/T2 markers
  const maxLossAbs = Math.abs(contract.maxLoss)
  const t1Abs = Math.abs(contract.expectedPnlAtTarget1)
  const t2Abs = Math.abs(contract.expectedPnlAtTarget2)
  const totalRange = maxLossAbs + t2Abs
  const lossPct = totalRange > 0 ? (maxLossAbs / totalRange) * 100 : 50
  const t1Pct = totalRange > 0 ? ((maxLossAbs + t1Abs) / totalRange) * 100 : 70

  return (
    <article className="rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.03] p-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="font-mono text-sm font-semibold text-ivory">{contract.description}</h4>
          <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] text-emerald-200">
            AI Pick
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Spread health traffic light */}
          <span className={cn('h-2 w-2 rounded-full', health.color)} title={`Spread: ${health.label}`} />
          <span className="text-[9px] text-white/50">{health.label}</span>
        </div>
      </div>

      {/* Visual R:R bar */}
      <div className="mt-2.5">
        <div className="relative h-[10px] w-full overflow-hidden rounded-full bg-white/[0.06]">
          {/* Loss zone */}
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-rose-500/40"
            style={{ width: `${lossPct}%` }}
          />
          {/* Profit zone */}
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-emerald-500/40"
            style={{ width: `${100 - lossPct}%` }}
          />
          {/* T1 marker */}
          <div
            className="absolute top-0 h-full w-[2px] bg-emerald-300/80"
            style={{ left: `${t1Pct}%` }}
            title={`T1: +$${contract.expectedPnlAtTarget1.toFixed(0)}`}
          />
          {/* T2 marker */}
          <div
            className="absolute top-0 h-full w-[2px] bg-champagne/80"
            style={{ right: '0%' }}
            title={`T2: +$${contract.expectedPnlAtTarget2.toFixed(0)}`}
          />
          {/* Entry (break-even) marker */}
          <div
            className="absolute top-0 h-full w-[2px] bg-white/50"
            style={{ left: `${lossPct}%` }}
            title="Break-even"
          />
        </div>
      <div className="mt-1 flex justify-between text-[9px] font-mono">
          <span className="text-rose-300/70">Risk ${maxLossAbs.toFixed(0)} /1c</span>
          <span className="text-emerald-300/70">T1 +${t1Abs.toFixed(0)}</span>
          <span className="text-champagne/70">T2 +${t2Abs.toFixed(0)}</span>
        </div>
      </div>

      {/* Key metrics row */}
      <div className="mt-2 flex items-center gap-3 text-[10px]">
        <span className="font-mono text-emerald-200">
          R:R {contract.riskReward.toFixed(2)}
        </span>
        <span className="font-mono text-white/60">
          Δ {contract.delta.toFixed(2)}
        </span>
        <span className="font-mono text-white/60">
          Θ {contract.theta.toFixed(2)}
        </span>
        <span className="font-mono text-white/50">
          {contract.bid.toFixed(2)}/{contract.ask.toFixed(2)}
        </span>
        <span className="font-mono text-white/40">
          {spread != null ? `${spread.toFixed(1)}%` : '--'} sprd
        </span>
      </div>

      {/* Expandable Greeks + detail */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="mt-2 flex w-full items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-2 py-1"
      >
        <span className="text-[9px] uppercase tracking-[0.1em] text-white/45">Full analytics</span>
        <ChevronDown className={cn('h-3 w-3 text-white/40 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-4 gap-2 text-[10px]">
            <div>
              <p className="text-white/40">Δ</p>
              <p className="font-mono text-white/70">{contract.delta.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-white/40">Γ</p>
              <p className="font-mono text-white/70">{contract.gamma.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-white/40">Θ</p>
              <p className="font-mono text-white/70">{contract.theta.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-white/40">Vega</p>
              <p className="font-mono text-white/70">{contract.vega.toFixed(3)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <p className="text-white/40">Max Risk (1 contract)</p>
              <p className="font-mono text-rose-200">${contract.maxLoss.toFixed(0)} (SPX x100)</p>
            </div>
            <div>
              <p className="text-white/40">Expiry</p>
              <p className="font-mono text-white/70">{new Date(contract.expiry).toLocaleDateString()}</p>
            </div>
          </div>
          <p className="text-[10px] text-white/55 leading-relaxed">{contract.reasoning}</p>
        </div>
      )}
    </article>
  )
}
