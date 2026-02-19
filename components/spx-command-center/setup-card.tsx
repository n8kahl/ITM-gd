'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Setup } from '@/lib/types/spx-command-center'

function statusBadge(status: Setup['status']): { label: string; cls: string } {
  if (status === 'triggered') return { label: 'TRIGGERED', cls: 'border-emerald-300/55 bg-emerald-400/25 text-emerald-100 animate-pulse-emerald' }
  if (status === 'ready') return { label: 'ACTIONABLE', cls: 'border-emerald-300/35 bg-emerald-400/12 text-emerald-100' }
  if (status === 'forming') return { label: 'FORMING', cls: 'border-amber-300/35 bg-amber-400/12 text-amber-100' }
  if (status === 'invalidated') return { label: 'INVALIDATED', cls: 'border-rose-300/35 bg-rose-400/12 text-rose-100' }
  return { label: 'EXPIRED', cls: 'border-white/25 bg-white/10 text-white/60' }
}

function borderClass(status: Setup['status']): string {
  if (status === 'triggered') return 'border-emerald-400/55 bg-emerald-500/[0.08]'
  if (status === 'ready') return 'border-emerald-400/40 bg-emerald-500/[0.05]'
  if (status === 'forming') return 'border-amber-400/30 bg-amber-500/[0.04]'
  if (status === 'invalidated') return 'border-rose-400/40 bg-rose-500/[0.06]'
  return 'border-white/15 bg-white/[0.02] opacity-60'
}

function tierLabel(tier: Setup['tier'] | undefined): string | null {
  if (!tier) return null
  if (tier === 'sniper_primary') return 'SNIPER A'
  if (tier === 'sniper_secondary') return 'SNIPER B'
  if (tier === 'watchlist') return 'WATCHLIST'
  return null
}

/** Compute thermometer positions as percentages along the trade range */
function computeThermometer(setup: Setup, currentPrice: number) {
  const entryMid = (setup.entryZone.low + setup.entryZone.high) / 2
  const isBullish = setup.direction === 'bullish'

  // Full range from stop → target2 (or reverse for bearish)
  const rangeMin = isBullish ? setup.stop : setup.target2.price
  const rangeMax = isBullish ? setup.target2.price : setup.stop
  const span = Math.abs(rangeMax - rangeMin)
  if (span <= 0) return null

  const pct = (price: number) => Math.max(0, Math.min(100, ((price - rangeMin) / span) * 100))

  return {
    stopPct: pct(setup.stop),
    entryLowPct: pct(setup.entryZone.low),
    entryHighPct: pct(setup.entryZone.high),
    target1Pct: pct(setup.target1.price),
    target2Pct: pct(setup.target2.price),
    pricePct: Number.isFinite(currentPrice) && currentPrice > 0 ? pct(currentPrice) : null,
    entryMid,
    // Is price inside entry zone?
    inZone: Number.isFinite(currentPrice) && currentPrice >= setup.entryZone.low && currentPrice <= setup.entryZone.high,
  }
}

