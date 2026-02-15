'use client'

import type { ContractRecommendation } from '@/lib/types/spx-command-center'

export function ContractCard({ contract }: { contract: ContractRecommendation }) {
  return (
    <article className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-ivory">{contract.description}</h4>
        <span className="text-[11px] text-emerald-200">R:R {contract.riskReward.toFixed(2)}</span>
      </div>

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
      </div>

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

      <div className="mt-2 text-[11px] text-white/70">
        <p>{contract.reasoning}</p>
      </div>
    </article>
  )
}
