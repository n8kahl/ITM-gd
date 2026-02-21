'use client'

import type { ContractRecommendation } from '@/lib/types/spx-command-center'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

function spreadPct(contract: ContractRecommendation): number | null {
  if (typeof contract.spreadPct === 'number' && Number.isFinite(contract.spreadPct)) {
    return contract.spreadPct
  }
  if (contract.ask <= 0) return null
  const spread = Math.max(contract.ask - contract.bid, 0)
  return (spread / contract.ask) * 100
}

function spreadHealth(pct: number | null): { color: string; label: string } {
  if (pct == null) return { color: 'bg-white/20', label: '--' }
  if (pct <= 10) return { color: 'bg-emerald-400', label: 'Tight' }
  if (pct <= 20) return { color: 'bg-amber-400', label: 'Fair' }
  return { color: 'bg-rose-400', label: 'Wide' }
}

function healthTone(tier: ContractRecommendation['healthTier']): { text: string; dot: string; label: string } {
  if (tier === 'green') return { text: 'text-emerald-200', dot: 'bg-emerald-400', label: 'Healthy' }
  if (tier === 'amber') return { text: 'text-amber-200', dot: 'bg-amber-400', label: 'Caution' }
  if (tier === 'red') return { text: 'text-rose-200', dot: 'bg-rose-400', label: 'Fragile' }
  return { text: 'text-white/60', dot: 'bg-white/30', label: 'Unknown' }
}

function costBandTone(costBand: ContractRecommendation['costBand']): string {
  if (costBand === 'discount') return 'text-emerald-200'
  if (costBand === 'expensive') return 'text-rose-200'
  return 'text-champagne'
}

function contractSignature(contract: ContractRecommendation): string {
  return [contract.type, contract.strike, contract.expiry, contract.description].join('|')
}

function alternativeToContract(
  primary: ContractRecommendation,
  alternative: NonNullable<ContractRecommendation['alternatives']>[number],
): ContractRecommendation {
  const primaryMid = ((primary.bid + primary.ask) / 2) || 0.01
  const alternativeMid = ((alternative.bid + alternative.ask) / 2) || 0.01
  const pnlScale = alternativeMid / primaryMid

  return {
    ...primary,
    ...alternative,
    gamma: primary.gamma,
    theta: primary.theta,
    vega: primary.vega,
    riskReward: primary.riskReward,
    expectedPnlAtTarget1: Number((primary.expectedPnlAtTarget1 * pnlScale).toFixed(2)),
    expectedPnlAtTarget2: Number((primary.expectedPnlAtTarget2 * pnlScale).toFixed(2)),
    reasoning: alternative.tradeoff || primary.reasoning,
    premiumMid: alternativeMid * 100,
    premiumAsk: alternative.ask * 100,
  }
}

