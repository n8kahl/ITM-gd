'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  ChartBar,
  EnrichedTrade,
  OptionsContext,
  ParsedStopLevel,
  TradeEvaluation,
} from '@/lib/trade-day-replay/types'

const ET_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

interface TradeCardProps {
  trade: EnrichedTrade
  bars: ChartBar[]
  defaultExpanded?: boolean
}

interface SparklinePoint {
  x: number
  y: number
  time: number
  close: number
}

interface TradeSparklineAvailable {
  available: true
  allPath: string
  holdSegmentPath: string
  entryPoint: SparklinePoint
  exitPoint: SparklinePoint
}

interface TradeSparklineUnavailable {
  available: false
}

type TradeSparklineResult = TradeSparklineAvailable | TradeSparklineUnavailable

const SPARKLINE_WIDTH = 260
const SPARKLINE_HEIGHT = 72
const SPARKLINE_PADDING_X = 8
const SPARKLINE_PADDING_Y = 8

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseEpochSeconds(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }

  const epochMs = Date.parse(value)
  if (!Number.isFinite(epochMs)) {
    return null
  }

  return Math.floor(epochMs / 1000)
}

function formatContractLabel(trade: EnrichedTrade): string {
  const symbol = typeof trade.contract?.symbol === 'string' && trade.contract.symbol.trim().length > 0
    ? trade.contract.symbol.trim()
    : 'SPX'
  const strike = isFiniteNumber(trade.contract?.strike)
    ? Number.isInteger(trade.contract.strike)
      ? String(trade.contract.strike)
      : trade.contract.strike.toFixed(1)
    : '?'
  const type = trade.contract?.type === 'put' ? 'Put' : 'Call'
  const expiry = typeof trade.contract?.expiry === 'string' && trade.contract.expiry.trim().length > 0
    ? ` | ${trade.contract.expiry}`
    : ''

  return `${symbol} ${strike} ${type}${expiry}`
}

function formatTimestamp(value: string | null | undefined): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return '--'
  }

  const epochMs = Date.parse(value)
  if (!Number.isFinite(epochMs)) {
    return value
  }

  return `${ET_TIMESTAMP_FORMATTER.format(new Date(epochMs))} ET`
}

