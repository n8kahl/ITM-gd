'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts'
import type { CoachMarketDataSnapshot } from '@/lib/types/coach-review'

interface MarketContextPanelProps {
  snapshot: CoachMarketDataSnapshot | null
}

interface ChartPoint {
  t: number
  close: number
  ema8: number
  ema21: number
}

function downsampleBars<T>(rows: T[], maxPoints: number): T[] {
  if (rows.length <= maxPoints) return rows
  const step = Math.ceil(rows.length / maxPoints)
  const output: T[] = []
  for (let index = 0; index < rows.length; index += step) {
    output.push(rows[index])
  }
  if (output[output.length - 1] !== rows[rows.length - 1]) {
    output.push(rows[rows.length - 1])
  }
  return output
}

function computeEma(values: number[], period: number): number[] {
  if (values.length === 0) return []
  const smoothing = 2 / (period + 1)
  const ema: number[] = [values[0]]
  for (let index = 1; index < values.length; index += 1) {
    const next = values[index] * smoothing + ema[index - 1] * (1 - smoothing)
    ema.push(next)
  }
  return ema
}

function formatTimestamp(value: number): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function qualityClasses(quality: CoachMarketDataSnapshot['dataQuality']): string {
  if (quality === 'full') return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
  if (quality === 'partial') return 'border-amber-400/40 bg-amber-500/10 text-amber-200'
  return 'border-red-400/40 bg-red-500/10 text-red-200'
}

function toChartPoints(snapshot: CoachMarketDataSnapshot): ChartPoint[] {
  const minuteBars = downsampleBars(snapshot.chart.minuteBars, 240)
  const closes = minuteBars.map((bar) => bar.c)
  const ema8 = computeEma(closes, 8)
  const ema21 = computeEma(closes, 21)

  return minuteBars.map((bar, index) => ({
    t: bar.t,
    close: bar.c,
    ema8: ema8[index],
    ema21: ema21[index],
  }))
}

function nearestBar(
  minuteBars: CoachMarketDataSnapshot['chart']['minuteBars'],
  timestamp: number | undefined,
) {
  if (!timestamp || minuteBars.length === 0) return null
  let nearest = minuteBars[0]
  let best = Math.abs(minuteBars[0].t - timestamp)
  for (let index = 1; index < minuteBars.length; index += 1) {
    const distance = Math.abs(minuteBars[index].t - timestamp)
    if (distance < best) {
      best = distance
      nearest = minuteBars[index]
    }
  }
  return nearest
}

