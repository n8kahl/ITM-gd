'use client'

import type { ContractRecommendation } from '@/lib/types/spx-command-center'
import { InfoTip } from '@/components/ui/info-tip'

function spreadPct(contract: ContractRecommendation): number | null {
  if (contract.ask <= 0) return null
  const spread = Math.max(contract.ask - contract.bid, 0)
  return (spread / contract.ask) * 100
}

export function ContractCard({ contract }: { contract: ContractRecommendation }) {
  const spread = spreadPct(contract)

  return (
    <article className="rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/12 to-emerald-500/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-ivory">{contract.description}</h4>
        <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-emerald-200">
          AI Pick
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <p className="text-white/45">R:R</p>
          <p className="font-mono text-emerald-200">{contract.riskReward.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-white/45">Spread</p>
          <p className="font-mono text-ivory">{spread != null ? `${spread.toFixed(1)}%` : '--'}</p>
        </div>
        <div>
          <p className="text-white/45">Expiry</p>
          <p className="font-mono text-ivory">{new Date(contract.expiry).toLocaleDateString()}</p>
        </div>
      </div>

      <details className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
        <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.1em] text-white/65">
          Contract Analytics
        </summary>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-white/75">
          <div>
            <p className="text-white/45">Δ</p>
            <p className="font-mono">{contract.delta.toFixed(3)}</p>
          </div>
          <div>
            <p className="text-white/45">Γ</p>
            <p className="font-mono">{contract.gamma.toFixed(3)}</p>
          </div>
          <div>
            <p className="text-white/45">Θ</p>
            <p className="font-mono">{contract.theta.toFixed(3)}</p>
          </div>
          <div>
            <p className="text-white/45">Vega</p>
            <p className="font-mono">{contract.vega.toFixed(3)}</p>
          </div>
          <div>
            <p className="text-white/45">Target 1</p>
            <p className="font-mono text-emerald-200">${contract.expectedPnlAtTarget1.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-white/45">Target 2</p>
            <p className="font-mono text-champagne">${contract.expectedPnlAtTarget2.toFixed(0)}</p>
          </div>
        </div>
      </details>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/75">
        <div>
          <p className="text-white/45">Bid/Ask</p>
          <p className="font-mono">{contract.bid.toFixed(2)} / {contract.ask.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-white/45">Max Loss</p>
          <p className="font-mono text-rose-200">${contract.maxLoss.toFixed(0)}</p>
        </div>
      </div>

      <div className="mt-2 flex items-start gap-2 text-[11px] text-white/70">
        <InfoTip label="How to use this recommendation" panelClassName="w-64">
          Prioritize tighter spread %, cleaner R:R, and setup alignment. Use targets as scenario planning, not guarantees.
        </InfoTip>
        <p>{contract.reasoning}</p>
      </div>
    </article>
  )
}
