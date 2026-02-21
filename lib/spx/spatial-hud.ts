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
  startY: number
  coneWidth: number
  usedFallback: boolean
  anchorMode: SpatialAnchorMode
  anchorInViewport: boolean
  salience: number
}

interface BuildProbabilityConeGeometryInput {
  width: number
  height: number
  currentPrice: number
  priceToPixel: (price: number) => number | null
  timeToPixel?: (timestamp: number) => number | null
  anchorTimestampSec?: number | null
  visiblePriceRange?: { min: number; max: number } | null
  directionBias?: number
  windows: ProbabilityConeWindow[]
  startXRatio?: number
  coneWidthRatio?: number
}

const DEFAULT_START_X_RATIO = 0.82
const DEFAULT_CONE_WIDTH_RATIO = 0.16
const DEFAULT_CONE_WINDOW_MINUTES = [5, 15, 30] as const
const SPATIAL_COACH_PRICE_PATTERN = /\b([3-9]\d{3}(?:\.\d{1,2})?)\b/g
const ANCHOR_TIME_SEARCH_OFFSETS_SEC = [0, -30, 30, -60, 60, -120, 120, -300, 300, -600, 600] as const

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

function toGlobalRegex(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  return new RegExp(pattern.source, flags)
}

function resolveAnchorPriceFromContent(
  content: string,
  pattern: RegExp,
  referencePrice: number | null,
  maxDistancePoints: number,
): number | null {
  if (!content) return null
  const matcher = toGlobalRegex(pattern)
  const candidates: number[] = []
  for (const match of content.matchAll(matcher)) {
    const raw = match[1] ?? match[0]
    const parsed = Number.parseFloat(raw)
    if (Number.isFinite(parsed)) {
      candidates.push(parsed)
    }
  }
  if (candidates.length === 0) return null

  if (referencePrice != null) {
    const nearby = candidates
      .map((price) => ({ price, distance: Math.abs(price - referencePrice) }))
      .filter((candidate) => candidate.distance <= maxDistancePoints)
      .sort((left, right) => left.distance - right.distance)
    if (nearby.length > 0) {
      return nearby[0]?.price ?? null
    }
    return null
  }

  return candidates[0] ?? null
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
    timeToPixel,
    anchorTimestampSec = null,
    visiblePriceRange,
    directionBias = 0,
    windows,
    startXRatio = DEFAULT_START_X_RATIO,
    coneWidthRatio = DEFAULT_CONE_WIDTH_RATIO,
  } = input

  if (!isFinitePositive(width) || !isFinitePositive(height) || !isFinitePositive(currentPrice)) {
    return null
  }

  const fallbackStartX = clamp(width * startXRatio, 0, width)
  const coneWidth = clamp(width * coneWidthRatio, Math.min(24, width * 0.08), width * 0.35)
  const startY = safePriceToPixel(currentPrice, height, priceToPixel, visiblePriceRange)
  if (startY == null) return null

  const preparedWindows = sanitizeConeWindows(windows)
  const useFallbackWindows = preparedWindows.length === 0
  const coneWindows = useFallbackWindows
    ? buildFallbackConeWindows(currentPrice, visiblePriceRange, directionBias)
    : preparedWindows

  let startX = fallbackStartX
  let anchorMode: SpatialAnchorMode = 'fallback'
  let anchorInViewport = false
  let timeAnchoredXs: number[] | null = null
  if (timeToPixel && anchorTimestampSec != null && Number.isFinite(anchorTimestampSec)) {
    const fromStart = resolveTimeCoordinateWithTolerance(timeToPixel, anchorTimestampSec)
    if (fromStart != null && Number.isFinite(fromStart)) {
      const candidateXs: number[] = []
      let allResolved = true
      for (let index = 0; index < coneWindows.length; index += 1) {
        const windowPoint = coneWindows[index]
        const minutesForward = Number(windowPoint.minutesForward)
        const targetTimestamp = Number.isFinite(minutesForward)
          ? anchorTimestampSec + Math.max(1, Math.round(minutesForward * 60))
          : anchorTimestampSec + Math.round(((index + 1) / coneWindows.length) * 30 * 60)
        const x = resolveTimeCoordinateWithTolerance(timeToPixel, targetTimestamp)
        if (x == null || !Number.isFinite(x)) {
          allResolved = false
          break
        }
        candidateXs.push(clamp(x, 0, width))
      }
      if (allResolved && candidateXs.length === coneWindows.length) {
        anchorMode = 'time'
        anchorInViewport = fromStart >= 0 && fromStart <= width
        startX = clamp(fromStart, 0, width)
        timeAnchoredXs = candidateXs
      }
    }
  }

  const topPoints: string[] = []
  const bottomPoints: string[] = []
  const centerPoints: Array<{ x: number; y: number }> = []

  for (let index = 0; index < coneWindows.length; index += 1) {
    const windowPoint = coneWindows[index]
    const fraction = (index + 1) / coneWindows.length
    const x = timeAnchoredXs?.[index] ?? (startX + (fraction * coneWidth))
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
  const confidenceValues = coneWindows
    .map((point) => (Number.isFinite(point.confidence) ? Number(point.confidence) : null))
    .filter((value): value is number => value != null)
  const avgConfidence = confidenceValues.length > 0
    ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
    : 45
  const salience = clamp(0.38 + (avgConfidence / 100) * 0.36 + Math.abs(directionBias) * 0.18, 0.35, 1)

  return {
    path,
    centerLine,
    width,
    height,
    startX,
    startY,
    coneWidth,
    usedFallback: useFallbackWindows,
    anchorMode,
    anchorInViewport,
    salience,
  }
}

