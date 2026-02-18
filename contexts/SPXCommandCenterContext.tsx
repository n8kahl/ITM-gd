'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { postSPXStream } from '@/hooks/use-spx-api'
import { usePriceStream, type RealtimeSocketMessage } from '@/hooks/use-price-stream'
import { useSPXSnapshot } from '@/hooks/use-spx-snapshot'
import { SPX_TELEMETRY_EVENT, startSPXPerfTimer, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import type {
  BasisState,
  ClusterZone,
  CoachMessage,
  ContractRecommendation,
  FibLevel,
  GEXProfile,
  LevelCategory,
  PredictionState,
  Regime,
  Setup,
  SpyImpactState,
  SPXLevel,
} from '@/lib/types/spx-command-center'

type ChartTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D'

interface ChartAnnotation {
  id: string
  type: 'entry_zone' | 'stop' | 'target'
  priceLow?: number
  priceHigh?: number
  price?: number
  label: string
}

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
  selectedSetup: Setup | null
  tradeMode: TradeMode
  inTradeSetup: Setup | null
  inTradeSetupId: string | null
  tradeEntryPrice: number | null
  tradeEnteredAt: string | null
  tradePnlPoints: number | null
  selectedTimeframe: ChartTimeframe
  setChartTimeframe: (timeframe: ChartTimeframe) => void
  visibleLevelCategories: Set<LevelCategory>
  showSPYDerived: boolean
  chartAnnotations: ChartAnnotation[]
  flowEvents: Array<{
    id: string
    type: 'sweep' | 'block'
    symbol: 'SPX' | 'SPY'
    strike: number
    expiry: string
    size: number
    direction: 'bullish' | 'bearish'
    premium: number
    timestamp: string
  }>
  latestMicrobar: RealtimeMicrobar | null
  isLoading: boolean
  error: Error | null
  selectSetup: (setup: Setup | null) => void
  enterTrade: (setup?: Setup | null) => void
  exitTrade: () => void
  toggleLevelCategory: (category: LevelCategory) => void
  toggleSPYDerived: () => void
  requestContractRecommendation: (setup: Setup) => Promise<ContractRecommendation | null>
  sendCoachMessage: (prompt: string, setupId?: string | null) => Promise<CoachMessage>
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

  return rankSetups(Array.from(merged.values()))
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

interface PersistedTradeFocusState {
  setupId: string
  entryPrice: number | null
  enteredAt: string
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
  const [tradeEntryPrice, setTradeEntryPrice] = useState<number | null>(null)
  const [tradeEnteredAt, setTradeEnteredAt] = useState<string | null>(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChartTimeframe>('1m')
  const [visibleLevelCategories, setVisibleLevelCategories] = useState<Set<LevelCategory>>(new Set(ALL_CATEGORIES))
  const [showSPYDerived, setShowSPYDerived] = useState(true)
  const [snapshotRequestLate, setSnapshotRequestLate] = useState(false)
  const [ephemeralCoachMessages, setEphemeralCoachMessages] = useState<CoachMessage[]>([])
  const [realtimeSetups, setRealtimeSetups] = useState<Setup[]>([])
  const [latestMicrobar, setLatestMicrobar] = useState<RealtimeMicrobar | null>(null)
  const pageToFirstActionableStopperRef = useRef<null | ((payload?: Record<string, unknown>) => number | null)>(null)
  const pageToFirstSetupSelectStopperRef = useRef<null | ((payload?: Record<string, unknown>) => number | null)>(null)
  const hasTrackedFirstActionableRef = useRef(false)
  const hasTrackedFirstSetupSelectRef = useRef(false)
  const hasTrackedPageViewRef = useRef(false)
  const lastDataHealthRef = useRef<'healthy' | 'degraded' | 'stale' | null>(null)

  useEffect(() => {
    const persisted = loadPersistedTradeFocus()
    if (!persisted) return
    setInTradeSetupId(persisted.setupId)
    setTradeEntryPrice(persisted.entryPrice)
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

  useEffect(() => {
    if (!inTradeSetupId) return
    const exists = activeSetups.some((setup) => setup.id === inTradeSetupId)
    if (exists) return

    setInTradeSetupId(null)
    setTradeEntryPrice(null)
    setTradeEnteredAt(null)
    persistTradeFocusState(null)

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
      surface: 'trade_focus',
      action: 'auto_exit_missing_setup',
      setupId: inTradeSetupId,
    }, { level: 'warning', persist: true })
  }, [activeSetups, inTradeSetupId])

  const spxStreamPrice = stream.prices.get('SPX')
  const spyStreamPrice = stream.prices.get('SPY')
  const spxPrice = spxStreamPrice?.price ?? snapshotData?.basis?.spxPrice ?? 0
  const spxTickTimestamp = spxStreamPrice?.timestamp ?? null
  const spxPriceSource = spxStreamPrice?.source ?? (snapshotData?.basis?.spxPrice ? 'snapshot' : null)
  const spxPriceAgeMs = spxStreamPrice?.feedAgeMs ?? calculateAgeMs(spxTickTimestamp)
  const spyPrice = spyStreamPrice?.price ?? snapshotData?.basis?.spyPrice ?? 0
  const tradePnlPoints = useMemo(() => {
    if (!inTradeSetup || tradeEntryPrice == null || !Number.isFinite(spxPrice) || spxPrice <= 0) return null
    const move = spxPrice - tradeEntryPrice
    return inTradeSetup.direction === 'bullish' ? move : -move
  }, [inTradeSetup, spxPrice, tradeEntryPrice])

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

  useEffect(() => {
    if (hasTrackedPageViewRef.current) return
    hasTrackedPageViewRef.current = true

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.PAGE_VIEW, {
      route: '/members/spx-command-center',
      hasSession: Boolean(accessToken),
    }, { persist: true })
    pageToFirstActionableStopperRef.current = startSPXPerfTimer('ttfa_actionable_render')
    pageToFirstSetupSelectStopperRef.current = startSPXPerfTimer('ttfa_setup_select')
  }, [accessToken])

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
    const enteredAt = new Date().toISOString()

    setSelectedSetupId(target.id)
    setInTradeSetupId(target.id)
    setTradeEntryPrice(entryPrice)
    setTradeEnteredAt(enteredAt)
    persistTradeFocusState({
      setupId: target.id,
      entryPrice,
      enteredAt,
    })

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
      surface: 'trade_focus',
      action: 'enter',
      setupId: target.id,
      setupStatus: target.status,
      setupDirection: target.direction,
      entryPrice,
    }, { persist: true })
  }, [selectedSetup, spxPrice])

  const exitTrade = useCallback(() => {
    const exitingSetupId = inTradeSetupId
    setInTradeSetupId(null)
    setTradeEntryPrice(null)
    setTradeEnteredAt(null)
    persistTradeFocusState(null)

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
      surface: 'trade_focus',
      action: 'exit',
      setupId: exitingSetupId,
    }, { persist: true })
  }, [inTradeSetupId])

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
      const response = await fetch('/api/spx/contract-select', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setupId,
          setup,
        }),
        cache: 'no-store',
      })

      if (!response.ok) {
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
  }, [accessToken, mutateSnapshot])

  const error = snapshotError || null
  const tickSourceStale = spxPriceSource === 'tick'
    && spxPriceAgeMs != null
    && spxPriceAgeMs > TICK_FRESHNESS_STALE_MS
  const pollSourceStale = spxPriceSource === 'poll'
    && spxPriceAgeMs != null
    && spxPriceAgeMs > POLL_FRESHNESS_STALE_MS
  const dataHealth = useMemo<'healthy' | 'degraded' | 'stale'>(() => {
    if (snapshotIsDegraded || error || snapshotRequestLate) return 'degraded'
    if (stream.isConnected && (spxPriceSource === 'poll' || tickSourceStale || pollSourceStale)) return 'stale'
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

  const value = useMemo<SPXCommandCenterState>(() => ({
    dataHealth,
    dataHealthMessage,
    spxPrice,
    spxTickTimestamp,
    spxPriceAgeMs,
    spxPriceSource,
    spyPrice,
    snapshotGeneratedAt: snapshotData?.generatedAt || null,
    priceStreamConnected: stream.isConnected,
    priceStreamError: stream.error,
    basis: snapshotData?.basis || null,
    spyImpact: snapshotData?.spyImpact || null,
    regime: snapshotData?.regime?.regime || null,
    prediction: snapshotData?.prediction || null,
    levels: filteredLevels,
    clusterZones: snapshotData?.clusters || [],
    fibLevels: snapshotData?.fibLevels || [],
    gexProfile: snapshotData?.gex || null,
    activeSetups,
    coachMessages,
    selectedSetup,
    tradeMode,
    inTradeSetup,
    inTradeSetupId,
    tradeEntryPrice,
    tradeEnteredAt,
    tradePnlPoints,
    selectedTimeframe,
    setChartTimeframe,
    visibleLevelCategories,
    showSPYDerived,
    chartAnnotations,
    flowEvents: snapshotData?.flow || [],
    latestMicrobar,
    isLoading,
    error,
    selectSetup,
    enterTrade,
    exitTrade,
    toggleLevelCategory,
    toggleSPYDerived,
    requestContractRecommendation,
    sendCoachMessage,
  }), [
    activeSetups,
    chartAnnotations,
    dataHealth,
    dataHealthMessage,
    error,
    filteredLevels,
    isLoading,
    latestMicrobar,
    tradeMode,
    inTradeSetup,
    inTradeSetupId,
    tradeEntryPrice,
    tradeEnteredAt,
    tradePnlPoints,
    requestContractRecommendation,
    selectSetup,
    enterTrade,
    exitTrade,
    sendCoachMessage,
    selectedSetup,
    selectedTimeframe,
    setChartTimeframe,
    showSPYDerived,
    snapshotData,
    coachMessages,
    stream.error,
    stream.isConnected,
    spxPrice,
    spxPriceAgeMs,
    spxTickTimestamp,
    spxPriceSource,
    spyPrice,
    toggleLevelCategory,
    toggleSPYDerived,
    visibleLevelCategories,
  ])

  return (
    <SPXCommandCenterContext.Provider value={value}>
      {children}
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
