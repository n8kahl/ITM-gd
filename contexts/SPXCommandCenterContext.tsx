'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import {
  SPXAnalyticsProvider,
  type SPXAnalyticsContextState,
  type SPXLevelsDataQuality,
} from '@/contexts/spx/SPXAnalyticsContext'
import { SPXCoachProvider, type SPXCoachContextState } from '@/contexts/spx/SPXCoachContext'
import { SPXFlowProvider, type SPXFlowContextState } from '@/contexts/spx/SPXFlowContext'
import { SPXPriceProvider, type SPXPriceContextState } from '@/contexts/spx/SPXPriceContext'
import {
  SPXSetupProvider,
  type SPXActiveTradePlan,
  type SPXChartAnnotation,
  type SPXSetupContextState,
} from '@/contexts/spx/SPXSetupContext'
import { postSPX, postSPXStream } from '@/hooks/use-spx-api'
import {
  usePriceStream,
  type PriceStreamConnectionStatus,
  type PriceStreamFeedHealth,
  type RealtimeSocketMessage,
} from '@/hooks/use-price-stream'
import { useSPXSnapshot } from '@/hooks/use-spx-snapshot'
import { enrichCoachDecisionExplainability } from '@/lib/spx/coach-explainability'
import { distanceToStopPoints, isFlowDivergence, summarizeFlowAlignment } from '@/lib/spx/coach-context'
import { enrichSPXSetupWithDecisionEngine } from '@/lib/spx/decision-engine'
import { normalizeSPXRealtimeEvent } from '@/lib/spx/event-schema'
import { buildSetupDisplayPolicy, DEFAULT_PRIMARY_SETUP_LIMIT } from '@/lib/spx/setup-display-policy'
import {
  mergeActionableSetups,
  mergeSetup,
  setupLifecycleEpoch,
} from '@/lib/spx/setup-stream-state'
import {
  resolveSPXFeedHealth,
  formatSPXFeedFallbackReasonCode,
  type SPXFeedFallbackReasonCode,
  type SPXFeedFallbackStage,
} from '@/lib/spx/feed-health'
import { hasSetupPriceProgressionConflict } from '@/lib/spx/setup-viability'
import {
  createSPXTradeJournalArtifact,
  persistSPXTradeJournalArtifact,
} from '@/lib/spx/trade-journal-capture'
import { createSPXMarketDataOrchestrator } from '@/lib/spx/market-data-orchestrator'
import { SPX_TELEMETRY_EVENT, startSPXPerfTimer, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import { getEnabledSPXUXFlagKeys, getSPXUXFlags, type SPXUXFlags } from '@/lib/spx/flags'
import type {
  BasisState,
  ClusterZone,
  CoachDecisionBrief,
  CoachMessage,
  ContractRecommendation,
  FibLevel,
  FlowEvent,
  FlowWindowAggregation,
  GEXProfile,
  LevelCategory,
  PredictionState,
  Regime,
  Setup,
  SPXStandbyGuidance,
  SpyImpactState,
  SPXLevel,
} from '@/lib/types/spx-command-center'

type ChartTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D'
type ChartAnnotation = SPXChartAnnotation

interface RealtimeMicrobar {
  symbol: string
  interval: '1s' | '5s'
  bucketStartMs: number
  bucketEndMs: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  trades: number
  finalized: boolean
  timestamp: string
}

type TradeMode = 'scan' | 'in_trade'
type ExecutionFillSide = 'entry' | 'partial' | 'exit'
type ExecutionFillSource = 'proxy' | 'manual' | 'broker_tradier' | 'broker_other'
type ExecutionTransitionPhase = 'triggered' | 'target1_hit' | 'target2_hit' | 'invalidated' | 'expired'
const E2E_ALLOW_STALE_ENTRY = process.env.NEXT_PUBLIC_SPX_E2E_ALLOW_STALE_ENTRY === 'true'

interface ExecutionFillReference {
  transitionEventId: string
  phase: ExecutionTransitionPhase
  reason: 'entry' | 'stop' | 'target1' | 'target2'
  price: number
  timestamp: string
}

interface ExecutionFillReconciliation {
  persisted: boolean
  tableAvailable: boolean
  fillId: number | null
  setupId: string
  sessionDate: string
  side: ExecutionFillSide
  phase: ExecutionTransitionPhase | null
  source: ExecutionFillSource
  fillPrice: number
  fillQuantity: number | null
  executedAt: string
  direction: Setup['direction'] | null
  reference: ExecutionFillReference | null
  slippagePoints: number | null
  slippageBps: number | null
}

interface SPXBrokerFillEventDetail {
  setupId?: string
  side?: ExecutionFillSide
  fillPrice?: number
  fillQuantity?: number
  phase?: ExecutionTransitionPhase
  direction?: Setup['direction']
  source?: ExecutionFillSource | 'tradier'
  executedAt?: string
  transitionEventId?: string
  brokerOrderId?: string
  brokerExecutionId?: string
  metadata?: Record<string, unknown>
}

interface SPXCommandCenterState {
  dataHealth: 'healthy' | 'degraded' | 'stale'
  dataHealthMessage: string | null
  feedFallbackStage: SPXFeedFallbackStage
  feedFallbackReasonCode: SPXFeedFallbackReasonCode
  blockTradeEntryByFeedTrust: boolean
  levelsDataQuality: SPXLevelsDataQuality | null
  spxPrice: number
  spxTickTimestamp: string | null
  spxPriceAgeMs: number | null
  spxPriceSource: 'tick' | 'poll' | 'snapshot' | null
  spyPrice: number
  snapshotGeneratedAt: string | null
  priceStreamConnected: boolean
  priceStreamConnectionStatus: PriceStreamConnectionStatus
  priceStreamFeedHealth: PriceStreamFeedHealth | null
  priceStreamError: string | null
  basis: BasisState | null
  spyImpact: SpyImpactState | null
  regime: Regime | null
  prediction: PredictionState | null
  levels: SPXLevel[]
  clusterZones: ClusterZone[]
  fibLevels: FibLevel[]
  gexProfile: { spx: GEXProfile; spy: GEXProfile; combined: GEXProfile } | null
  activeSetups: Setup[]
  standbyGuidance: SPXStandbyGuidance | null
  coachMessages: CoachMessage[]
  coachDecision: CoachDecisionBrief | null
  coachDecisionStatus: 'idle' | 'loading' | 'ready' | 'error'
  coachDecisionError: string | null
  uxFlags: SPXUXFlags
  selectedSetup: Setup | null
  tradeMode: TradeMode
  inTradeSetup: Setup | null
  inTradeSetupId: string | null
  selectedSetupContract: ContractRecommendation | null
  inTradeContract: ContractRecommendation | null
  tradeEntryPrice: number | null
  tradeEnteredAt: string | null
  tradePnlPoints: number | null
  tradeEntryContractMid: number | null
  tradeCurrentContractMid: number | null
  tradePnlDollars: number | null
  selectedTimeframe: ChartTimeframe
  setChartTimeframe: (timeframe: ChartTimeframe) => void
  visibleLevelCategories: Set<LevelCategory>
  showSPYDerived: boolean
  chartAnnotations: ChartAnnotation[]
  flowEvents: FlowEvent[]
  flowAggregation: FlowWindowAggregation | null
  latestMicrobar: RealtimeMicrobar | null
  isLoading: boolean
  error: Error | null
  selectSetup: (setup: Setup | null) => void
  setSetupContractChoice: (setup: Setup | null, contract: ContractRecommendation | null) => void
  enterTrade: (setup?: Setup | null) => void
  exitTrade: () => void
  toggleLevelCategory: (category: LevelCategory) => void
  toggleSPYDerived: () => void
  requestContractRecommendation: (setup: Setup) => Promise<ContractRecommendation | null>
  sendCoachMessage: (prompt: string, setupId?: string | null) => Promise<CoachMessage>
  requestCoachDecision: (input?: {
    setupId?: string | null
    question?: string
    forceRefresh?: boolean
    surface?: string
  }) => Promise<CoachDecisionBrief | null>
}

const ALL_CATEGORIES: LevelCategory[] = ['structural', 'tactical', 'intraday', 'options', 'spy_derived', 'fibonacci']
const ACTIONABLE_SETUP_STATUSES: ReadonlySet<Setup['status']> = new Set(['forming', 'ready', 'triggered'])
const IMMEDIATELY_ACTIONABLE_STATUSES: ReadonlySet<Setup['status']> = new Set(['ready', 'triggered'])
const ENTERABLE_SETUP_STATUSES: ReadonlySet<Setup['status']> = new Set(['ready', 'triggered'])
const SNAPSHOT_DELAY_HEALTH_MS = 12_000
const TRADE_FOCUS_STORAGE_KEY = 'spx_command_center:trade_focus'
const SPX_PUBLIC_CHANNELS = ['setups:update', 'coach:message', 'price:SPX', 'flow:alert'] as const
const PROACTIVE_COACH_COOLDOWN_MS = 45_000
const PROACTIVE_FLOW_DIVERGENCE_THRESHOLD = 42
const PROACTIVE_STOP_DISTANCE_THRESHOLD = 3
const CONTRACT_ENDPOINT_UNAVAILABLE_BACKOFF_MS = 60_000
const COACH_DECISION_FAILURE_BACKOFF_BASE_MS = 4_000
const COACH_DECISION_FAILURE_BACKOFF_MAX_MS = 60_000
const COACH_DECISION_RATE_LIMIT_BACKOFF_MS = 15_000
const COACH_DECISION_AUTO_MIN_REFRESH_MS = 2_500
const SETUP_TRIGGER_TOAST_COOLDOWN_MS = 90_000
const SETUP_TRIGGER_BROWSER_COOLDOWN_MS = 180_000
const SETUP_STATUS_PRIORITY: Record<Setup['status'], number> = {
  triggered: 0,
  ready: 1,
  forming: 2,
  invalidated: 3,
  expired: 4,
}
const SETUP_TIER_PRIORITY: Record<NonNullable<Setup['tier']>, number> = {
  sniper_primary: 0,
  sniper_secondary: 1,
  watchlist: 2,
  hidden: 3,
}
const REALTIME_FLOW_EVENT_LIMIT = 80

function toEpoch(value: string | null | undefined): number {
  if (!value) return 0
  const epoch = Date.parse(value)
  return Number.isFinite(epoch) ? epoch : 0
}

function parseContractResponseMessage(payload: string): string {
  if (!payload) return ''
  try {
    const parsed = JSON.parse(payload) as { message?: unknown; error?: unknown }
    if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
      return parsed.message
    }
    if (typeof parsed.error === 'string' && parsed.error.trim().length > 0) {
      return parsed.error
    }
  } catch {
    // Payload might be plain text/HTML. Fall back below.
  }
  return payload
}

function isContractEndpointUnavailableMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  if (!normalized) return false
  if (normalized.includes('missing spx endpoint path')) return true
  if (normalized.includes('unable to reach spx backend endpoint')) return true
  return normalized.includes('contract-select')
    && normalized.includes('route')
    && normalized.includes('not found')
}

function rankSetups(setups: Setup[]): Setup[] {
  return [...setups].sort((a, b) => {
    const statusDelta = SETUP_STATUS_PRIORITY[a.status] - SETUP_STATUS_PRIORITY[b.status]
    if (statusDelta !== 0) return statusDelta
    const tierDelta = (SETUP_TIER_PRIORITY[a.tier || 'hidden'] ?? 3) - (SETUP_TIER_PRIORITY[b.tier || 'hidden'] ?? 3)
    if (tierDelta !== 0) return tierDelta
    const evDelta = (b.evR || 0) - (a.evR || 0)
    if (evDelta !== 0) return evDelta
    const scoreDelta = (b.score || 0) - (a.score || 0)
    if (scoreDelta !== 0) return scoreDelta
    if ((a.rank ?? Number.MAX_SAFE_INTEGER) !== (b.rank ?? Number.MAX_SAFE_INTEGER)) {
      return (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER)
    }
    if (b.confluenceScore !== a.confluenceScore) return b.confluenceScore - a.confluenceScore
    if (b.probability !== a.probability) return b.probability - a.probability

    const recencyA = setupLifecycleEpoch(a)
    const recencyB = setupLifecycleEpoch(b)
    if (recencyB !== recencyA) return recencyB - recencyA

    return a.id.localeCompare(b.id)
  })
}

function roundTo(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals))
}

function parseFlowEventTimestamp(input: unknown): string | null {
  if (typeof input !== 'string' || input.trim().length === 0) return null
  const parsed = Date.parse(input)
  if (!Number.isFinite(parsed)) return null
  return input
}

function mergeFlowEvents(existing: FlowEvent[], incoming: FlowEvent[]): FlowEvent[] {
  if (incoming.length === 0) {
    return [...existing]
      .sort((a, b) => toEpoch(b.timestamp) - toEpoch(a.timestamp))
      .slice(0, REALTIME_FLOW_EVENT_LIMIT)
  }

  const deduped = new Map<string, FlowEvent>()
  for (const event of [...incoming, ...existing]) {
    deduped.set(event.id, event)
  }

  return Array.from(deduped.values())
    .sort((a, b) => toEpoch(b.timestamp) - toEpoch(a.timestamp))
    .slice(0, REALTIME_FLOW_EVENT_LIMIT)
}