export interface ChartAxisLevelInput {
  id?: string
  price: number
  label: string
  color: string
  lineWidth?: number
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  axisLabelVisible?: boolean
  type?: string
  strength?: 'strong' | 'moderate' | 'weak' | 'dynamic' | 'critical'
  group?: string
}

interface ResolveVisibleChartLevelsOptions {
  livePrice?: number | null
  nearWindowPoints?: number
  nearLabelBudget?: number
  maxTotalLabels?: number
  minGapPoints?: number
}

export interface VisibleChartLevelsResult<T extends ChartAxisLevelInput> {
  levels: T[]
  stats: {
    inputCount: number
    dedupedCount: number
    budgetSuppressedCount: number
    collisionSuppressedCount: number
  }
}

function canonicalizeLabel(label: string): string {
  return label
    .toUpperCase()
    .replace(/^SPY\s*(?:→|->|-)\s*SPX\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function labelPriority(label: string): number {
  const normalized = label.toUpperCase()
  if (normalized.includes('ENTRY')) return 120
  if (normalized.includes('STOP')) return 118
  if (normalized.includes('TARGET')) return 110
  if (normalized.includes('PDC') || normalized.includes('PDH') || normalized.includes('PDL')) return 108
  if (normalized.includes('OPTIONS FLIP')) return 106
  if (normalized.includes('MONTHLY')) return 104
  if (normalized.includes('DAILY')) return 102
  return 80
}

function strengthPriority(strength?: ChartAxisLevelInput['strength']): number {
  if (strength === 'critical') return 26
  if (strength === 'strong') return 22
  if (strength === 'moderate') return 18
  if (strength === 'dynamic') return 15
  if (strength === 'weak') return 12
  return 10
}

function typePriority(type?: string): number {
  if (type === 'entry_zone' || type === 'stop' || type === 'target1' || type === 'target2') return 24
  if (type === 'options') return 20
  if (type === 'structural') return 18
  if (type === 'fibonacci') return 14
  if (type === 'spy_derived') return 12
  return 10
}

function levelPriority(level: ChartAxisLevelInput): number {
  const groupBonus = level.group === 'position' ? 28 : 0
  const spyPenalty = level.label.toUpperCase().includes('SPY') ? -2 : 0
  return labelPriority(level.label) + strengthPriority(level.strength) + typePriority(level.type) + groupBonus + spyPenalty
}

function withinGap(a: number, b: number, minGap: number): boolean {
  return Math.abs(a - b) < minGap
}

export function resolveVisibleChartLevels<T extends ChartAxisLevelInput>(
  levels: T[],
  options?: ResolveVisibleChartLevelsOptions,
): VisibleChartLevelsResult<T> {
  if (levels.length === 0) {
    return {
      levels: [],
      stats: {
        inputCount: 0,
        dedupedCount: 0,
        budgetSuppressedCount: 0,
        collisionSuppressedCount: 0,
      },
    }
  }

  const nearWindowPoints = options?.nearWindowPoints ?? 14
  const nearLabelBudget = options?.nearLabelBudget ?? 7
  const maxTotalLabels = options?.maxTotalLabels ?? 16
  const minGapPoints = options?.minGapPoints ?? 1.35
  const livePrice = Number.isFinite(options?.livePrice) ? Number(options?.livePrice) : null

  const dedupeMap = new Map<string, T>()
  for (const level of levels) {
    if (!Number.isFinite(level.price)) continue
    const roundedPrice = Math.round(level.price * 4) / 4
    const key = `${roundedPrice}|${canonicalizeLabel(level.label)}`
    const existing = dedupeMap.get(key)
    if (!existing || levelPriority(level) > levelPriority(existing)) {
      dedupeMap.set(key, level)
    }
  }
  const deduped = Array.from(dedupeMap.values())

  const ranked = deduped
    .map((level) => {
      const distance = livePrice == null ? 0 : Math.abs(level.price - livePrice)
      const near = livePrice != null ? distance <= nearWindowPoints : true
      const priority = levelPriority(level)
      return {
        level,
        distance,
        near,
        priority,
      }
    })
    .sort((left, right) => {
      if (left.near !== right.near) return left.near ? -1 : 1
      if (left.priority !== right.priority) return right.priority - left.priority
      if (left.distance !== right.distance) return left.distance - right.distance
      return right.level.price - left.level.price
    })

  const accepted: T[] = []
  let nearCount = 0
  let budgetSuppressedCount = 0
  let collisionSuppressedCount = 0
  for (const candidate of ranked) {
    if (accepted.length >= maxTotalLabels) {
      budgetSuppressedCount += 1
      continue
    }
    if (candidate.near && nearCount >= nearLabelBudget) {
      budgetSuppressedCount += 1
      continue
    }
    const collided = accepted.some((existing) => withinGap(existing.price, candidate.level.price, minGapPoints))
    if (collided) {
      collisionSuppressedCount += 1
      continue
    }
    accepted.push(candidate.level)
    if (candidate.near) nearCount += 1
  }

  return {
    levels: [...accepted].sort((left, right) => right.price - left.price),
    stats: {
      inputCount: levels.length,
      dedupedCount: Math.max(0, levels.length - deduped.length),
      budgetSuppressedCount,
      collisionSuppressedCount,
    },
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

interface ExtractSpatialCoachAnchorsOptions<T extends SpatialCoachAnchorInput = SpatialCoachAnchorInput> {
  dismissedIds?: Set<string>
  maxNodes?: number
  pricePattern?: RegExp
  referencePrice?: number | null
  maxDistancePoints?: number
  fallbackAnchorPrice?: (message: T) => number | null
}

export const DEFAULT_MAX_SPATIAL_COACH_NODES = 5

export function extractSpatialCoachAnchors<T extends SpatialCoachAnchorInput>(
  messages: T[],
  options?: ExtractSpatialCoachAnchorsOptions<T>,
): SpatialCoachAnchorMessage<T>[] {
  const maxNodes = options?.maxNodes ?? DEFAULT_MAX_SPATIAL_COACH_NODES
  if (maxNodes <= 0) return []

  const dismissedIds = options?.dismissedIds ?? new Set<string>()
  const pricePattern = options?.pricePattern ?? SPATIAL_COACH_PRICE_PATTERN
  const referencePrice = Number.isFinite(options?.referencePrice) ? Number(options?.referencePrice) : null
  const maxDistancePoints = Number.isFinite(options?.maxDistancePoints) ? Number(options?.maxDistancePoints) : 420
  const fallbackAnchorPrice = options?.fallbackAnchorPrice

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
    const contentAnchor = resolveAnchorPriceFromContent(
      item.message.content,
      pricePattern,
      referencePrice,
      maxDistancePoints,
    )
    const fallbackAnchor = contentAnchor == null
      ? (fallbackAnchorPrice?.(item.message) ?? null)
      : null
    const anchorPrice = contentAnchor ?? fallbackAnchor
    if (anchorPrice == null || !Number.isFinite(anchorPrice)) continue
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

export interface GammaVacuumZone {
  low: number
  high: number
  intensity: number
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

interface BuildGammaVacuumZonesOptions {
  maxZones?: number
  lowMagnitudeRatio?: number
}

export function buildGammaVacuumZones(
  gexByStrike: GammaTopographyStrikeInput[],
  currentPrice: number,
  options?: BuildGammaVacuumZonesOptions,
): GammaVacuumZone[] {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return []

  const maxZones = options?.maxZones ?? 4
  const lowMagnitudeRatio = options?.lowMagnitudeRatio ?? 0.12
  if (maxZones <= 0) return []

  const sorted = gexByStrike
    .filter((point) => Number.isFinite(point.strike) && Number.isFinite(point.gex))
    .sort((left, right) => left.strike - right.strike)

  if (sorted.length < 2) return []

  const maxAbs = Math.max(...sorted.map((point) => Math.abs(point.gex)), 0)
  if (!Number.isFinite(maxAbs) || maxAbs <= 0) return []
  const lowMagnitudeThreshold = maxAbs * lowMagnitudeRatio
  if (lowMagnitudeThreshold <= 0) return []

  const provisional: GammaVacuumZone[] = []
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const left = sorted[index]
    const right = sorted[index + 1]
    if (!left || !right) continue
    const leftAbs = Math.abs(left.gex)
    const rightAbs = Math.abs(right.gex)
    if (leftAbs > lowMagnitudeThreshold || rightAbs > lowMagnitudeThreshold) continue

    const low = Math.min(left.strike, right.strike)
    const high = Math.max(left.strike, right.strike)
    const mid = (low + high) / 2
    const avgAbs = (leftAbs + rightAbs) / 2
    const voidness = 1 - clamp(avgAbs / lowMagnitudeThreshold, 0, 1)
    const proximity = 1 / (1 + (Math.abs(mid - currentPrice) / 32))
    const intensity = clamp((voidness * 0.72) + (proximity * 0.28), 0.18, 1)

    provisional.push({ low, high, intensity })
  }

  if (provisional.length === 0) return []

  const merged: GammaVacuumZone[] = []
  for (const zone of provisional) {
    const previous = merged[merged.length - 1]
    if (previous && zone.low <= previous.high) {
      previous.high = Math.max(previous.high, zone.high)
      previous.intensity = Math.max(previous.intensity, zone.intensity)
      continue
    }
    merged.push({ ...zone })
  }

  return merged
    .sort((left, right) => {
      const leftMid = (left.low + left.high) / 2
      const rightMid = (right.low + right.high) / 2
      const leftDistance = Math.abs(leftMid - currentPrice)
      const rightDistance = Math.abs(rightMid - currentPrice)
      if (leftDistance !== rightDistance) return leftDistance - rightDistance
      return (right.high - right.low) - (left.high - left.low)
    })
    .slice(0, maxZones)
    .sort((left, right) => right.high - left.high)
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
  const fromTime = input.anchorTimeSec != null
    ? resolveTimeCoordinateWithTolerance(input.timeToPixel, input.anchorTimeSec)
    : null
  if (fromTime != null && Number.isFinite(fromTime)) {
    return { x: clamp(fromTime, minX, maxX), mode: 'time' }
  }
  const fallbackX = input.width * (0.64 + (input.fallbackIndex * 0.05))
  return { x: clamp(fallbackX, minX, maxX), mode: 'fallback' }
}

function resolveTimeCoordinateWithTolerance(
  timeToPixel: (timestamp: number) => number | null,
  timestampSec: number,
): number | null {
  for (const offset of ANCHOR_TIME_SEARCH_OFFSETS_SEC) {
    const x = timeToPixel(timestampSec + offset)
    if (x != null && Number.isFinite(x)) return x
  }
  return null
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
