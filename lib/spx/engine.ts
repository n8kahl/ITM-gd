import type {
  BasisState,
  ClusterZone,
  ContractCandidate,
  ContractRecommendation,
  FibLevel,
  GEXProfile,
  LevelCategory,
  PredictionState,
  Regime,
  SPXLevel,
  Setup,
  SetupStatus,
  SetupType,
  ZoneType,
} from '@/lib/types/spx-command-center'

export const CLUSTER_RADIUS_POINTS = 3

const CATEGORY_WEIGHT: Record<LevelCategory, number> = {
  structural: 1.5,
  tactical: 1.2,
  intraday: 1.0,
  options: 1.3,
  spy_derived: 1.1,
  fibonacci: 1.2,
}

export function classifyZoneType(score: number): ZoneType {
  if (score >= 5) return 'fortress'
  if (score >= 3.5) return 'defended'
  if (score >= 2) return 'moderate'
  return 'minor'
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals))
}

function categoryScore(level: SPXLevel): number {
  const base = CATEGORY_WEIGHT[level.category] ?? 1
  const crossValidatedBonus = level.category === 'fibonacci' && level.metadata.crossValidated === true ? 0.5 : 0
  return base + crossValidatedBonus
}

export function buildClusterZones(levels: SPXLevel[], radius = CLUSTER_RADIUS_POINTS): ClusterZone[] {
  if (levels.length === 0) return []

  const sorted = [...levels].sort((a, b) => a.price - b.price)
  const rawGroups: SPXLevel[][] = []

  let group: SPXLevel[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i]
    const groupMax = group[group.length - 1].price

    if (current.price - groupMax <= radius) {
      group.push(current)
      continue
    }

    rawGroups.push(group)
    group = [current]
  }
  rawGroups.push(group)

  const zones: ClusterZone[] = rawGroups.map((items, idx) => {
    const min = Math.min(...items.map((item) => item.price))
    const max = Math.max(...items.map((item) => item.price))
    const score = items.reduce((sum, item) => sum + categoryScore(item), 0)

    const holdRates = items
      .map((item) => (typeof item.metadata.holdRate === 'number' ? item.metadata.holdRate : null))
      .filter((item): item is number => item !== null)

    const tests = items
      .map((item) => (typeof item.metadata.testsToday === 'number' ? item.metadata.testsToday : 0))
      .reduce((sum, value) => sum + value, 0)

    const lastTest = items
      .map((item) => (typeof item.metadata.lastTestAt === 'string' ? item.metadata.lastTestAt : null))
      .filter((item): item is string => item !== null)
      .sort()
      .pop() || null

    return {
      id: `cluster-${idx + 1}-${round(min)}-${round(max)}`,
      priceLow: round(min - 0.25),
      priceHigh: round(max + 0.25),
      clusterScore: round(score, 2),
      type: classifyZoneType(score),
      sources: items.map((item) => ({
        source: item.source,
        category: item.category,
        price: round(item.price),
        instrument: item.symbol,
      })),
      testCount: tests,
      lastTestAt: lastTest,
      held: holdRates.length > 0 ? holdRates.reduce((sum, value) => sum + value, 0) / holdRates.length >= 60 : null,
      holdRate: holdRates.length > 0
        ? round(holdRates.reduce((sum, value) => sum + value, 0) / holdRates.length, 2)
        : null,
    }
  })

  return mergeOverlappingZones(zones)
}

