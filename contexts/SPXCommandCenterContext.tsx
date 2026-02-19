'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { SPXAnalyticsProvider, type SPXAnalyticsContextState } from '@/contexts/spx/SPXAnalyticsContext'
import { SPXCoachProvider, type SPXCoachContextState } from '@/contexts/spx/SPXCoachContext'
import { SPXFlowProvider, type SPXFlowContextState } from '@/contexts/spx/SPXFlowContext'
import { SPXPriceProvider, type SPXPriceContextState } from '@/contexts/spx/SPXPriceContext'
import {
  SPXSetupProvider,
  type SPXChartAnnotation,
  type SPXSetupContextState,
} from '@/contexts/spx/SPXSetupContext'
import { postSPX, postSPXStream } from '@/hooks/use-spx-api'
import { usePriceStream, type RealtimeSocketMessage } from '@/hooks/use-price-stream'
import { useSPXSnapshot } from '@/hooks/use-spx-snapshot'
import { distanceToStopPoints, isFlowDivergence, summarizeFlowAlignment } from '@/lib/spx/coach-context'
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
  GEXProfile,
  LevelCategory,
  PredictionState,
  Regime,
  Setup,
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

interface SPXCommandCenterState {
  dataHealth: 'healthy' | 'degraded' | 'stale'
  dataHealthMessage: string | null
  spxPrice: number
  spxTickTimestamp: string | null
  spxPriceAgeMs: number | null
  spxPriceSource: 'tick' | 'poll' | 'snapshot' | null
  spyPrice: number
  snapshotGeneratedAt: string | null
  priceStreamConnected: boolean
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
const TICK_FRESHNESS_STALE_MS = 7_500
const POLL_FRESHNESS_STALE_MS = 90_000
const REALTIME_SETUP_RETENTION_MS = 15 * 60 * 1000
const TRADE_FOCUS_STORAGE_KEY = 'spx_command_center:trade_focus'
const SPX_PUBLIC_CHANNELS = ['setups:update', 'coach:message', 'price:SPX'] as const
const PROACTIVE_COACH_COOLDOWN_MS = 45_000
const PROACTIVE_FLOW_DIVERGENCE_THRESHOLD = 42
const PROACTIVE_STOP_DISTANCE_THRESHOLD = 3
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

function toEpoch(value: string | null | undefined): number {
  if (!value) return 0
  const epoch = Date.parse(value)
  return Number.isFinite(epoch) ? epoch : 0
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

    const recencyA = a.triggeredAt ? toEpoch(a.triggeredAt) : toEpoch(a.createdAt)
    const recencyB = b.triggeredAt ? toEpoch(b.triggeredAt) : toEpoch(b.createdAt)
    if (recencyB !== recencyA) return recencyB - recencyA

    return a.id.localeCompare(b.id)
  })
}

function setupRecencyEpoch(setup: Setup): number {
  return Math.max(toEpoch(setup.triggeredAt), toEpoch(setup.createdAt))
}

function roundTo(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals))
}

function setupSemanticKey(setup: Setup): string {
  return [
    setup.type,
    setup.direction,
    roundTo(setup.entryZone.low, 2),
    roundTo(setup.entryZone.high, 2),
    roundTo(setup.stop, 2),
    roundTo(setup.target1.price, 2),
    roundTo(setup.target2.price, 2),
    setup.regime,
  ].join('|')
}

function dedupeSetupsBySemanticKey(setups: Setup[]): Setup[] {
  const ranked = rankSetups(setups)
  const deduped: Setup[] = []
  const seen = new Set<string>()

  for (const setup of ranked) {
    const key = setupSemanticKey(setup)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(setup)
  }

  return rankSetups(deduped)
}

function shouldKeepExistingSetup(existing: Setup, incoming: Setup): boolean {
  const existingPriority = SETUP_STATUS_PRIORITY[existing.status]
  const incomingPriority = SETUP_STATUS_PRIORITY[incoming.status]
  const existingRecency = setupRecencyEpoch(existing)
  const incomingRecency = setupRecencyEpoch(incoming)

  if (existing.status === 'triggered' && (incoming.status === 'ready' || incoming.status === 'forming')) {
    return incomingRecency <= existingRecency + 60_000
  }

  if (existingPriority < incomingPriority && existingRecency >= incomingRecency) {
    return true
  }

  return false
}

function mergeSetup(existing: Setup | undefined, incoming: Setup): Setup {
  if (!existing) return incoming
  if (shouldKeepExistingSetup(existing, incoming)) {
    return {
      ...incoming,
      ...existing,
      recommendedContract: existing.recommendedContract ?? incoming.recommendedContract,
    }
  }

  return {
    ...incoming,
    recommendedContract: incoming.recommendedContract ?? existing.recommendedContract,
  }
}