export function ContractCard({
  contract,
  selectedContractSignature,
  onSelectContract,
}: {
  contract: ContractRecommendation
  selectedContractSignature?: string | null
  onSelectContract?: (contract: ContractRecommendation) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const spread = spreadPct(contract)
  const health = spreadHealth(spread)
  const contractHealth = healthTone(contract.healthTier)
  const currentSignature = contractSignature(contract)
  const isPrimarySelected = !selectedContractSignature || selectedContractSignature === currentSignature

  // R:R visual bar — loss zone (red) | profit zone (green) with T1/T2 markers
  const maxLossAbs = Math.abs(contract.maxLoss)
  const t1Abs = Math.abs(contract.expectedPnlAtTarget1)
  const t2Abs = Math.abs(contract.expectedPnlAtTarget2)
  const totalRange = maxLossAbs + t2Abs
  const lossPct = totalRange > 0 ? (maxLossAbs / totalRange) * 100 : 50
  const t1Pct = totalRange > 0 ? ((maxLossAbs + t1Abs) / totalRange) * 100 : 70

  return (
    <article className="rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.03] p-3.5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-mono text-sm font-semibold text-ivory">{contract.description}</h4>
          <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-emerald-200">
            AI Recommendation
          </span>
          {isPrimarySelected && (
            <span className="rounded-full border border-emerald-300/45 bg-emerald-400/20 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-emerald-100">
              Selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-right">
          {typeof contract.healthScore === 'number' && (
            <span className={cn('text-[10px] font-mono', contractHealth.text)}>
              {contractHealth.label} {contract.healthScore.toFixed(0)}
            </span>
          )}
          {/* Spread health traffic light */}
          <span className={cn('h-2 w-2 rounded-full', health.color)} title={`Spread: ${health.label}`} />
          <span className="text-[10px] text-white/60">{health.label}</span>
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
      <div className="mt-1 flex justify-between text-[10px] font-mono">
          <span className="text-rose-300/70">Risk ${maxLossAbs.toFixed(0)} /1c</span>
          <span className="text-emerald-300/70">T1 +${t1Abs.toFixed(0)}</span>
          <span className="text-champagne/70">T2 +${t2Abs.toFixed(0)}</span>
        </div>
      </div>

      {/* Key metrics row */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px]">
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

      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] md:grid-cols-4">
        <div className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-1">
          <p className="text-white/45">Premium</p>
          <p className="font-mono text-white/75">
            ${Math.round(contract.premiumAsk ?? contract.ask * 100)}
          </p>
        </div>
        <div className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-1">
          <p className="text-white/45">Liquidity</p>
          <p className="font-mono text-white/75">
            {typeof contract.liquidityScore === 'number' ? `${contract.liquidityScore.toFixed(0)}%` : '--'}
          </p>
        </div>
        <div className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-1">
          <p className="text-white/45">OI / Vol</p>
          <p className="font-mono text-white/75">
            {typeof contract.openInterest === 'number' ? contract.openInterest.toLocaleString() : '--'}
            {' / '}
            {typeof contract.volume === 'number' ? contract.volume.toLocaleString() : '--'}
          </p>
        </div>
        <div className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-1">
          <p className="text-white/45">Cost/Health</p>
          <p className={cn('font-mono uppercase', costBandTone(contract.costBand))}>
            {contract.costBand || 'balanced'}
          </p>
          <p className={cn('font-mono text-[9px]', contractHealth.text)}>
            {contract.healthTier || 'unknown'}
          </p>
        </div>
      </div>

      {(typeof contract.thetaRiskPer15m === 'number' || typeof contract.ivVsRealized === 'number') && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-white/55">
          {typeof contract.thetaRiskPer15m === 'number' && (
            <span className="font-mono">Theta burn ~${contract.thetaRiskPer15m.toFixed(2)}/15m</span>
          )}
          {typeof contract.ivVsRealized === 'number' && (
            <span className="font-mono">IV spread {(contract.ivVsRealized * 100).toFixed(1)}%</span>
          )}
        </div>
      )}

      {/* Expandable Greeks + detail */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="mt-2 flex min-h-[40px] w-full items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60"
      >
        <span className="text-[10px] uppercase tracking-[0.09em] text-white/55">Full analytics</span>
        <ChevronDown className={cn('h-3 w-3 text-white/40 transition-transform', expanded && 'rotate-180')} />
      </button>

      {onSelectContract && !isPrimarySelected && (
        <button
          type="button"
          onClick={() => onSelectContract(contract)}
          className="mt-2 min-h-[40px] rounded border border-emerald-400/35 bg-emerald-500/12 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em] text-emerald-100 transition-colors hover:bg-emerald-500/22 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60"
        >
          Use AI Recommendation
        </button>
      )}

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
              <p className="font-mono text-rose-200">${Math.abs(contract.maxLoss).toFixed(0)} (SPX x100)</p>
            </div>
            <div>
              <p className="text-white/40">Expiry</p>
              <p className="font-mono text-white/70">{new Date(contract.expiry).toLocaleDateString()}</p>
            </div>
          </div>
          {Array.isArray(contract.alternatives) && contract.alternatives.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
              <p className="text-[10px] uppercase tracking-[0.09em] text-white/55">Alternative Contracts</p>
              {contract.alternatives.map((alternative) => {
                const alternativeContract = alternativeToContract(contract, alternative)
                const alternativeSignature = contractSignature(alternativeContract)
                const isAlternativeSelected = selectedContractSignature === alternativeSignature

                return (
                  <button
                    key={`${alternative.description}-${alternative.score}`}
                    type="button"
                    onClick={() => onSelectContract?.(alternativeContract)}
                    className={cn(
                      'grid min-h-[40px] w-full grid-cols-5 gap-2 rounded border px-1.5 py-1.5 text-left text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60',
                      isAlternativeSelected
                        ? 'border-emerald-300/40 bg-emerald-500/12'
                        : 'border-transparent hover:border-white/15 hover:bg-white/[0.03]',
                    )}
                  >
                    <span className="font-mono text-white/70">
                      {alternative.description}
                      {isAlternativeSelected && (
                          <span className="ml-1 rounded border border-emerald-300/35 bg-emerald-500/15 px-1 py-[1px] text-[8px] uppercase tracking-[0.06em] text-emerald-100">
                            selected
                          </span>
                        )}
                      {alternative.tag && (
                        <span className="ml-1 rounded border border-emerald-300/25 bg-emerald-500/10 px-1 py-[1px] text-[8px] uppercase tracking-[0.06em] text-emerald-200">
                          {alternative.tag.replace('_', ' ')}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-white/50">Δ {alternative.delta.toFixed(2)}</span>
                    <span className="font-mono text-white/50">${alternative.ask.toFixed(2)} ask</span>
                    <span className="font-mono text-white/45">{alternative.spreadPct.toFixed(1)}% sprd</span>
                    <span className="font-mono text-white/45">
                      {alternative.liquidityScore.toFixed(0)} liq
                      {typeof alternative.healthScore === 'number' ? ` · H${alternative.healthScore.toFixed(0)}` : ''}
                    </span>
                    {alternative.tradeoff && (
                      <span className="col-span-5 text-[9px] text-white/55">{alternative.tradeoff}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
          <p className="text-[11px] text-white/65 leading-relaxed">{contract.reasoning}</p>
        </div>
      )}
    </article>
  )
}