function mergeOverlappingZones(zones: ClusterZone[]): ClusterZone[] {
  if (zones.length <= 1) return zones

  const sorted = [...zones].sort((a, b) => a.priceLow - b.priceLow)
  const merged: ClusterZone[] = []

  for (const zone of sorted) {
    const previous = merged[merged.length - 1]
    if (!previous || zone.priceLow > previous.priceHigh) {
      merged.push(zone)
      continue
    }

    const dominant = zone.clusterScore >= previous.clusterScore ? zone : previous
    const combinedScore = round(Math.max(zone.clusterScore, previous.clusterScore), 2)

    merged[merged.length - 1] = {
      ...dominant,
      id: `${previous.id}|${zone.id}`,
      priceLow: round(Math.min(previous.priceLow, zone.priceLow), 2),
      priceHigh: round(Math.max(previous.priceHigh, zone.priceHigh), 2),
      clusterScore: combinedScore,
      type: classifyZoneType(combinedScore),
      testCount: previous.testCount + zone.testCount,
      sources: dedupeSources([...previous.sources, ...zone.sources]),
      holdRate: averageNullable(previous.holdRate, zone.holdRate),
      held: dominant.held,
      lastTestAt: maxDate(previous.lastTestAt, zone.lastTestAt),
    }
  }

  return merged
}