function mergeActionableSetups(existingSetups: Setup[], incomingSetups: Setup[]): Setup[] {
  const now = Date.now()
  const incomingIds = new Set(incomingSetups.map((setup) => setup.id))
  const merged = new Map(existingSetups.map((setup) => [setup.id, setup]))

  for (const incoming of incomingSetups) {
    const current = merged.get(incoming.id)
    const nextSetup = mergeSetup(current, incoming)
    if (ACTIONABLE_SETUP_STATUSES.has(nextSetup.status)) {
      merged.set(nextSetup.id, nextSetup)
    } else {
      merged.delete(nextSetup.id)
    }
  }

  for (const existing of existingSetups) {
    if (incomingIds.has(existing.id)) continue
    if (!ACTIONABLE_SETUP_STATUSES.has(existing.status)) {
      merged.delete(existing.id)
      continue
    }
    const isRecent = now - setupRecencyEpoch(existing) <= REALTIME_SETUP_RETENTION_MS
    if (!isRecent) {
      merged.delete(existing.id)
    }
  }

  return dedupeSetupsBySemanticKey(Array.from(merged.values()))
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
  const [latestMicrobar, setLatestMicrobar] = useState<RealtimeMicrobar | null>(null)
  const inTradeSetupRef = useRef<Setup | null>(null)
  const coachDecisionRequestSequenceRef = useRef(0)
  const pageToFirstActionableStopperRef = useRef<null | ((payload?: Record<string, unknown>) => number | null)>(null)
  const pageToFirstSetupSelectStopperRef = useRef<null | ((payload?: Record<string, unknown>) => number | null)>(null)
  const hasTrackedFirstActionableRef = useRef(false)
  const hasTrackedFirstSetupSelectRef = useRef(false)
  const hasTrackedPageViewRef = useRef(false)
  const lastDataHealthRef = useRef<'healthy' | 'degraded' | 'stale' | null>(null)
  const proactiveCooldownByKeyRef = useRef<Record<string, number>>({})
  const previousSetupStatusByIdRef = useRef<Record<string, Setup['status']>>({})
  const legacyPriceStateRef = useRef<SPXPriceContextState | null>(null)
  const legacyAnalyticsStateRef = useRef<SPXAnalyticsContextState | null>(null)
  const legacyCoachStateRef = useRef<SPXCoachContextState | null>(null)
  const legacyFlowStateRef = useRef<SPXFlowContextState | null>(null)
  const legacySetupStateRef = useRef<SPXSetupContextState | null>(null)
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

  const handleRealtimeMessage = useCallback((message: RealtimeSocketMessage) => {
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

    if (message.type === 'spx_coach') {
      const payload = message.data
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return
      const content = typeof (payload as { content?: unknown }).content === 'string'
        ? (payload as { content: string }).content.trim()
        : ''
      if (!content) return

      const timestamp = typeof message.timestamp === 'string' ? message.timestamp : new Date().toISOString()
      const setupId = typeof (payload as { setupId?: unknown }).setupId === 'string'
        ? (payload as { setupId: string }).setupId
        : null
      const messageId = `coach_ws_${timestamp}_${setupId || 'global'}_${content.slice(0, 24)}`

      const coachMessage: CoachMessage = {
        id: messageId,
        type: isCoachType((payload as { type?: unknown }).type) ? (payload as { type: CoachMessage['type'] }).type : 'behavioral',
        priority: isCoachPriority((payload as { priority?: unknown }).priority)
          ? (payload as { priority: CoachMessage['priority'] }).priority
          : 'guidance',
        setupId,
        content,
        structuredData: {
          source: 'ws',
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
    const snapshotSetups = (snapshotData?.setups || []).filter((setup) => ACTIONABLE_SETUP_STATUSES.has(setup.status))
    setRealtimeSetups((previous) => mergeActionableSetups(previous, snapshotSetups))
  }, [snapshotData?.generatedAt, snapshotData?.setups])

  const activeSetups = useMemo(() => rankSetups(realtimeSetups), [realtimeSetups])
  const allLevels = useMemo(() => snapshotData?.levels || [], [snapshotData?.levels])
  const inTradeSetup = useMemo(
    () => (inTradeSetupId ? activeSetups.find((setup) => setup.id === inTradeSetupId) || null : null),
    [activeSetups, inTradeSetupId],
  )
  const tradeMode: TradeMode = inTradeSetupId ? 'in_trade' : 'scan'

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

  const requestCoachDecision = useCallback(async (input?: {
    setupId?: string | null
    question?: string
    forceRefresh?: boolean
    surface?: string
  }): Promise<CoachDecisionBrief | null> => {
    const requestSequence = ++coachDecisionRequestSequenceRef.current
    const requestSetupId = input?.setupId || inTradeSetup?.id || selectedSetup?.id || null
    const requestTradeMode = tradeMode === 'in_trade'
      ? 'in_trade'
      : requestSetupId
        ? 'evaluate'
        : 'scan'
    const activeContract = tradeMode === 'in_trade' ? inTradeContract : selectedSetupContract

    if (!accessToken) {
      if (requestSequence !== coachDecisionRequestSequenceRef.current) return null
      setCoachDecisionStatus('error')
      setCoachDecisionError('Missing session token for coach decision request.')
      return null
    }

    setCoachDecisionStatus('loading')
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
      setCoachDecision(decision)
      setCoachDecisionStatus('ready')
      setCoachDecisionError(null)

      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_DECISION_GENERATED, {
        decisionId: decision.decisionId,
        setupId: decision.setupId,
        verdict: decision.verdict,
        confidence: decision.confidence,
        severity: decision.severity,
        source: decision.source,
        tradeMode: requestTradeMode,
      }, { persist: true })

      if (decision.source === 'fallback_v1') {
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_DECISION_FALLBACK_USED, {
          decisionId: decision.decisionId,
          setupId: decision.setupId,
          verdict: decision.verdict,
          source: decision.source,
          tradeMode: requestTradeMode,
        }, { level: 'warning', persist: true })
      }

      return decision
    } catch (error) {
      if (requestSequence !== coachDecisionRequestSequenceRef.current) return null
      const message = error instanceof Error ? error.message : 'Coach decision request failed.'
      setCoachDecisionStatus('error')
      setCoachDecisionError(message)

      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_DECISION_FALLBACK_USED, {
        setupId: requestSetupId,
        verdict: null,
        source: 'client_error',
        tradeMode: requestTradeMode,
        message,
      }, { level: 'warning', persist: true })

      return null
    }
  }, [
    accessToken,
    inTradeContract,
    inTradeSetup?.id,
    selectedSetup?.id,
    selectedSetupContract,
    tradeMode,
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
        type: 'target',
        price: selectedSetup.target1.price,
        label: selectedSetup.target1.label,
      },
      {
        id: `${selectedSetup.id}-target2`,
        type: 'target',
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
  const flowEvents = useMemo(() => snapshotData?.flow || [], [snapshotData?.flow])

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

  useEffect(() => {
    const nextStatusById: Record<string, Setup['status']> = {}
    for (const setup of activeSetups) {
      nextStatusById[setup.id] = setup.status
    }

    if (!uxFlags.coachProactive) {
      previousSetupStatusByIdRef.current = nextStatusById
      return
    }

    for (const setup of activeSetups) {
      const previousStatus = previousSetupStatusByIdRef.current[setup.id]
      if (!previousStatus) continue
      if (previousStatus === 'triggered' || setup.status !== 'triggered') continue

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

    previousSetupStatusByIdRef.current = nextStatusById
  }, [activeSetups, flowEvents, pushProactiveCoachMessage, uxFlags.coachProactive])

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
      content: `Price is within ${stopDistance.toFixed(1)} points of your stop. ${flowSummary && flowSummary.alignmentPct >= 55 ? `Flow still confirms ${flowSummary.alignmentPct}%, but consider tightening.` : 'Consider reducing risk or exiting if confirmation does not improve.'}`,
      structuredData: {
        source: 'client_proactive',
        reason: 'stop_proximity',
        stopDistance,
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

    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.UX_MOBILE_FOCUS_CHANGED, {
        action: 'enter',
        setupId: target.id,
        setupStatus: target.status,
        mobileFullTradeFocusEnabled: uxFlags.mobileFullTradeFocus,
      }, { persist: true })
    }
  }, [selectedContractBySetupId, selectedSetup, selectedSetupContract, spxPrice, uxFlags.mobileFullTradeFocus])

  const exitTrade = useCallback(() => {
    const exitingSetupId = inTradeSetupId
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
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.UX_MOBILE_FOCUS_CHANGED, {
        action: 'exit',
        setupId: exitingSetupId,
        mobileFullTradeFocusEnabled: uxFlags.mobileFullTradeFocus,
      }, { persist: true })
    }
  }, [inTradeSetupId, uxFlags.mobileFullTradeFocus])

  const setChartTimeframe = useCallback((timeframe: ChartTimeframe) => {
    setSelectedTimeframe(timeframe)
  }, [])

  const requestContractRecommendation = useCallback(async (setup: Setup) => {
    const setupId = setup.id
    const stopTimer = startSPXPerfTimer('contract_recommendation_latency')

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

    try {
      const requestHeaders = {
        Authorization: `Bearer ${accessToken}`,
      }
      const setupParams = new URLSearchParams({ setupId })
      let response = await fetch(`/api/spx/contract-select?${setupParams.toString()}`, {
        method: 'GET',
        headers: requestHeaders,
        cache: 'no-store',
      })

      // Compatibility fallback: older/newer upstream deployments may differ
      // on whether contract-select expects GET or POST.
      if (response.status === 404 || response.status === 405) {
        response = await fetch('/api/spx/contract-select', {
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
      }

      if (!response.ok) {
        if (response.status === 404) {
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
          }, { level: 'warning', persist: true })
          return setup.recommendedContract || null
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
  const tickSourceStale = spxPriceSource === 'tick'
    && spxPriceAgeMs != null
    && spxPriceAgeMs > TICK_FRESHNESS_STALE_MS
  const pollSourceStale = spxPriceSource === 'poll'
    && spxPriceAgeMs != null
    && spxPriceAgeMs > POLL_FRESHNESS_STALE_MS
  const dataHealth = useMemo<'healthy' | 'degraded' | 'stale'>(() => {
    if (snapshotIsDegraded || error || snapshotRequestLate) return 'degraded'
    if (stream.isConnected && (spxPriceSource === 'poll' || spxPriceSource === 'snapshot' || tickSourceStale || pollSourceStale)) return 'stale'
    if (!stream.isConnected && Boolean(snapshotData?.generatedAt)) return 'stale'
    return 'healthy'
  }, [
    error,
    pollSourceStale,
    snapshotData?.generatedAt,
    snapshotIsDegraded,
    snapshotRequestLate,
    spxPriceSource,
    stream.isConnected,
    tickSourceStale,
  ])

  const dataHealthMessage = useMemo(() => {
    if (snapshotIsDegraded) {
      return snapshotDegradedMessage || 'SPX service is running in degraded mode.'
    }
    if (error?.message) {
      return error.message
    }
    if (snapshotRequestLate && !snapshotData) {
      return 'SPX snapshot request is delayed. Core chart stream is still active while analytics recover.'
    }
    if (tickSourceStale) {
      const seconds = spxPriceAgeMs != null ? Math.floor(spxPriceAgeMs / 1000) : null
      return `Tick stream lag detected (${seconds != null ? `${seconds}s` : 'unknown'} behind). Falling back to last known price until feed recovers.`
    }
    if (spxPriceSource === 'poll' && stream.isConnected) {
      return 'Live tick feed unavailable. Streaming over poll fallback, so chart and price updates may lag.'
    }
    if (spxPriceSource === 'snapshot' && stream.isConnected) {
      return 'WebSocket connected but no live price packets received yet. Running on snapshot fallback.'
    }
    if (pollSourceStale) {
      return 'Poll fallback data is stale. Waiting for fresher provider bars or tick feed recovery.'
    }
    if (dataHealth === 'stale') {
      return 'Live stream disconnected and snapshot is stale. Reconnecting in background.'
    }
    return null
  }, [
    dataHealth,
    error,
    pollSourceStale,
    snapshotData,
    snapshotDegradedMessage,
    snapshotIsDegraded,
    snapshotRequestLate,
    spxPriceAgeMs,
    spxPriceSource,
    stream.isConnected,
    tickSourceStale,
  ])

  useEffect(() => {
    if (lastDataHealthRef.current === dataHealth) return
    lastDataHealthRef.current = dataHealth

    if (dataHealth !== 'healthy') {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.DATA_HEALTH_CHANGED, {
        dataHealth,
        message: dataHealthMessage,
      }, { level: dataHealth === 'degraded' ? 'warning' : 'info' })
    }
  }, [dataHealth, dataHealthMessage])

  const liveAnalyticsState = useMemo<SPXAnalyticsContextState>(() => ({
    dataHealth,
    dataHealthMessage,
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
    error,
    filteredLevels,
    isLoading,
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
  }), [flowEvents])

  const liveSetupState = useMemo<SPXSetupContextState>(() => ({
    activeSetups,
    selectedSetup,
    tradeMode,
    inTradeSetup,
    inTradeSetupId,
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
  ])

  const livePriceState = useMemo<SPXPriceContextState>(() => ({
    spxPrice,
    spxTickTimestamp,
    spxPriceAgeMs,
    spxPriceSource,
    spyPrice,
    snapshotGeneratedAt: snapshotData?.generatedAt || null,
    priceStreamConnected: stream.isConnected,
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
    stream.error,
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
    spxPrice: legacyPriceState.spxPrice,
    spxTickTimestamp: legacyPriceState.spxTickTimestamp,
    spxPriceAgeMs: legacyPriceState.spxPriceAgeMs,
    spxPriceSource: legacyPriceState.spxPriceSource,
    spyPrice: legacyPriceState.spyPrice,
    snapshotGeneratedAt: legacyPriceState.snapshotGeneratedAt,
    priceStreamConnected: legacyPriceState.priceStreamConnected,
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
