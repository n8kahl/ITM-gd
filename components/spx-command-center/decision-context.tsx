'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { cn } from '@/lib/utils'
import type { ClusterZone, FibLevel, PredictionState, SpyImpactState } from '@/lib/types/spx-command-center'

// ─── Cluster Zones (compact + expandable) ───
function ClusterPanel({ zones, spxPrice }: { zones: ClusterZone[]; spxPrice: number }) {
  const [expanded, setExpanded] = useState(false)
  if (zones.length === 0) return null

  const maxScore = Math.max(...zones.map((z) => z.clusterScore), 1)
  const visible = expanded ? zones.slice(0, 8) : zones.slice(0, 3)

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between"
      >
        <span className="text-[10px] uppercase tracking-[0.12em] text-white/45">Cluster Zones</span>
        <ChevronDown className={cn('h-3 w-3 text-white/40 transition-transform', expanded && 'rotate-180')} />
      </button>

      <div className="mt-2 space-y-1.5">
        {visible.map((zone) => {
          const width = Math.max(12, (zone.clusterScore / maxScore) * 100)
          const isNearPrice = spxPrice > 0 && spxPrice >= zone.priceLow - 10 && spxPrice <= zone.priceHigh + 10

          return (
            <div key={zone.id}>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-[5px] rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      zone.type === 'fortress' ? 'bg-emerald-400/50' :
                      zone.type === 'defended' ? 'bg-emerald-400/30' :
                      'bg-white/12',
                    )}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-white/55 min-w-[100px] text-right">
                  {zone.priceLow.toFixed(0)}–{zone.priceHigh.toFixed(0)}
                </span>
                <span className={cn(
                  'text-[8px] uppercase tracking-[0.06em] min-w-[52px] text-right',
                  zone.type === 'fortress' ? 'text-emerald-300' :
                  zone.type === 'defended' ? 'text-emerald-200/70' :
                  'text-white/35',
                )}>
                  {zone.type}
                </span>
                {isNearPrice && <span className="text-champagne text-[7px]">●</span>}
              </div>

              {/* Expanded detail: sources, hold rate, test count */}
              {expanded && (
                <div className="mt-0.5 ml-2 flex flex-wrap gap-2 text-[9px] text-white/40">
                  <span>{zone.sources.length} sources</span>
                  {zone.testCount > 0 && <span>{zone.testCount} tests</span>}
                  {zone.holdRate != null && <span>Hold {(zone.holdRate * 100).toFixed(0)}%</span>}
                  {zone.held != null && (
                    <span className={zone.held ? 'text-emerald-300/60' : 'text-rose-300/60'}>
                      {zone.held ? 'Held last' : 'Broke last'}
                    </span>
                  )}
                  {/* SPY-derived source indicator */}
                  {zone.sources.some((s) => s.instrument === 'SPY') && (
                    <span className="text-champagne/60">SPY derived</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {zones.length > 3 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 text-[9px] text-white/35 hover:text-white/55"
        >
          +{zones.length - 3} more zones
        </button>
      )}
    </div>
  )
}

// ─── Probability Cone (compact + setup targets) ───
function ConePanel({ prediction, selectedSetup }: {
  prediction: PredictionState | null
  selectedSetup: { target1: { price: number }; target2: { price: number } } | null
}) {
  const [expanded, setExpanded] = useState(false)
  if (!prediction) return null

  const cone = prediction.probabilityCone
  const maxSpread = Math.max(...cone.map((p) => p.high - p.low), 1)
  const visible = expanded ? cone : cone.slice(0, 3)

  // Check if targets fall within the cone windows
  const t1InCone = selectedSetup ? cone.find((p) =>
    selectedSetup.target1.price >= p.low && selectedSetup.target1.price <= p.high
  ) : null
  const t2InCone = selectedSetup ? cone.find((p) =>
    selectedSetup.target2.price >= p.low && selectedSetup.target2.price <= p.high
  ) : null

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between"
      >
        <span className="text-[10px] uppercase tracking-[0.12em] text-white/45">Probability Cone</span>
        <ChevronDown className={cn('h-3 w-3 text-white/40 transition-transform', expanded && 'rotate-180')} />
      </button>

      <div className="mt-2 space-y-1.5">
        {visible.map((point) => {
          const spread = point.high - point.low
          const w = Math.max(15, (spread / maxSpread) * 100)

          return (
            <div key={point.minutesForward} className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-white/40 min-w-[24px]">{point.minutesForward}m</span>
              <div className="flex-1 h-[5px] rounded-full bg-white/[0.04] overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400/30" style={{ width: `${w}%` }} />
              </div>
              <span className="font-mono text-[9px] text-white/45 min-w-[100px] text-right">
                {point.low.toFixed(0)} – {point.high.toFixed(0)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Setup target markers */}
      {selectedSetup && (t1InCone || t2InCone) && (
        <div className="mt-1.5 flex gap-3 text-[9px] font-mono">
          {t1InCone && (
            <span className="text-emerald-300/70">▲ T1 in {t1InCone.minutesForward}m cone</span>
          )}
          {t2InCone && (
            <span className="text-champagne/70">▲ T2 in {t2InCone.minutesForward}m cone</span>
          )}
        </div>
      )}

      {cone.length > 3 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 text-[9px] text-white/35 hover:text-white/55"
        >
          +{cone.length - 3} more windows
        </button>
      )}
    </div>
  )
}

// ─── Fib Levels (inline compact, no separate box) ───
function FibPanel({ fibLevels, spxPrice }: { fibLevels: FibLevel[]; spxPrice: number }) {
  const [expanded, setExpanded] = useState(false)
  if (fibLevels.length === 0) return null

  // Sort by proximity to current price
  const sorted = [...fibLevels]
    .sort((a, b) => Math.abs(a.price - spxPrice) - Math.abs(b.price - spxPrice))
  const visible = expanded ? sorted.slice(0, 10) : sorted.slice(0, 4)

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between"
      >
        <span className="text-[10px] uppercase tracking-[0.12em] text-white/45">Fib Levels Near Spot</span>
        <ChevronDown className={cn('h-3 w-3 text-white/40 transition-transform', expanded && 'rotate-180')} />
      </button>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {visible.map((level, idx) => {
          const isAbove = level.price > spxPrice
          const dist = Math.abs(level.price - spxPrice)

          return (
            <span
              key={`${level.timeframe}-${level.ratio}-${idx}`}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-mono',
                level.crossValidated
                  ? 'border-champagne/30 bg-champagne/8 text-champagne'
                  : 'border-white/10 bg-white/[0.03] text-white/60',
              )}
            >
              <span className="font-medium">{(level.ratio * 100).toFixed(1)}%</span>
              <span>{level.price.toFixed(0)}</span>
              <span className={cn('text-[8px]', isAbove ? 'text-rose-300/50' : 'text-emerald-300/50')}>
                {isAbove ? '↑' : '↓'}{dist.toFixed(0)}
              </span>
              {level.crossValidated && (
                <span className="text-[7px] text-champagne/60" title="Cross-validated with SPY">✦</span>
              )}
            </span>
          )
        })}
      </div>

      {expanded && (
        <p className="mt-1 text-[9px] text-white/30">
          ✦ = Cross-validated with SPY equivalent fib level
        </p>
      )}

      {fibLevels.length > 4 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 text-[9px] text-white/35 hover:text-white/55"
        >
          +{fibLevels.length - 4} more levels
        </button>
      )}
    </div>
  )
}

// ─── SPY Impact Summary ───
function formatSpySource(source: string): string {
  const normalized = source.toLowerCase()
  if (normalized.startsWith('spy_key_')) {
    const fragments = normalized.split('_')
    const rank = fragments[2] || '?'
    const rawType = fragments.slice(3).join('_')
    return `Key ${rank} ${formatSpySource(rawType)}`
  }
  if (normalized.includes('call_wall')) return 'Call Wall'
  if (normalized.includes('put_wall')) return 'Put Wall'
  if (normalized.includes('flip_point')) return 'Flip'
  if (normalized.includes('combined')) return 'Combined Gamma'
  return source.replace(/_/g, ' ').toUpperCase()
}

function SPYImpact({
  spyImpact,
  selectedDirection,
}: {
  spyImpact: SpyImpactState | null
  selectedDirection: 'bullish' | 'bearish' | null
}) {
  if (!spyImpact || spyImpact.levels.length === 0) return null

  const spotSpx = spyImpact.spot.spx
  const above = spyImpact.levels
    .filter((level) => level.projectedSpx >= spotSpx)
    .sort((a, b) => a.projectedSpx - b.projectedSpx)[0]
  const below = spyImpact.levels
    .filter((level) => level.projectedSpx < spotSpx)
    .sort((a, b) => b.projectedSpx - a.projectedSpx)[0]
  const nearest = [...spyImpact.levels]
    .sort((a, b) => Math.abs(a.projectedSpx - spotSpx) - Math.abs(b.projectedSpx - spotSpx))
    .slice(0, 3)

  const directionalNote = (() => {
    if (!selectedDirection || !above || !below) return 'SPY levels provide converted support/resistance context for SPX entries.'
    const supportDistance = Math.abs(spotSpx - below.projectedSpx)
    const resistanceDistance = Math.abs(above.projectedSpx - spotSpx)
    if (selectedDirection === 'bullish') {
      return supportDistance <= resistanceDistance
        ? 'Bullish setup alignment: support is closer than resistance.'
        : 'Bullish caution: resistance is closer than support.'
    }
    return resistanceDistance <= supportDistance
      ? 'Bearish setup alignment: resistance is closer than support.'
      : 'Bearish caution: support is closer than resistance.'
  })()

  return (
    <div className="rounded-xl border border-champagne/15 bg-champagne/[0.03] px-3 py-2">
      <span className="text-[9px] uppercase tracking-[0.1em] text-champagne/60">SPY → SPX Impact</span>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[10px]">
        <div className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1">
          <p className="text-[8px] uppercase tracking-[0.08em] text-white/45">Beta</p>
          <p className="font-mono text-white/80">{spyImpact.beta.toFixed(2)}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1">
          <p className="text-[8px] uppercase tracking-[0.08em] text-white/45">Corr</p>
          <p className="font-mono text-white/80">{spyImpact.correlation.toFixed(2)}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1">
          <p className="text-[8px] uppercase tracking-[0.08em] text-white/45">Basis</p>
          <p className="font-mono text-white/80">{spyImpact.basisUsed.toFixed(2)}</p>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-1 gap-1.5 text-[10px] md:grid-cols-2">
        <div className="rounded-md border border-emerald-400/20 bg-emerald-500/8 px-2 py-1">
          <p className="text-[8px] uppercase tracking-[0.08em] text-emerald-200/70">Nearest Support</p>
          <p className="font-mono text-emerald-100">
            {below ? `${below.projectedSpx.toFixed(0)} (${below.impactSpxPoints > 0 ? '+' : ''}${below.impactSpxPoints.toFixed(1)})` : '--'}
            {below ? ` · ${formatSpySource(below.source)}` : ''}
          </p>
        </div>
        <div className="rounded-md border border-rose-400/20 bg-rose-500/8 px-2 py-1">
          <p className="text-[8px] uppercase tracking-[0.08em] text-rose-200/70">Nearest Resistance</p>
          <p className="font-mono text-rose-100">
            {above ? `${above.projectedSpx.toFixed(0)} (${above.impactSpxPoints > 0 ? '+' : ''}${above.impactSpxPoints.toFixed(1)})` : '--'}
            {above ? ` · ${formatSpySource(above.source)}` : ''}
          </p>
        </div>
      </div>
      <p className="mt-1.5 text-[9px] text-white/45">
        Converted using dynamic beta formula <span className="font-mono text-white/60">SPX ≈ (SPY × β) + basis</span>
        {`, β ${spyImpact.beta.toFixed(2)}, basis ${spyImpact.basisUsed.toFixed(2)}.`}
      </p>
      <p className="mt-0.5 text-[9px] text-champagne/75">{directionalNote}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[9px] font-mono text-white/45">
        {nearest.map((level) => (
          <span key={`${level.source}-${level.projectedSpx}`} className="rounded border border-white/12 bg-white/[0.03] px-1.5 py-0.5">
            {formatSpySource(level.source)} {level.projectedSpx.toFixed(0)} ({level.impactSpxPoints > 0 ? '+' : ''}{level.impactSpxPoints.toFixed(1)})
          </span>
        ))}
        <span className="rounded border border-white/10 bg-white/[0.02] px-1.5 py-0.5">{spyImpact.levels.length} projected levels</span>
      </div>
    </div>
  )
}

// ─── Main DecisionContext container ───
export function DecisionContext() {
  const { clusterZones, prediction, fibLevels, spxPrice, selectedSetup, spyImpact } = useSPXCommandCenter()

  return (
    <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
      <ClusterPanel zones={clusterZones.slice(0, 8)} spxPrice={spxPrice} />
      <ConePanel
        prediction={prediction}
        selectedSetup={selectedSetup ? { target1: selectedSetup.target1, target2: selectedSetup.target2 } : null}
      />
      <div className="space-y-2">
        <FibPanel fibLevels={fibLevels.slice(0, 12)} spxPrice={spxPrice} />
        <SPYImpact
          spyImpact={spyImpact}
          selectedDirection={selectedSetup?.direction ?? null}
        />
      </div>
    </div>
  )
}
