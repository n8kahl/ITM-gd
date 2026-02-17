'use client'

import { useMemo } from 'react'
import { Activity, Dot, Target } from 'lucide-react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { InfoTip } from '@/components/ui/info-tip'
import { cn } from '@/lib/utils'

function formatPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '--'
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

function formatGexNet(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`
  return `${(value / 1_000).toFixed(0)}K`
}

function getAgeMs(timestamp: string | null): number | null {
  if (!timestamp) return null
  const parsed = Date.parse(timestamp)
  if (Number.isNaN(parsed)) return null
  return Math.max(Date.now() - parsed, 0)
}

function formatFreshness(ageMs: number | null): string {
  if (ageMs == null) return '--'
  const seconds = Math.floor(ageMs / 1000)
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

export function SPXHeader() {
  const {
    spxPrice,
    basis,
    regime,
    prediction,
    activeSetups,
    flowEvents,
    gexProfile,
    snapshotGeneratedAt,
    priceStreamConnected,
    priceStreamError,
  } = useSPXCommandCenter()

  const snapshotAgeMs = getAgeMs(snapshotGeneratedAt)
  const snapshotFreshness = formatFreshness(snapshotAgeMs)

  const actionableCount = useMemo(
    () => activeSetups.filter((s) => s.status === 'ready' || s.status === 'triggered').length,
    [activeSetups],
  )

  const flowBias = useMemo(() => {
    if (flowEvents.length === 0) return 'flow warming'
    const bullish = flowEvents.filter((e) => e.direction === 'bullish').reduce((s, e) => s + e.premium, 0)
    const bearish = flowEvents.filter((e) => e.direction === 'bearish').reduce((s, e) => s + e.premium, 0)
    const gross = bullish + bearish
    const pct = gross > 0 ? Math.round((bullish / gross) * 100) : 50
    if (pct >= 60) return `bullish pressure ${pct}%`
    if (pct <= 40) return `bearish pressure ${100 - pct}%`
    return `balanced ${pct}%`
  }, [flowEvents])

  const postureDir = prediction
    ? prediction.direction.bullish >= prediction.direction.bearish ? 'bullish' : 'bearish'
    : 'neutral'
  const postureLabel = `${(regime || '--').toUpperCase()} ${postureDir.toUpperCase()}${prediction ? ` ${prediction.confidence.toFixed(0)}%` : ''}`

  const gexNet = gexProfile?.combined?.netGex ?? null
  const gexPosture = gexNet != null ? (gexNet >= 0 ? 'Supportive' : 'Unstable') : '--'
  const flipPoint = gexProfile?.combined?.flipPoint ?? null

  return (
    <header className="glass-card-heavy relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] via-white/[0.015] to-emerald-500/[0.035] px-4 py-3 md:px-5 md:py-4">
      <div className="pointer-events-none absolute -right-24 -top-24 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        {/* ── Left: Hero price ── */}
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-300" />
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">SPX Command Center</p>
            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-300">LIVE</span>
            <InfoTip label="What is SPX Command Center?">
              Real-time decision cockpit for SPX options: setups, levels, flow, and coaching fused in one view.
            </InfoTip>
          </div>
          <h1 className="mt-1 font-serif text-[2.6rem] leading-none text-ivory md:text-[3rem]">
            {formatPrice(spxPrice)}
          </h1>
          <p className="mt-1.5 text-[12px] text-white/55">
            <span className="text-white/70">{actionableCount} setups actionable</span>
            {' · '}
            <span title="Current market regime classification">Regime: <span className="text-ivory">{regime || '--'}</span></span>
            {' · '}
            <span title="Options flow direction bias (bull vs bear premium)">Flow: <span className="text-ivory">{flowBias}</span></span>
          </p>
        </div>

        {/* ── Right: Decision metrics ── */}
        <div className="relative z-10 grid grid-cols-2 gap-2 md:min-w-[340px]">
          {/* Market posture (span full) */}
          <div className="col-span-2 rounded-xl border border-champagne/25 bg-champagne/[0.06] px-3 py-2" title="AI prediction combining regime, flow, and GEX data — shows directional bias and confidence level">
            <p className="text-[9px] uppercase tracking-[0.12em] text-white/45">Market Posture · AI Prediction</p>
            <p className="font-mono text-sm font-semibold text-champagne">{postureLabel}</p>
          </div>

          {/* 4 compact metric cells */}
          <div className="rounded-lg border border-white/8 bg-black/25 px-2.5 py-1.5 text-center" title="SPX minus SPY×10 spread — positive means SPX leads, negative means SPY leads">
            <p className="text-[8px] uppercase tracking-[0.12em] text-white/40">SPX/SPY Basis</p>
            <p className={cn('font-mono text-sm font-semibold', basis && basis.current >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
              {basis ? formatSigned(basis.current) : '--'}
            </p>
            {basis && (
              <p className="text-[8px] text-white/30">{basis.leading} leads</p>
            )}
          </div>
          <div className="rounded-lg border border-white/8 bg-black/25 px-2.5 py-1.5 text-center" title="How extreme the current basis is vs its 20-period average — above ±1 is notable, ±2 is extreme">
            <p className="text-[8px] uppercase tracking-[0.12em] text-white/40">Basis Z-Score</p>
            <p className={cn('font-mono text-sm font-semibold', basis && basis.zscore < -1 ? 'text-rose-300' : basis && basis.zscore > 1 ? 'text-emerald-300' : 'text-ivory')}>
              {basis ? basis.zscore.toFixed(2) : '--'}
            </p>
            {basis && (
              <p className="text-[8px] text-white/30">
                {Math.abs(basis.zscore) >= 2 ? 'Extreme' : Math.abs(basis.zscore) >= 1 ? 'Notable' : 'Normal'}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-white/8 bg-black/25 px-2.5 py-1.5 text-center" title="Net gamma exposure — Supportive means dealers dampen moves, Unstable means dealers amplify moves">
            <p className="text-[8px] uppercase tracking-[0.12em] text-white/40">GEX Net</p>
            <p className={cn('font-mono text-sm font-semibold', gexNet != null && gexNet >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
              {gexNet != null ? gexPosture : '--'}
            </p>
            {gexNet != null && (
              <p className="text-[8px] font-mono text-white/35">{formatGexNet(gexNet)}</p>
            )}
          </div>
          <div className="rounded-lg border border-white/8 bg-black/25 px-2.5 py-1.5 text-center" title="GEX flip point — above this level dealers stabilize, below they amplify. Key pivot for directional moves">
            <p className="text-[8px] uppercase tracking-[0.12em] text-white/40">GEX Flip Point</p>
            <p className="font-mono text-sm font-semibold text-ivory">
              {flipPoint != null ? flipPoint.toFixed(0) : '--'}
            </p>
            {flipPoint != null && spxPrice > 0 && (
              <p className="text-[8px] font-mono text-white/30">
                {spxPrice >= flipPoint ? 'Above' : 'Below'} ({(spxPrice - flipPoint) >= 0 ? '+' : ''}{(spxPrice - flipPoint).toFixed(0)})
              </p>
            )}
          </div>

          {/* Direction probabilities */}
          {prediction && (
            <div className="col-span-2">
              <p className="mb-1 text-[8px] uppercase tracking-[0.12em] text-white/35">Direction Probability</p>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <span className="rounded-md border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-1 text-center text-emerald-200">
                  <span className="text-[7px] uppercase tracking-wider text-emerald-300/50 block leading-tight">Bull</span>
                  ↑ {prediction.direction.bullish.toFixed(0)}%
                </span>
                <span className="rounded-md border border-rose-400/20 bg-rose-500/10 px-1.5 py-1 text-center text-rose-200">
                  <span className="text-[7px] uppercase tracking-wider text-rose-300/50 block leading-tight">Bear</span>
                  ↓ {prediction.direction.bearish.toFixed(0)}%
                </span>
                <span className="rounded-md border border-white/15 bg-white/[0.04] px-1.5 py-1 text-center text-white/60">
                  <span className="text-[7px] uppercase tracking-wider text-white/30 block leading-tight">Flat</span>
                  ↔ {prediction.direction.neutral.toFixed(0)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="relative z-10 mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
        <Activity className="h-3.5 w-3.5 text-emerald-300" />
        <span>Sniper briefing active</span>
        <Dot className="h-4 w-4 text-emerald-300" />
        <span>Pro Tier</span>
        <span
          className={cn(
            'ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.08em]',
            priceStreamConnected
              ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
              : 'border-amber-400/35 bg-amber-500/15 text-amber-200',
          )}
          title={priceStreamConnected ? 'WebSocket tick stream connected' : (priceStreamError || 'WebSocket reconnecting')}
        >
          {priceStreamConnected ? 'WS Live' : 'WS Retry'}
        </span>
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.08em]',
            snapshotAgeMs != null && snapshotAgeMs < 20_000
              ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200'
              : 'border-white/20 bg-white/5 text-white/55',
          )}
        >
          Snapshot {snapshotFreshness}
        </span>
      </div>
    </header>
  )
}