function parseRealtimeFlowEvent(message: RealtimeSocketMessage): FlowEvent | null {
  if (message.type !== 'spx_flow') return null
  const payload = message.data
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null

  const typeRaw = (payload as { type?: unknown }).type
  const symbolRaw = (payload as { symbol?: unknown }).symbol
  const directionRaw = (payload as { direction?: unknown }).direction
  const strike = toFiniteNumber((payload as { strike?: unknown }).strike)
  const expiry = typeof (payload as { expiry?: unknown }).expiry === 'string'
    ? (payload as { expiry: string }).expiry
    : null
  const size = toFiniteNumber((payload as { size?: unknown }).size)
  const premium = toFiniteNumber((payload as { premium?: unknown }).premium)
  const timestamp = parseFlowEventTimestamp(
    (payload as { timestamp?: unknown }).timestamp
      ?? message.timestamp
      ?? new Date().toISOString(),
  )

  if (typeRaw !== 'sweep' && typeRaw !== 'block') return null
  if (symbolRaw !== 'SPX' && symbolRaw !== 'SPY') return null
  if (directionRaw !== 'bullish' && directionRaw !== 'bearish') return null
  if (strike == null || premium == null || size == null) return null
  if (!expiry || !timestamp) return null

  const id = `${symbolRaw}:${typeRaw}:${directionRaw}:${strike}:${expiry}:${size}:${premium}:${timestamp}`
  return {
    id,
    type: typeRaw,
    symbol: symbolRaw,
    strike,
    expiry,
    size,
    direction: directionRaw,
    premium,
    timestamp,
  }
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function calculateAgeMs(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null
  const parsed = Date.parse(timestamp)
  if (!Number.isFinite(parsed)) return null
  return Math.max(Date.now() - parsed, 0)
}

function contractSignature(contract: ContractRecommendation | null | undefined): string | null {
  if (!contract) return null
  return [
    contract.type,
    contract.strike,
    contract.expiry,
    contract.description,
  ].join('|')
}

function contractMid(contract: ContractRecommendation | null | undefined): number | null {
  if (!contract) return null
  if (typeof contract.premiumMid === 'number' && Number.isFinite(contract.premiumMid)) {
    return contract.premiumMid / 100
  }
  if (Number.isFinite(contract.bid) && Number.isFinite(contract.ask) && contract.bid > 0 && contract.ask > 0) {
    return (contract.bid + contract.ask) / 2
  }
  if (Number.isFinite(contract.ask) && contract.ask > 0) return contract.ask
  if (Number.isFinite(contract.bid) && contract.bid > 0) return contract.bid
  return null
}

function findContractBySignature(setup: Setup | null, signature: string | null): ContractRecommendation | null {
  if (!setup || !signature) return null
  const primary = setup.recommendedContract ? [setup.recommendedContract] : []
  const alternatives = Array.isArray(setup.recommendedContract?.alternatives)
    ? setup.recommendedContract.alternatives
    : []
  const candidates = [...primary, ...alternatives.map((alt) => ({
    ...alt,
    gamma: setup.recommendedContract?.gamma ?? 0,
    theta: setup.recommendedContract?.theta ?? 0,
    vega: setup.recommendedContract?.vega ?? 0,
    riskReward: setup.recommendedContract?.riskReward ?? 0,
    expectedPnlAtTarget1: setup.recommendedContract?.expectedPnlAtTarget1 ?? 0,
    expectedPnlAtTarget2: setup.recommendedContract?.expectedPnlAtTarget2 ?? 0,
    reasoning: setup.recommendedContract?.reasoning ?? 'Alternative candidate',
    premiumMid: typeof alt.ask === 'number' && typeof alt.bid === 'number' ? ((alt.ask + alt.bid) / 2) * 100 : undefined,
    premiumAsk: typeof alt.ask === 'number' ? alt.ask * 100 : undefined,
  } as ContractRecommendation))]
  return candidates.find((candidate) => contractSignature(candidate) === signature) || null
}

interface PersistedTradeFocusState {
  setupId: string
  entryPrice: number | null
  enteredAt: string
  contract: ContractRecommendation | null
  entryContractMid: number | null
}

function loadPersistedTradeFocus(): PersistedTradeFocusState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(TRADE_FOCUS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedTradeFocusState>
    if (!parsed || typeof parsed.setupId !== 'string' || parsed.setupId.length === 0) return null
    if (typeof parsed.enteredAt !== 'string' || parsed.enteredAt.length === 0) return null
    return {
      setupId: parsed.setupId,
      entryPrice: typeof parsed.entryPrice === 'number' && Number.isFinite(parsed.entryPrice)
        ? parsed.entryPrice
        : null,
      enteredAt: parsed.enteredAt,
      contract: parsed.contract && typeof parsed.contract === 'object'
        ? parsed.contract as ContractRecommendation
        : null,
      entryContractMid: typeof parsed.entryContractMid === 'number' && Number.isFinite(parsed.entryContractMid)
        ? parsed.entryContractMid
        : null,
    }
  } catch {
    return null
  }
}

