'use client'

import { Activity, Dot, Target } from 'lucide-react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { InfoTip } from '@/components/ui/info-tip'
import { cn } from '@/lib/utils'

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '--'
  return value.toLocaleString()
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
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ago`
}

export function SPXHeader() {
  const {
    spxPrice,
    spyPrice,
    basis,
    regime,
    snapshotGeneratedAt,
    priceStreamConnected,
    priceStreamError,
  } = useSPXCommandCenter()

  const basisColor = basis?.current != null && basis.current >= 0 ? 'text-emerald-300' : 'text-rose-300'
  const snapshotAgeMs = getAgeMs(snapshotGeneratedAt)
  const snapshotFreshness = formatFreshness(snapshotAgeMs)

  return (
    <header className="glass-card-heavy relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] via-white/[0.015] to-emerald-500/[0.035] px-4 py-3 md:px-5 md:py-4">
      <div className="pointer-events-none absolute -right-24 -top-24 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-300" />
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">SPX Command Center</p>
            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">LIVE</span>
            <InfoTip label="What is SPX Command Center?">
              Real-time decision cockpit for SPX options: setups, levels, flow, and coaching are fused so you can act from one view.
            </InfoTip>
          </div>
          <h1 className="text-xl md:text-2xl font-serif text-ivory mt-1">Institutional Setup Intelligence</h1>
        </div>

        <div className="relative z-10 grid grid-cols-2 md:flex gap-2 md:gap-3 text-sm">
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">SPX</p>
            <p className="font-mono text-lg text-ivory">{formatPrice(spxPrice)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">SPY</p>
            <p className="font-mono text-lg text-ivory">{formatPrice(spyPrice)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">Basis</p>
            <p className={cn('font-mono text-lg', basisColor)}>{basis ? formatSigned(basis.current) : '--'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">Regime</p>
            <p className="font-mono text-lg text-champagne capitalize">{regime || '--'}</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2 text-xs text-white/65">
        <Activity className="h-3.5 w-3.5 text-emerald-300" />
        <span>Real-time level matrix, setup lifecycle, and AI guidance</span>
        <Dot className="h-4 w-4 text-emerald-300" />
        <span>Pro Tier</span>
        <span
          className={cn(
            'ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]',
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
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]',
            snapshotAgeMs != null && snapshotAgeMs < 20_000
              ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200'
              : 'border-white/20 bg-white/5 text-white/65',
          )}
          title={snapshotGeneratedAt ? `Snapshot generated ${new Date(snapshotGeneratedAt).toLocaleTimeString()}` : 'Snapshot timestamp unavailable'}
        >
          Snapshot {snapshotFreshness}
        </span>
      </div>
    </header>
  )
}
