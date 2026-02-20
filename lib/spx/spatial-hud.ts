import type { ContractRecommendation, LevelStrength, Setup, SetupStatus } from '@/lib/types/spx-command-center'

export interface ProbabilityConeWindow {
  high: number
  low: number
  center?: number
  minutesForward?: number
  confidence?: number
}

export interface ProbabilityConeGeometry {
  path: string
  centerLine: string
  width: number
  height: number
  startX: number
  coneWidth: number
  usedFallback: boolean
}

interface BuildProbabilityConeGeometryInput {
  width: number
  height: number
  currentPrice: number
  priceToPixel: (price: number) => number | null
  visiblePriceRange?: { min: number; max: number } | null
  directionBias?: number
  windows: ProbabilityConeWindow[]
  startXRatio?: number
  coneWidthRatio?: number
}

const DEFAULT_START_X_RATIO = 0.82
const DEFAULT_CONE_WIDTH_RATIO = 0.16
const DEFAULT_CONE_WINDOW_MINUTES = [5, 15, 30] as const
const SPATIAL_COACH_PRICE_PATTERN = /\b(5[5-9]\d{2}|6[0-2]\d{2})\b/

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function isValidPriceRange(range: { min: number; max: number } | null | undefined): range is { min: number; max: number } {
  if (!range) return false
  return Number.isFinite(range.min) && Number.isFinite(range.max) && range.max > range.min
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function fallbackPixelFromPrice(price: number, height: number, visiblePriceRange?: { min: number; max: number } | null): number | null {
  if (!isValidPriceRange(visiblePriceRange)) return null
  const span = visiblePriceRange.max - visiblePriceRange.min
  const normalized = (visiblePriceRange.max - price) / span
  const y = normalized * height
  return Number.isFinite(y) ? clamp(y, 0, height) : null
}

function safePriceToPixel(
  price: number,
  height: number,
  priceToPixel: (price: number) => number | null,
  visiblePriceRange?: { min: number; max: number } | null,
): number | null {
  const fromChart = priceToPixel(price)
  if (fromChart != null && Number.isFinite(fromChart)) {
    return clamp(fromChart, 0, height)
  }
  return fallbackPixelFromPrice(price, height, visiblePriceRange)
}

function sanitizeConeWindows(windows: ProbabilityConeWindow[]): ProbabilityConeWindow[] {
  return windows.filter((windowPoint) => (
    Number.isFinite(windowPoint.high)
    && Number.isFinite(windowPoint.low)
    && windowPoint.high > windowPoint.low
  ))
}

function buildFallbackConeWindows(
  currentPrice: number,
  visiblePriceRange?: { min: number; max: number } | null,
  directionBias = 0,
): ProbabilityConeWindow[] {
  const visibleSpan = isValidPriceRange(visiblePriceRange)
    ? visiblePriceRange.max - visiblePriceRange.min
    : Math.max(currentPrice * 0.004, 12)
  const baseSpread = Math.max(visibleSpan * 0.05, 2)
  const driftStep = Math.max(visibleSpan * 0.015, 0.75)

  return DEFAULT_CONE_WINDOW_MINUTES.map((minutesForward, index) => {
    const spread = baseSpread * (1 + (index * 0.7))
    const center = currentPrice + directionBias * driftStep * (index + 1)
    return {
      minutesForward,
      high: center + spread,
      low: center - spread,
      center,
      confidence: 0.4,
    }
  })
}

export function buildProbabilityConeGeometry(
  input: BuildProbabilityConeGeometryInput,
): ProbabilityConeGeometry | null {
  const {
    width,
    height,
    currentPrice,
    priceToPixel,
    visiblePriceRange,
    directionBias = 0,
    windows,
    startXRatio = DEFAULT_START_X_RATIO,
    coneWidthRatio = DEFAULT_CONE_WIDTH_RATIO,
  } = input

  if (!isFinitePositive(width) || !isFinitePositive(height) || !isFinitePositive(currentPrice)) {
    return null
  }

  const startX = clamp(width * startXRatio, 0, width)
  const coneWidth = clamp(width * coneWidthRatio, Math.min(24, width * 0.08), width * 0.35)
  const startY = safePriceToPixel(currentPrice, height, priceToPixel, visiblePriceRange)
  if (startY == null) return null

  const preparedWindows = sanitizeConeWindows(windows)
  const useFallbackWindows = preparedWindows.length === 0
  const coneWindows = useFallbackWindows
    ? buildFallbackConeWindows(currentPrice, visiblePriceRange, directionBias)
    : preparedWindows

  const topPoints: string[] = []
  const bottomPoints: string[] = []
  const centerPoints: Array<{ x: number; y: number }> = []

  for (let index = 0; index < coneWindows.length; index += 1) {
    const windowPoint = coneWindows[index]
    const fraction = (index + 1) / coneWindows.length
    const x = startX + (fraction * coneWidth)
    const highY = safePriceToPixel(windowPoint.high, height, priceToPixel, visiblePriceRange)
    const lowY = safePriceToPixel(windowPoint.low, height, priceToPixel, visiblePriceRange)
    if (highY == null || lowY == null) continue

    const topY = Math.min(highY, lowY)
    const bottomY = Math.max(highY, lowY)
    topPoints.push(`${x},${topY}`)
    bottomPoints.push(`${x},${bottomY}`)

    const centerPrice = Number.isFinite(windowPoint.center) ? Number(windowPoint.center) : (windowPoint.high + windowPoint.low) / 2
    const centerY = safePriceToPixel(centerPrice, height, priceToPixel, visiblePriceRange)
    if (centerY != null) {
      centerPoints.push({ x, y: centerY })
    }
  }

  if (topPoints.length === 0 || bottomPoints.length === 0) {
    return null
  }

  const path = `M${startX},${startY} L${topPoints.join(' L')} L${[...bottomPoints].reverse().join(' L')} Z`
  const lastCenterPoint = centerPoints[centerPoints.length - 1]
  const centerLine = lastCenterPoint ? `M${startX},${startY} L${lastCenterPoint.x},${lastCenterPoint.y}` : ''

  return {
    path,
    centerLine,
    width,
    height,
    startX,
    coneWidth,
    usedFallback: useFallbackWindows,
  }
}

export interface SpatialCoachAnchorInput {
  id: string
  content: string
  timestamp: string
}

export interface SpatialCoachAnchorMessage<T extends SpatialCoachAnchorInput = SpatialCoachAnchorInput> {
  message: T
  anchorPrice: number
}

interface ExtractSpatialCoachAnchorsOptions {
  dismissedIds?: Set<string>
  maxNodes?: number
  pricePattern?: RegExp
}

export const DEFAULT_MAX_SPATIAL_COACH_NODES = 5

export function extractSpatialCoachAnchors<T extends SpatialCoachAnchorInput>(
  messages: T[],
  options?: ExtractSpatialCoachAnchorsOptions,
): SpatialCoachAnchorMessage<T>[] {
  const maxNodes = options?.maxNodes ?? DEFAULT_MAX_SPATIAL_COACH_NODES
  if (maxNodes <= 0) return []

  const dismissedIds = options?.dismissedIds ?? new Set<string>()
  const pricePattern = options?.pricePattern ?? SPATIAL_COACH_PRICE_PATTERN

  const sorted = [...messages]
    .map((message, index) => ({
      message,
      timestampMs: Date.parse(message.timestamp || '') || 0,
      originalIndex: index,
    }))
    .sort((left, right) => {
      if (right.timestampMs !== left.timestampMs) return right.timestampMs - left.timestampMs
      return left.originalIndex - right.originalIndex
    })

  const anchored: SpatialCoachAnchorMessage<T>[] = []
  for (const item of sorted) {
    if (dismissedIds.has(item.message.id)) continue
    const match = item.message.content.match(pricePattern)
    if (!match) continue
    const anchorPrice = Number.parseFloat(match[0])
    if (!Number.isFinite(anchorPrice)) continue
    anchored.push({ message: item.message, anchorPrice })
    if (anchored.length >= maxNodes) break
  }

  return anchored
}

export interface TopographicLevelInput {
  id: string
  price: number
  strength?: LevelStrength
  type?: string
  color?: string
}

export interface TopographicLadderEntry {
  id: string
  price: number
  color: string
  weight: number
}

function levelStrengthWeight(strength?: LevelStrength): number {
  if (strength === 'critical') return 1.5
  if (strength === 'strong') return 1.3
  if (strength === 'moderate') return 1.1
  if (strength === 'dynamic') return 1
  if (strength === 'weak') return 0.85
  return 1
}

function levelTypeWeight(type?: string): number {
  if (!type) return 1
  if (type === 'options') return 1.2
  if (type === 'structural') return 1.15
  if (type === 'fibonacci') return 0.95
  return 1
}

export function buildTopographicLadderEntries(
  levels: TopographicLevelInput[],
  currentPrice: number,
  maxEntries = 12,
): TopographicLadderEntry[] {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return []
  if (maxEntries <= 0) return []

  const ranked = levels
    .filter((level) => Number.isFinite(level.price))
    .map((level) => {
      const distance = Math.abs(level.price - currentPrice)
      const weight = levelStrengthWeight(level.strength) * levelTypeWeight(level.type)
      return {
        level,
        score: distance / Math.max(weight, 0.2),
      }
    })
    .sort((left, right) => left.score - right.score)
    .slice(0, maxEntries)
    .map(({ level }) => ({
      id: level.id,
      price: level.price,
      color: level.color || 'rgba(16,185,129,0.5)',
      weight: levelStrengthWeight(level.strength) * levelTypeWeight(level.type),
    }))

  return ranked.sort((left, right) => right.price - left.price)
}

export interface GammaTopographyStrikeInput {
  strike: number
  gex: number
}

export interface GammaTopographyEntry {
  strike: number
  gex: number
  weight: number
  polarity: 'positive' | 'negative'
}

interface BuildGammaTopographyEntriesOptions {
  maxEntries?: number
  minMagnitudeRatio?: number
}

export function buildGammaTopographyEntries(
  gexByStrike: GammaTopographyStrikeInput[],
  currentPrice: number,
  options?: BuildGammaTopographyEntriesOptions,
): GammaTopographyEntry[] {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return []

  const maxEntries = options?.maxEntries ?? 10
  const minMagnitudeRatio = options?.minMagnitudeRatio ?? 0.18
  if (maxEntries <= 0) return []

  const valid = gexByStrike.filter((point) => Number.isFinite(point.strike) && Number.isFinite(point.gex))
  if (valid.length === 0) return []

  const maxAbs = Math.max(...valid.map((point) => Math.abs(point.gex)), 0)
  if (!Number.isFinite(maxAbs) || maxAbs <= 0) return []

  const filtered = valid
    .filter((point) => Math.abs(point.gex) >= maxAbs * minMagnitudeRatio)
    .map((point) => {
      const magnitudeWeight = Math.abs(point.gex) / maxAbs
      const distance = Math.abs(point.strike - currentPrice)
      const proximityWeight = 1 / (1 + (distance / 24))
      return {
        point,
        rankScore: magnitudeWeight * 0.72 + proximityWeight * 0.28,
        weight: clamp(magnitudeWeight, 0.12, 1),
      }
    })
    .sort((left, right) => right.rankScore - left.rankScore)
    .slice(0, maxEntries)
    .map(({ point, weight }) => ({
      strike: point.strike,
      gex: point.gex,
      weight,
      polarity: point.gex >= 0 ? 'positive' as const : 'negative' as const,
    }))

  return filtered.sort((left, right) => right.strike - left.strike)
}

export interface SetupLockPriceBand {
  id: string
  kind: 'entry' | 'risk' | 'target1' | 'target2'
  low: number
  high: number
  emphasis: number
  color: string
}

export interface SetupLockGeometry {
  centerPrice: number
  confluenceRings: number
  bands: SetupLockPriceBand[]
}

function normalizeBandBounds(from: number, to: number): { low: number; high: number } | null {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  const low = Math.min(from, to)
  const high = Math.max(from, to)
  if (high - low <= 0) return null
  return { low, high }
}

export function buildSetupLockGeometry(setup: Setup | null): SetupLockGeometry | null {
  if (!setup) return null

  const entryLow = setup.entryZone.low
  const entryHigh = setup.entryZone.high
  if (!Number.isFinite(entryLow) || !Number.isFinite(entryHigh)) return null
  const normalizedEntry = normalizeBandBounds(entryLow, entryHigh)
  if (!normalizedEntry) return null

  const direction = setup.direction
  const centerPrice = (normalizedEntry.low + normalizedEntry.high) / 2

  const riskAnchor = direction === 'bullish' ? normalizedEntry.low : normalizedEntry.high
  const riskBounds = normalizeBandBounds(riskAnchor, setup.stop)

  const target1Anchor = direction === 'bullish' ? normalizedEntry.high : normalizedEntry.low
  const target1Bounds = normalizeBandBounds(target1Anchor, setup.target1.price)
  const target2Anchor = setup.target1.price
  const target2Bounds = normalizeBandBounds(target2Anchor, setup.target2.price)

  const bands: SetupLockPriceBand[] = [
    {
      id: `${setup.id}:entry`,
      kind: 'entry',
      low: normalizedEntry.low,
      high: normalizedEntry.high,
      emphasis: 1,
      color: 'rgba(245,237,204,0.22)',
    },
  ]

  if (riskBounds) {
    bands.push({
      id: `${setup.id}:risk`,
      kind: 'risk',
      low: riskBounds.low,
      high: riskBounds.high,
      emphasis: 0.95,
      color: 'rgba(251,113,133,0.2)',
    })
  }

  if (target1Bounds) {
    bands.push({
      id: `${setup.id}:target1`,
      kind: 'target1',
      low: target1Bounds.low,
      high: target1Bounds.high,
      emphasis: 0.9,
      color: 'rgba(16,185,129,0.16)',
    })
  }

  if (target2Bounds) {
    bands.push({
      id: `${setup.id}:target2`,
      kind: 'target2',
      low: target2Bounds.low,
      high: target2Bounds.high,
      emphasis: 0.84,
      color: 'rgba(16,185,129,0.12)',
    })
  }

  return {
    centerPrice,
    confluenceRings: Math.max(0, Math.min(5, Math.round(setup.confluenceScore))),
    bands,
  }
}

export type SetupLockState = 'idle' | 'ready' | 'triggered' | 'in_trade'

export function resolveSetupLockState(
  tradeMode: 'scan' | 'in_trade',
  setupStatus?: SetupStatus | null,
): SetupLockState {
  if (tradeMode === 'in_trade') return 'in_trade'
  if (setupStatus === 'triggered') return 'triggered'
  if (setupStatus === 'ready') return 'ready'
  return 'idle'
}

export interface RiskRewardShadowGeometry {
  direction: Setup['direction']
  entryLow: number
  entryHigh: number
  entryAnchor: number
  stop: number
  target1: number
  target2: number
  riskPoints: number
  rewardPointsToT1: number
  rewardPointsToT2: number
  rrToT1: number | null
  rrToT2: number | null
  contractMid: number | null
}

function deriveContractMid(contract: ContractRecommendation | null | undefined): number | null {
  if (!contract) return null
  if (Number.isFinite(contract.bid) && Number.isFinite(contract.ask)) {
    return (contract.bid + contract.ask) / 2
  }
  return null
}

export function buildRiskRewardShadowGeometry(
  setup: Setup | null,
  contract?: ContractRecommendation | null,
): RiskRewardShadowGeometry | null {
  if (!setup) return null
  if (!Number.isFinite(setup.entryZone.low) || !Number.isFinite(setup.entryZone.high)) return null
  if (!Number.isFinite(setup.stop) || !Number.isFinite(setup.target1.price) || !Number.isFinite(setup.target2.price)) {
    return null
  }

  const entryLow = Math.min(setup.entryZone.low, setup.entryZone.high)
  const entryHigh = Math.max(setup.entryZone.low, setup.entryZone.high)
  const entryAnchor = (entryLow + entryHigh) / 2
  const riskPoints = Math.abs(entryAnchor - setup.stop)
  if (riskPoints <= 0) return null

  const rewardPointsToT1 = Math.abs(setup.target1.price - entryAnchor)
  const rewardPointsToT2 = Math.abs(setup.target2.price - entryAnchor)
  const rrFromContract = Number.isFinite(contract?.riskReward) && (contract?.riskReward || 0) > 0
    ? Number(contract?.riskReward)
    : null
  const rrToT1 = rrFromContract != null
    ? rrFromContract
    : (rewardPointsToT1 / riskPoints)
  const rrToT2 = rewardPointsToT2 / riskPoints

  return {
    direction: setup.direction,
    entryLow,
    entryHigh,
    entryAnchor,
    stop: setup.stop,
    target1: setup.target1.price,
    target2: setup.target2.price,
    riskPoints,
    rewardPointsToT1,
    rewardPointsToT2,
    rrToT1: Number.isFinite(rrToT1) ? rrToT1 : null,
    rrToT2: Number.isFinite(rrToT2) ? rrToT2 : null,
    contractMid: deriveContractMid(contract),
  }
}

export function parseIsoToUnixSeconds(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return Math.floor(parsed / 1000)
}

export type SpatialAnchorMode = 'time' | 'fallback'

export interface ResolveSpatialAnchorXInput {
  width: number
  fallbackIndex: number
  anchorTimeSec: number | null
  timeToPixel: (timestamp: number) => number | null
  minX?: number
  maxX?: number
}

export interface ResolvedSpatialAnchorX {
  x: number
  mode: SpatialAnchorMode
}

export function resolveSpatialAnchorX(input: ResolveSpatialAnchorXInput): ResolvedSpatialAnchorX {
  const minX = input.minX ?? 8
  const maxX = input.maxX ?? Math.max(minX, input.width - 8)
  const fromTime = input.anchorTimeSec != null ? input.timeToPixel(input.anchorTimeSec) : null
  if (fromTime != null && Number.isFinite(fromTime)) {
    return { x: clamp(fromTime, minX, maxX), mode: 'time' }
  }
  const fallbackX = input.width * (0.64 + (input.fallbackIndex * 0.05))
  return { x: clamp(fallbackX, minX, maxX), mode: 'fallback' }
}

export type SpatialGhostLifecycleState = 'entering' | 'active' | 'fading'

export interface SpatialGhostLifecycleNode {
  state: SpatialGhostLifecycleState
  firstSeenMs: number
  stateSinceMs: number
}

export type SpatialGhostLifecycleMap = Record<string, SpatialGhostLifecycleNode>

export interface SpatialGhostLifecycleOptions {
  enterDurationMs?: number
  activeDurationMs?: number
  fadeDurationMs?: number
}

const DEFAULT_GHOST_ENTER_DURATION_MS = 1200
const DEFAULT_GHOST_ACTIVE_DURATION_MS = 10_000
const DEFAULT_GHOST_FADE_DURATION_MS = 1500

function normalizeVisibleIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    ordered.push(id)
  }
  return ordered
}