function persistTradeFocusState(state: PersistedTradeFocusState | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!state) {
      window.localStorage.removeItem(TRADE_FOCUS_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(TRADE_FOCUS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore localStorage failures.
  }
}

function parseRealtimeMicrobar(message: RealtimeSocketMessage): RealtimeMicrobar | null {
  if (message.type !== 'microbar') return null
  if (typeof message.symbol !== 'string' || message.symbol.toUpperCase() !== 'SPX') return null

  const interval = message.interval === '5s' ? '5s' : message.interval === '1s' ? '1s' : null
  const bucketStartMs = toFiniteNumber(message.bucketStartMs)
  const bucketEndMs = toFiniteNumber(message.bucketEndMs)
  const open = toFiniteNumber(message.open)
  const high = toFiniteNumber(message.high)
  const low = toFiniteNumber(message.low)
  const close = toFiniteNumber(message.close)
  const volume = toFiniteNumber(message.volume)
  const trades = toFiniteNumber(message.trades)
  const timestamp = typeof message.timestamp === 'string' ? message.timestamp : null
  if (
    !interval
    || bucketStartMs == null
    || bucketEndMs == null
    || open == null
    || high == null
    || low == null
    || close == null
    || volume == null
    || trades == null
    || !timestamp
  ) {
    return null
  }

  return {
    symbol: 'SPX',
    interval,
    bucketStartMs,
    bucketEndMs,
    open,
    high,
    low,
    close,
    volume,
    trades,
    finalized: message.finalized === true,
    timestamp,
  }
}

function isCoachType(value: unknown): value is CoachMessage['type'] {
  return value === 'pre_trade' || value === 'in_trade' || value === 'behavioral' || value === 'post_trade' || value === 'alert'
}

function isCoachPriority(value: unknown): value is CoachMessage['priority'] {
  return value === 'alert' || value === 'setup' || value === 'guidance' || value === 'behavioral'
}

function humanizeSetupType(type: string): string {
  return type
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function setupAlertSummary(setup: Setup): string {
  const side = setup.direction === 'bullish' ? 'LONG' : 'SHORT'
  const entry = `${setup.entryZone.low.toFixed(2)}-${setup.entryZone.high.toFixed(2)}`
  return `${side} ${humanizeSetupType(setup.type)} | entry ${entry} | stop ${setup.stop.toFixed(2)} | T1 ${setup.target1.price.toFixed(2)} | T2 ${setup.target2.price.toFixed(2)}`
}

type ExecutionSlippageSide = ExecutionFillSide

function computeDirectionalSlippagePoints(input: {
  side: ExecutionSlippageSide
  direction: Setup['direction']
  referencePrice: number
  actualPrice: number
}): number {
  const sideMultiplier = input.side === 'entry' ? 1 : -1
  const directionalMove = input.direction === 'bullish'
    ? input.actualPrice - input.referencePrice
    : input.referencePrice - input.actualPrice
  return roundTo(directionalMove * sideMultiplier, 2)
}

function signedPointLabel(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

function resolveExitReference(setup: Setup, exitPrice: number): { label: string; price: number } {
  if (setup.status === 'invalidated') {
    return { label: 'stop', price: setup.stop }
  }
  if (setup.status === 'expired') {
    return { label: setup.target2.label || 'T2', price: setup.target2.price }
  }

  const candidates = [
    { label: 'stop', price: setup.stop },
    { label: setup.target1.label || 'T1', price: setup.target1.price },
    { label: setup.target2.label || 'T2', price: setup.target2.price },
  ]

  return candidates.reduce((best, candidate) => (
    Math.abs(candidate.price - exitPrice) < Math.abs(best.price - exitPrice) ? candidate : best
  ))
}

function defaultPhaseForSide(side: ExecutionFillSide): ExecutionTransitionPhase {
  if (side === 'entry') return 'triggered'
  if (side === 'partial') return 'target1_hit'
  return 'target2_hit'
}

function phaseLabel(phase: ExecutionTransitionPhase | null | undefined): string {
  if (!phase) return 'reference'
  return phase.replace(/_/g, ' ')
}

function sourceLabel(source: ExecutionFillSource): string {
  if (source === 'broker_tradier') return 'Tradier'
  if (source === 'broker_other') return 'Broker'
  if (source === 'manual') return 'Manual'
  return 'Proxy'
}

const SPXCommandCenterContext = createContext<SPXCommandCenterState | null>(null)

export function SPXCommandCenterProvider({ children }: { children: React.ReactNode }) {
  const { session } = useMemberAuth()
  const {
    snapshot: snapshotData,
    isDegraded: snapshotIsDegraded,
    degradedMessage: snapshotDegradedMessage,
    isLoading,
    error: snapshotError,
    mutate: mutateSnapshot,
  } = useSPXSnapshot()
  const accessToken = session?.access_token || null
  const [selectedSetupId, setSelectedSetupId] = useState<string | null>(null)
  const [inTradeSetupId, setInTradeSetupId] = useState<string | null>(null)
  const [selectedContractBySetupId, setSelectedContractBySetupId] = useState<Record<string, ContractRecommendation>>({})
  const [inTradeContract, setInTradeContract] = useState<ContractRecommendation | null>(null)
  const [tradeEntryPrice, setTradeEntryPrice] = useState<number | null>(null)
  const [tradeEntryContractMid, setTradeEntryContractMid] = useState<number | null>(null)
  const [tradeEnteredAt, setTradeEnteredAt] = useState<string | null>(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChartTimeframe>('1m')
  const [visibleLevelCategories, setVisibleLevelCategories] = useState<Set<LevelCategory>>(new Set(ALL_CATEGORIES))
  const [showSPYDerived, setShowSPYDerived] = useState(true)
  const [snapshotRequestLate, setSnapshotRequestLate] = useState(false)
  const [ephemeralCoachMessages, setEphemeralCoachMessages] = useState<CoachMessage[]>([])
  const [coachDecision, setCoachDecision] = useState<CoachDecisionBrief | null>(null)
  const [coachDecisionStatus, setCoachDecisionStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [coachDecisionError, setCoachDecisionError] = useState<string | null>(null)
  const [realtimeSetups, setRealtimeSetups] = useState<Setup[]>([])
  const [realtimeFlowEvents, setRealtimeFlowEvents] = useState<FlowEvent[]>([])
  const [setupTriggerNotificationsEnabled, setSetupTriggerNotificationsEnabled] = useState(true)
  const [latestMicrobar, setLatestMicrobar] = useState<RealtimeMicrobar | null>(null)
  const selectedSetupIdRef = useRef<string | null>(null)
  const inTradeSetupIdRef = useRef<string | null>(null)
  const tradeModeRef = useRef<TradeMode>('scan')
  const selectedSetupContractRef = useRef<ContractRecommendation | null>(null)
  const inTradeContractRef = useRef<ContractRecommendation | null>(null)
  const coachDecisionRef = useRef<CoachDecisionBrief | null>(null)
  const coachDecisionStatusRef = useRef<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const inTradeSetupRef = useRef<Setup | null>(null)
  const coachDecisionRequestSequenceRef = useRef(0)
  const coachDecisionLastRequestAtRef = useRef(0)
  const coachDecisionLastRequestKeyRef = useRef<string | null>(null)
  const pageToFirstActionableStopperRef = useRef<null | ((payload?: Record<string, unknown>) => number | null)>(null)
  const pageToFirstSetupSelectStopperRef = useRef<null | ((payload?: Record<string, unknown>) => number | null)>(null)
  const hasTrackedFirstActionableRef = useRef(false)
  const hasTrackedFirstSetupSelectRef = useRef(false)
  const hasTrackedPageViewRef = useRef(false)
  const lastFeedTrustTransitionRef = useRef<string | null>(null)
  const activeSetupsRef = useRef<Setup[]>([])
  const proactiveCooldownByKeyRef = useRef<Record<string, number>>({})
  const setupToastCooldownByKeyRef = useRef<Record<string, number>>({})
  const setupBrowserCooldownByKeyRef = useRef<Record<string, number>>({})
  const previousSetupStatusByIdRef = useRef<Record<string, Setup['status']>>({})
  const contractEndpointModeRef = useRef<'unknown' | 'get' | 'post' | 'unavailable'>('unknown')
  const contractEndpointUnavailableUntilRef = useRef(0)
  const contractSetupUnavailableUntilRef = useRef<Record<string, number>>({})
  const coachDecisionFailureCountRef = useRef(0)
  const coachDecisionBackoffUntilRef = useRef(0)
  const legacyPriceStateRef = useRef<SPXPriceContextState | null>(null)
  const legacyAnalyticsStateRef = useRef<SPXAnalyticsContextState | null>(null)
  const legacyCoachStateRef = useRef<SPXCoachContextState | null>(null)
  const legacyFlowStateRef = useRef<SPXFlowContextState | null>(null)
  const legacySetupStateRef = useRef<SPXSetupContextState | null>(null)
  const marketDataOrchestratorRef = useRef(createSPXMarketDataOrchestrator())
  const previousStreamConnectedRef = useRef(false)
  const uxFlags = useMemo(() => getSPXUXFlags(), [])

  useEffect(() => {
    const persisted = loadPersistedTradeFocus()
    if (!persisted) return
    setInTradeSetupId(persisted.setupId)
    setTradeEntryPrice(persisted.entryPrice)
    setTradeEntryContractMid(persisted.entryContractMid)
    setInTradeContract(persisted.contract || null)
    setTradeEnteredAt(persisted.enteredAt)
    setSelectedSetupId((current) => current || persisted.setupId)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    void (async () => {
      try {
        const response = await fetch('/api/members/dashboard/notification-preferences', {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) return
        const payload = await response.json() as {
          success?: boolean
          data?: { setups?: boolean }
        }
        if (!active || payload.success !== true) return
        setSetupTriggerNotificationsEnabled(payload.data?.setups !== false)
      } catch {
        // Keep safe default enabled state.
      }
    })()

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  const handleRealtimeMessage = useCallback((message: RealtimeSocketMessage) => {
    const normalizedRealtimeEvent = normalizeSPXRealtimeEvent(message)
    marketDataOrchestratorRef.current.ingest(normalizedRealtimeEvent)

    const microbar = parseRealtimeMicrobar(message)
    if (microbar) {
      setLatestMicrobar(microbar)
      return
    }

    if (message.type === 'spx_setup') {
      const payload = message.data
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return
      const setup = (payload as { setup?: unknown }).setup
      if (!setup || typeof setup !== 'object' || Array.isArray(setup)) return

      const setupCandidate = setup as Setup
      if (typeof setupCandidate.id !== 'string' || setupCandidate.id.length === 0) return
      const action = typeof (payload as { action?: unknown }).action === 'string'
        ? (payload as { action: string }).action
        : 'updated'
      const transition = (payload as { transition?: unknown }).transition
      if (transition && typeof transition === 'object' && !Array.isArray(transition)) {
        const fromPhase = typeof (transition as { fromPhase?: unknown }).fromPhase === 'string'
          ? (transition as { fromPhase: string }).fromPhase
          : null
        const toPhase = typeof (transition as { toPhase?: unknown }).toPhase === 'string'
          ? (transition as { toPhase: string }).toPhase
          : null
        const reason = typeof (transition as { reason?: unknown }).reason === 'string'
          ? (transition as { reason: string }).reason
          : null

        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SETUP_TRANSITION_RECEIVED, {
          setupId: setupCandidate.id,
          action,
          fromPhase,
          toPhase,
          reason,
        })
      }
      if (setupCandidate.status === 'invalidated') {
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SETUP_INVALIDATED, {
          setupId: setupCandidate.id,
          reason: setupCandidate.invalidationReason || 'unknown',
          statusUpdatedAt: setupCandidate.statusUpdatedAt || null,
        })
      }

      setRealtimeSetups((previous) => {
        const map = new Map(previous.map((item) => [item.id, item]))
        if (action === 'expired' || setupCandidate.status === 'expired' || setupCandidate.status === 'invalidated') {
          map.delete(setupCandidate.id)
          return rankSetups(Array.from(map.values()))
        }

        const merged = mergeSetup(map.get(setupCandidate.id), setupCandidate)
        if (ACTIONABLE_SETUP_STATUSES.has(merged.status)) {
          map.set(merged.id, merged)
        } else {
          map.delete(merged.id)
        }
        return rankSetups(Array.from(map.values()))
      })
      return
    }

    const flowEvent = parseRealtimeFlowEvent(message)
    if (flowEvent) {
      setRealtimeFlowEvents((previous) => mergeFlowEvents(previous, [flowEvent]))
      return
    }

    if (message.type === 'spx_coach') {
      const payload = message.data
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return
      const content = typeof (payload as { content?: unknown }).content === 'string'
        ? (payload as { content: string }).content.trim()
        : ''
      if (!content) return

      const payloadStructuredData = (payload as { structuredData?: unknown }).structuredData
      const normalizedStructuredData = payloadStructuredData && typeof payloadStructuredData === 'object' && !Array.isArray(payloadStructuredData)
        ? (payloadStructuredData as Record<string, unknown>)
        : {}
      const timestamp = typeof (payload as { timestamp?: unknown }).timestamp === 'string'
        ? (payload as { timestamp: string }).timestamp
        : (typeof message.timestamp === 'string' ? message.timestamp : new Date().toISOString())
      const setupId = typeof (payload as { setupId?: unknown }).setupId === 'string'
        ? (payload as { setupId: string }).setupId
        : null
      const messageId = typeof (payload as { id?: unknown }).id === 'string' && (payload as { id: string }).id.trim().length > 0
        ? (payload as { id: string }).id
        : `coach_ws_${timestamp}_${setupId || 'global'}_${content.slice(0, 24)}`

      const coachMessage: CoachMessage = {
        id: messageId,
        type: isCoachType((payload as { type?: unknown }).type) ? (payload as { type: CoachMessage['type'] }).type : 'behavioral',
        priority: isCoachPriority((payload as { priority?: unknown }).priority)
          ? (payload as { priority: CoachMessage['priority'] }).priority
          : 'guidance',
        setupId,
        content,
        structuredData: {
          ...normalizedStructuredData,
          source: typeof normalizedStructuredData.source === 'string' ? normalizedStructuredData.source : 'ws',
          transport: 'websocket',
          channel: typeof message.channel === 'string' ? message.channel : 'coach:message',
        },
        timestamp,
      }

      setEphemeralCoachMessages((previous) => {
        const deduped = new Map<string, CoachMessage>()
        for (const messageItem of [coachMessage, ...previous]) {
          if (!messageItem?.id) continue
          deduped.set(messageItem.id, messageItem)
        }
        return Array.from(deduped.values()).slice(0, 80)
      })
    }
  }, [])

  const stream = usePriceStream(['SPX', 'SPY'], true, accessToken, {
    channels: [...SPX_PUBLIC_CHANNELS],
    onMessage: handleRealtimeMessage,
  })

  useEffect(() => {
    if (stream.isConnected && !previousStreamConnectedRef.current) {
      marketDataOrchestratorRef.current.clearSequenceGap()
    }
    if (!stream.isConnected && previousStreamConnectedRef.current) {
      marketDataOrchestratorRef.current.reset()
    }
    previousStreamConnectedRef.current = stream.isConnected
  }, [stream.isConnected])

  useEffect(() => {
    const snapshotEpochMs = toEpoch(snapshotData?.generatedAt) || Date.now()
    const snapshotSetups = (snapshotData?.setups || []).filter((setup) => ACTIONABLE_SETUP_STATUSES.has(setup.status))
    setRealtimeSetups((previous) => mergeActionableSetups(previous, snapshotSetups, { nowMs: snapshotEpochMs }))
  }, [snapshotData?.generatedAt, snapshotData?.setups])

  useEffect(() => {
    const snapshotFlow = snapshotData?.flow || []
    setRealtimeFlowEvents((previous) => mergeFlowEvents(previous, snapshotFlow))
  }, [snapshotData?.flow])

  const flowEvents = useMemo(
    () => mergeFlowEvents(realtimeFlowEvents, snapshotData?.flow || []),
    [realtimeFlowEvents, snapshotData?.flow],
  )
  const currentSpxPriceForSetupValidation = stream.prices.get('SPX')?.price ?? snapshotData?.basis?.spxPrice ?? 0
  const activeSetups = useMemo(() => {
    const nowMs = toEpoch(snapshotData?.generatedAt) || Date.now()
    const enriched = realtimeSetups.map((setup) => enrichSPXSetupWithDecisionEngine(setup, {
      regime: snapshotData?.regime?.regime || null,
      prediction: snapshotData?.prediction || null,
      basis: snapshotData?.basis || null,
      gex: snapshotData?.gex?.combined || null,
      flowEvents,
      nowMs,
    }))
    const filtered = enriched.filter((setup) => !hasSetupPriceProgressionConflict(setup, currentSpxPriceForSetupValidation))
    return rankSetups(filtered)
  }, [
    currentSpxPriceForSetupValidation,
    flowEvents,
    realtimeSetups,
    snapshotData?.basis,
    snapshotData?.generatedAt,
    snapshotData?.gex?.combined,
    snapshotData?.prediction,
    snapshotData?.regime?.regime,
  ])
  const allLevels = useMemo(() => snapshotData?.levels || [], [snapshotData?.levels])
  const inTradeSetup = useMemo(
    () => (inTradeSetupId ? activeSetups.find((setup) => setup.id === inTradeSetupId) || null : null),
    [activeSetups, inTradeSetupId],
  )
  const tradeMode: TradeMode = inTradeSetupId ? 'in_trade' : 'scan'

  useEffect(() => {
    activeSetupsRef.current = activeSetups
  }, [activeSetups])

  useEffect(() => {
    coachDecisionRef.current = coachDecision
  }, [coachDecision])

  useEffect(() => {
    coachDecisionStatusRef.current = coachDecisionStatus
  }, [coachDecisionStatus])

  useEffect(() => {
    selectedSetupIdRef.current = selectedSetupId || null
    inTradeSetupIdRef.current = inTradeSetupId || null
    tradeModeRef.current = tradeMode
  }, [
    inTradeSetupId,
    selectedSetupId,
    tradeMode,
  ])

  useEffect(() => {
    inTradeSetupRef.current = inTradeSetup
  }, [inTradeSetup])

  useEffect(() => {
    if (inTradeSetupId) return

    const selectedStillExists = selectedSetupId
      ? activeSetups.some((setup) => setup.id === selectedSetupId)
      : false
    if (selectedStillExists) return

    const fallback =
      activeSetups.find((setup) => IMMEDIATELY_ACTIONABLE_STATUSES.has(setup.status))
      || activeSetups[0]
      || null
    const nextSelectedId = fallback?.id || null
    if (nextSelectedId === selectedSetupId) return
    setSelectedSetupId(nextSelectedId)
  }, [activeSetups, inTradeSetupId, selectedSetupId])

  const selectedSetup = useMemo(() => {
    if (inTradeSetupId) {
      const lockedSetup = activeSetups.find((setup) => setup.id === inTradeSetupId)
      if (lockedSetup) return lockedSetup
    }

    const defaultSetup =
      activeSetups.find((setup) => IMMEDIATELY_ACTIONABLE_STATUSES.has(setup.status)) ||
      activeSetups[0] ||
      null
    if (!selectedSetupId) return defaultSetup
    return activeSetups.find((setup) => setup.id === selectedSetupId) || defaultSetup
  }, [activeSetups, inTradeSetupId, selectedSetupId])
  const alertDisplayPolicy = useMemo(() => buildSetupDisplayPolicy({
    setups: activeSetups,
    regime: snapshotData?.regime?.regime || null,
    prediction: snapshotData?.prediction || null,
    selectedSetup,
    primaryLimit: DEFAULT_PRIMARY_SETUP_LIMIT,
  }), [
    activeSetups,
    selectedSetup,
    snapshotData?.prediction,
    snapshotData?.regime?.regime,
  ])
  const alertableSetupIds = useMemo(() => {
    const actionable = [
      ...alertDisplayPolicy.actionablePrimary,
      ...alertDisplayPolicy.actionableSecondary,
    ]
    return new Set(actionable.map((setup) => setup.id))
  }, [alertDisplayPolicy.actionablePrimary, alertDisplayPolicy.actionableSecondary])

  const selectedSetupContract = useMemo<ContractRecommendation | null>(() => {
    if (!selectedSetup) return null
    const selectedByUser = selectedContractBySetupId[selectedSetup.id]
    if (selectedByUser) {
      const signature = contractSignature(selectedByUser)
      const refreshed = findContractBySignature(selectedSetup, signature)
      return refreshed || selectedByUser
    }
    return selectedSetup.recommendedContract || null
  }, [selectedContractBySetupId, selectedSetup])
  const selectedSetupContractSignatureKey = useMemo(
    () => contractSignature(selectedSetupContract),
    [selectedSetupContract],
  )
  const inTradeContractSignatureKey = useMemo(
    () => contractSignature(inTradeContract),
    [inTradeContract],
  )

  useEffect(() => {
    selectedSetupContractRef.current = selectedSetupContract
    inTradeContractRef.current = inTradeContract
  }, [inTradeContract, selectedSetupContract])

  const requestCoachDecision = useCallback(async (input?: {
    setupId?: string | null
    question?: string
    forceRefresh?: boolean
    surface?: string
  }): Promise<CoachDecisionBrief | null> => {
    const requestSequence = ++coachDecisionRequestSequenceRef.current
    const forced = Boolean(input?.forceRefresh)
    const now = Date.now()
    if (!forced && now < coachDecisionBackoffUntilRef.current) {
      return coachDecisionRef.current
    }
    const resolvedTradeMode = tradeModeRef.current
    const requestSetupId = input?.setupId || inTradeSetupIdRef.current || selectedSetupIdRef.current || null
    const requestTradeMode = resolvedTradeMode === 'in_trade'
      ? 'in_trade'
      : requestSetupId
        ? 'evaluate'
        : 'scan'
    const activeContract = resolvedTradeMode === 'in_trade'
      ? inTradeContractRef.current
      : selectedSetupContractRef.current
    const activeContractSignature = contractSignature(activeContract)
    const requestKey = [
      requestSetupId || 'none',
      requestTradeMode,
      activeContractSignature || 'none',
      input?.question || '',
      input?.surface || 'spx_coach_feed',
    ].join('|')
    const isPassiveAutoRequest = !forced && !input?.question && input?.surface === 'spx_coach_auto'
    if (
      isPassiveAutoRequest
      && coachDecisionLastRequestKeyRef.current === requestKey
      && (now - coachDecisionLastRequestAtRef.current) < COACH_DECISION_AUTO_MIN_REFRESH_MS
    ) {
      return coachDecisionRef.current
    }
    coachDecisionLastRequestKeyRef.current = requestKey
    coachDecisionLastRequestAtRef.current = now

    if (!accessToken) {
      if (requestSequence !== coachDecisionRequestSequenceRef.current) return null
      setCoachDecisionStatus('error')
      setCoachDecisionError('Missing session token for coach decision request.')
      return null
    }

    if (forced || !coachDecisionRef.current || coachDecisionStatusRef.current === 'error') {
      setCoachDecisionStatus('loading')
    }
    setCoachDecisionError(null)

    try {
      const decision = await postSPX<CoachDecisionBrief>('/api/spx/coach/decision', accessToken, {
        setupId: requestSetupId || undefined,
        tradeMode: requestTradeMode,
        question: input?.question || undefined,
        forceRefresh: Boolean(input?.forceRefresh),
        selectedContract: activeContract
          ? {
            description: activeContract.description,
            bid: activeContract.bid,
            ask: activeContract.ask,
            riskReward: activeContract.riskReward,
          }
          : undefined,
        clientContext: {
          layoutMode: requestTradeMode,
          surface: input?.surface || 'spx_coach_feed',
        },
      })

      if (requestSequence !== coachDecisionRequestSequenceRef.current) return null
      const explainabilitySetup = activeSetupsRef.current.find((item) => item.id === decision.setupId)
        || activeSetupsRef.current.find((item) => item.id === requestSetupId)
        || null
      const enrichedDecision = enrichCoachDecisionExplainability(decision, explainabilitySetup)
      setCoachDecision(enrichedDecision)
      setCoachDecisionStatus('ready')
      setCoachDecisionError(null)
      coachDecisionFailureCountRef.current = 0
      coachDecisionBackoffUntilRef.current = 0

      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_DECISION_GENERATED, {
        decisionId: enrichedDecision.decisionId,
        setupId: enrichedDecision.setupId,
        verdict: enrichedDecision.verdict,
        confidence: enrichedDecision.confidence,
        severity: enrichedDecision.severity,
        source: enrichedDecision.source,
        explainabilityLines: enrichedDecision.why.length,
        tradeMode: requestTradeMode,
      }, { persist: true })

      if (enrichedDecision.source === 'fallback_v1') {
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_DECISION_FALLBACK_USED, {
          decisionId: enrichedDecision.decisionId,
          setupId: enrichedDecision.setupId,
          verdict: enrichedDecision.verdict,
          source: enrichedDecision.source,
          tradeMode: requestTradeMode,
        }, { level: 'warning', persist: true })
      }

      return enrichedDecision
    } catch (error) {
      if (requestSequence !== coachDecisionRequestSequenceRef.current) return null
      const message = error instanceof Error ? error.message : 'Coach decision request failed.'
      setCoachDecisionStatus('error')
      setCoachDecisionError(message)
      coachDecisionFailureCountRef.current = Math.min(coachDecisionFailureCountRef.current + 1, 6)
      const isRateLimited = /(^|\\b)429(\\b|$)|too many requests/i.test(message)
      const exponentialBackoffMs = Math.min(
        COACH_DECISION_FAILURE_BACKOFF_BASE_MS * (2 ** Math.max(coachDecisionFailureCountRef.current - 1, 0)),
        COACH_DECISION_FAILURE_BACKOFF_MAX_MS,
      )
      const backoffMs = isRateLimited
        ? Math.max(COACH_DECISION_RATE_LIMIT_BACKOFF_MS, exponentialBackoffMs)
        : exponentialBackoffMs
      coachDecisionBackoffUntilRef.current = Date.now() + backoffMs

      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_DECISION_FALLBACK_USED, {
        setupId: requestSetupId,
        verdict: null,
        source: 'client_error',
        tradeMode: requestTradeMode,
        message,
        backoffMs,
      }, { level: 'warning', persist: true })

      return null
    }
  }, [
    accessToken,
  ])

  useEffect(() => {
    if (!uxFlags.coachSurfaceV2) return

    const setupId = inTradeSetup?.id || selectedSetup?.id || null
    if (!setupId && tradeMode !== 'in_trade') {
      setCoachDecision(null)
      setCoachDecisionStatus('idle')
      setCoachDecisionError(null)
      return
    }

    const timeoutId = window.setTimeout(() => {
      void requestCoachDecision({
        setupId,
        forceRefresh: false,
        surface: 'spx_coach_auto',
      })
    }, 180)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    inTradeContractSignatureKey,
    inTradeSetup?.id,
    requestCoachDecision,
    selectedSetup?.id,
    selectedSetupContractSignatureKey,
    tradeMode,
    uxFlags.coachSurfaceV2,
  ])

  useEffect(() => {
    if (!inTradeSetupId) return
    const setup = activeSetups.find((item) => item.id === inTradeSetupId) || null
    if (!setup) return

    setInTradeContract((previous) => {
      const previousSignature = contractSignature(previous)
      const nextCandidate = findContractBySignature(setup, previousSignature)
        || previous
        || selectedContractBySetupId[setup.id]
        || setup.recommendedContract
        || null
      if (!nextCandidate) return null
      if (!previous) return nextCandidate
      if (contractSignature(previous) !== contractSignature(nextCandidate)) return nextCandidate
      if (previous.bid !== nextCandidate.bid || previous.ask !== nextCandidate.ask || previous.premiumMid !== nextCandidate.premiumMid) {
        return nextCandidate
      }
      return previous
    })
  }, [activeSetups, inTradeSetupId, selectedContractBySetupId])

  useEffect(() => {
    if (!inTradeSetupId) return
    const exists = activeSetups.some((setup) => setup.id === inTradeSetupId)
    if (exists) return

    setInTradeSetupId(null)
    setInTradeContract(null)
    setTradeEntryPrice(null)
    setTradeEntryContractMid(null)
    setTradeEnteredAt(null)
    persistTradeFocusState(null)

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
      surface: 'trade_focus',
      action: 'auto_exit_missing_setup',
      setupId: inTradeSetupId,
    }, { level: 'warning', persist: true })
  }, [activeSetups, inTradeSetupId])

  useEffect(() => {
    const activeIds = new Set(activeSetups.map((setup) => setup.id))
    setSelectedContractBySetupId((previous) => {
      const entries = Object.entries(previous).filter(([setupId]) => activeIds.has(setupId))
      if (entries.length === Object.keys(previous).length) return previous
      return Object.fromEntries(entries)
    })
  }, [activeSetups])

  const spxStreamPrice = stream.prices.get('SPX')
  const spyStreamPrice = stream.prices.get('SPY')
  const snapshotPriceTimestamp = snapshotData?.basis?.timestamp || snapshotData?.generatedAt || null
  const spxPrice = spxStreamPrice?.price ?? snapshotData?.basis?.spxPrice ?? 0
  const spxTickTimestamp = spxStreamPrice?.timestamp ?? snapshotPriceTimestamp
  const spxPriceSource = spxStreamPrice?.source ?? (snapshotData?.basis?.spxPrice ? 'snapshot' : null)
  const spxPriceAgeMs = spxStreamPrice?.feedAgeMs ?? calculateAgeMs(spxTickTimestamp)
  const spyPrice = spyStreamPrice?.price ?? snapshotData?.basis?.spyPrice ?? 0

  useEffect(() => {
    if (!spxTickTimestamp) return
    marketDataOrchestratorRef.current.ingest({
      kind: 'heartbeat',
      channel: 'price:spx',
      symbol: 'SPX',
      timestamp: spxTickTimestamp,
      source: spxPriceSource,
      feedAgeMs: spxPriceAgeMs,
      sequence: null,
      // Use wall-clock receipt time for heartbeat freshness; message timestamps can be historical.
      receivedAtMs: Date.now(),
    })
  }, [spxPriceAgeMs, spxPriceSource, spxTickTimestamp])

  const tradePnlPoints = useMemo(() => {
    if (!inTradeSetup || tradeEntryPrice == null || !Number.isFinite(spxPrice) || spxPrice <= 0) return null
    const move = spxPrice - tradeEntryPrice
    return inTradeSetup.direction === 'bullish' ? move : -move
  }, [inTradeSetup, spxPrice, tradeEntryPrice])
  const tradeCurrentContractMid = useMemo(() => contractMid(inTradeContract), [inTradeContract])
  const tradePnlDollars = useMemo(() => {
    if (tradeEntryContractMid == null || tradeCurrentContractMid == null) return null
    return (tradeCurrentContractMid - tradeEntryContractMid) * 100
  }, [tradeCurrentContractMid, tradeEntryContractMid])
  const lockedTradeContractSignature = useMemo(
    () => contractSignature(
      inTradeContract
      || (inTradeSetupId ? selectedContractBySetupId[inTradeSetupId] : null)
      || inTradeSetup?.recommendedContract
      || null,
    ),
    [inTradeContract, inTradeSetup?.recommendedContract, inTradeSetupId, selectedContractBySetupId],
  )
  const activeTradePlan = useMemo<SPXActiveTradePlan | null>(() => {
    const planSetup = tradeMode === 'in_trade' ? inTradeSetup : selectedSetup
    if (!planSetup) return null

    const planContract = tradeMode === 'in_trade'
      ? (
        inTradeContract
        || selectedContractBySetupId[planSetup.id]
        || planSetup.recommendedContract
        || null
      )
      : (
        (selectedSetup?.id === planSetup.id ? selectedSetupContract : null)
        || selectedContractBySetupId[planSetup.id]
        || planSetup.recommendedContract
        || null
      )
    const planEntryAnchor = tradeMode === 'in_trade'
      ? (tradeEntryPrice ?? ((planSetup.entryZone.low + planSetup.entryZone.high) / 2))
      : ((planSetup.entryZone.low + planSetup.entryZone.high) / 2)
    const planCurrentContractMid = tradeMode === 'in_trade'
      ? tradeCurrentContractMid
      : contractMid(planContract)
    const planEntryContractMid = tradeMode === 'in_trade'
      ? tradeEntryContractMid
      : contractMid(planContract)

    return {
      setupId: planSetup.id,
      direction: planSetup.direction,
      regime: planSetup.regime,
      status: planSetup.status,
      entryLow: planSetup.entryZone.low,
      entryHigh: planSetup.entryZone.high,
      entryAnchor: planEntryAnchor,
      stop: planSetup.stop,
      target1Price: planSetup.target1.price,
      target1Label: planSetup.target1.label,
      target2Price: planSetup.target2.price,
      target2Label: planSetup.target2.label,
      probability: planSetup.probability,
      confluenceScore: planSetup.confluenceScore,
      contract: planContract,
      contractSignature: contractSignature(planContract),
      entryContractMid: planEntryContractMid,
      currentContractMid: planCurrentContractMid,
      pnlPoints: tradeMode === 'in_trade' ? tradePnlPoints : null,
      pnlDollars: tradeMode === 'in_trade' ? tradePnlDollars : null,
      enteredAt: tradeMode === 'in_trade' ? tradeEnteredAt : null,
    }
  }, [
    inTradeContract,
    inTradeSetup,
    selectedContractBySetupId,
    selectedSetup,
    selectedSetupContract,
    tradeCurrentContractMid,
    tradeEntryContractMid,
    tradeEntryPrice,
    tradeEnteredAt,
    tradeMode,
    tradePnlDollars,
    tradePnlPoints,
  ])

  const chartAnnotations = useMemo<ChartAnnotation[]>(() => {
    if (!selectedSetup) return []

    return [
      {
        id: `${selectedSetup.id}-entry`,
        type: 'entry_zone',
        priceLow: selectedSetup.entryZone.low,
        priceHigh: selectedSetup.entryZone.high,
        label: 'Entry Zone',
      },
      {
        id: `${selectedSetup.id}-stop`,
        type: 'stop',
        price: selectedSetup.stop,
        label: 'Stop',
      },
      {
        id: `${selectedSetup.id}-target1`,
        type: 'target1',
        price: selectedSetup.target1.price,
        label: selectedSetup.target1.label,
      },
      {
        id: `${selectedSetup.id}-target2`,
        type: 'target2',
        price: selectedSetup.target2.price,
        label: selectedSetup.target2.label,
      },
    ]
  }, [selectedSetup])

  const filteredLevels = useMemo(() => {
    return allLevels
      .filter((level) => visibleLevelCategories.has(level.category))
      .filter((level) => (showSPYDerived ? true : level.category !== 'spy_derived'))
  }, [allLevels, showSPYDerived, visibleLevelCategories])

  const appendEphemeralCoachMessage = useCallback((message: CoachMessage) => {
    setEphemeralCoachMessages((previous) => {
      const deduped = new Map<string, CoachMessage>()
      for (const item of [message, ...previous]) {
        if (!item?.id) continue
        deduped.set(item.id, item)
      }
      return Array.from(deduped.values())
        .sort((a, b) => toEpoch(b.timestamp) - toEpoch(a.timestamp))
        .slice(0, 80)
    })
  }, [])

  const reportExecutionFill = useCallback(async (input: {
    setupId: string
    side: ExecutionFillSide
    fillPrice: number
    fillQuantity?: number
    direction?: Setup['direction']
    phase?: ExecutionTransitionPhase
    source: ExecutionFillSource
    executedAt?: string
    transitionEventId?: string
    brokerOrderId?: string
    brokerExecutionId?: string
    metadata?: Record<string, unknown>
  }): Promise<ExecutionFillReconciliation | null> => {
    if (!accessToken) {
      return null
    }

    try {
      const reconciliation = await postSPX<ExecutionFillReconciliation>('/api/spx/execution/fills', accessToken, {
        setupId: input.setupId,
        side: input.side,
        fillPrice: input.fillPrice,
        fillQuantity: input.fillQuantity,
        direction: input.direction,
        phase: input.phase,
        source: input.source,
        executedAt: input.executedAt,
        transitionEventId: input.transitionEventId,
        brokerOrderId: input.brokerOrderId,
        brokerExecutionId: input.brokerExecutionId,
        metadata: input.metadata,
      })

      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.EXECUTION_FILL_REPORTED, {
        setupId: input.setupId,
        side: input.side,
        source: input.source,
        persisted: reconciliation.persisted,
        tableAvailable: reconciliation.tableAvailable,
        reconciled: Boolean(reconciliation.reference),
        slippagePoints: reconciliation.slippagePoints,
      }, { persist: true })

      if (reconciliation.reference && reconciliation.slippagePoints != null) {
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.EXECUTION_FILL_RECONCILED, {
          setupId: input.setupId,
          side: input.side,
          source: input.source,
          phase: reconciliation.reference.phase,
          slippagePoints: reconciliation.slippagePoints,
          slippageBps: reconciliation.slippageBps,
        }, { persist: true })
      }

      return reconciliation
    } catch (error) {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.EXECUTION_FILL_REPORT_FAILED, {
        setupId: input.setupId,
        side: input.side,
        source: input.source,
        message: error instanceof Error ? error.message : 'execution_fill_report_failed',
      }, { level: 'warning', persist: true })
      return null
    }
  }, [accessToken])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleBrokerFill = (event: Event) => {
      const detail = (event as CustomEvent<SPXBrokerFillEventDetail>).detail
      if (!detail || typeof detail !== 'object') return

      const setupId = typeof detail.setupId === 'string' ? detail.setupId.trim() : ''
      if (!setupId) return

      const side: ExecutionFillSide = detail.side === 'entry' || detail.side === 'partial' || detail.side === 'exit'
        ? detail.side
        : 'entry'

      const fillPrice = typeof detail.fillPrice === 'number' && Number.isFinite(detail.fillPrice) && detail.fillPrice > 0
        ? detail.fillPrice
        : null
      if (fillPrice == null) return

      const setup = activeSetupsRef.current.find((candidate) => candidate.id === setupId)
        || (inTradeSetupRef.current?.id === setupId ? inTradeSetupRef.current : null)
      const direction = detail.direction === 'bullish' || detail.direction === 'bearish'
        ? detail.direction
        : setup?.direction
      if (!direction) return

      const phase = detail.phase || defaultPhaseForSide(side)
      const source: ExecutionFillSource = detail.source === 'broker_other'
        ? 'broker_other'
        : detail.source === 'manual'
          ? 'manual'
          : detail.source === 'proxy'
            ? 'proxy'
            : 'broker_tradier'
      const executedAt = typeof detail.executedAt === 'string' && detail.executedAt.trim().length > 0
        ? detail.executedAt
        : new Date().toISOString()

      if (side === 'entry' && inTradeSetupIdRef.current === setupId) {
        setTradeEntryPrice(fillPrice)
        setTradeEnteredAt(executedAt)
      }

      void (async () => {
        const fallbackReferencePrice = setup
          ? (
            side === 'entry'
              ? (setup.entryZone.low + setup.entryZone.high) / 2
              : side === 'partial'
                ? setup.target1.price
                : resolveExitReference(setup, fillPrice).price
          )
          : fillPrice
        const fallbackSlippagePoints = computeDirectionalSlippagePoints({
          side,
          direction,
          referencePrice: fallbackReferencePrice,
          actualPrice: fillPrice,
        })

        const reconciliation = await reportExecutionFill({
          setupId,
          side,
          fillPrice,
          fillQuantity: typeof detail.fillQuantity === 'number' && Number.isFinite(detail.fillQuantity)
            ? detail.fillQuantity
            : undefined,
          direction,
          phase,
          source,
          executedAt,
          transitionEventId: typeof detail.transitionEventId === 'string' ? detail.transitionEventId : undefined,
          brokerOrderId: typeof detail.brokerOrderId === 'string' ? detail.brokerOrderId : undefined,
          brokerExecutionId: typeof detail.brokerExecutionId === 'string' ? detail.brokerExecutionId : undefined,
          metadata: detail.metadata,
        })

        const referencePrice = reconciliation?.reference?.price ?? fallbackReferencePrice
        const slippagePoints = reconciliation?.slippagePoints ?? fallbackSlippagePoints
        const referencePhase = reconciliation?.reference?.phase || phase
        const fillSource = reconciliation?.source || source

        appendEphemeralCoachMessage({
          id: `coach_exec_broker_fill_${setupId}_${side}_${Date.now()}`,
          type: side === 'entry' ? 'in_trade' : 'post_trade',
          priority: 'setup',
          setupId,
          content: `Execution reconciled (${sourceLabel(fillSource)}): ${side.toUpperCase()} fill ${fillPrice.toFixed(2)} vs ${phaseLabel(referencePhase).toUpperCase()} reference ${referencePrice.toFixed(2)} (${signedPointLabel(slippagePoints)} pts slippage).`,
          structuredData: {
            source: 'execution_reconciliation',
            action: 'broker_fill_reconciled',
            setupId,
            side,
            direction,
            actualPrice: roundTo(fillPrice, 2),
            referencePrice: roundTo(referencePrice, 2),
            referencePhase,
            slippagePoints: roundTo(slippagePoints, 2),
            slippageBps: reconciliation?.slippageBps ?? null,
            fillSource,
            reconciliation,
          },
          timestamp: reconciliation?.executedAt || executedAt,
        })
      })()
    }

    window.addEventListener('spx:broker-fill', handleBrokerFill as EventListener)
    return () => {
      window.removeEventListener('spx:broker-fill', handleBrokerFill as EventListener)
    }
  }, [appendEphemeralCoachMessage, reportExecutionFill])

  const coachMessages = useMemo(() => {
    const snapshotMessages = snapshotData?.coachMessages || []
    const deduped = new Map<string, CoachMessage>()

    for (const message of [...ephemeralCoachMessages, ...snapshotMessages]) {
      if (!message?.id) continue
      deduped.set(message.id, message)
    }

    return Array.from(deduped.values())
      .sort((a, b) => toEpoch(b.timestamp) - toEpoch(a.timestamp))
      .slice(0, 80)
  }, [ephemeralCoachMessages, snapshotData?.coachMessages])
  const canEmitProactiveMessage = useCallback((cooldownKey: string, nowEpoch: number) => {
    const lastEpoch = proactiveCooldownByKeyRef.current[cooldownKey] || 0
    if (nowEpoch - lastEpoch < PROACTIVE_COACH_COOLDOWN_MS) return false
    proactiveCooldownByKeyRef.current[cooldownKey] = nowEpoch
    return true
  }, [])

  const pushProactiveCoachMessage = useCallback((message: CoachMessage, cooldownKey: string) => {
    const nowEpoch = Date.now()
    if (!canEmitProactiveMessage(cooldownKey, nowEpoch)) return

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_MESSAGE_SENT, {
      setupId: message.setupId || null,
      promptLength: 0,
      result: 'proactive',
      proactiveReason: message.structuredData?.reason || null,
      messageId: message.id,
    })

    setEphemeralCoachMessages((previous) => {
      const deduped = new Map<string, CoachMessage>()
      for (const item of [message, ...previous]) {
        if (!item?.id) continue
        deduped.set(item.id, item)
      }
      return Array.from(deduped.values())
        .sort((a, b) => toEpoch(b.timestamp) - toEpoch(a.timestamp))
        .slice(0, 80)
    })
  }, [canEmitProactiveMessage])

  const emitSetupTriggeredNotification = useCallback((setup: Setup) => {
    if (!uxFlags.setupRealtimeAlertsV1) return
    const now = Date.now()
    const cooldownKey = `triggered:${setup.id}`
    const lastToastAt = setupToastCooldownByKeyRef.current[cooldownKey] || 0
    if (now - lastToastAt < SETUP_TRIGGER_TOAST_COOLDOWN_MS) return

    setupToastCooldownByKeyRef.current[cooldownKey] = now
    const title = `${humanizeSetupType(setup.type)} Triggered`
    toast(title, {
      id: `spx_setup_triggered_${setup.id}`,
      description: setupAlertSummary(setup),
      duration: 8_000,
    })

    if (!setupTriggerNotificationsEnabled) return
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    if (!('Notification' in window)) return
    if (document.visibilityState === 'visible') return
    if (Notification.permission !== 'granted') return

    const lastBrowserAt = setupBrowserCooldownByKeyRef.current[cooldownKey] || 0
    if (now - lastBrowserAt < SETUP_TRIGGER_BROWSER_COOLDOWN_MS) return
    setupBrowserCooldownByKeyRef.current[cooldownKey] = now

    const notification = new Notification(title, {
      body: setupAlertSummary(setup),
      icon: '/hero-logo.png',
      tag: `spx-trigger-${setup.id}`,
      requireInteraction: false,
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }, [setupTriggerNotificationsEnabled, uxFlags.setupRealtimeAlertsV1])

  useEffect(() => {
    const nextStatusById: Record<string, Setup['status']> = {}
    let focusTriggeredSetupId: string | null = null
    for (const setup of activeSetups) {
      nextStatusById[setup.id] = setup.status
    }

    for (const setup of activeSetups) {
      const previousStatus = previousSetupStatusByIdRef.current[setup.id]
      if (!previousStatus) continue
      if (previousStatus === 'triggered' || setup.status !== 'triggered') continue

      const isAlertable = alertableSetupIds.has(setup.id) || inTradeSetupId === setup.id
      if (!isAlertable) continue

      emitSetupTriggeredNotification(setup)
      if (!inTradeSetupId && focusTriggeredSetupId == null) {
        focusTriggeredSetupId = setup.id
      }
      if (!uxFlags.coachProactive) continue

      const flowSummary = summarizeFlowAlignment(flowEvents.slice(0, 12), setup.direction)
      const now = new Date().toISOString()
      const message: CoachMessage = {
        id: `coach_proactive_triggered_${setup.id}_${setup.statusUpdatedAt || now}`,
        type: 'pre_trade',
        priority: 'setup',
        setupId: setup.id,
        content: `Entry window open for ${setup.direction.toUpperCase()} ${setup.regime}. Confluence ${setup.confluenceScore}/5${flowSummary ? `, flow confirms ${flowSummary.alignmentPct}%` : ''}. Entry zone ${setup.entryZone.low.toFixed(0)}-${setup.entryZone.high.toFixed(0)}.`,
        structuredData: {
          source: 'client_proactive',
          reason: 'status_triggered',
          setupStatus: setup.status,
          setupDirection: setup.direction,
        },
        timestamp: now,
      }

      pushProactiveCoachMessage(message, `triggered:${setup.id}`)
    }

    if (
      focusTriggeredSetupId
      && !inTradeSetupId
      && selectedSetupIdRef.current !== focusTriggeredSetupId
    ) {
      setSelectedSetupId(focusTriggeredSetupId)
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
        surface: 'setup_feed',
        action: 'auto_focus_triggered_setup',
        setupId: focusTriggeredSetupId,
      })
    }

    previousSetupStatusByIdRef.current = nextStatusById
  }, [
    activeSetups,
    alertableSetupIds,
    emitSetupTriggeredNotification,
    flowEvents,
    inTradeSetupId,
    pushProactiveCoachMessage,
    uxFlags.coachProactive,
  ])

  useEffect(() => {
    if (!uxFlags.coachProactive) return
    const scopedSetup = inTradeSetup || selectedSetup
    if (!scopedSetup) return

    const flowSummary = summarizeFlowAlignment(flowEvents.slice(0, 12), scopedSetup.direction)
    if (!flowSummary) return
    if (!isFlowDivergence(flowSummary.alignmentPct, PROACTIVE_FLOW_DIVERGENCE_THRESHOLD)) return

    const opposingShare = 100 - flowSummary.alignmentPct
    const now = new Date().toISOString()
    const message: CoachMessage = {
      id: `coach_proactive_flow_divergence_${scopedSetup.id}_${Math.floor(Date.now() / 60_000)}`,
      type: tradeMode === 'in_trade' ? 'in_trade' : 'pre_trade',
      priority: 'alert',
      setupId: scopedSetup.id,
      content: `Flow divergence detected for your ${scopedSetup.direction} setup. Opposing pressure is ${opposingShare}% over recent prints. Consider waiting for re-alignment or tightening risk.`,
      structuredData: {
        source: 'client_proactive',
        reason: 'flow_divergence',
        alignmentPct: flowSummary.alignmentPct,
        opposingShare,
      },
      timestamp: now,
    }

    pushProactiveCoachMessage(message, `flow_divergence:${scopedSetup.id}`)
  }, [
    flowEvents,
    inTradeSetup,
    pushProactiveCoachMessage,
    selectedSetup,
    tradeMode,
    uxFlags.coachProactive,
  ])

  useEffect(() => {
    if (!uxFlags.coachProactive) return
    if (tradeMode !== 'in_trade' || !inTradeSetup) return

    const stopDistance = distanceToStopPoints(spxPrice, inTradeSetup)
    if (stopDistance == null) return
    if (stopDistance < 0 || stopDistance > PROACTIVE_STOP_DISTANCE_THRESHOLD) return

    const flowSummary = summarizeFlowAlignment(flowEvents.slice(0, 12), inTradeSetup.direction)
    const now = new Date().toISOString()
    const message: CoachMessage = {
      id: `coach_proactive_stop_proximity_${inTradeSetup.id}_${Math.floor(Date.now() / 60_000)}`,
      type: 'in_trade',
      priority: 'alert',
      setupId: inTradeSetup.id,
      content: `Price is within ${stopDistance.toFixed(1)} points of your stop at ${inTradeSetup.stop.toFixed(2)}. ${flowSummary && flowSummary.alignmentPct >= 55 ? `Flow still confirms ${flowSummary.alignmentPct}%, but consider tightening.` : 'Consider reducing risk or exiting if confirmation does not improve.'}`,
      structuredData: {
        source: 'client_proactive',
        reason: 'stop_proximity',
        stopDistance,
        stopPrice: inTradeSetup.stop,
        flowAlignmentPct: flowSummary?.alignmentPct ?? null,
      },
      timestamp: now,
    }

    pushProactiveCoachMessage(message, `stop_proximity:${inTradeSetup.id}`)
  }, [
    flowEvents,
    inTradeSetup,
    pushProactiveCoachMessage,
    spxPrice,
    tradeMode,
    uxFlags.coachProactive,
  ])

  useEffect(() => {
    if (hasTrackedPageViewRef.current) return
    hasTrackedPageViewRef.current = true

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.PAGE_VIEW, {
      route: '/members/spx-command-center',
      hasSession: Boolean(accessToken),
    }, { persist: true })
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.UX_FLAGS_EVALUATED, {
      enabledFlags: getEnabledSPXUXFlagKeys(uxFlags),
      flags: uxFlags,
    })
    pageToFirstActionableStopperRef.current = startSPXPerfTimer('ttfa_actionable_render')
    pageToFirstSetupSelectStopperRef.current = startSPXPerfTimer('ttfa_setup_select')
  }, [accessToken, uxFlags])

  useEffect(() => {
    if (hasTrackedFirstActionableRef.current) return

    const firstActionable = activeSetups.find((setup) => IMMEDIATELY_ACTIONABLE_STATUSES.has(setup.status))
    if (!firstActionable) return

    hasTrackedFirstActionableRef.current = true
    const durationMs = pageToFirstActionableStopperRef.current?.({
      setupId: firstActionable.id,
      setupStatus: firstActionable.status,
      setupDirection: firstActionable.direction,
    }) ?? null

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.FIRST_ACTIONABLE_RENDER, {
      setupId: firstActionable.id,
      setupStatus: firstActionable.status,
      setupDirection: firstActionable.direction,
      durationMs,
    }, { persist: true })
  }, [activeSetups])

  useEffect(() => {
    if (!isLoading || snapshotData) {
      setSnapshotRequestLate(false)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSnapshotRequestLate(true)
    }, SNAPSHOT_DELAY_HEALTH_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isLoading, snapshotData])

  const toggleLevelCategory = useCallback((category: LevelCategory) => {
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.LEVEL_MAP_INTERACTION, {
      action: 'toggle_category',
      category,
    })

    setVisibleLevelCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }

      if (next.size === 0) {
        return new Set([category])
      }

      return next
    })
  }, [])

  const toggleSPYDerived = useCallback(() => {
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.LEVEL_MAP_INTERACTION, {
      action: 'toggle_spy_overlay',
    })
    setShowSPYDerived((prev) => !prev)
  }, [])

  const selectSetup = useCallback((setup: Setup | null) => {
    if (inTradeSetupId && setup?.id && setup.id !== inTradeSetupId) {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
        surface: 'trade_focus',
        action: 'blocked_select_during_focus',
        setupId: setup.id,
        focusedSetupId: inTradeSetupId,
      })
      return
    }

    if (setup) {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SETUP_SELECTED, {
        setupId: setup.id,
        setupType: setup.type,
        setupStatus: setup.status,
        setupDirection: setup.direction,
        setupProbability: setup.probability,
      }, { persist: true })

      if (!hasTrackedFirstSetupSelectRef.current) {
        hasTrackedFirstSetupSelectRef.current = true
        const durationMs = pageToFirstSetupSelectStopperRef.current?.({
          setupId: setup.id,
        }) ?? null

        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.FIRST_SETUP_SELECT, {
          setupId: setup.id,
          durationMs,
        }, { persist: true })
      }
    }

    setSelectedSetupId(setup?.id || null)
  }, [inTradeSetupId])

  const setSetupContractChoice = useCallback((setup: Setup | null, contract: ContractRecommendation | null) => {
    if (!setup) return
    setSelectedContractBySetupId((previous) => {
      const current = previous[setup.id] || null
      const currentSignature = contractSignature(current)
      const nextSignature = contractSignature(contract)
      if (currentSignature === nextSignature) return previous

      const next = { ...previous }
      if (!contract) {
        delete next[setup.id]
      } else {
        next[setup.id] = contract
      }
      return next
    })
  }, [])

  const enterTrade = useCallback((setup?: Setup | null) => {
    const target = setup || selectedSetup
    if (!target) return
    // CRITICAL-4 guard: prevent concurrent trade entry (position size blowup risk)
    if (inTradeSetupId !== null) {
      toast.error('Trade entry blocked: already in an active trade', {
        description: 'Exit or flatten your current position before entering a new trade.',
        duration: 5_000,
      })
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
        surface: 'trade_focus',
        action: 'enter_rejected_concurrent',
        setupId: target.id,
        currentTradeSetupId: inTradeSetupId,
      }, { level: 'warning', persist: true })
      return
    }
    const streamTrustStateNow = marketDataOrchestratorRef.current.evaluate(Date.now(), stream.isConnected)
    const liveFeedHealth = resolveSPXFeedHealth({
      snapshotIsDegraded,
      snapshotDegradedMessage,
      errorMessage: snapshotError?.message || stream.error || null,
      snapshotRequestLate,
      snapshotAvailable: Boolean(snapshotData),
      streamConnected: stream.isConnected,
      spxPriceSource,
      spxPriceAgeMs,
      sequenceGapDetected: streamTrustStateNow.sequenceGapDetected,
      heartbeatStale: streamTrustStateNow.heartbeatStale,
    })
    const feedTrustBlocked = E2E_ALLOW_STALE_ENTRY && liveFeedHealth.dataHealth === 'stale'
      ? false
      : liveFeedHealth.fallbackPolicy.blockTradeEntry
    if (feedTrustBlocked) {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
        surface: 'trade_focus',
        action: 'enter_rejected_feed_trust',
        setupId: target.id,
        setupStatus: target.status,
        dataHealth: liveFeedHealth.dataHealth,
        feedFallbackStage: liveFeedHealth.fallbackPolicy.stage,
        feedFallbackReasonCode: liveFeedHealth.fallbackPolicy.reasonCode,
      }, { level: 'warning', persist: true })
      const reason = formatSPXFeedFallbackReasonCode(liveFeedHealth.fallbackPolicy.reasonCode)
      toast.error('Trade entry blocked: feed trust guard active', {
        description: liveFeedHealth.dataHealthMessage || reason || 'Realtime feed state is stale/degraded. Wait for recovery.',
        duration: 6_000,
      })
      return
    }
    if (hasSetupPriceProgressionConflict(target, spxPrice)) {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
        surface: 'trade_focus',
        action: 'enter_rejected_price_progression',
        setupId: target.id,
        setupStatus: target.status,
        currentPrice: spxPrice,
        target1: target.target1.price,
      }, { level: 'warning', persist: true })
      toast.error('Trade entry blocked: setup is no longer viable', {
        description: 'Price has already progressed through first target before trigger confirmation.',
        duration: 6_000,
      })
      return
    }
    if (!ENTERABLE_SETUP_STATUSES.has(target.status)) {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
        surface: 'trade_focus',
        action: 'enter_rejected_non_actionable',
        setupId: target.id,
        setupStatus: target.status,
      }, { level: 'warning' })
      return
    }

    const entryPrice = Number.isFinite(spxPrice) && spxPrice > 0
      ? spxPrice
      : (target.entryZone.low + target.entryZone.high) / 2
    const chosenContract = (
      (target.id === selectedSetup?.id ? selectedSetupContract : null)
      || selectedContractBySetupId[target.id]
      || target.recommendedContract
      || null
    )
    const entryContractMid = contractMid(chosenContract)
    const enteredAt = new Date().toISOString()

    setSelectedSetupId(target.id)
    setInTradeSetupId(target.id)
    setInTradeContract(chosenContract)
    setTradeEntryPrice(entryPrice)
    setTradeEntryContractMid(entryContractMid)
    setTradeEnteredAt(enteredAt)
    persistTradeFocusState({
      setupId: target.id,
      entryPrice,
      contract: chosenContract,
      entryContractMid,
      enteredAt,
    })

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
      surface: 'trade_focus',
      action: 'enter',
      setupId: target.id,
      setupStatus: target.status,
      setupDirection: target.direction,
      entryPrice,
      contract: chosenContract?.description || null,
      contractMid: entryContractMid,
    }, { persist: true })

    void (async () => {
      const fallbackReferencePrice = (target.entryZone.low + target.entryZone.high) / 2
      const fallbackSlippagePoints = computeDirectionalSlippagePoints({
        side: 'entry',
        direction: target.direction,
        referencePrice: fallbackReferencePrice,
        actualPrice: entryPrice,
      })

      const reconciliation = await reportExecutionFill({
        setupId: target.id,
        side: 'entry',
        fillPrice: entryPrice,
        direction: target.direction,
        phase: 'triggered',
        source: 'proxy',
        executedAt: enteredAt,
        metadata: {
          trigger: 'trade_focus_enter',
          setupType: target.type,
          setupStatus: target.status,
        },
      })

      const referencePrice = reconciliation?.reference?.price ?? fallbackReferencePrice
      const slippagePoints = reconciliation?.slippagePoints ?? fallbackSlippagePoints
      const referencePhase = reconciliation?.reference?.phase || defaultPhaseForSide('entry')
      const fillSource = reconciliation?.source || 'proxy'

      appendEphemeralCoachMessage({
        id: `coach_exec_confirm_enter_${target.id}_${Date.now()}`,
        type: 'in_trade',
        priority: 'setup',
        setupId: target.id,
        content: `Execution confirmed (${sourceLabel(fillSource)}): ENTER at ${entryPrice.toFixed(2)} vs ${phaseLabel(referencePhase).toUpperCase()} reference ${referencePrice.toFixed(2)} (${signedPointLabel(slippagePoints)} pts slippage).`,
        structuredData: {
          source: 'execution_confirmation',
          action: 'enter_confirmed',
          setupId: target.id,
          setupDirection: target.direction,
          setupType: target.type,
          actualPrice: roundTo(entryPrice, 2),
          referencePrice: roundTo(referencePrice, 2),
          referencePhase,
          slippagePoints: roundTo(slippagePoints, 2),
          slippageBps: reconciliation?.slippageBps ?? null,
          fillSource,
          reconciliation,
        },
        timestamp: reconciliation?.executedAt || enteredAt,
      })
    })()

    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.UX_MOBILE_FOCUS_CHANGED, {
        action: 'enter',
        setupId: target.id,
        setupStatus: target.status,
        mobileFullTradeFocusEnabled: uxFlags.mobileFullTradeFocus,
      }, { persist: true })
    }
  }, [
    appendEphemeralCoachMessage,
    inTradeSetupId,
    reportExecutionFill,
    selectedContractBySetupId,
    selectedSetup,
    selectedSetupContract,
    snapshotData,
    snapshotDegradedMessage,
    snapshotError?.message,
    snapshotIsDegraded,
    snapshotRequestLate,
    spxPrice,
    spxPriceAgeMs,
    spxPriceSource,
    stream.error,
    stream.isConnected,
    uxFlags.mobileFullTradeFocus,
  ])

  const exitTrade = useCallback(() => {
    if (!inTradeSetupId) return
    const exitingSetupId = inTradeSetupId
    const exitingSetup = inTradeSetupRef.current
    const exitContract = inTradeContractRef.current
    const exitDecision = coachDecisionRef.current
    const exitPrice = Number.isFinite(spxPrice) && spxPrice > 0 ? spxPrice : null
    const artifact = createSPXTradeJournalArtifact({
      setup: exitingSetup,
      openedAt: tradeEnteredAt,
      entryPrice: tradeEntryPrice,
      exitPrice,
      pnlPoints: tradePnlPoints,
      pnlDollars: tradePnlDollars,
      contractDescription: exitContract?.description || null,
      contractEntryMid: tradeEntryContractMid,
      contractExitMid: contractMid(exitContract),
      timeframe: selectedTimeframe,
      coachDecision: exitDecision,
    })
    persistSPXTradeJournalArtifact(artifact)

    if (exitingSetup && exitPrice != null) {
      const exitTimestamp = new Date().toISOString()
      void (async () => {
        const fallbackReference = resolveExitReference(exitingSetup, exitPrice)
        const fallbackSlippagePoints = computeDirectionalSlippagePoints({
          side: 'exit',
          direction: exitingSetup.direction,
          referencePrice: fallbackReference.price,
          actualPrice: exitPrice,
        })

        const fallbackPhase: ExecutionTransitionPhase = exitingSetup.status === 'invalidated'
          ? 'invalidated'
          : 'target2_hit'

        const reconciliation = await reportExecutionFill({
          setupId: exitingSetupId,
          side: 'exit',
          fillPrice: exitPrice,
          direction: exitingSetup.direction,
          phase: fallbackPhase,
          source: 'proxy',
          executedAt: exitTimestamp,
          metadata: {
            trigger: 'trade_focus_exit',
            setupType: exitingSetup.type,
            setupStatus: exitingSetup.status,
          },
        })

        const referencePrice = reconciliation?.reference?.price ?? fallbackReference.price
        const slippagePoints = reconciliation?.slippagePoints ?? fallbackSlippagePoints
        const referencePhase = reconciliation?.reference?.phase || fallbackPhase
        const fillSource = reconciliation?.source || 'proxy'

        appendEphemeralCoachMessage({
          id: `coach_exec_confirm_exit_${exitingSetupId}_${Date.now()}`,
          type: 'post_trade',
          priority: 'setup',
          setupId: exitingSetupId,
          content: `Execution confirmed (${sourceLabel(fillSource)}): EXIT at ${exitPrice.toFixed(2)} vs ${phaseLabel(referencePhase).toUpperCase()} reference ${referencePrice.toFixed(2)} (${signedPointLabel(slippagePoints)} pts slippage).`,
          structuredData: {
            source: 'execution_confirmation',
            action: 'exit_confirmed',
            setupId: exitingSetupId,
            setupDirection: exitingSetup.direction,
            setupType: exitingSetup.type,
            actualPrice: roundTo(exitPrice, 2),
            referenceLabel: phaseLabel(referencePhase),
            referencePrice: roundTo(referencePrice, 2),
            slippagePoints: roundTo(slippagePoints, 2),
            slippageBps: reconciliation?.slippageBps ?? null,
            fillSource,
            reconciliation,
          },
          timestamp: reconciliation?.executedAt || exitTimestamp,
        })
      })()
    }

    setInTradeSetupId(null)
    setInTradeContract(null)
    setTradeEntryPrice(null)
    setTradeEntryContractMid(null)
    setTradeEnteredAt(null)
    persistTradeFocusState(null)

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
      surface: 'trade_focus',
      action: 'exit',
      setupId: exitingSetupId,
    }, { persist: true })
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.TRADE_JOURNAL_CAPTURED, {
      setupId: artifact.setupId,
      artifactId: artifact.artifactId,
      pnlPoints: artifact.pnlPoints,
      pnlDollars: artifact.pnlDollars,
      expectancyR: artifact.expectancyR,
      adherenceScore: artifact.adherenceScore,
    }, { persist: true })
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.UX_MOBILE_FOCUS_CHANGED, {
        action: 'exit',
        setupId: exitingSetupId,
        mobileFullTradeFocusEnabled: uxFlags.mobileFullTradeFocus,
      }, { persist: true })
    }
  }, [
    appendEphemeralCoachMessage,
    inTradeSetupId,
    reportExecutionFill,
    selectedTimeframe,
    spxPrice,
    tradeEnteredAt,
    tradeEntryContractMid,
    tradeEntryPrice,
    tradePnlDollars,
    tradePnlPoints,
    uxFlags.mobileFullTradeFocus,
  ])

  const setChartTimeframe = useCallback((timeframe: ChartTimeframe) => {
    setSelectedTimeframe(timeframe)
  }, [])

  const requestContractRecommendation = useCallback(async (setup: Setup) => {
    const setupId = setup.id
    const stopTimer = startSPXPerfTimer('contract_recommendation_latency')
    const now = Date.now()

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONTRACT_REQUESTED, {
      setupId,
    }, { persist: true })

    if (!accessToken) {
      const durationMs = stopTimer({ setupId, result: 'missing_token' })
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONTRACT_RESULT, {
        setupId,
        result: 'missing_token',
        durationMs,
      }, { level: 'warning', persist: true })
      return null
    }

    const setupUnavailableUntil = contractSetupUnavailableUntilRef.current[setupId] || 0
    if (setupUnavailableUntil > now) {
      const durationMs = stopTimer({
        setupId,
        result: 'setup_backoff',
        backoffUntil: setupUnavailableUntil,
      })
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONTRACT_RESULT, {
        setupId,
        result: 'setup_backoff',
        durationMs,
        backoffMs: setupUnavailableUntil - now,
      }, { level: 'warning', persist: true })
      return setup.recommendedContract || null
    }

    if (contractEndpointModeRef.current === 'unavailable') {
      if (now < contractEndpointUnavailableUntilRef.current) {
        const durationMs = stopTimer({
          setupId,
          result: 'endpoint_backoff',
        })
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONTRACT_RESULT, {
          setupId,
          result: 'endpoint_backoff',
          durationMs,
        }, { level: 'warning', persist: true })
        return setup.recommendedContract || null
      }
      contractEndpointModeRef.current = 'unknown'
    }

    try {
      const requestHeaders = {
        Authorization: `Bearer ${accessToken}`,
      }
      const setupParams = new URLSearchParams({ setupId })
      const getRequest = () => fetch(`/api/spx/contract-select?${setupParams.toString()}`, {
        method: 'GET',
        headers: requestHeaders,
        cache: 'no-store',
      })
      const postRequest = () => fetch('/api/spx/contract-select', {
        method: 'POST',
        headers: {
          ...requestHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setupId,
          setup,
        }),
        cache: 'no-store',
      })

      let response: Response
      const endpointMode = contractEndpointModeRef.current

      if (endpointMode === 'post') {
        response = await postRequest()
        if (response.status === 404 || response.status === 405) {
          const fallback = await getRequest()
          if (fallback.ok) {
            contractEndpointModeRef.current = 'get'
            response = fallback
          } else {
            response = fallback
          }
        }
      } else if (endpointMode === 'get') {
        response = await getRequest()
        if (response.status === 404 || response.status === 405) {
          const fallback = await postRequest()
          if (fallback.ok) {
            contractEndpointModeRef.current = 'post'
            response = fallback
          } else {
            response = fallback
          }
        }
      } else {
        response = await postRequest()
        if (response.ok) {
          contractEndpointModeRef.current = 'post'
        } else if (response.status === 404 || response.status === 405) {
          const fallback = await getRequest()
          if (fallback.ok) {
            contractEndpointModeRef.current = 'get'
            response = fallback
          } else {
            response = fallback
          }
        }
      }

      if (!response.ok) {
        if (response.status === 404) {
          const responseMessage = parseContractResponseMessage(await response.text())
          if (isContractEndpointUnavailableMessage(responseMessage)) {
            contractEndpointModeRef.current = 'unavailable'
            contractEndpointUnavailableUntilRef.current = Date.now() + CONTRACT_ENDPOINT_UNAVAILABLE_BACKOFF_MS
            const durationMs = stopTimer({
              setupId,
              result: 'endpoint_not_found',
              status: response.status,
            })
            trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONTRACT_RESULT, {
              setupId,
              result: 'endpoint_not_found',
              status: response.status,
              durationMs,
              backoffMs: CONTRACT_ENDPOINT_UNAVAILABLE_BACKOFF_MS,
            }, { level: 'warning', persist: true })
            return setup.recommendedContract || null
          }

          contractSetupUnavailableUntilRef.current[setupId] = Date.now() + CONTRACT_ENDPOINT_UNAVAILABLE_BACKOFF_MS
          const durationMs = stopTimer({
            setupId,
            result: 'no_recommendation',
            status: response.status,
          })
          trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONTRACT_RESULT, {
            setupId,
            result: 'no_recommendation',
            status: response.status,
            durationMs,
            backoffMs: CONTRACT_ENDPOINT_UNAVAILABLE_BACKOFF_MS,
          }, { level: 'warning', persist: true })
          return setup.recommendedContract || null
        }

        if (response.status === 405) {
          contractEndpointModeRef.current = 'unavailable'
          contractEndpointUnavailableUntilRef.current = Date.now() + CONTRACT_ENDPOINT_UNAVAILABLE_BACKOFF_MS
          const durationMs = stopTimer({
            setupId,
            result: 'method_not_allowed',
            status: response.status,
          })
          trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONTRACT_RESULT, {
            setupId,
            result: 'method_not_allowed',
            status: response.status,
            durationMs,
            backoffMs: CONTRACT_ENDPOINT_UNAVAILABLE_BACKOFF_MS,
          }, { level: 'warning', persist: true })
          return setup.recommendedContract || null
        }

        if (response.status >= 500) {
          contractEndpointUnavailableUntilRef.current = Date.now() + CONTRACT_ENDPOINT_UNAVAILABLE_BACKOFF_MS
        }

        const durationMs = stopTimer({
          setupId,
          result: 'http_error',
          status: response.status,
        })
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONTRACT_RESULT, {
          setupId,
          result: 'http_error',
          status: response.status,
          durationMs,
        }, { level: response.status >= 500 ? 'error' : 'warning', persist: true })
        return null
      }

      const recommendation = await response.json() as ContractRecommendation
      contractEndpointUnavailableUntilRef.current = 0
      delete contractSetupUnavailableUntilRef.current[setupId]
      const durationMs = stopTimer({
        setupId,
        result: 'success',
      })
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONTRACT_RESULT, {
        setupId,
        result: 'success',
        durationMs,
        strike: recommendation.strike,
        contractType: recommendation.type,
        riskReward: recommendation.riskReward,
      }, { persist: true })

      return recommendation
    } catch (error) {
      const durationMs = stopTimer({
        setupId,
        result: 'exception',
      })
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONTRACT_RESULT, {
        setupId,
        result: 'exception',
        durationMs,
        message: error instanceof Error ? error.message : 'Unknown contract request failure',
      }, { level: 'error', persist: true })
      return null
    }
  }, [accessToken])

  useEffect(() => {
    if (!inTradeSetupId) return
    let isCancelled = false

    const toCandidates = (recommendation: ContractRecommendation): ContractRecommendation[] => {
      const alternatives = Array.isArray(recommendation.alternatives)
        ? recommendation.alternatives.map((alternative) => ({
          ...alternative,
          gamma: recommendation.gamma,
          theta: recommendation.theta,
          vega: recommendation.vega,
          riskReward: recommendation.riskReward,
          expectedPnlAtTarget1: recommendation.expectedPnlAtTarget1,
          expectedPnlAtTarget2: recommendation.expectedPnlAtTarget2,
          reasoning: recommendation.reasoning,
          premiumMid: ((alternative.bid + alternative.ask) / 2) * 100,
          premiumAsk: alternative.ask * 100,
        } as ContractRecommendation))
        : []
      return [recommendation, ...alternatives]
    }

    const refresh = async () => {
      const setup = inTradeSetupRef.current
      if (!setup) return
      const recommendation = await requestContractRecommendation(setup)
      if (isCancelled || !recommendation) return
      const candidates = toCandidates(recommendation)
      const matched = lockedTradeContractSignature
        ? candidates.find((candidate) => contractSignature(candidate) === lockedTradeContractSignature) || null
        : null

      const nextContract = matched || recommendation
      setInTradeContract((previous) => {
        if (!previous) return nextContract
        if (contractSignature(previous) !== contractSignature(nextContract)) return nextContract
        if (previous.bid !== nextContract.bid || previous.ask !== nextContract.ask || previous.premiumMid !== nextContract.premiumMid) {
          return nextContract
        }
        return previous
      })
    }

    void refresh()
    const intervalId = window.setInterval(() => {
      void refresh()
    }, 15_000)

    return () => {
      isCancelled = true
      window.clearInterval(intervalId)
    }
  }, [inTradeSetupId, lockedTradeContractSignature, requestContractRecommendation])

  const sendCoachMessage = useCallback(async (prompt: string, setupId?: string | null) => {
    const stopTimer = startSPXPerfTimer('coach_message_roundtrip')

    if (!accessToken) {
      stopTimer({ setupId: setupId || null, result: 'missing_token' })
      throw new Error('Missing session token for SPX coach request')
    }

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_MESSAGE_SENT, {
      setupId: setupId || null,
      promptLength: prompt.length,
    })

    try {
      const streamMessages = await postSPXStream<CoachMessage>('/api/spx/coach/message', accessToken, {
        prompt,
        setupId: setupId || undefined,
      })
      const nextMessages = streamMessages.filter((message) => Boolean(message?.id))
      if (nextMessages.length === 0) {
        stopTimer({ setupId: setupId || null, result: 'empty_response' })
        throw new Error('SPX coach returned no messages')
      }

      setEphemeralCoachMessages((previous) => {
        const deduped = new Map<string, CoachMessage>()
        for (const message of [...nextMessages, ...previous]) {
          if (!message?.id) continue
          deduped.set(message.id, message)
        }
        return Array.from(deduped.values()).slice(0, 80)
      })

      await mutateSnapshot((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          coachMessages: [...nextMessages, ...prev.coachMessages],
          generatedAt: new Date().toISOString(),
        }
      }, false)

      stopTimer({
        setupId: setupId || null,
        result: 'success',
        messageCount: nextMessages.length,
      })

      if (uxFlags.coachSurfaceV2) {
        void requestCoachDecision({
          setupId: setupId || inTradeSetup?.id || selectedSetup?.id || null,
          question: prompt,
          forceRefresh: true,
          surface: 'spx_coach_message',
        })
      }

      return nextMessages[0]
    } catch (error) {
      stopTimer({
        setupId: setupId || null,
        result: 'exception',
      })
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_MESSAGE_SENT, {
        setupId: setupId || null,
        promptLength: prompt.length,
        result: 'error',
        message: error instanceof Error ? error.message : 'Unknown coach request failure',
      }, { level: 'error' })

      const fallbackMessage: CoachMessage = {
        id: `coach_fallback_${Date.now()}`,
        type: 'behavioral',
        priority: 'alert',
        setupId: setupId || null,
        content: `Coach request failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please retry in a few seconds.`,
        structuredData: {
          source: 'client_fallback',
          failed: true,
          setupId: setupId || null,
        },
        timestamp: new Date().toISOString(),
      }

      setEphemeralCoachMessages((previous) => {
        const deduped = new Map<string, CoachMessage>()
        for (const message of [fallbackMessage, ...previous]) {
          if (!message?.id) continue
          deduped.set(message.id, message)
        }
        return Array.from(deduped.values()).slice(0, 80)
      })

      await mutateSnapshot((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          coachMessages: [fallbackMessage, ...prev.coachMessages],
          generatedAt: new Date().toISOString(),
        }
      }, false)

      return fallbackMessage
    }
  }, [
    accessToken,
    inTradeSetup?.id,
    mutateSnapshot,
    requestCoachDecision,
    selectedSetup?.id,
    uxFlags.coachSurfaceV2,
  ])

  const error = snapshotError || null
  const effectiveFeedError = error?.message || stream.error || null
  const streamTrustState = marketDataOrchestratorRef.current.evaluate(Date.now(), stream.isConnected)
  const resolvedFeedHealth = resolveSPXFeedHealth({
    snapshotIsDegraded,
    snapshotDegradedMessage,
    errorMessage: effectiveFeedError,
    snapshotRequestLate,
    snapshotAvailable: Boolean(snapshotData),
    streamConnected: stream.isConnected,
    spxPriceSource,
    spxPriceAgeMs,
    sequenceGapDetected: streamTrustState.sequenceGapDetected,
    heartbeatStale: streamTrustState.heartbeatStale,
  })
  const dataHealth = resolvedFeedHealth.dataHealth
  const dataHealthMessage = resolvedFeedHealth.dataHealthMessage
  const feedFallbackStage = resolvedFeedHealth.fallbackPolicy.stage
  const feedFallbackReasonCode = resolvedFeedHealth.fallbackPolicy.reasonCode
  const blockTradeEntryByFeedTrust = E2E_ALLOW_STALE_ENTRY && resolvedFeedHealth.dataHealth === 'stale'
    ? false
    : resolvedFeedHealth.fallbackPolicy.blockTradeEntry
  const levelsDataQuality = useMemo<SPXLevelsDataQuality | null>(() => {
    const candidate = snapshotData?.levelsDataQuality || snapshotData?.dataQuality
    if (!candidate || typeof candidate !== 'object') return null
    const integrity = candidate.integrity === 'degraded'
      ? 'degraded'
      : candidate.integrity === 'full'
        ? 'full'
        : null
    if (!integrity) return null
    const warnings = Array.isArray(candidate.warnings)
      ? candidate.warnings.filter((warning): warning is string => typeof warning === 'string')
      : []
    return {
      integrity,
      warnings,
    }
  }, [snapshotData?.dataQuality, snapshotData?.levelsDataQuality])

  useEffect(() => {
    const nextTransitionKey = [
      dataHealth,
      feedFallbackStage,
      feedFallbackReasonCode,
    ].join(':')
    if (lastFeedTrustTransitionRef.current === nextTransitionKey) return
    lastFeedTrustTransitionRef.current = nextTransitionKey

    if (dataHealth !== 'healthy' || feedFallbackReasonCode !== 'none') {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.DATA_HEALTH_CHANGED, {
        dataHealth,
        message: dataHealthMessage,
        spxPriceSource,
        spxPriceAgeMs,
        feedFallbackStage,
        feedFallbackReasonCode,
        blockTradeEntryByFeedTrust,
        streamConnected: stream.isConnected,
        sequenceGapDetected: resolvedFeedHealth.flags.sequenceGapDetected,
        heartbeatStale: resolvedFeedHealth.flags.heartbeatStale,
        lastRealtimeEventAtMs: streamTrustState.lastEventAtMs,
      }, { level: dataHealth === 'degraded' ? 'warning' : 'info' })
    }
  }, [
    dataHealth,
    dataHealthMessage,
    feedFallbackReasonCode,
    feedFallbackStage,
    blockTradeEntryByFeedTrust,
    resolvedFeedHealth.flags.heartbeatStale,
    resolvedFeedHealth.flags.sequenceGapDetected,
    spxPriceAgeMs,
    spxPriceSource,
    stream.isConnected,
    streamTrustState.lastEventAtMs,
  ])

  const liveAnalyticsState = useMemo<SPXAnalyticsContextState>(() => ({
    dataHealth,
    dataHealthMessage,
    feedFallbackStage,
    feedFallbackReasonCode,
    blockTradeEntryByFeedTrust,
    levelsDataQuality,
    basis: snapshotData?.basis || null,
    spyImpact: snapshotData?.spyImpact || null,
    regime: snapshotData?.regime?.regime || null,
    prediction: snapshotData?.prediction || null,
    levels: filteredLevels,
    clusterZones: snapshotData?.clusters || [],
    fibLevels: snapshotData?.fibLevels || [],
    gexProfile: snapshotData?.gex || null,
    isLoading,
    error,
  }), [
    dataHealth,
    dataHealthMessage,
    feedFallbackReasonCode,
    feedFallbackStage,
    blockTradeEntryByFeedTrust,
    error,
    filteredLevels,
    isLoading,
    levelsDataQuality,
    snapshotData,
  ])

  const liveCoachState = useMemo<SPXCoachContextState>(() => ({
    coachMessages,
    sendCoachMessage,
    coachDecision,
    coachDecisionStatus,
    coachDecisionError,
    requestCoachDecision,
  }), [
    coachDecision,
    coachDecisionError,
    coachDecisionStatus,
    coachMessages,
    requestCoachDecision,
    sendCoachMessage,
  ])

  const liveFlowState = useMemo<SPXFlowContextState>(() => ({
    flowEvents,
    flowAggregation: snapshotData?.flowAggregation || null,
  }), [flowEvents, snapshotData?.flowAggregation])

  const liveSetupState = useMemo<SPXSetupContextState>(() => ({
    activeSetups,
    standbyGuidance: snapshotData?.standbyGuidance || null,
    selectedSetup,
    tradeMode,
    inTradeSetup,
    inTradeSetupId,
    activeTradePlan,
    selectedSetupContract,
    inTradeContract,
    tradeEntryPrice,
    tradeEnteredAt,
    tradePnlPoints,
    tradeEntryContractMid,
    tradeCurrentContractMid,
    tradePnlDollars,
    chartAnnotations,
    selectSetup,
    setSetupContractChoice,
    enterTrade,
    exitTrade,
    requestContractRecommendation,
    visibleLevelCategories,
    showSPYDerived,
    toggleLevelCategory,
    toggleSPYDerived,
  }), [
    activeSetups,
    activeTradePlan,
    chartAnnotations,
    enterTrade,
    exitTrade,
    inTradeContract,
    inTradeSetup,
    inTradeSetupId,
    requestContractRecommendation,
    selectSetup,
    selectedSetup,
    selectedSetupContract,
    setSetupContractChoice,
    showSPYDerived,
    toggleLevelCategory,
    toggleSPYDerived,
    tradeCurrentContractMid,
    tradeEntryContractMid,
    tradeEntryPrice,
    tradeEnteredAt,
    tradeMode,
    tradePnlDollars,
    tradePnlPoints,
    visibleLevelCategories,
    snapshotData?.standbyGuidance,
  ])

  const livePriceState = useMemo<SPXPriceContextState>(() => ({
    spxPrice,
    spxTickTimestamp,
    spxPriceAgeMs,
    spxPriceSource,
    spyPrice,
    snapshotGeneratedAt: snapshotData?.generatedAt || null,
    priceStreamConnected: stream.isConnected,
    priceStreamConnectionStatus: stream.connectionStatus,
    priceStreamFeedHealth: stream.feedHealth,
    priceStreamError: stream.error,
    selectedTimeframe,
    setChartTimeframe,
    latestMicrobar,
  }), [
    latestMicrobar,
    selectedTimeframe,
    setChartTimeframe,
    snapshotData?.generatedAt,
    spxPrice,
    spxPriceAgeMs,
    spxPriceSource,
    spxTickTimestamp,
    spyPrice,
    stream.connectionStatus,
    stream.error,
    stream.feedHealth,
    stream.isConnected,
  ])

  useEffect(() => {
    if (!uxFlags.contextSplitV1 || !legacyPriceStateRef.current) {
      legacyPriceStateRef.current = livePriceState
    }
  }, [livePriceState, uxFlags.contextSplitV1])

  useEffect(() => {
    if (!uxFlags.contextSplitV1 || !legacyAnalyticsStateRef.current) {
      legacyAnalyticsStateRef.current = liveAnalyticsState
    }
  }, [liveAnalyticsState, uxFlags.contextSplitV1])

  useEffect(() => {
    if (!uxFlags.contextSplitV1 || !legacyCoachStateRef.current) {
      legacyCoachStateRef.current = liveCoachState
    }
  }, [liveCoachState, uxFlags.contextSplitV1])

  useEffect(() => {
    if (!uxFlags.contextSplitV1 || !legacyFlowStateRef.current) {
      legacyFlowStateRef.current = liveFlowState
    }
  }, [liveFlowState, uxFlags.contextSplitV1])

  useEffect(() => {
    if (!uxFlags.contextSplitV1 || !legacySetupStateRef.current) {
      legacySetupStateRef.current = liveSetupState
    }
  }, [liveSetupState, uxFlags.contextSplitV1])

  const legacyPriceState = uxFlags.contextSplitV1 && legacyPriceStateRef.current
    ? legacyPriceStateRef.current
    : livePriceState
  const legacyAnalyticsState = uxFlags.contextSplitV1 && legacyAnalyticsStateRef.current
    ? legacyAnalyticsStateRef.current
    : liveAnalyticsState
  const legacyCoachState = uxFlags.contextSplitV1 && legacyCoachStateRef.current
    ? legacyCoachStateRef.current
    : liveCoachState
  const legacyFlowState = uxFlags.contextSplitV1 && legacyFlowStateRef.current
    ? legacyFlowStateRef.current
    : liveFlowState
  const legacySetupState = uxFlags.contextSplitV1 && legacySetupStateRef.current
    ? legacySetupStateRef.current
    : liveSetupState

  const value = useMemo<SPXCommandCenterState>(() => ({
    dataHealth: legacyAnalyticsState.dataHealth,
    dataHealthMessage: legacyAnalyticsState.dataHealthMessage,
    feedFallbackStage: legacyAnalyticsState.feedFallbackStage,
    feedFallbackReasonCode: legacyAnalyticsState.feedFallbackReasonCode,
    blockTradeEntryByFeedTrust: legacyAnalyticsState.blockTradeEntryByFeedTrust,
    levelsDataQuality: legacyAnalyticsState.levelsDataQuality || null,
    spxPrice: legacyPriceState.spxPrice,
    spxTickTimestamp: legacyPriceState.spxTickTimestamp,
    spxPriceAgeMs: legacyPriceState.spxPriceAgeMs,
    spxPriceSource: legacyPriceState.spxPriceSource,
    spyPrice: legacyPriceState.spyPrice,
    snapshotGeneratedAt: legacyPriceState.snapshotGeneratedAt,
    priceStreamConnected: legacyPriceState.priceStreamConnected,
    priceStreamConnectionStatus: legacyPriceState.priceStreamConnectionStatus,
    priceStreamFeedHealth: legacyPriceState.priceStreamFeedHealth,
    priceStreamError: legacyPriceState.priceStreamError,
    basis: legacyAnalyticsState.basis,
    spyImpact: legacyAnalyticsState.spyImpact,
    regime: legacyAnalyticsState.regime,
    prediction: legacyAnalyticsState.prediction,
    levels: legacyAnalyticsState.levels,
    clusterZones: legacyAnalyticsState.clusterZones,
    fibLevels: legacyAnalyticsState.fibLevels,
    gexProfile: legacyAnalyticsState.gexProfile,
    activeSetups: legacySetupState.activeSetups,
    standbyGuidance: legacySetupState.standbyGuidance,
    coachMessages: legacyCoachState.coachMessages,
    coachDecision: legacyCoachState.coachDecision,
    coachDecisionStatus: legacyCoachState.coachDecisionStatus,
    coachDecisionError: legacyCoachState.coachDecisionError,
    uxFlags,
    selectedSetup: legacySetupState.selectedSetup,
    tradeMode: legacySetupState.tradeMode,
    inTradeSetup: legacySetupState.inTradeSetup,
    inTradeSetupId: legacySetupState.inTradeSetupId,
    selectedSetupContract: legacySetupState.selectedSetupContract,
    inTradeContract: legacySetupState.inTradeContract,
    tradeEntryPrice: legacySetupState.tradeEntryPrice,
    tradeEnteredAt: legacySetupState.tradeEnteredAt,
    tradePnlPoints: legacySetupState.tradePnlPoints,
    tradeEntryContractMid: legacySetupState.tradeEntryContractMid,
    tradeCurrentContractMid: legacySetupState.tradeCurrentContractMid,
    tradePnlDollars: legacySetupState.tradePnlDollars,
    selectedTimeframe: legacyPriceState.selectedTimeframe,
    setChartTimeframe: legacyPriceState.setChartTimeframe,
    visibleLevelCategories: legacySetupState.visibleLevelCategories,
    showSPYDerived: legacySetupState.showSPYDerived,
    chartAnnotations: legacySetupState.chartAnnotations,
    flowEvents: legacyFlowState.flowEvents,
    flowAggregation: legacyFlowState.flowAggregation,
    latestMicrobar: legacyPriceState.latestMicrobar,
    isLoading: legacyAnalyticsState.isLoading,
    error: legacyAnalyticsState.error,
    selectSetup: legacySetupState.selectSetup,
    setSetupContractChoice: legacySetupState.setSetupContractChoice,
    enterTrade: legacySetupState.enterTrade,
    exitTrade: legacySetupState.exitTrade,
    toggleLevelCategory: legacySetupState.toggleLevelCategory,
    toggleSPYDerived: legacySetupState.toggleSPYDerived,
    requestContractRecommendation: legacySetupState.requestContractRecommendation,
    sendCoachMessage: legacyCoachState.sendCoachMessage,
    requestCoachDecision: legacyCoachState.requestCoachDecision,
  }), [
    legacyAnalyticsState,
    legacyCoachState,
    legacyFlowState,
    legacyPriceState,
    legacySetupState,
    uxFlags,
  ])

  return (
    <SPXCommandCenterContext.Provider value={value}>
      <SPXPriceProvider value={livePriceState}>
        <SPXAnalyticsProvider value={liveAnalyticsState}>
          <SPXSetupProvider value={liveSetupState}>
            <SPXFlowProvider value={liveFlowState}>
              <SPXCoachProvider value={liveCoachState}>
                {children}
              </SPXCoachProvider>
            </SPXFlowProvider>
          </SPXSetupProvider>
        </SPXAnalyticsProvider>
      </SPXPriceProvider>
    </SPXCommandCenterContext.Provider>
  )
}

export function useSPXCommandCenter() {
  const context = useContext(SPXCommandCenterContext)
  if (!context) {
    throw new Error('useSPXCommandCenter must be used inside SPXCommandCenterProvider')
  }

  return context
}
