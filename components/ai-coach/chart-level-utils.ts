import type {
  ChartTimeframe,
  FibonacciLevelsResponse,
  FibonacciTimeframe,
} from '@/lib/api/ai-coach'
import type { LevelAnnotation } from './trading-chart'

const FIB_TIMEFRAME_MAP: Record<ChartTimeframe, FibonacciTimeframe> = {
  '1m': '5m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '1h',
  '1D': 'daily',
}

const FIB_LEVEL_ORDER: Array<{
  key: keyof FibonacciLevelsResponse['levels']
  label: string
  isMajor: boolean
}> = [
  { key: 'level_0', label: '0%', isMajor: false },
  { key: 'level_236', label: '23.6%', isMajor: false },
  { key: 'level_382', label: '38.2%', isMajor: true },
  { key: 'level_500', label: '50%', isMajor: false },
  { key: 'level_618', label: '61.8%', isMajor: true },
  { key: 'level_786', label: '78.6%', isMajor: false },
  { key: 'level_100', label: '100%', isMajor: false },
]

export function mapChartTimeframeToFibTimeframe(timeframe: ChartTimeframe): FibonacciTimeframe {
  return FIB_TIMEFRAME_MAP[timeframe]
}

export function mapFibonacciResponseToAnnotations(fib: FibonacciLevelsResponse): LevelAnnotation[] {
  return FIB_LEVEL_ORDER.map((entry) => ({
    price: fib.levels[entry.key],
    label: `Fib ${entry.label}`,
    color: entry.isMajor ? '#c4b5fd' : '#8b5cf6',
    lineWidth: entry.isMajor ? 2 : 1,
    lineStyle: 'solid',
    type: `fibonacci_${entry.label}`,
    strength: entry.isMajor ? 'strong' : 'moderate',
  }))
}

export function mergeLevelAnnotations(
  baseLevels: LevelAnnotation[],
  supplementalLevels: LevelAnnotation[],
): LevelAnnotation[] {
  const seen = new Set<string>()
  const merged: LevelAnnotation[] = []

  for (const level of [...baseLevels, ...supplementalLevels]) {
    const key = `${level.label}|${Number(level.price.toFixed(2))}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(level)
  }

  return merged
}