export function evolveSpatialGhostLifecycle(
  previous: SpatialGhostLifecycleMap,
  visibleIdsInput: string[],
  nowMs: number,
  options?: SpatialGhostLifecycleOptions,
): SpatialGhostLifecycleMap {
  const enterDurationMs = options?.enterDurationMs ?? DEFAULT_GHOST_ENTER_DURATION_MS
  const activeDurationMs = options?.activeDurationMs ?? DEFAULT_GHOST_ACTIVE_DURATION_MS
  const fadeDurationMs = options?.fadeDurationMs ?? DEFAULT_GHOST_FADE_DURATION_MS
  const visibleIds = normalizeVisibleIds(visibleIdsInput)
  const visibleSet = new Set(visibleIds)

  const next: SpatialGhostLifecycleMap = {}
  for (const [id, node] of Object.entries(previous)) {
    next[id] = { ...node }
  }

  for (const id of visibleIds) {
    const node = next[id]
    if (!node) {
      next[id] = {
        state: 'entering',
        firstSeenMs: nowMs,
        stateSinceMs: nowMs,
      }
      continue
    }
    if (node.state === 'fading') {
      next[id] = {
        ...node,
        state: 'active',
        stateSinceMs: nowMs,
      }
    }
  }

  for (const [id, node] of Object.entries(next)) {
    if (!visibleSet.has(id) && node.state !== 'fading') {
      next[id] = {
        ...node,
        state: 'fading',
        stateSinceMs: nowMs,
      }
    }
  }

  for (const [id, node] of Object.entries(next)) {
    if (node.state === 'entering' && nowMs - node.stateSinceMs >= enterDurationMs) {
      next[id] = {
        ...node,
        state: 'active',
        stateSinceMs: nowMs,
      }
      continue
    }

    if (node.state === 'active' && nowMs - node.firstSeenMs >= activeDurationMs) {
      next[id] = {
        ...node,
        state: 'fading',
        stateSinceMs: nowMs,
      }
      continue
    }

    if (node.state === 'fading' && nowMs - node.stateSinceMs >= fadeDurationMs) {
      delete next[id]
    }
  }

  return next
}

export function spatialGhostLifecycleEquals(
  left: SpatialGhostLifecycleMap,
  right: SpatialGhostLifecycleMap,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  for (const id of leftKeys) {
    const l = left[id]
    const r = right[id]
    if (!l || !r) return false
    if (l.state !== r.state || l.firstSeenMs !== r.firstSeenMs || l.stateSinceMs !== r.stateSinceMs) {
      return false
    }
  }
  return true
}
