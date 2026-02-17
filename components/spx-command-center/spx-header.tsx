'use client'

import { useMemo } from 'react'
import { Dot, Target } from 'lucide-react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
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
    <header className="glass-card-heavy relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.025] via-white/[0.01] to-emerald-500/[0.03] px-3 py-2 md:px-4 md:py-2.5">
      <div className="pointer-events-none absolute -right-24 -top-24 h-44 w-44 rounded-full bg-emerald-500/8 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.12em] text-white/55">
              <Target className="h-3.5 w-3.5 text-emerald-300" />
              SPX Command Center
            </span>
            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/12 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-emerald-200">
              Live
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em]',
                priceStreamConnected
                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200/85'
                  : 'border-amber-400/30 bg-amber-500/10 text-amber-200/85',
              )}
              title={priceStreamConnected ? 'WebSocket tick stream connected' : (priceStreamError || 'WebSocket reconnecting')}
            >
              {priceStreamConnected ? 'WS Live' : 'WS Retry'}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em]',
                snapshotAgeMs != null && snapshotAgeMs < 20_000
                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200/85'
                  : 'border-white/20 bg-white/[0.04] text-white/60',
              )}
            >
              Snapshot {snapshotFreshness}
            </span>
          </div>

          <div className="mt-0.5 flex items-end gap-1.5">
            <h1 className="font-serif text-[2.05rem] leading-none text-ivory md:text-[2.35rem]">
              {formatPrice(spxPrice)}
            </h1>
          </div>

          <p className="mt-0.5 truncate text-[11px] text-white/58">
            <span className="text-white/75">{actionableCount} setups actionable</span>
            <Dot className="inline h-3.5 w-3.5 align-text-bottom text-white/30" />
            <span>Regime: <span className="text-ivory">{regime || '--'}</span></span>
            <Dot className="inline h-3.5 w-3.5 align-text-bottom text-white/30" />
            <span>Flow: <span className="text-ivory">{flowBias}</span></span>
          </p>
        </div>

        <div className="grid w-full gap-1.5 md:max-w-[520px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-md border border-champagne/25 bg-champagne/[0.07] px-2 py-1 text-[10px] font-mono text-champagne">
              {postureLabel}
            </span>
            {prediction && (
              <div className="ml-auto grid grid-cols-3 gap-1 text-[10px] md:ml-0">
                <span className="rounded border border-emerald-400/20 bg-emerald-500/12 px-1.5 py-0.5 text-emerald-200">
                  ↑ {prediction.direction.bullish.toFixed(0)}%
                </span>
                <span className="rounded border border-rose-400/20 bg-rose-500/10 px-1.5 py-0.5 text-rose-200">
                  ↓ {prediction.direction.bearish.toFixed(0)}%
                </span>
                <span className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-white/65">
                  ↔ {prediction.direction.neutral.toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
            <div className="rounded-md border border-white/10 bg-black/25 px-2 py-1">
              <p className="text-[8px] uppercase tracking-[0.1em] text-white/40">Basis</p>
              <p className={cn('font-mono text-[11px] font-semibold', basis && basis.current >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                {basis ? formatSigned(basis.current) : '--'}
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 px-2 py-1">
              <p className="text-[8px] uppercase tracking-[0.1em] text-white/40">Z-Score</p>
              <p className={cn('font-mono text-[11px] font-semibold', basis && Math.abs(basis.zscore) >= 1 ? (basis.zscore > 0 ? 'text-emerald-300' : 'text-rose-300') : 'text-ivory')}>
                {basis ? basis.zscore.toFixed(2) : '--'}
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 px-2 py-1">
              <p className="text-[8px] uppercase tracking-[0.1em] text-white/40">GEX Net</p>
              <p className={cn('font-mono text-[11px] font-semibold', gexNet != null && gexNet >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                {gexNet != null ? formatGexNet(gexNet) : '--'}
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 px-2 py-1">
              <p className="text-[8px] uppercase tracking-[0.1em] text-white/40">Flip</p>
              <p className="font-mono text-[11px] font-semibold text-ivory">
                {flipPoint != null ? flipPoint.toFixed(0) : '--'}
              </p>
              {gexNet != null && (
                <p className="text-[8px] text-white/35">{gexPosture}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
