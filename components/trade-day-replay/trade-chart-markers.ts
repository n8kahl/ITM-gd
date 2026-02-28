import type {
  CreatePriceLineOptions,
  LineStyle,
  LineWidth,
  SeriesMarker,
  Time,
  UTCTimestamp,
} from 'lightweight-charts'
import type { ChartBar, EnrichedTrade } from '@/lib/trade-day-replay/types'

/**
 * Alias for lightweight-charts v5 SeriesMarker.
 */
export type TradeSeriesMarker = SeriesMarker<Time>
export type TradePriceLineOptions = CreatePriceLineOptions

function parseEpochSeconds(value: string | null | undefined): number | null {
  if (!value) return null
  const epochMs = Date.parse(value)
  if (!Number.isFinite(epochMs)) return null
  return Math.floor(epochMs / 1000)
}

function toUtcTimestamp(seconds: number): UTCTimestamp {
  return seconds as UTCTimestamp
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function findNearestBarTime(bars: ChartBar[], targetTimeSec: number): number | null {
  if (bars.length === 0) return null

  let left = 0
  let right = bars.length - 1

  while (left < right) {
    const mid = Math.floor((left + right) / 2)
    if (bars[mid]!.time < targetTimeSec) {
      left = mid + 1
    } else {
      right = mid
    }
  }

  const candidate = left
  const previous = Math.max(candidate - 1, 0)
  const candidateDistance = Math.abs(bars[candidate]!.time - targetTimeSec)
  const previousDistance = Math.abs(bars[previous]!.time - targetTimeSec)
  const nearestIndex = previousDistance <= candidateDistance ? previous : candidate
  return bars[nearestIndex]!.time
}

function formatContractShort(trade: EnrichedTrade): string {
  const strike = isFiniteNumber(trade.contract?.strike)
    ? Number.isInteger(trade.contract.strike) ? String(trade.contract.strike) : trade.contract.strike.toFixed(0)
    : '?'
  const type = trade.contract?.type === 'put' ? 'P' : 'C'
  return `${strike}${type}`
}

function formatPnl(pnlPercent: number | null): string {
  if (!isFiniteNumber(pnlPercent)) return ''
  const sign = pnlPercent >= 0 ? '+' : ''
  return `${sign}${pnlPercent.toFixed(0)}%`
}

/**
 * Builds lightweight-charts native markers from enriched trades.
 * Markers auto-track with chart pan/zoom — no HTML overlay needed.
 */
export function buildTradeMarkers(
  trades: EnrichedTrade[],
  visibleBars: ChartBar[],
  selectedTradeIndex?: number,
): TradeSeriesMarker[] {
  if (visibleBars.length === 0 || trades.length === 0) return []

  const firstTime = visibleBars[0]!.time
  const lastTime = visibleBars[visibleBars.length - 1]!.time
  const isInWindow = (timeSec: number) => timeSec >= firstTime && timeSec <= lastTime

  const markers: TradeSeriesMarker[] = []

  for (const trade of trades) {
    const isSelected = trade.tradeIndex === selectedTradeIndex
    const entryTimeSec = parseEpochSeconds(trade.entryTimestamp)

    // Entry marker
    if (entryTimeSec != null && isInWindow(entryTimeSec)) {
      const barTime = findNearestBarTime(visibleBars, entryTimeSec)
      if (barTime != null) {
        markers.push({
          time: toUtcTimestamp(barTime),
          position: 'belowBar',
          color: '#10B981',
          shape: 'arrowUp',
          text: formatContractShort(trade),
          size: isSelected ? 3 : 2,
        })
      }
    }

    // Exit markers
    const exitEvents = Array.isArray(trade.exitEvents) ? trade.exitEvents : []
    for (const exitEvent of exitEvents) {
      if (exitEvent.type !== 'full_exit' && exitEvent.type !== 'trim') continue

      const eventTimeSec = parseEpochSeconds(exitEvent.timestamp)
      if (eventTimeSec == null || !isInWindow(eventTimeSec)) continue

      const barTime = findNearestBarTime(visibleBars, eventTimeSec)
      if (barTime == null) continue

      if (exitEvent.type === 'full_exit') {
        markers.push({
          time: toUtcTimestamp(barTime),
          position: 'aboveBar',
          color: '#ef4444',
          shape: 'arrowDown',
          text: formatPnl(trade.pnlPercent),
          size: isSelected ? 3 : 2,
        })
      } else {
        // Trim
        const trimPct = isFiniteNumber(exitEvent.percentage)
          ? `T ${exitEvent.percentage}%`
          : 'Trim'
        markers.push({
          time: toUtcTimestamp(barTime),
          position: 'aboveBar',
          color: '#F3E5AB',
          shape: 'circle',
          text: trimPct,
          size: isSelected ? 2 : 1,
        })
      }
    }
  }

  // lightweight-charts requires markers sorted by time ascending
  markers.sort((a, b) => Number(a.time) - Number(b.time))

  return markers
}

/**
 * Builds price line options for stop levels visible in the current frame.
 */
export function buildStopPriceLines(
  trades: EnrichedTrade[],
  visibleBars: ChartBar[],
): TradePriceLineOptions[] {
  if (visibleBars.length === 0 || trades.length === 0) return []

  const firstTime = visibleBars[0]!.time
  const lastTime = visibleBars[visibleBars.length - 1]!.time
  const isInWindow = (timeSec: number) => timeSec >= firstTime && timeSec <= lastTime

  const lines: TradePriceLineOptions[] = []
  const seenPrices = new Set<string>()

  for (const trade of trades) {
    const stopLevels = Array.isArray(trade.stopLevels) ? trade.stopLevels : []
    for (const stop of stopLevels) {
      const stopTimeSec = parseEpochSeconds(stop.timestamp)
      if (!isFiniteNumber(stop.spxLevel) || stopTimeSec == null || !isInWindow(stopTimeSec)) continue

      const priceKey = stop.spxLevel.toFixed(1)
      if (seenPrices.has(priceKey)) continue
      seenPrices.add(priceKey)

      lines.push({
        price: stop.spxLevel,
        color: '#ef4444',
        lineWidth: 1 as LineWidth,
        lineStyle: 2 as LineStyle, // Dashed
        title: `Stop ${priceKey}`,
        axisLabelVisible: true,
      })
    }
  }

  return lines
}