export function MarketContextPanel({ snapshot }: MarketContextPanelProps) {
  const chartPoints = useMemo(() => (snapshot ? toChartPoints(snapshot) : []), [snapshot])
  const entryBar = snapshot
    ? nearestBar(snapshot.chart.minuteBars, snapshot.chart.entryMarker?.timestamp)
    : null
  const exitBar = snapshot
    ? nearestBar(snapshot.chart.minuteBars, snapshot.chart.exitMarker?.timestamp)
    : null

  if (!snapshot) {
    return (
      <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-muted-foreground">
        Market context is not loaded yet. Generate AI analysis to fetch and freeze market data.
      </div>
    )
  }

  return (
    <div className="glass-card-heavy space-y-4 rounded-xl border border-white/10 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ivory">Market Context</h2>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${qualityClasses(snapshot.dataQuality)}`}>
          {snapshot.dataQuality.toUpperCase()}
        </span>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Price Chart (1m) + EMA8/EMA21</p>
        {chartPoints.length > 1 ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartPoints}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="t"
                  tickFormatter={formatTimestamp}
                  stroke="rgba(255,255,255,0.45)"
                  tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 10 }}
                  minTickGap={20}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  width={56}
                  stroke="rgba(255,255,255,0.45)"
                  tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 10 }}
                />
                <Tooltip
                  labelFormatter={(label) => formatTimestamp(Number(label))}
                  formatter={(value: number, name: string) => [value.toFixed(2), name.toUpperCase()]}
                  contentStyle={{
                    backgroundColor: 'rgba(10,12,18,0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    fontSize: '12px',
                  }}
                />
                {snapshot.chart.entryMarker ? (
                  <ReferenceLine
                    x={snapshot.chart.entryMarker.timestamp}
                    stroke="rgba(16,185,129,0.8)"
                    strokeDasharray="4 4"
                    label={{ value: 'Entry', fill: 'rgba(16,185,129,0.9)', position: 'insideTopRight', fontSize: 10 }}
                  />
                ) : null}
                {snapshot.chart.exitMarker ? (
                  <ReferenceLine
                    x={snapshot.chart.exitMarker.timestamp}
                    stroke="rgba(248,113,113,0.9)"
                    strokeDasharray="4 4"
                    label={{ value: 'Exit', fill: 'rgba(248,113,113,0.95)', position: 'insideTopRight', fontSize: 10 }}
                  />
                ) : null}
                <Line type="monotone" dataKey="close" stroke="#34d399" strokeWidth={1.8} dot={false} />
                <Line type="monotone" dataKey="ema8" stroke="#fde68a" strokeWidth={1.2} dot={false} />
                <Line type="monotone" dataKey="ema21" stroke="#93c5fd" strokeWidth={1.1} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Insufficient intraday bars for chart rendering.</p>
        )}
      </div>

      {snapshot.options ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Options Context</p>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Contract" value={snapshot.options.contractTicker || '—'} />
            <Metric label="Strike" value={String(snapshot.options.strikePrice)} />
            <Metric label="Expiration" value={snapshot.options.expirationDate} />
            <Metric label="Type" value={snapshot.options.contractType} />
            <Metric label="Delta" value={String(snapshot.options.greeksAtEntry.delta)} />
            <Metric label="Gamma" value={String(snapshot.options.greeksAtEntry.gamma)} />
            <Metric label="Theta" value={String(snapshot.options.greeksAtEntry.theta)} />
            <Metric label="Vega" value={String(snapshot.options.greeksAtEntry.vega)} />
            <Metric label="IV" value={String(snapshot.options.ivAtEntry)} />
            <Metric
              label="Bid / Ask"
              value={snapshot.options.bidAskSpread
                ? `${snapshot.options.bidAskSpread.bid} / ${snapshot.options.bidAskSpread.ask}`
                : '—'}
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">SPX Context</p>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="SPX" value={snapshot.spxContext.spxPrice.toFixed(2)} />
          <Metric label="SPX Change" value={`${snapshot.spxContext.spxChange.toFixed(2)}%`} />
          <Metric label="VIX" value={snapshot.spxContext.vixLevel.toFixed(2)} />
          <Metric label="Regime" value={snapshot.spxContext.regime} />
          <Metric label="Direction" value={snapshot.spxContext.regimeDirection} />
          <Metric label="GEX Regime" value={snapshot.spxContext.gexRegime} />
          <Metric
            label="GEX Flip"
            value={snapshot.spxContext.gexFlipPoint == null ? '—' : snapshot.spxContext.gexFlipPoint.toFixed(2)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Volume & Tape</p>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Trade Time Volume" value={snapshot.volumeContext.tradeTimeVolume.toLocaleString('en-US')} />
          <Metric label="Avg Daily Volume" value={snapshot.volumeContext.avgVolume.toLocaleString('en-US')} />
          <Metric label="Relative Volume" value={snapshot.volumeContext.relativeVolume.toFixed(2)} />
          <Metric
            label="VWAP Entry / Exit"
            value={`${snapshot.volumeContext.vwapAtEntry?.toFixed(2) ?? '—'} / ${snapshot.volumeContext.vwapAtExit?.toFixed(2) ?? '—'}`}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-md border border-emerald-400/30 bg-emerald-500/10 p-2.5">
            <p className="text-xs text-emerald-200">Entry Bar</p>
            <p className="mt-1 text-sm text-emerald-100">
              {entryBar ? `${entryBar.v.toLocaleString('en-US')} @ ${formatTimestamp(entryBar.t)}` : '—'}
            </p>
          </div>
          <div className="rounded-md border border-red-400/30 bg-red-500/10 p-2.5">
            <p className="text-xs text-red-200">Exit Bar</p>
            <p className="mt-1 text-sm text-red-100">
              {exitBar ? `${exitBar.v.toLocaleString('en-US')} @ ${formatTimestamp(exitBar.t)}` : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-ivory">{value}</p>
    </div>
  )
}