function dedupeSources(sources: ClusterZone['sources']): ClusterZone['sources'] {
  const seen = new Set<string>()
  const deduped: ClusterZone['sources'] = []

  for (const source of sources) {
    const key = `${source.instrument}:${source.category}:${source.source}:${source.price}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(source)
  }

  return deduped
}

function averageNullable(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null
  if (a == null) return b
  if (b == null) return a
  return round((a + b) / 2, 2)
}

function maxDate(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

export interface BasisComputationInput {
  spxPrice: number
  spyPrice: number
  basisHistory?: number[]
}

function ema(values: number[], period: number): number {
  if (values.length === 0) return 0
  const k = 2 / (period + 1)
  let current = values[0]
  for (let i = 1; i < values.length; i += 1) {
    current = values[i] * k + current * (1 - k)
  }
  return current
}

function zScore(values: number[], value: number): number {
  if (values.length < 2) return 0
  const mean = values.reduce((sum, item) => sum + item, 0) / values.length
  const variance = values.reduce((sum, item) => sum + ((item - mean) ** 2), 0) / values.length
  const std = Math.sqrt(variance)
  if (std === 0) return 0
  return (value - mean) / std
}

export function computeBasisState(input: BasisComputationInput): BasisState {
  const current = input.spxPrice - input.spyPrice * 10
  const history = [...(input.basisHistory ?? []), current].slice(-50)
  const ema5 = ema(history.slice(-5), Math.min(5, history.length))
  const ema20 = ema(history.slice(-20), Math.min(20, history.length))
  const diff = ema5 - ema20

  const trend: BasisState['trend'] = diff > 0.35 ? 'expanding' : diff < -0.35 ? 'contracting' : 'stable'
  const leading: BasisState['leading'] = current > ema20 + 0.35
    ? 'SPX'
    : current < ema20 - 0.35
      ? 'SPY'
      : 'neutral'

  return {
    current: round(current, 2),
    trend,
    leading,
    ema5: round(ema5, 2),
    ema20: round(ema20, 2),
    zscore: round(zScore(history, current), 2),
  }
}

export interface ConfluenceInput {
  zoneType: ZoneType
  gexAligned: boolean
  flowConfirmed: boolean
  fibTouch: boolean
  regimeAligned: boolean
}

export function calculateConfluence(input: ConfluenceInput): {
  score: number
  sources: string[]
} {
  const sources: string[] = []

  if (input.zoneType === 'fortress' || input.zoneType === 'defended') {
    sources.push('level_quality')
  }
  if (input.gexAligned) sources.push('gex_alignment')
  if (input.flowConfirmed) sources.push('flow_confirmation')
  if (input.fibTouch) sources.push('fibonacci_touch')
  if (input.regimeAligned) sources.push('regime_alignment')

  return {
    score: Math.min(5, sources.length),
    sources,
  }
}

export function transitionSetupStatus(
  setup: Setup,
  context: {
    currentPrice: number
    nowIso?: string
    invalidated?: boolean
    confluenceScore?: number
  },
): SetupStatus {
  const now = new Date(context.nowIso ?? new Date().toISOString())
  const createdAt = new Date(setup.createdAt)
  const ageMs = now.getTime() - createdAt.getTime()

  if (context.invalidated) return 'invalidated'

  const inEntryZone = context.currentPrice >= setup.entryZone.low && context.currentPrice <= setup.entryZone.high
  if (inEntryZone && (setup.status === 'ready' || setup.status === 'forming')) {
    return 'triggered'
  }

  if (setup.status === 'forming' && (context.confluenceScore ?? setup.confluenceScore) >= 3) {
    return 'ready'
  }

  if (setup.status !== 'triggered' && ageMs > 30 * 60 * 1000) {
    return 'expired'
  }

  return setup.status
}

export interface RegimeSignalInput {
  netGex: number
  volumeTrend: 'rising' | 'flat' | 'falling'
  rangeCompression: number
  breakoutStrength: number
  zoneContainment: number
}

export function classifyRegime(input: RegimeSignalInput): Regime {
  if (input.breakoutStrength >= 0.7 && input.volumeTrend === 'rising') {
    return 'breakout'
  }

  if (input.rangeCompression >= 0.65 && input.volumeTrend !== 'rising') {
    return 'compression'
  }

  if (input.netGex < 0 && (input.breakoutStrength >= 0.45 || input.volumeTrend === 'rising')) {
    return 'trending'
  }

  if (input.zoneContainment >= 0.55 && input.netGex >= 0) {
    return 'ranging'
  }

  return input.netGex < 0 ? 'trending' : 'ranging'
}

function normalizeProbabilities(parts: Array<[key: string, value: number]>): Record<string, number> {
  const bounded = parts.map(([key, value]) => [key, Math.max(0, value)] as const)
  const sum = bounded.reduce((acc, [, value]) => acc + value, 0)
  if (sum === 0) {
    return Object.fromEntries(bounded.map(([key]) => [key, 0]))
  }
  return Object.fromEntries(bounded.map(([key, value]) => [key, round((value / sum) * 100, 2)]))
}

export function buildPredictionState(input: {
  regime: Regime
  spot: number
  nearestUpsideZone: ClusterZone | null
  nearestDownsideZone: ClusterZone | null
  confidence: number
  expectedMove: number
}): PredictionState {
  const confidence = Math.max(0, Math.min(100, input.confidence))

  const directionBase = (() => {
    switch (input.regime) {
      case 'trending':
        return { bullish: 52, bearish: 38, neutral: 10 }
      case 'breakout':
        return { bullish: 49, bearish: 41, neutral: 10 }
      case 'compression':
        return { bullish: 34, bearish: 33, neutral: 33 }
      case 'ranging':
      default:
        return { bullish: 36, bearish: 34, neutral: 30 }
    }
  })()

  const magnitudeBase = (() => {
    switch (input.regime) {
      case 'breakout':
        return { small: 15, medium: 45, large: 40 }
      case 'trending':
        return { small: 25, medium: 50, large: 25 }
      case 'compression':
        return { small: 55, medium: 35, large: 10 }
      case 'ranging':
      default:
        return { small: 50, medium: 38, large: 12 }
    }
  })()

  const direction = normalizeProbabilities(Object.entries(directionBase)) as PredictionState['direction']
  const magnitude = normalizeProbabilities(Object.entries(magnitudeBase)) as PredictionState['magnitude']

  const cone = [5, 10, 15, 20, 30].map((minutesForward, idx) => {
    const spread = input.expectedMove * (0.35 + idx * 0.2)
    const centerShift = (direction.bullish - direction.bearish) / 100 * spread * 0.4
    return {
      minutesForward,
      high: round(input.spot + centerShift + spread, 2),
      low: round(input.spot + centerShift - spread, 2),
      center: round(input.spot + centerShift, 2),
      confidence: round(Math.max(10, confidence - idx * 8), 2),
    }
  })

  return {
    regime: input.regime,
    direction,
    magnitude,
    timingWindow: {
      description: input.regime === 'compression'
        ? 'Compression regime detected. Await break confirmation before entry.'
        : input.regime === 'breakout'
          ? 'Breakout window active. Momentum setups have priority.'
          : 'Monitor nearest fortress/defended zones for reaction entries.',
      actionable: input.regime !== 'compression' || confidence >= 70,
    },
    nextTarget: {
      upside: {
        price: input.nearestUpsideZone ? round((input.nearestUpsideZone.priceLow + input.nearestUpsideZone.priceHigh) / 2, 2) : round(input.spot + input.expectedMove, 2),
        zone: input.nearestUpsideZone?.type || 'projected',
      },
      downside: {
        price: input.nearestDownsideZone ? round((input.nearestDownsideZone.priceLow + input.nearestDownsideZone.priceHigh) / 2, 2) : round(input.spot - input.expectedMove, 2),
        zone: input.nearestDownsideZone?.type || 'projected',
      },
    },
    probabilityCone: cone,
    confidence: round(confidence, 2),
  }
}

function estimateOptionValue(move: number, contract: ContractCandidate): number {
  const mid = (contract.bid + contract.ask) / 2
  const intrinsicMove = Math.max(0, Math.abs(move * contract.delta * 100))
  const gammaKick = Math.max(0, Math.abs(move) * contract.gamma * 15)
  const thetaDrag = Math.max(0, Math.abs(contract.theta) * 0.25)
  return Math.max(0.01, mid + intrinsicMove * 0.01 + gammaKick - thetaDrag)
}

function chooseDeltaTarget(type: SetupType): number {
  switch (type) {
    case 'fade_at_wall':
      return 0.18
    case 'breakout_vacuum':
      return 0.26
    case 'trend_continuation':
      return 0.3
    case 'mean_reversion':
    default:
      return 0.22
  }
}

export function recommendContract(
  setup: Setup,
  candidates: ContractCandidate[],
): ContractRecommendation | null {
  if (candidates.length === 0) return null

  const targetDelta = chooseDeltaTarget(setup.type)
  const desiredType = setup.direction === 'bullish' ? 'call' : 'put'

  const filtered = candidates.filter((candidate) => candidate.type === desiredType)
  if (filtered.length === 0) return null

  const best = [...filtered]
    .sort((a, b) => {
      const aDeltaDistance = Math.abs(Math.abs(a.delta) - targetDelta)
      const bDeltaDistance = Math.abs(Math.abs(b.delta) - targetDelta)
      if (aDeltaDistance !== bDeltaDistance) return aDeltaDistance - bDeltaDistance
      return (a.ask - a.bid) - (b.ask - b.bid)
    })
    .at(0)

  if (!best) return null

  const riskPoints = Math.abs((setup.direction === 'bullish' ? setup.entryZone.low : setup.entryZone.high) - setup.stop)
  const rewardPoints1 = Math.abs(setup.target1.price - ((setup.entryZone.low + setup.entryZone.high) / 2))
  const rewardPoints2 = Math.abs(setup.target2.price - ((setup.entryZone.low + setup.entryZone.high) / 2))
  const riskReward = riskPoints <= 0 ? 0 : rewardPoints1 / riskPoints

  const moveToTarget1 = setup.direction === 'bullish'
    ? setup.target1.price - setup.entryZone.high
    : setup.entryZone.low - setup.target1.price
  const moveToTarget2 = setup.direction === 'bullish'
    ? setup.target2.price - setup.entryZone.high
    : setup.entryZone.low - setup.target2.price

  const mid = (best.bid + best.ask) / 2
  const expectedTarget1 = estimateOptionValue(moveToTarget1, best)
  const expectedTarget2 = estimateOptionValue(moveToTarget2, best)

  return {
    description: `${best.strike}${best.type === 'call' ? 'C' : 'P'} ${best.expiry}`,
    strike: best.strike,
    expiry: best.expiry,
    type: best.type,
    delta: round(best.delta, 3),
    gamma: round(best.gamma, 3),
    theta: round(best.theta, 3),
    vega: round(best.vega, 3),
    bid: round(best.bid, 2),
    ask: round(best.ask, 2),
    riskReward: round(riskReward, 2),
    expectedPnlAtTarget1: round((expectedTarget1 - mid) * 100, 2),
    expectedPnlAtTarget2: round((expectedTarget2 - mid) * 100, 2),
    maxLoss: round(mid * 100, 2),
    reasoning: `${setup.type} prioritizes ${desiredType.toUpperCase()} with Δ≈${targetDelta}. Selected tightest spread near target delta.`,
  }
}

export function buildChartStyle(category: LevelCategory): SPXLevel['chartStyle'] {
  const map: Record<LevelCategory, SPXLevel['chartStyle']> = {
    structural: {
      color: 'rgba(96,165,250,0.7)',
      lineStyle: 'solid',
      lineWidth: 2,
      labelFormat: 'Structural',
    },
    tactical: {
      color: 'rgba(255,255,255,0.6)',
      lineStyle: 'solid',
      lineWidth: 1.5,
      labelFormat: 'Tactical',
    },
    intraday: {
      color: 'rgba(156,163,175,0.5)',
      lineStyle: 'dotted',
      lineWidth: 1,
      labelFormat: 'Intraday',
    },
    options: {
      color: 'rgba(16,185,129,0.8)',
      lineStyle: 'solid',
      lineWidth: 2,
      labelFormat: 'Options',
    },
    spy_derived: {
      color: 'rgba(16,185,129,0.5)',
      lineStyle: 'dot-dash',
      lineWidth: 1.5,
      labelFormat: 'SPY Derived',
    },
    fibonacci: {
      color: 'rgba(245,237,204,0.6)',
      lineStyle: 'dashed',
      lineWidth: 1.5,
      labelFormat: 'Fibonacci',
    },
  }

  return map[category]
}

export function makeFibLevelsFromRange(input: {
  swingHigh: number
  swingLow: number
  timeframe: FibLevel['timeframe']
  crossValidated?: boolean
}): FibLevel[] {
  const ratios = [0.236, 0.382, 0.5, 0.618, 0.786, 1.272, 1.618, 2]
  const range = input.swingHigh - input.swingLow

  return ratios.map((ratio) => ({
    ratio,
    price: round(input.swingHigh - range * ratio, 2),
    timeframe: input.timeframe,
    direction: ratio > 1 ? 'extension' : 'retracement',
    swingHigh: input.swingHigh,
    swingLow: input.swingLow,
    crossValidated: input.crossValidated === true,
  }))
}

export function gexProfileFromStrikes(input: {
  spot: number
  strikes: Array<{ strike: number; gex: number }>
}): GEXProfile {
  const sorted = [...input.strikes].sort((a, b) => a.strike - b.strike)
  const netGex = sorted.reduce((sum, level) => sum + level.gex, 0)

  const callWall = sorted
    .filter((level) => level.gex > 0)
    .sort((a, b) => b.gex - a.gex)
    .at(0)?.strike ?? input.spot

  const putWall = sorted
    .filter((level) => level.gex < 0)
    .sort((a, b) => a.gex - b.gex)
    .at(0)?.strike ?? input.spot

  const flipPoint = sorted.reduce((closest, current) => (
    Math.abs(current.gex) < Math.abs(closest.gex) ? current : closest
  ), sorted[0] ?? { strike: input.spot, gex: 0 }).strike

  const keyLevels: GEXProfile['keyLevels'] = [...sorted]
    .sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))
    .slice(0, 10)
    .map((item) => {
      const type: GEXProfile['keyLevels'][number]['type'] = item.gex >= 0 ? 'call_wall' : 'put_wall'
      return {
        strike: round(item.strike, 2),
        gex: round(item.gex, 2),
        type,
      }
    })

  return {
    netGex: round(netGex, 2),
    flipPoint: round(flipPoint, 2),
    callWall: round(callWall, 2),
    putWall: round(putWall, 2),
    zeroGamma: round(flipPoint, 2),
    gexByStrike: sorted.map((item) => ({ strike: round(item.strike, 2), gex: round(item.gex, 2) })),
    keyLevels,
    expirationBreakdown: {},
    timestamp: new Date().toISOString(),
  }
}
