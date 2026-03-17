import { getChartData, type ChartBar } from '@/lib/api/ai-coach'

const EASTERN_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
})

export interface SpxTickerSnapshot {
  price: number
  change: number | null
  changePct: number | null
  asOf: string | null
}

function toEpochMillis(timestamp: number): number {
  if (!Number.isFinite(timestamp)) return 0
  return timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000
}

function toUtcDateKey(timestamp: number): string {
  return new Date(toEpochMillis(timestamp)).toISOString().slice(0, 10)
}

function toRoundedPrice(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return Number(value.toFixed(2))
}

function resolvePreviousClose(
  currentBar: ChartBar,
  dailyBars: ChartBar[],
): number | null {
  if (dailyBars.length === 0) return null

  const currentDateKey = toUtcDateKey(currentBar.time)
  const lastDailyBar = dailyBars[dailyBars.length - 1]
  const lastDailyDateKey = toUtcDateKey(lastDailyBar.time)

  if (lastDailyDateKey === currentDateKey) {
    if (dailyBars.length < 2) return null
    return dailyBars[dailyBars.length - 2]?.close ?? null
  }

  return lastDailyBar.close
}

export function buildSpxTickerSnapshot(
  intradayBars: ChartBar[],
  dailyBars: ChartBar[],
): SpxTickerSnapshot | null {
  const currentBar = intradayBars[intradayBars.length - 1] ?? dailyBars[dailyBars.length - 1] ?? null
  if (!currentBar) return null

  const previousClose = resolvePreviousClose(currentBar, dailyBars)
  const change = previousClose != null ? currentBar.close - previousClose : null
  const changePct = previousClose && previousClose !== 0 && change != null
    ? (change / previousClose) * 100
    : null

  return {
    price: Number(currentBar.close.toFixed(2)),
    change: toRoundedPrice(change),
    changePct: toRoundedPrice(changePct),
    asOf: EASTERN_TIME_FORMATTER.format(new Date(toEpochMillis(currentBar.time))),
  }
}

function unwrapChartResult<T>(
  result: PromiseSettledResult<T>,
): T | null {
  if (result.status === 'fulfilled') return result.value

  const reason = result.reason
  if (reason instanceof DOMException && reason.name === 'AbortError') {
    throw reason
  }
  if (
    typeof reason === 'object'
    && reason !== null
    && 'name' in reason
    && (reason as { name?: string }).name === 'AbortError'
  ) {
    throw reason
  }

  return null
}

export async function loadSpxTickerSnapshot(
  token: string,
  signal?: AbortSignal,
): Promise<SpxTickerSnapshot> {
  const [intradayResult, dailyResult] = await Promise.allSettled([
    getChartData('SPX', '1m', token, signal),
    getChartData('SPX', '1D', token, signal),
  ])

  const intradayData = unwrapChartResult(intradayResult)
  const dailyData = unwrapChartResult(dailyResult)

  const snapshot = buildSpxTickerSnapshot(
    intradayData?.bars ?? [],
    dailyData?.bars ?? [],
  )

  if (!snapshot) {
    throw new Error('No SPX bars available')
  }

  return snapshot
}
