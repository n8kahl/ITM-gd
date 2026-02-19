'use client'

import { Dot } from 'lucide-react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
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
    basis,
    regime,
    prediction,
    gexProfile,
  } = useSPXAnalyticsContext()
  const { tradeMode, inTradeSetup, tradePnlPoints } = useSPXSetupContext()
  const {
    spxPrice,
    spxTickTimestamp,
    spxPriceAgeMs,
    spxPriceSource,
    snapshotGeneratedAt,
    priceStreamConnected,
    priceStreamError,
  } = useSPXPriceContext()

  const snapshotAgeMs = getAgeMs(snapshotGeneratedAt)
  const snapshotFreshness = formatFreshness(snapshotAgeMs)
  const tickAgeMs = spxPriceAgeMs ?? getAgeMs(spxTickTimestamp)
  const wsTickLive = priceStreamConnected && spxPriceSource === 'tick' && (tickAgeMs == null || tickAgeMs <= 5_000)
  const wsTickLagging = priceStreamConnected && spxPriceSource === 'tick' && tickAgeMs != null && tickAgeMs > 5_000
  const wsPollFallback = priceStreamConnected && spxPriceSource === 'poll'
  const wsConnectedUnknownSource = priceStreamConnected && !wsTickLive && !wsTickLagging && !wsPollFallback
  const wsLagLabel = tickAgeMs != null ? `${Math.floor(tickAgeMs / 1000)}s` : '--'

  const postureDirection = prediction
    ? prediction.direction.bullish >= prediction.direction.bearish ? 'bullish' : 'bearish'
    : 'neutral'
  const postureLabel = `${(regime || '--').toUpperCase()} ${postureDirection.toUpperCase()}${prediction ? ` ${prediction.confidence.toFixed(0)}%` : ''}`

  const gexNet = gexProfile?.combined?.netGex ?? null
  const gexPosture = gexNet == null ? '--' : gexNet >= 0 ? 'Supportive' : 'Unstable'
  const flipPoint = gexProfile?.combined?.flipPoint ?? null

  return (
    <header className="glass-card-heavy relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.025] via-white/[0.01] to-emerald-500/[0.03] px-3 py-2">
      <div className="pointer-events-none absolute -right-24 -top-24 h-44 w-44 rounded-full bg-emerald-500/8 blur-3xl" />
      <div className="relative z-10 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-md border border-white/20 bg-black/25 px-2 py-1 font-serif text-[1.2rem] leading-none text-ivory md:text-[1.35rem]">
          SPX {formatPrice(spxPrice)}
        </span>

        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.08em]',
            wsTickLive
              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
              : wsTickLagging || wsPollFallback
                ? 'border-amber-300/35 bg-amber-500/12 text-amber-100'
                : wsConnectedUnknownSource
                  ? 'border-white/20 bg-white/[0.06] text-white/75'
                  : 'border-amber-400/30 bg-amber-500/10 text-amber-200',
          )}
          title={
            wsTickLive
              ? 'WebSocket connected with tick-level updates'
              : wsTickLagging
                ? `WebSocket connected but tick feed is lagging (${wsLagLabel})`
              : wsPollFallback
                ? 'WebSocket connected; using slower poll fallback prices'
                : wsConnectedUnknownSource
                  ? 'WebSocket connected; awaiting fresh price source'
                  : (priceStreamError || 'WebSocket reconnecting')
          }
        >
          {wsTickLive
            ? 'WS Tick'
            : wsTickLagging
              ? `WS Lag ${wsLagLabel}`
              : wsPollFallback
                ? 'WS Poll'
                : wsConnectedUnknownSource
                  ? 'WS Link'
                  : 'WS Retry'}
        </span>

        <span className="inline-flex items-center rounded-md border border-champagne/25 bg-champagne/[0.08] px-2 py-1 text-[10px] text-champagne">
          {postureLabel}
        </span>

        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-1 text-[10px]',
            gexNet != null && gexNet >= 0
              ? 'border-emerald-400/20 bg-emerald-500/8 text-emerald-100'
              : 'border-rose-400/20 bg-rose-500/8 text-rose-100',
          )}
        >
          GEX {gexNet != null ? `${formatGexNet(gexNet)} ${gexPosture}` : '--'}
        </span>

        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-1 text-[10px]',
            basis && basis.current >= 0
              ? 'border-emerald-300/20 bg-emerald-500/[0.07] text-emerald-100'
              : 'border-rose-300/20 bg-rose-500/[0.07] text-rose-100',
          )}
        >
          Basis {basis ? `${formatSigned(basis.current)} (Z ${basis.zscore.toFixed(2)})` : '--'}
        </span>
      </div>

      <div className="relative z-10 mt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-white/70">
        {tradeMode === 'in_trade' && inTradeSetup ? (
          <span className="inline-flex items-center rounded-md border border-emerald-400/20 bg-emerald-500/[0.08] px-2 py-1 text-emerald-100">
            In Trade {inTradeSetup.direction.toUpperCase()} {inTradeSetup.regime.toUpperCase()}
            {tradePnlPoints != null ? ` · ${tradePnlPoints >= 0 ? '+' : ''}${tradePnlPoints.toFixed(2)} pts` : ''}
          </span>
        ) : (
          <span>Snapshot {snapshotFreshness}</span>
        )}
        <Dot className="h-3.5 w-3.5 text-white/40" />
        <span>Flip {flipPoint != null ? flipPoint.toFixed(0) : '--'}</span>
      </div>
    </header>
  )
}