export function SetupCard({
  setup,
  currentPrice,
  selected,
  readOnly = false,
  onSelect,
  onEnterTrade,
  showEnterTradeCta = false,
}: {
  setup: Setup
  currentPrice: number
  selected: boolean
  readOnly?: boolean
  onSelect?: () => void
  onEnterTrade?: () => void
  showEnterTradeCta?: boolean
}) {
  const badge = statusBadge(setup.status)
  const thermo = useMemo(() => computeThermometer(setup, currentPrice), [setup, currentPrice])

  const entryMid = (setup.entryZone.low + setup.entryZone.high) / 2
  const riskPts = Math.abs(entryMid - setup.stop)
  const rewardPts = Math.abs(setup.target1.price - entryMid)
  const rr = riskPts > 0 ? (rewardPts / riskPts) : 0
  const calibratedWin = setup.pWinCalibrated != null ? setup.pWinCalibrated * 100 : setup.probability
  const setupScore = setup.score ?? (setup.confluenceScore * 20)
  const setupEv = setup.evR ?? null

  const distToEntry = Number.isFinite(currentPrice) && currentPrice > 0
    ? Math.abs(currentPrice - entryMid)
    : null
  const tier = tierLabel(setup.tier)
  const canEnterTrade = showEnterTradeCta
    && (setup.status === 'ready' || setup.status === 'triggered')
    && !readOnly
    && typeof onEnterTrade === 'function'

  return (
    <div
      className={cn(
        'w-full rounded-xl border p-3 transition-all duration-200',
        borderClass(setup.status),
        onSelect ? 'cursor-pointer hover:border-emerald-300/50 hover:bg-emerald-500/[0.08]' : 'cursor-default',
        selected && 'ring-1 ring-emerald-300/60 bg-emerald-500/[0.1]',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={!onSelect}
        className={cn(
          'w-full text-left outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60 focus-visible:ring-offset-1 focus-visible:ring-offset-[#090B0F]',
          onSelect ? 'cursor-pointer' : 'cursor-default',
        )}
      >
        {/* ── Row 1: Direction headline + Status badge ── */}
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-base font-semibold tracking-tight text-ivory uppercase">
            {setup.direction} {setup.regime}
          </h4>
          <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em]', badge.cls)}>
            {badge.label}
          </span>
        </div>

        {/* ── Row 2: Setup type + Confluence score ── */}
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/55">
            {setup.type.replace(/_/g, ' ')}
          </span>
          <div className="flex items-center gap-1.5">
            {tier && (
              <span className="rounded border border-emerald-300/25 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em] text-emerald-200">
                {tier}
              </span>
            )}
            {Array.from({ length: 5 }).map((_, idx) => (
              <span
                key={`${setup.id}-c-${idx}`}
                className={cn(
                  'h-2 w-2 rounded-full',
                  idx < setup.confluenceScore
                    ? 'bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.4)]'
                    : 'bg-white/15',
                )}
              />
            ))}
            <span className="ml-1 text-[11px] font-mono text-white/60">{setup.confluenceScore}/5</span>
          </div>
        </div>

        {/* ── Row 3: Confluence source pills ── */}
        {setup.confluenceSources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {setup.confluenceSources.slice(0, 4).map((source) => (
              <div
                key={source}
                className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-emerald-200"
              >
                {source.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        )}

        {/* ── Row 4: Entry proximity thermometer ── */}
        {thermo && (
          <div className="mt-2.5 rounded-lg border border-white/10 bg-black/30 px-2 py-2">
            <div className="relative h-3 rounded-full bg-white/[0.06] overflow-hidden">
              {/* Stop zone (red) */}
              <div
                className={cn(
                  'absolute top-0 h-full rounded-l-full bg-rose-500/30',
                )}
                style={{ left: 0, width: `${Math.min(thermo.stopPct, thermo.entryLowPct)}%` }}
              />
              {/* Entry zone (emerald band) */}
              <div
                className={cn(
                  'absolute top-0 h-full',
                  thermo.inZone ? 'bg-emerald-400/50 animate-pulse' : 'bg-emerald-500/25',
                )}
                style={{
                  left: `${thermo.entryLowPct}%`,
                  width: `${Math.max(1, thermo.entryHighPct - thermo.entryLowPct)}%`,
                }}
              />
              {/* Target 1 marker */}
              <div
                className="absolute top-0 h-full w-0.5 bg-emerald-300/60"
                style={{ left: `${thermo.target1Pct}%` }}
              />
              {/* Target 2 marker */}
              <div
                className="absolute top-0 h-full w-0.5 bg-champagne/50"
                style={{ left: `${thermo.target2Pct}%` }}
              />
              {/* Current price indicator */}
              {thermo.pricePct != null && (
                <div
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 h-4 w-1.5 rounded-full border',
                    thermo.inZone
                      ? 'bg-emerald-300 border-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                      : 'bg-white border-white/60 shadow-[0_0_6px_rgba(255,255,255,0.3)]',
                  )}
                  style={{ left: `${thermo.pricePct}%`, transform: 'translate(-50%, -50%)' }}
                />
              )}
            </div>
            {/* Thermometer labels */}
            <div className="mt-1 flex justify-between text-[9px] font-mono">
              <span className="text-rose-300">{setup.stop.toFixed(0)}</span>
              <span className="text-emerald-200">{entryMid.toFixed(0)}</span>
              <span className="text-emerald-300">T1 {setup.target1.price.toFixed(0)}</span>
              <span className="text-champagne">T2 {setup.target2.price.toFixed(0)}</span>
            </div>
          </div>
        )}

        {/* ── Row 5: Key decision metrics (compact) ── */}
        <div className="mt-2 grid grid-cols-4 gap-1.5 text-[10px]">
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-1 text-center">
            <p className="text-white/40">R:R</p>
            <p className="font-mono text-emerald-200 font-medium">{rr.toFixed(1)}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-1 text-center">
            <p className="text-white/40">Win%</p>
            <p className="font-mono text-ivory font-medium">{calibratedWin.toFixed(0)}%</p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-1 text-center">
            <p className="text-white/40">Score</p>
            <p className="font-mono text-ivory font-medium">{setupScore.toFixed(0)}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-1 text-center">
            <p className="text-white/40">EV(R)</p>
            <p className={cn('font-mono font-medium', (setupEv ?? 0) >= 0 ? 'text-emerald-200' : 'text-rose-200')}>
              {setupEv != null ? `${setupEv >= 0 ? '+' : ''}${setupEv.toFixed(2)}` : '--'}
            </p>
          </div>
        </div>

        {distToEntry != null && (
          <p className="mt-1.5 text-[9px] uppercase tracking-[0.09em] text-white/40">
            Dist to entry {distToEntry.toFixed(1)} pts · Risk {riskPts.toFixed(1)} pts
          </p>
        )}
      </button>

      {canEnterTrade && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onEnterTrade?.()
          }}
          className={cn(
            'mt-2.5 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em]',
            setup.status === 'triggered'
              ? 'border-emerald-300/55 bg-emerald-500/25 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
              : 'border-emerald-400/35 bg-emerald-500/14 text-emerald-100 hover:bg-emerald-500/22',
          )}
          aria-label={`Enter trade focus for ${setup.direction} ${setup.type.replace(/_/g, ' ')}`}
        >
          Enter Trade
        </button>
      )}

      {readOnly && (
        <p className="mt-1.5 text-[9px] uppercase tracking-[0.1em] text-white/35">Read-only</p>
      )}
    </div>
  )
}
