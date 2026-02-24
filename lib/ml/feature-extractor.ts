import type { Regime, Setup } from '@/lib/types/spx-command-center'
import type { FeatureExtractionContext, SetupFeatureVector } from '@/lib/ml/types'

const FLOW_BIAS_DECAY = 0.85
const SESSION_OPEN_MINUTE_ET = (9 * 60) + 30
const SESSION_LENGTH_MINUTES = 390

const WEEKDAY_MAP: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 0,
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function toEpoch(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function resolveNowMs(setup: Setup, context: FeatureExtractionContext): number {
  if (typeof context.nowMs === 'number' && Number.isFinite(context.nowMs) && context.nowMs > 0) {
    return context.nowMs
  }
  const fromSetup = toEpoch(setup.statusUpdatedAt || setup.triggeredAt || setup.createdAt)
  return fromSetup > 0 ? fromSetup : Date.now()
}

function regimeCode(regime: Regime | null): number {
  switch (regime) {
    case 'trending':
      return 1
    case 'ranging':
      return 2
    case 'compression':
      return 3
    case 'breakout':
      return 4
    default:
      return 0
  }
}

function regimeCompatibility(setupRegime: Regime, activeRegime: Regime | null): number {
  if (!activeRegime) return 0.5
  if (setupRegime === activeRegime) return 1

  if (
    (setupRegime === 'trending' && activeRegime === 'breakout')
    || (setupRegime === 'breakout' && activeRegime === 'trending')
    || (setupRegime === 'compression' && activeRegime === 'ranging')
    || (setupRegime === 'ranging' && activeRegime === 'compression')
  ) {
    return 0.65
  }

  if (
    (setupRegime === 'trending' && activeRegime === 'ranging')
    || (setupRegime === 'ranging' && activeRegime === 'trending')
    || (setupRegime === 'breakout' && activeRegime === 'compression')
    || (setupRegime === 'compression' && activeRegime === 'breakout')
  ) {
    return 0.15
  }

  return 0.3
}

function flowBias(direction: Setup['direction'], context: FeatureExtractionContext): number {
  const scoped = context.flowEvents.slice(0, 24)
  if (scoped.length === 0) return 0

  let weightedAligned = 0
  let weightedOpposing = 0
  let totalWeight = 0

  for (let i = 0; i < scoped.length; i += 1) {
    const weight = FLOW_BIAS_DECAY ** i
    totalWeight += weight
    if (scoped[i].direction === direction) weightedAligned += weight
    else weightedOpposing += weight
  }

  if (totalWeight <= 0) return 0
  return clamp((weightedAligned - weightedOpposing) / totalWeight, -1, 1)
}

function latestFlowEventEpoch(context: FeatureExtractionContext): number {
  let latest = 0
  for (const event of context.flowEvents) {
    const ts = toEpoch(event.timestamp)
    if (ts > latest) latest = ts
  }
  return latest
}

function resolveFlowVolume(context: FeatureExtractionContext): number {
  return round(context.flowEvents.reduce((sum, event) => sum + safeNumber(event.size), 0), 2)
}

function resolveSweepCount(context: FeatureExtractionContext): number {
  return context.flowEvents.reduce((count, event) => (event.type === 'sweep' ? count + 1 : count), 0)
}

function inferPutCallRatio(setup: Setup, context: FeatureExtractionContext): number {
  const explicit = safeNumber(context.metrics?.putCallRatio, Number.NaN)
  if (Number.isFinite(explicit)) return explicit

  let bullishCount = 0
  let bearishCount = 0
  for (const event of context.flowEvents) {
    if (event.direction === 'bullish') bullishCount += 1
    else if (event.direction === 'bearish') bearishCount += 1
  }

  if (bullishCount === 0 && bearishCount === 0) return 1
  if (bullishCount === 0) return round(bearishCount, 4)
  return round(bearishCount / bullishCount, 4)
}

function inferIVRank(setup: Setup, context: FeatureExtractionContext): number {
  const explicit = safeNumber(context.metrics?.ivRank, Number.NaN)
  if (Number.isFinite(explicit)) return clamp(explicit, 0, 100)

  const ivVsRealized = safeNumber(setup.recommendedContract?.ivVsRealized, Number.NaN)
  if (Number.isFinite(ivVsRealized)) {
    return clamp(round((ivVsRealized + 1) * 50, 2), 0, 100)
  }

  return 50
}

function inferDte(setup: Setup, context: FeatureExtractionContext, nowMs: number): number {
  const explicit = safeNumber(context.metrics?.dte, Number.NaN)
  if (Number.isFinite(explicit)) return Math.max(0, explicit)

  const contractDte = safeNumber(setup.recommendedContract?.daysToExpiry, Number.NaN)
  if (Number.isFinite(contractDte)) return Math.max(0, contractDte)

  const expiryEpoch = toEpoch(setup.recommendedContract?.expiry)
  if (expiryEpoch <= 0) return 0

  const days = (expiryEpoch - nowMs) / (24 * 60 * 60 * 1000)
  return Math.max(0, round(days, 4))
}

function inferLastTestResult(setup: Setup): number {
  const memory = setup.memoryContext
  if (!memory || memory.tests <= 0) return -1

  if (memory.wins > memory.losses) return 1
  if (memory.losses > memory.wins) return 0

  if (memory.winRatePct == null) return -1
  if (memory.winRatePct >= 50) return 1
  return 0
}

function getEasternTimeParts(epochMs: number): { hour: number; minute: number; weekday: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/New_York',
  })
  const parts = formatter.formatToParts(new Date(epochMs))
  const weekdayText = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun'
  const hour = Number.parseInt(parts.find((part) => part.type === 'hour')?.value ?? '0', 10)
  const minute = Number.parseInt(parts.find((part) => part.type === 'minute')?.value ?? '0', 10)

  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
    weekday: WEEKDAY_MAP[weekdayText] ?? 0,
  }
}