function formatHoldDuration(value: number | null | undefined): string {
  if (!isFiniteNumber(value) || value < 0) {
    return 'n/a'
  }

  const rounded = Math.round(value)
  const hours = Math.floor(rounded / 60)
  const minutes = rounded % 60

  if (hours <= 0) return `${minutes}m`
  if (minutes <= 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function formatSignedPercent(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) {
    return 'n/a'
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatSignedNumber(value: number | null | undefined, suffix = '', digits = 2): string {
  if (!isFiniteNumber(value)) {
    return 'n/a'
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${suffix}`
}

function formatPlainNumber(value: number | null | undefined, digits = 2): string {
  if (!isFiniteNumber(value)) {
    return 'n/a'
  }

  return value.toFixed(digits)
}

function formatPercentNumber(value: number | null | undefined, digits = 1): string {
  if (!isFiniteNumber(value)) {
    return 'n/a'
  }

  return `${(value * 100).toFixed(digits)}%`
}

function formatWholePercent(value: number | null | undefined, digits = 0): string {
  if (!isFiniteNumber(value)) {
    return 'n/a'
  }

  return `${value.toFixed(digits)}%`
}

function normalizeStringArray(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function safeOptionsContext(value: OptionsContext | null | undefined): OptionsContext | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  return value
}

function safeEvaluation(value: TradeEvaluation | null | undefined): TradeEvaluation | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  return value
}

function safeStopLevels(value: ParsedStopLevel[] | null | undefined): ParsedStopLevel[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item) => (
      item != null
      && typeof item === 'object'
      && isFiniteNumber(item.spxLevel)
      && typeof item.timestamp === 'string'
      && item.timestamp.trim().length > 0
    ))
    .sort((left, right) => {
      const leftTime = Date.parse(left.timestamp)
      const rightTime = Date.parse(right.timestamp)
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
        return leftTime - rightTime
      }
      return left.timestamp.localeCompare(right.timestamp)
    })
}

function getPnlTone(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) {
    return 'border-white/20 bg-white/10 text-white/80'
  }

  if (value >= 0) {
    return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
  }

  return 'border-red-500/40 bg-red-500/15 text-red-200'
}

function resolveTradeExitEpochSeconds(trade: EnrichedTrade, entryEpochSeconds: number): number | null {
  const exitEvents = Array.isArray(trade.exitEvents) ? trade.exitEvents : []
  const allExitTimes: number[] = []
  const fullExitTimes: number[] = []

  for (const exitEvent of exitEvents) {
    const eventEpochSeconds = parseEpochSeconds(exitEvent?.timestamp)
    if (eventEpochSeconds == null || eventEpochSeconds < entryEpochSeconds) {
      continue
    }

    allExitTimes.push(eventEpochSeconds)
    if (exitEvent.type === 'full_exit') {
      fullExitTimes.push(eventEpochSeconds)
    }
  }

  if (fullExitTimes.length > 0) {
    return Math.max(...fullExitTimes)
  }

  if (allExitTimes.length > 0) {
    return Math.max(...allExitTimes)
  }

  if (isFiniteNumber(trade.holdDurationMin) && trade.holdDurationMin > 0) {
    return entryEpochSeconds + Math.round(trade.holdDurationMin * 60)
  }

  return null
}

function buildPath(points: SparklinePoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
}

function findNearestPoint(points: SparklinePoint[], targetTime: number): SparklinePoint {
  let nearestPoint = points[0]!
  let nearestDistance = Math.abs(nearestPoint.time - targetTime)

  for (let index = 1; index < points.length; index += 1) {
    const candidate = points[index]!
    const distance = Math.abs(candidate.time - targetTime)
    if (distance < nearestDistance) {
      nearestPoint = candidate
      nearestDistance = distance
    }
  }

  return nearestPoint
}

function buildTradeSparkline(trade: EnrichedTrade, bars: ChartBar[]): TradeSparklineResult {
  if (!Array.isArray(bars) || bars.length === 0) {
    return { available: false }
  }

  const entryEpochSeconds = parseEpochSeconds(trade.entryTimestamp)
  if (entryEpochSeconds == null) {
    return { available: false }
  }

  const exitEpochSeconds = resolveTradeExitEpochSeconds(trade, entryEpochSeconds)
  if (exitEpochSeconds == null || exitEpochSeconds <= entryEpochSeconds) {
    return { available: false }
  }

  const windowBars = bars
    .filter((bar) => (
      bar != null
      && isFiniteNumber(bar.time)
      && isFiniteNumber(bar.close)
      && bar.time >= entryEpochSeconds
      && bar.time <= exitEpochSeconds
    ))
    .slice()
    .sort((left, right) => left.time - right.time)

  if (windowBars.length < 2) {
    return { available: false }
  }

  const closes = windowBars.map((bar) => bar.close)
  const minClose = Math.min(...closes)
  const maxClose = Math.max(...closes)
  const closeRange = maxClose - minClose
  const timeRange = Math.max(exitEpochSeconds - entryEpochSeconds, 1)
  const drawWidth = SPARKLINE_WIDTH - (SPARKLINE_PADDING_X * 2)
  const drawHeight = SPARKLINE_HEIGHT - (SPARKLINE_PADDING_Y * 2)
  const flatY = SPARKLINE_PADDING_Y + (drawHeight / 2)

  const points = windowBars.map((bar) => {
    const x = SPARKLINE_PADDING_X + (((bar.time - entryEpochSeconds) / timeRange) * drawWidth)
    const y = closeRange <= 0
      ? flatY
      : SPARKLINE_PADDING_Y + (((maxClose - bar.close) / closeRange) * drawHeight)

    return {
      x,
      y,
      time: bar.time,
      close: bar.close,
    }
  })

  const entryPoint = findNearestPoint(points, entryEpochSeconds)
  const exitPoint = findNearestPoint(points, exitEpochSeconds)
  const holdStart = Math.min(entryPoint.time, exitPoint.time)
  const holdEnd = Math.max(entryPoint.time, exitPoint.time)
  const segmentPoints = points.filter((point) => point.time >= holdStart && point.time <= holdEnd)
  const highlightedSegment = segmentPoints.length >= 2 ? segmentPoints : [entryPoint, exitPoint]

  return {
    available: true,
    allPath: buildPath(points),
    holdSegmentPath: buildPath(highlightedSegment),
    entryPoint,
    exitPoint,
  }
}

export function TradeCard({ trade, bars, defaultExpanded = false }: TradeCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const tradeIndexLabel = Number.isFinite(trade.tradeIndex) ? trade.tradeIndex : '--'
  const tradeIndexToken = String(tradeIndexLabel)
  const contractLabel = formatContractLabel(trade)
  const entryTimestampLabel = formatTimestamp(trade.entryTimestamp)
  const holdDurationLabel = formatHoldDuration(trade.holdDurationMin)
  const pnlPercentLabel = formatSignedPercent(trade.pnlPercent)

  const optionsAtEntry = safeOptionsContext(trade.optionsAtEntry)
  const evaluation = safeEvaluation(trade.evaluation)
  const stopLevels = useMemo(() => safeStopLevels(trade.stopLevels), [trade.stopLevels])

  const rawMessages = useMemo(
    () => normalizeStringArray(trade.rawMessages),
    [trade.rawMessages],
  )
  const drivers = normalizeStringArray(evaluation?.drivers)
  const risks = normalizeStringArray(evaluation?.risks)
  const sparkline = useMemo(
    () => buildTradeSparkline(trade, bars),
    [bars, trade],
  )

  return (
    <article
      className="rounded-lg border border-white/10 bg-black/20 p-4"
      data-testid={`trade-card-${tradeIndexToken}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.1em] text-white/60">Trade {tradeIndexLabel}</p>
          <h3 className="mt-1 text-sm font-semibold text-ivory">{contractLabel}</h3>
          <p className="mt-1 text-xs text-white/70">
            Entry {entryTimestampLabel}
            <span className="px-1 text-white/45">|</span>
            Hold {holdDurationLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', getPnlTone(trade.pnlPercent))}>
            {pnlPercentLabel}
          </span>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-white/80"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-controls={`trade-replay-card-body-${tradeIndexLabel}`}
            data-testid={`trade-card-toggle-${tradeIndexToken}`}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Expand
              </>
            )}
          </Button>
        </div>
      </div>

      {expanded ? (
        <div id={`trade-replay-card-body-${tradeIndexLabel}`} className="mt-4 space-y-4">
          <section className="rounded-md border border-white/10 bg-white/[0.02] p-3">
            <h4 className="text-[11px] uppercase tracking-[0.1em] text-white/60">SPX Hold Window</h4>
            {sparkline.available ? (
              <div
                className="mt-2 rounded border border-white/10 bg-black/25 p-2"
                data-testid={`trade-card-sparkline-${tradeIndexToken}`}
              >
                <svg
                  viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
                  role="img"
                  aria-label={`SPX hold window sparkline for trade ${tradeIndexToken}`}
                  className="h-[72px] w-full"
                >
                  <path
                    d={sparkline.allPath}
                    fill="none"
                    stroke="rgba(255,255,255,0.35)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={sparkline.holdSegmentPath}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth={2.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    data-testid={`trade-card-sparkline-segment-${tradeIndexToken}`}
                  />
                  <circle
                    cx={sparkline.entryPoint.x}
                    cy={sparkline.entryPoint.y}
                    r={3}
                    fill="#F3E5AB"
                    stroke="#000000"
                    strokeWidth={1}
                    data-testid={`trade-card-sparkline-entry-marker-${tradeIndexToken}`}
                  />
                  <circle
                    cx={sparkline.exitPoint.x}
                    cy={sparkline.exitPoint.y}
                    r={3}
                    fill="#ef4444"
                    stroke="#000000"
                    strokeWidth={1}
                    data-testid={`trade-card-sparkline-exit-marker-${tradeIndexToken}`}
                  />
                </svg>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-white/65">
                  <span>
                    Entry <span className="font-mono text-white/85">SPX {formatPlainNumber(sparkline.entryPoint.close, 2)}</span>
                  </span>
                  <span>
                    Exit <span className="font-mono text-white/85">SPX {formatPlainNumber(sparkline.exitPoint.close, 2)}</span>
                  </span>
                </div>
              </div>
            ) : (
              <p
                className="mt-2 rounded border border-dashed border-white/15 bg-black/25 px-2 py-1 text-xs text-white/65"
                data-testid={`trade-card-sparkline-fallback-${tradeIndexToken}`}
              >
                Sparkline unavailable
              </p>
            )}
          </section>

          <section className="rounded-md border border-white/10 bg-white/[0.02] p-3">
            <h4 className="text-[11px] uppercase tracking-[0.1em] text-white/60">Pricing Summary</h4>
            <div className="mt-2 grid gap-3 text-sm md:grid-cols-3">
              <div>
                <p className="text-xs text-white/60">Entry Premium</p>
                <p className="font-mono text-white/90">{formatPlainNumber(trade.entryPrice)}</p>
              </div>
              <div>
                <p className="text-xs text-white/60">Derived P&amp;L %</p>
                <p className={cn('font-mono', isFiniteNumber(trade.pnlPercent) && trade.pnlPercent >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                  {pnlPercentLabel}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/60">Outcome</p>
                <p className="text-white/90">
                  {trade.isWinner == null ? 'n/a' : trade.isWinner ? 'Winner' : 'Loser'}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-white/10 bg-white/[0.02] p-3">
            <h4 className="text-[11px] uppercase tracking-[0.1em] text-white/60">Day-of Greeks (at entry)</h4>
            {optionsAtEntry ? (
              <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-white/60">Delta</p>
                  <p className="font-mono text-white/90">{formatSignedNumber(optionsAtEntry.delta, '', 3)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60">Gamma</p>
                  <p className="font-mono text-white/90">{formatSignedNumber(optionsAtEntry.gamma, '', 4)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60">Theta</p>
                  <p className="font-mono text-white/90">{formatSignedNumber(optionsAtEntry.theta, '', 3)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60">Vega</p>
                  <p className="font-mono text-white/90">{formatSignedNumber(optionsAtEntry.vega, '', 3)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60">IV</p>
                  <p className="font-mono text-white/90">{formatPercentNumber(optionsAtEntry.iv, 1)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60">Bid</p>
                  <p className="font-mono text-white/90">{formatPlainNumber(optionsAtEntry.bid)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60">Ask</p>
                  <p className="font-mono text-white/90">{formatPlainNumber(optionsAtEntry.ask)}</p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-white/70">No day-of option context captured.</p>
            )}
          </section>

          <section className="rounded-md border border-white/10 bg-white/[0.02] p-3">
            <h4 className="text-[11px] uppercase tracking-[0.1em] text-white/60">Evaluation Summary</h4>
            {evaluation ? (
              <>
                <div className="mt-2 grid gap-3 text-sm md:grid-cols-3">
                  <div>
                    <p className="text-xs text-white/60">Alignment Score</p>
                    <p className="font-mono text-white/90">{formatPlainNumber(evaluation.alignmentScore)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Confidence</p>
                    <p className="font-mono text-white/90">{formatWholePercent(evaluation.confidence, 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Expected Value (R)</p>
                    <p className="font-mono text-white/90">{formatSignedNumber(evaluation.expectedValueR, 'R')}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-xs text-white/60">Drivers</p>
                    {drivers.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {drivers.map((driver, index) => (
                          <li key={`${trade.tradeIndex}-driver-${index}`} className="rounded bg-white/[0.03] px-2 py-1 text-white/85">
                            {driver}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-white/70">n/a</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-white/60">Risks</p>
                    {risks.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {risks.map((risk, index) => (
                          <li key={`${trade.tradeIndex}-risk-${index}`} className="rounded bg-white/[0.03] px-2 py-1 text-white/85">
                            {risk}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-white/70">n/a</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-white/70">No evaluation output available.</p>
            )}
          </section>

          <section className="rounded-md border border-white/10 bg-white/[0.02] p-3">
            <h4 className="text-[11px] uppercase tracking-[0.1em] text-white/60">Stop Levels Timeline</h4>
            {stopLevels.length > 0 ? (
              <ol className="mt-2 space-y-1 text-sm">
                {stopLevels.map((stopLevel, index) => (
                  <li key={`${trade.tradeIndex}-stop-${index}`} className="flex items-center justify-between gap-4 rounded bg-white/[0.03] px-2 py-1">
                    <span className="text-white/80">{formatTimestamp(stopLevel.timestamp)}</span>
                    <span className="font-mono text-white/90">SPX {formatPlainNumber(stopLevel.spxLevel, 2)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-white/70">No stop level timeline recorded.</p>
            )}
          </section>

          <details className="rounded-md border border-white/10 bg-white/[0.02]">
            <summary className="cursor-pointer list-none px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-white/70">
              Raw Messages ({rawMessages.length})
            </summary>
            <div className="space-y-2 px-3 pb-3 text-xs">
              {rawMessages.length > 0 ? (
                rawMessages.map((message, index) => (
                  <p key={`${trade.tradeIndex}-raw-${index}`} className="rounded border border-white/10 bg-black/25 p-2 text-white/85 whitespace-pre-wrap break-words">
                    {message}
                  </p>
                ))
              ) : (
                <p className="text-white/70">No raw messages captured.</p>
              )}
            </div>
          </details>
        </div>
      ) : null}
    </article>
  )
}