export function extractFeatures(setup: Setup, context: FeatureExtractionContext): SetupFeatureVector {
  const nowMs = resolveNowMs(setup, context)
  const latestFlowEpoch = latestFlowEventEpoch(context)

  const entryMid = (safeNumber(setup.entryZone.low) + safeNumber(setup.entryZone.high)) / 2
  const clusterMid = (safeNumber(setup.clusterZone.priceLow) + safeNumber(setup.clusterZone.priceHigh)) / 2
  const inferredAtr14 = round(Math.max(Math.abs(safeNumber(setup.target1.price) - safeNumber(setup.stop)) / 2, 0.01), 4)
  const atr14 = Math.max(0.01, safeNumber(context.metrics?.atr14, inferredAtr14))
  const atr7 = Math.max(0.01, safeNumber(context.metrics?.atr7, atr14))

  const session = getEasternTimeParts(nowMs)
  const minuteOfDay = (session.hour * 60) + session.minute

  const memoryWinRate = setup.memoryContext?.winRatePct
  const historicalWinRate = memoryWinRate == null
    ? 0.5
    : clamp(memoryWinRate / 100, 0, 1)

  const flowAgeMinutes = latestFlowEpoch > 0
    ? Math.max(0, round((nowMs - latestFlowEpoch) / 60000, 4))
    : 9_999

  const featureVector: SetupFeatureVector = {
    confluenceScore: round(clamp(safeNumber(setup.confluenceScore), 0, 5), 4),
    confluenceFlowAge: flowAgeMinutes,
    confluenceEmaAlignment: round(clamp(safeNumber(setup.confluenceBreakdown?.ema), 0, 1), 4),
    confluenceGexAlignment: round(clamp(safeNumber(setup.confluenceBreakdown?.gex), 0, 1), 4),

    regimeType: regimeCode(context.regime),
    regimeCompatibility: round(regimeCompatibility(setup.regime, context.regime), 4),
    regimeAge: round(Math.max((nowMs - toEpoch(setup.createdAt)) / 60000, 0), 4),

    flowBias: round(flowBias(setup.direction, context), 4),
    flowRecency: flowAgeMinutes,
    flowVolume: resolveFlowVolume(context),
    flowSweepCount: resolveSweepCount(context),

    distanceToVWAP: round(Math.abs(safeNumber(context.metrics?.distanceToVWAP)), 4),
    distanceToNearestCluster: round(Math.abs(entryMid - clusterMid), 4),
    atr14: round(atr14, 4),
    atr7_14_ratio: round(clamp(atr7 / atr14, 0, 5), 4),

    ivRank: round(inferIVRank(setup, context), 4),
    ivSkew: round(safeNumber(context.metrics?.ivSkew), 4),
    putCallRatio: round(inferPutCallRatio(setup, context), 4),
    netGex: round(safeNumber(context.gex?.netGex), 4),

    minutesIntoSession: clamp(minuteOfDay - SESSION_OPEN_MINUTE_ET, 0, SESSION_LENGTH_MINUTES),
    dayOfWeek: session.weekday,
    dte: round(inferDte(setup, context, nowMs), 4),

    historicalWinRate: round(historicalWinRate, 4),
    historicalTestCount: Math.max(0, safeNumber(setup.memoryContext?.tests)),
    lastTestResult: inferLastTestResult(setup),
  }

  return featureVector
}
