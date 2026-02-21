'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle,
  BellOff,
  Bot,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXCoachContext } from '@/contexts/spx/SPXCoachContext'
import { useSPXFlowContext } from '@/contexts/spx/SPXFlowContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { CoachMessageCard } from '@/components/spx-command-center/coach-message'
import { applySPXAlertSuppression } from '@/lib/spx/alert-suppression'
import { normalizeCoachDecisionForMode } from '@/lib/spx/coach-decision-policy'
import { cn } from '@/lib/utils'
import type {
  CoachDecisionAction,
  CoachDecisionBrief,
  CoachDecisionSeverity,
  CoachDecisionVerdict,
  CoachMessage,
  Setup,
} from '@/lib/types/spx-command-center'
import { summarizeFlowAlignment } from '@/lib/spx/coach-context'
import { buildSPXScenarioLanes } from '@/lib/spx/scenario-lanes'
import { SPX_SHORTCUT_EVENT, type SPXCoachQuickActionEventDetail } from '@/lib/spx/shortcut-events'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import {
  COACH_ALERT_LIFECYCLE_EVENT,
  acknowledgeCoachAlertCritical,
  findTopCoachAlertV2,
  loadCoachAlertLifecycleState,
  markCoachAlertSeen,
  muteCoachAlert,
  resolveCoachAlertSeverity,
  shouldAutoMarkAlertSeen,
  snoozeCoachAlert,
  type CoachAlertLifecycleState,
} from '@/lib/spx/coach-alert-state-v2'

const PRE_TRADE_ACTIONS = [
  { id: 'confirm_entry', label: 'Confirm entry?', icon: Target },
  { id: 'risk_check', label: 'Risk check', icon: ShieldCheck },
  { id: 'exit_strategy', label: 'Exit strategy', icon: TrendingDown },
  { id: 'size_guidance', label: 'Size guidance', icon: ShieldAlert },
] as const

const ACTIVE_TRADE_ACTIONS = [
  { id: 'risk_check', label: 'Risk check', icon: ShieldCheck },
  { id: 'exit_strategy', label: 'Exit strategy', icon: TrendingDown },
  { id: 'hold_or_trim', label: 'Hold or trim?', icon: TrendingUp },
  { id: 'size_adjustment', label: 'Size adjustment', icon: ShieldAlert },
] as const

const ALERT_AUTO_SEEN_DELAY_MS = 2_000
const ALERT_SNOOZE_DURATION_MS = 5 * 60 * 1000
const ALERT_MUTE_DURATION_MS = 30 * 60 * 1000
const TIMELINE_BOTTOM_THRESHOLD_PX = 28

function toScopedPrompt(prompt: string, setupId?: string | null): string {
  if (!setupId) return prompt
  return `${prompt}\nSetup ID: ${setupId}`
}

function toDecisionTone(severity: CoachDecisionSeverity): string {
  if (severity === 'critical') return 'border-rose-300/45 bg-rose-500/12'
  if (severity === 'warning') return 'border-amber-300/35 bg-amber-500/10'
  return 'border-emerald-300/35 bg-emerald-500/10'
}

function verdictPill(verdict: CoachDecisionVerdict): string {
  if (verdict === 'ENTER') return 'border-emerald-300/45 bg-emerald-500/16 text-emerald-100'
  if (verdict === 'EXIT') return 'border-rose-300/45 bg-rose-500/16 text-rose-100'
  if (verdict === 'REDUCE') return 'border-amber-300/45 bg-amber-500/16 text-amber-100'
  return 'border-white/20 bg-white/[0.06] text-white/80'
}

function actionClasses(action: CoachDecisionAction): string {
  if (action.style === 'primary') {
    return 'border-emerald-300/45 bg-emerald-500/16 text-emerald-100 hover:bg-emerald-500/28'
  }
  if (action.style === 'secondary') {
    return 'border-white/18 bg-white/[0.05] text-white/82 hover:bg-white/[0.12]'
  }
  return 'border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]'
}

function resolveActionLabel(action: CoachDecisionAction): string {
  if (action.id === 'REVERT_AI_CONTRACT') return 'Use AI Contract'
  if (action.id === 'EXIT_TRADE_FOCUS') return 'Exit Trade Focus'
  return action.label
}

function normalizeDecisionActions(actions: CoachDecisionAction[]): CoachDecisionAction[] {
  const deduped: CoachDecisionAction[] = []
  const seen = new Set<string>()

  for (const action of actions) {
    // History already has a dedicated control below; keep decision row execution-focused.
    if (action.id === 'OPEN_HISTORY') continue
    const key = `${action.id}:${resolveActionLabel(action).trim().toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(action)
    if (deduped.length >= 2) break
  }

  return deduped.map((action, index) => (
    index === 0 ? action : { ...action, style: 'ghost' }
  ))
}

function staleAgeLabel(decision: CoachDecisionBrief | null): string | null {
  if (!decision) return null
  const generatedEpoch = Date.parse(decision.freshness.generatedAt)
  if (!Number.isFinite(generatedEpoch)) return null
  const elapsedMs = Math.max(Date.now() - generatedEpoch, 0)
  const seconds = Math.floor(elapsedMs / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function findSetupById(setups: Setup[], setupId?: string | null): Setup | null {
  if (!setupId) return null
  return setups.find((setup) => setup.id === setupId) || null
}

function decisionStatusLabel(status: 'idle' | 'loading' | 'ready' | 'error'): string {
  if (status === 'loading') return 'Refreshing'
  if (status === 'error') return 'Delayed'
  if (status === 'ready') return 'Live'
  return 'Idle'
}

export function AICoachFeed({ readOnly = false }: { readOnly?: boolean }) {
  const { uxFlags } = useSPXCommandCenter()
  const { regime } = useSPXAnalyticsContext()
  const { spxPrice } = useSPXPriceContext()
  const {
    selectedSetup,
    activeSetups,
    tradeMode,
    inTradeSetup,
    activeTradePlan,
    selectSetup,
    enterTrade,
    exitTrade,
    setSetupContractChoice,
  } = useSPXSetupContext()
  const {
    coachMessages,
    sendCoachMessage,
    coachDecision,
    coachDecisionStatus,
    coachDecisionError,
    requestCoachDecision,
  } = useSPXCoachContext()
  const { flowEvents } = useSPXFlowContext()
  const prefersReducedMotion = useReducedMotion()

  const [prompt, setPrompt] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showAllMessages, setShowAllMessages] = useState(false)
  const [alertLifecycleState, setAlertLifecycleState] = useState<CoachAlertLifecycleState>(() => loadCoachAlertLifecycleState())
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [isTimelineAtBottom, setIsTimelineAtBottom] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [quickPromptsOpen, setQuickPromptsOpen] = useState(false)

  const timelineRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const autoSeenTimeoutRef = useRef<number | null>(null)
  const lastVisibleMessageIdRef = useRef<string | null>(null)

  const scopedSetup = inTradeSetup || selectedSetup
  const coachDecisionMode = tradeMode === 'in_trade' ? 'in_trade' : (scopedSetup ? 'evaluate' : 'scan')
  const effectiveCoachDecision = useMemo(
    () => normalizeCoachDecisionForMode(
      coachDecision,
      coachDecisionMode,
      { scopedSetupId: scopedSetup?.id || null },
    ),
    [coachDecision, coachDecisionMode, scopedSetup?.id],
  )

  useEffect(() => {
    setShowAllMessages(false)
    setHistoryOpen(true)
  }, [scopedSetup?.id])

  useEffect(() => {
    const handleLifecycleSync = (event: Event) => {
      const custom = event as CustomEvent<{ state?: CoachAlertLifecycleState }>
      if (custom.detail?.state) {
        setAlertLifecycleState(custom.detail.state)
        return
      }
      setAlertLifecycleState(loadCoachAlertLifecycleState())
    }

    window.addEventListener(COACH_ALERT_LIFECYCLE_EVENT, handleLifecycleSync as EventListener)
    return () => {
      window.removeEventListener(COACH_ALERT_LIFECYCLE_EVENT, handleLifecycleSync as EventListener)
    }
  }, [])

  const setupTypeById = useMemo(() => {
    return new Map(activeSetups.map((setup) => [setup.id, setup.type.replace(/_/g, ' ')]))
  }, [activeSetups])

  const scopedMessages = useMemo(() => {
    if (scopedSetup && !showAllMessages) {
      return coachMessages.filter((message) => !message.setupId || message.setupId === scopedSetup.id)
    }
    return coachMessages
  }, [coachMessages, scopedSetup, showAllMessages])
  const suppressedAlertResult = useMemo(
    () => applySPXAlertSuppression(scopedMessages),
    [scopedMessages],
  )
  const effectiveMessages = suppressedAlertResult.messages

  const pinnedAlert = useMemo(
    () => findTopCoachAlertV2(effectiveMessages, alertLifecycleState),
    [alertLifecycleState, effectiveMessages],
  )

  const pinnedAlertSeverity = useMemo(
    () => (pinnedAlert ? resolveCoachAlertSeverity(pinnedAlert) : null),
    [pinnedAlert],
  )

  const visibleMessages = useMemo(
    () => effectiveMessages.filter((message) => message.id !== pinnedAlert?.id),
    [effectiveMessages, pinnedAlert?.id],
  )

  const groupedMessages = useMemo(() => {
    const groups = new Map<string, CoachMessage[]>()

    visibleMessages.forEach((message) => {
      const key = message.setupId || '__global__'
      const existing = groups.get(key)
      if (existing) {
        existing.push(message)
      } else {
        groups.set(key, [message])
      }
    })

    return Array.from(groups.entries()).map(([groupId, messages]) => {
      if (groupId === '__global__') {
        return { id: groupId, label: 'General Guidance', messages }
      }
      if (scopedSetup && groupId === scopedSetup.id) {
        return { id: groupId, label: 'Selected Setup', messages }
      }
      const setupType = setupTypeById.get(groupId)
      return {
        id: groupId,
        label: setupType ? `Setup · ${setupType}` : `Setup · ${groupId.slice(0, 8)}`,
        messages,
      }
    })
  }, [scopedSetup, setupTypeById, visibleMessages])

  const flowSummary = useMemo(() => {
    if (!scopedSetup) return null
    return summarizeFlowAlignment(flowEvents.slice(0, 12), scopedSetup.direction)
  }, [flowEvents, scopedSetup])
  const scenarioLanes = useMemo(
    () => buildSPXScenarioLanes(scopedSetup, Number.isFinite(spxPrice) && spxPrice > 0 ? spxPrice : null),
    [scopedSetup, spxPrice],
  )

  const quickActions = useMemo(() => {
    if (!uxFlags.coachProactive) {
      if (tradeMode === 'in_trade') {
        return [
          { ...ACTIVE_TRADE_ACTIONS[0], prompt: 'I am in this trade now. Reassess stop risk and invalidation conditions using current flow/regime.' },
          { ...ACTIVE_TRADE_ACTIONS[1], prompt: 'I am in this trade now. Give precise scaling/exit rules for T1/T2 and trailing stop logic.' },
          { ...ACTIVE_TRADE_ACTIONS[2], prompt: 'I am in this trade now. Should I hold, trim, or fully exit based on current conditions?' },
          { ...ACTIVE_TRADE_ACTIONS[3], prompt: 'I am in this trade now. Should I keep size, reduce risk, or add only on confirmation?' },
        ]
      }
      return [
        { ...PRE_TRADE_ACTIONS[0], prompt: 'Should I enter this setup now? Validate confluence and timing.' },
        { ...PRE_TRADE_ACTIONS[1], prompt: 'Run a risk check on the selected setup. What could go wrong?' },
        { ...PRE_TRADE_ACTIONS[2], prompt: 'What is the optimal exit strategy for this setup? When to take partials?' },
        { ...PRE_TRADE_ACTIONS[3], prompt: 'What position size is appropriate for this setup given current conditions?' },
      ]
    }

    if (tradeMode === 'in_trade') {
      return ACTIVE_TRADE_ACTIONS.map((action) => {
        if (action.id === 'risk_check') {
          const flowHint = flowSummary ? `Flow alignment is ${flowSummary.alignmentPct}%.` : 'Flow alignment is still warming.'
          return {
            ...action,
            prompt: `I am in this trade now. Reassess stop risk, invalidation, and immediate downside scenarios. ${flowHint}`,
          }
        }
        if (action.id === 'exit_strategy') {
          return {
            ...action,
            prompt: `I am in this trade now. Give precise scaling and exit rules for ${scopedSetup?.target1.label || 'T1'} ${scopedSetup ? scopedSetup.target1.price.toFixed(0) : '--'} and ${scopedSetup?.target2.label || 'T2'} ${scopedSetup ? scopedSetup.target2.price.toFixed(0) : '--'}.`,
          }
        }
        if (action.id === 'hold_or_trim') {
          const planPnl = activeTradePlan?.pnlDollars
          const pnlHint = planPnl == null ? 'P&L is flat.' : `Contract P&L is ${planPnl >= 0 ? '+' : ''}$${planPnl.toFixed(0)}.`
          return {
            ...action,
            prompt: `I am in this trade now. Should I hold, trim, or fully exit right now? ${pnlHint} Use current flow/regime and stop proximity.`,
          }
        }
        return {
          ...action,
          prompt: 'I am in this trade now. Should I keep size, reduce risk, or add only on high-confidence confirmation?',
        }
      })
    }

    return PRE_TRADE_ACTIONS.map((action) => {
      if (action.id === 'confirm_entry') {
        if (!scopedSetup) {
          return {
            ...action,
            prompt: 'Should I enter this setup now? Validate confluence and timing.',
          }
        }
        const flowHint = flowSummary ? `Flow alignment ${flowSummary.alignmentPct}%.` : 'Flow still building.'
        return {
          ...action,
          prompt: `Should I enter ${scopedSetup.direction.toUpperCase()} ${scopedSetup.regime} now at ${scopedSetup.entryZone.low.toFixed(0)}-${scopedSetup.entryZone.high.toFixed(0)}? Confluence ${scopedSetup.confluenceScore}/5. ${flowHint}`,
        }
      }
      if (action.id === 'risk_check') {
        if (!scopedSetup) {
          return {
            ...action,
            prompt: 'Run a risk check on the selected setup. What could go wrong?',
          }
        }
        return {
          ...action,
          prompt: `Run a risk check for this ${scopedSetup.direction} setup in ${regime || scopedSetup.regime}. Stop is ${scopedSetup.stop.toFixed(0)} and entry zone is ${scopedSetup.entryZone.low.toFixed(0)}-${scopedSetup.entryZone.high.toFixed(0)}.`,
        }
      }
      if (action.id === 'exit_strategy') {
        if (!scopedSetup) {
          return {
            ...action,
            prompt: 'What is the optimal exit strategy for this setup? When to take partials?',
          }
        }
        return {
          ...action,
          prompt: `Define the optimal exit plan for this setup: ${scopedSetup.target1.label} ${scopedSetup.target1.price.toFixed(0)}, ${scopedSetup.target2.label} ${scopedSetup.target2.price.toFixed(0)}, and stop ${scopedSetup.stop.toFixed(0)}.`,
        }
      }
      if (!scopedSetup) {
        return {
          ...action,
          prompt: 'What position size is appropriate for this setup given current conditions?',
        }
      }
      return {
        ...action,
        prompt: `Give position sizing guidance for this setup. Probability ${scopedSetup.probability.toFixed(0)}%, confluence ${scopedSetup.confluenceScore}/5, direction ${scopedSetup.direction}.`,
      }
    })
  }, [activeTradePlan?.pnlDollars, flowSummary, regime, scopedSetup, tradeMode, uxFlags.coachProactive])

  const sendMessage = useCallback(async (text: string, options?: { setupId?: string | null; forceRefresh?: boolean }) => {
    setSendError(null)
    setIsSending(true)

    try {
      const scopedId = options?.setupId ?? scopedSetup?.id
      const contractContext = tradeMode === 'in_trade' && activeTradePlan?.contract
        ? `\nContract: ${activeTradePlan.contract.description}\nEntry mid: ${activeTradePlan.entryContractMid?.toFixed(2) ?? '--'}\nCurrent mid: ${activeTradePlan.currentContractMid?.toFixed(2) ?? '--'}\nContract P&L: ${activeTradePlan.pnlDollars == null ? '--' : `${activeTradePlan.pnlDollars >= 0 ? '+' : ''}$${activeTradePlan.pnlDollars.toFixed(0)}`}`
        : ''

      await sendCoachMessage(`${text}${contractContext}`, scopedId)
      setPrompt('')
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Coach request failed. Please try again.')
    } finally {
      setIsSending(false)
    }
  }, [
    scopedSetup?.id,
    sendCoachMessage,
    tradeMode,
    activeTradePlan,
  ])

  const handleDecisionAction = useCallback(async (action: CoachDecisionAction) => {
    const actionSetupId = typeof action.payload?.setupId === 'string' ? action.payload.setupId : scopedSetup?.id || null
    const actionSetup = findSetupById(activeSetups, actionSetupId) || scopedSetup

    if (action.style === 'primary') {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_PRIMARY_ACTION_CLICKED, {
        actionId: action.id,
        setupId: actionSetupId,
        tradeMode,
        decisionId: effectiveCoachDecision?.decisionId || null,
      }, { persist: true })
    } else {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_SECONDARY_ACTION_CLICKED, {
        actionId: action.id,
        setupId: actionSetupId,
        tradeMode,
        decisionId: effectiveCoachDecision?.decisionId || null,
      }, { persist: true })
    }

    if (tradeMode === 'in_trade' && action.id === 'ENTER_TRADE_FOCUS') {
      return
    }
    if (tradeMode !== 'in_trade' && action.id === 'EXIT_TRADE_FOCUS') {
      return
    }

    if (action.id === 'ENTER_TRADE_FOCUS' && actionSetup) {
      selectSetup(actionSetup)
      enterTrade(actionSetup)
      void requestCoachDecision({
        setupId: actionSetup.id,
        forceRefresh: true,
        surface: 'spx_coach_action_enter',
      })
      return
    }

    if (action.id === 'EXIT_TRADE_FOCUS') {
      exitTrade()
      void requestCoachDecision({
        setupId: actionSetupId,
        forceRefresh: true,
        surface: 'spx_coach_action_exit',
      })
      return
    }

    if (action.id === 'REVERT_AI_CONTRACT') {
      if (actionSetup?.recommendedContract) {
        setSetupContractChoice(actionSetup, actionSetup.recommendedContract)
      }
      void requestCoachDecision({
        setupId: actionSetup?.id || actionSetupId,
        forceRefresh: true,
        surface: 'spx_coach_action_revert_contract',
      })
      return
    }

    if (action.id === 'OPEN_HISTORY') {
      setHistoryOpen(true)
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_HISTORY_OPENED, {
        setupId: actionSetupId,
        tradeMode,
        decisionId: effectiveCoachDecision?.decisionId || null,
      }, { persist: true })
      return
    }

    if (action.id === 'ASK_FOLLOW_UP') {
      inputRef.current?.focus()
      return
    }

    if (action.id === 'TIGHTEN_STOP_GUIDANCE') {
      await sendMessage('Give precise stop-tightening guidance now based on this exact setup and live flow.', {
        setupId: actionSetupId,
        forceRefresh: true,
      })
      return
    }

    if (action.id === 'REDUCE_SIZE_GUIDANCE') {
      await sendMessage('Should I reduce size now? Quantify urgency, trigger conditions, and specific risk actions.', {
        setupId: actionSetupId,
        forceRefresh: true,
      })
    }
  }, [
    activeSetups,
    effectiveCoachDecision?.decisionId,
    enterTrade,
    exitTrade,
    requestCoachDecision,
    scopedSetup,
    selectSetup,
    sendMessage,
    setSetupContractChoice,
    tradeMode,
  ])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!prompt.trim() || isSending) return
    await sendMessage(prompt.trim())
  }

  useEffect(() => {
    if (readOnly) return

    const handleShortcutQuickAction = (event: Event) => {
      if (isSending) return

      const custom = event as CustomEvent<SPXCoachQuickActionEventDetail>
      const index = custom.detail?.index
      if (!Number.isInteger(index) || index == null || index < 0) return

      const nextAction = quickActions[index]
      if (!nextAction) return

      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.UX_SHORTCUT_USED, {
        action: 'coach_quick_action_dispatch',
        quickActionIndex: index + 1,
        quickActionLabel: nextAction.label,
        source: custom.detail?.source || 'keyboard',
        tradeMode,
        selectedSetupId: scopedSetup?.id || null,
      })

      void sendMessage(toScopedPrompt(nextAction.prompt, scopedSetup?.id))
    }

    window.addEventListener(SPX_SHORTCUT_EVENT.COACH_QUICK_ACTION, handleShortcutQuickAction as EventListener)
    return () => {
      window.removeEventListener(SPX_SHORTCUT_EVENT.COACH_QUICK_ACTION, handleShortcutQuickAction as EventListener)
    }
  }, [isSending, quickActions, readOnly, scopedSetup?.id, sendMessage, tradeMode])

  useEffect(() => {
    if (!pinnedAlert) return
    if (!shouldAutoMarkAlertSeen(pinnedAlert, alertLifecycleState)) return

    autoSeenTimeoutRef.current = window.setTimeout(() => {
      setAlertLifecycleState((previous) => markCoachAlertSeen(previous, pinnedAlert))
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_ALERT_SEEN, {
        messageId: pinnedAlert.id,
        setupId: pinnedAlert.setupId,
        severity: resolveCoachAlertSeverity(pinnedAlert),
        tradeMode,
        surface: 'ai_coach_feed',
      }, { persist: true })
    }, ALERT_AUTO_SEEN_DELAY_MS)

    return () => {
      if (autoSeenTimeoutRef.current != null) {
        window.clearTimeout(autoSeenTimeoutRef.current)
      }
    }
  }, [alertLifecycleState, pinnedAlert, tradeMode])

  const dismissPinnedAlert = useCallback((message: CoachMessage) => {
    setAlertLifecycleState((previous) => acknowledgeCoachAlertCritical(previous, message))
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_ALERT_ACK, {
      messageId: message.id,
      priority: message.priority,
      setupId: message.setupId,
      severity: resolveCoachAlertSeverity(message),
      surface: 'ai_coach_feed',
    }, { persist: true })
  }, [])

  const snoozePinnedAlert = useCallback((message: CoachMessage) => {
    setAlertLifecycleState((previous) => snoozeCoachAlert(previous, message, ALERT_SNOOZE_DURATION_MS))
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_ALERT_SNOOZED, {
      messageId: message.id,
      setupId: message.setupId,
      severity: resolveCoachAlertSeverity(message),
      durationMs: ALERT_SNOOZE_DURATION_MS,
      tradeMode,
      surface: 'ai_coach_feed',
    }, { persist: true })
  }, [tradeMode])

  const mutePinnedAlert = useCallback((message: CoachMessage) => {
    setAlertLifecycleState((previous) => muteCoachAlert(previous, message, ALERT_MUTE_DURATION_MS))
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_ALERT_MUTED, {
      messageId: message.id,
      setupId: message.setupId,
      severity: resolveCoachAlertSeverity(message),
      durationMs: ALERT_MUTE_DURATION_MS,
      tradeMode,
      surface: 'ai_coach_feed',
    }, { persist: true })
  }, [tradeMode])

  const scrollTimelineToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const node = timelineRef.current
    if (!node) return
    node.scrollTo({
      top: node.scrollHeight,
      behavior,
    })
  }, [])

  const handleTimelineScroll = useCallback(() => {
    if (!uxFlags.coachTimelineV2) return
    const node = timelineRef.current
    if (!node) return

    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight
    const nextAtBottom = distanceFromBottom <= TIMELINE_BOTTOM_THRESHOLD_PX
    setIsTimelineAtBottom(nextAtBottom)
    if (nextAtBottom) {
      setShowJumpToLatest(false)
    }
  }, [uxFlags.coachTimelineV2])

  useEffect(() => {
    if (!uxFlags.coachTimelineV2) return

    const latestMessageId = visibleMessages[0]?.id || null
    if (!latestMessageId) {
      lastVisibleMessageIdRef.current = null
      return
    }

    if (!lastVisibleMessageIdRef.current) {
      lastVisibleMessageIdRef.current = latestMessageId
      scrollTimelineToBottom('auto')
      return
    }

    if (lastVisibleMessageIdRef.current !== latestMessageId) {
      if (isTimelineAtBottom || !historyOpen) {
        scrollTimelineToBottom(prefersReducedMotion ? 'auto' : 'smooth')
      } else {
        setShowJumpToLatest(true)
      }
    }

    lastVisibleMessageIdRef.current = latestMessageId
  }, [historyOpen, isTimelineAtBottom, prefersReducedMotion, scrollTimelineToBottom, uxFlags.coachTimelineV2, visibleMessages])

  useEffect(() => {
    if (suppressedAlertResult.suppressedCount <= 0) return
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_NO_CHANGE_SUPPRESSED, {
      suppressedCount: suppressedAlertResult.suppressedCount,
      setupId: scopedSetup?.id || null,
      tradeMode,
      surface: 'ai_coach_feed',
    })
  }, [scopedSetup?.id, suppressedAlertResult.suppressedCount, tradeMode])

  const handleMessageActionChip = useCallback((action: string, message: CoachMessage) => {
    const setupId = message.setupId || scopedSetup?.id || null
    const actionPrompt = `Apply this action now: ${action}. Keep response concise and execution-focused.`

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_MESSAGE_ACTION_CLICKED, {
      messageId: message.id,
      setupId,
      action,
      tradeMode,
      surface: 'ai_coach_feed',
    }, { persist: true })

    void sendMessage(toScopedPrompt(actionPrompt, setupId), {
      setupId,
      forceRefresh: true,
    })
  }, [scopedSetup?.id, sendMessage, tradeMode])

  const latestMessage = visibleMessages[0] || null
  const decisionAge = staleAgeLabel(effectiveCoachDecision)
  const decisionActions = useMemo(
    () => normalizeDecisionActions(effectiveCoachDecision?.actions || []),
    [effectiveCoachDecision?.actions],
  )
  const coachDecisionDisplayStatus = coachDecisionStatus === 'loading' && effectiveCoachDecision
    ? 'ready'
    : coachDecisionStatus

  return (
    <section
      className="glass-card-heavy rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.025] to-champagne/5 p-3 flex flex-col gap-2 min-h-[220px]"
      data-testid="spx-ai-coach-feed"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] uppercase tracking-[0.14em] text-white/60">AI Coach</h3>
          <span className={cn(
            'rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em]',
            coachDecisionDisplayStatus === 'ready'
              ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
              : coachDecisionDisplayStatus === 'loading'
                ? 'border-champagne/35 bg-champagne/12 text-champagne'
                : coachDecisionDisplayStatus === 'error'
                  ? 'border-rose-300/35 bg-rose-500/12 text-rose-100'
                  : 'border-white/18 bg-white/[0.05] text-white/70',
          )}>
            {decisionStatusLabel(coachDecisionDisplayStatus)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!scopedSetup}
            onClick={() => setShowAllMessages(false)}
            className={cn(
              'min-h-[36px] rounded border px-2.5 py-1 text-[9px] uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-45',
              !showAllMessages
                ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200'
                : 'border-white/15 bg-white/[0.03] text-white/50',
            )}
          >
            Focused
          </button>
          <button
            type="button"
            onClick={() => setShowAllMessages(true)}
            className={cn(
              'min-h-[36px] rounded border px-2.5 py-1 text-[9px] uppercase tracking-[0.08em]',
              showAllMessages
                ? 'border-champagne/35 bg-champagne/12 text-champagne'
                : 'border-white/15 bg-white/[0.03] text-white/50',
            )}
          >
            All
          </button>
        </div>
      </div>

      {tradeMode === 'in_trade' && inTradeSetup && (
        <div className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-[0.1em] text-emerald-200/85">
            In-Trade Guidance Active · {inTradeSetup.direction} {inTradeSetup.regime}
          </p>
        </div>
      )}

      {scenarioLanes.length > 0 && (
        <div className="rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-2" data-testid="spx-coach-scenario-lanes">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/48">Scenario lanes</p>
          <div className="mt-1.5 grid gap-1 text-[10px] text-white/78">
            {scenarioLanes.map((lane) => (
              <div key={lane.id} className="flex items-center justify-between gap-2">
                <span className="text-white/62">{lane.label}</span>
                <span className={cn(
                  'rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.07em]',
                  lane.type === 'base'
                    ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100'
                    : lane.type === 'adverse'
                      ? 'border-rose-300/30 bg-rose-500/10 text-rose-100'
                      : 'border-sky-300/30 bg-sky-500/10 text-sky-100',
                )}>
                  {lane.price.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {pinnedAlert && (
          <motion.div
            key={pinnedAlert.id}
            initial={uxFlags.coachMotionV1 && !prefersReducedMotion ? { opacity: 0, y: -6 } : undefined}
            animate={uxFlags.coachMotionV1 && !prefersReducedMotion ? { opacity: 1, y: 0 } : undefined}
            exit={uxFlags.coachMotionV1 && !prefersReducedMotion ? { opacity: 0, y: -6 } : undefined}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={cn(
              'rounded-lg border px-3 py-2',
              pinnedAlertSeverity === 'critical'
                ? 'border-rose-300/45 bg-rose-500/14'
                : pinnedAlertSeverity === 'warning'
                  ? 'border-amber-300/35 bg-amber-500/12'
                  : 'border-emerald-400/25 bg-emerald-500/10',
            )}
            data-testid="spx-ai-coach-pinned-alert"
          >
            <div className="flex items-center justify-between gap-2">
              <p className={cn(
                'inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.1em]',
                pinnedAlertSeverity === 'critical'
                  ? 'text-rose-100'
                  : pinnedAlertSeverity === 'warning'
                    ? 'text-amber-100'
                    : 'text-emerald-100',
              )}>
                <AlertTriangle className="h-3 w-3" />
                {pinnedAlertSeverity === 'critical'
                  ? 'Critical Alert'
                  : pinnedAlertSeverity === 'warning'
                    ? 'Warning Alert'
                    : 'Coach Insight'}
              </p>
              <div className="flex items-center gap-1">
                {pinnedAlertSeverity === 'critical' ? (
                  <button
                    type="button"
                    data-testid="spx-ai-coach-alert-ack"
                    onClick={() => dismissPinnedAlert(pinnedAlert)}
                    className="rounded border border-rose-300/35 bg-rose-400/15 px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-rose-100 hover:bg-rose-400/25"
                  >
                    Acknowledge
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      data-testid="spx-ai-coach-alert-snooze"
                      onClick={() => snoozePinnedAlert(pinnedAlert)}
                      className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/[0.06] px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-white/80 hover:bg-white/[0.12]"
                    >
                      <Clock3 className="h-3 w-3" />
                      Snooze 5m
                    </button>
                    <button
                      type="button"
                      data-testid="spx-ai-coach-alert-mute"
                      onClick={() => mutePinnedAlert(pinnedAlert)}
                      className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/[0.06] px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-white/80 hover:bg-white/[0.12]"
                    >
                      <BellOff className="h-3 w-3" />
                      Mute 30m
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="mt-1 text-[12px] leading-snug text-ivory">{pinnedAlert.content}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {uxFlags.coachSurfaceV2 && (
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={effectiveCoachDecision?.decisionId || scopedSetup?.id || 'coach-brief'}
            data-testid="spx-coach-decision-brief"
            initial={uxFlags.coachMotionV1 && !prefersReducedMotion ? { opacity: 0, y: 6 } : undefined}
            animate={uxFlags.coachMotionV1 && !prefersReducedMotion ? { opacity: 1, y: 0 } : undefined}
            exit={uxFlags.coachMotionV1 && !prefersReducedMotion ? { opacity: 0, y: -6 } : undefined}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'rounded-xl border px-3 py-2.5',
              toDecisionTone(effectiveCoachDecision?.severity || 'routine'),
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.1em] text-white/70">
                  <Bot className="h-3 w-3 text-emerald-200" />
                  Decision Brief
                  {decisionAge && (
                    <span className="inline-flex items-center gap-1 text-white/45">
                      <Clock3 className="h-3 w-3" />
                      {decisionAge}
                    </span>
                  )}
                </p>
                {effectiveCoachDecision ? (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={cn('rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em]', verdictPill(effectiveCoachDecision.verdict))}>
                      {effectiveCoachDecision.verdict}
                    </span>
                    <span className="rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-white/75">
                      Confidence {effectiveCoachDecision.confidence}%
                    </span>
                    {effectiveCoachDecision.freshness.stale && (
                      <span className="rounded border border-rose-300/30 bg-rose-500/12 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-rose-100">
                        Stale
                      </span>
                    )}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                disabled={coachDecisionStatus === 'loading'}
                onClick={() => {
                  void requestCoachDecision({
                    setupId: scopedSetup?.id || null,
                    forceRefresh: true,
                    surface: 'spx_coach_manual_refresh',
                  })
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/[0.05] text-white/70 hover:bg-white/[0.12] disabled:opacity-40"
                aria-label="Refresh coach decision"
              >
                {coachDecisionStatus === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </button>
            </div>

            {effectiveCoachDecision ? (
              <>
                <p className="mt-2 text-[12px] leading-snug text-ivory">{effectiveCoachDecision.primaryText}</p>

                {effectiveCoachDecision.why.length > 0 && (
                  <ul className="mt-2 space-y-1 text-[11px] text-white/78">
                    {effectiveCoachDecision.why.slice(0, 3).map((line, index) => (
                      <li key={`${effectiveCoachDecision.decisionId}-why-${index}`} className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 text-emerald-200/85" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {(effectiveCoachDecision.riskPlan?.invalidation || effectiveCoachDecision.riskPlan?.positionGuidance || effectiveCoachDecision.riskPlan?.stop || effectiveCoachDecision.riskPlan?.maxRiskDollars) && (
                  <div className="mt-2.5 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-2">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-white/50">Risk Plan</p>
                    <div className="mt-1 grid gap-1 text-[10px] text-white/75">
                      {effectiveCoachDecision.riskPlan?.invalidation && <p>Invalidation: {effectiveCoachDecision.riskPlan.invalidation}</p>}
                      {typeof effectiveCoachDecision.riskPlan?.stop === 'number' && <p>Stop: {effectiveCoachDecision.riskPlan.stop.toFixed(1)}</p>}
                      {typeof effectiveCoachDecision.riskPlan?.maxRiskDollars === 'number' && (
                        <p>Max risk: ${effectiveCoachDecision.riskPlan.maxRiskDollars.toFixed(0)}</p>
                      )}
                      {effectiveCoachDecision.riskPlan?.positionGuidance && <p>Size: {effectiveCoachDecision.riskPlan.positionGuidance}</p>}
                    </div>
                  </div>
                )}

                {decisionActions.length > 0 && !readOnly && (
                  <div
                    className="mt-2.5 grid gap-1.5 sm:flex sm:flex-wrap"
                    data-testid="spx-coach-decision-actions"
                  >
                    {decisionActions.map((action, index) => (
                      <button
                        key={`${effectiveCoachDecision.decisionId}-${action.id}`}
                        type="button"
                        onClick={() => {
                          void handleDecisionAction(action)
                        }}
                        className={cn(
                          'min-h-[40px] rounded-lg border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.07em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60',
                          index === 0 && 'sm:min-w-[190px]',
                          actionClasses(action),
                        )}
                      >
                        {resolveActionLabel(action)}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="mt-2 text-[12px] text-white/75">
                {coachDecisionStatus === 'loading'
                  ? 'Building an execution-focused decision brief...'
                  : coachDecisionError || 'Select a setup for contextual decision guidance.'}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {!readOnly && (
        <div className="space-y-1.5">
          <button
            type="button"
            data-testid="spx-coach-quick-prompts-toggle"
            onClick={() => setQuickPromptsOpen((previous) => !previous)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded border border-white/15 bg-white/[0.03] px-2.5 py-1.5 text-[9px] uppercase tracking-[0.08em] text-white/65 hover:bg-white/[0.08] hover:text-white/82 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60"
          >
            <Bot className="h-3 w-3 text-emerald-200/90" />
            {quickPromptsOpen ? 'Hide coach prompts' : `Show coach prompts (${quickActions.length})`}
          </button>

          <div
            data-testid="spx-coach-quick-prompts"
            data-state={quickPromptsOpen ? 'open' : 'closed'}
            className={cn(
              'flex flex-wrap gap-1.5',
              !quickPromptsOpen && 'hidden',
            )}
          >
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={isSending}
                onClick={() => {
                  void sendMessage(toScopedPrompt(action.prompt, scopedSetup?.id), {
                    setupId: scopedSetup?.id,
                    forceRefresh: true,
                  })
                }}
                className={cn(
                  'inline-flex min-h-[40px] items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.06em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60',
                  'border-white/15 bg-white/[0.03] text-white/72 hover:bg-white/[0.1] hover:text-white/90',
                  'disabled:opacity-40',
                )}
              >
                <action.icon className="h-3 w-3" />
                {action.label}
              </button>
            ))}
          </div>

          {tradeMode === 'in_trade' && (
            <button
              type="button"
              onClick={() => {
                exitTrade()
                void requestCoachDecision({
                  setupId: scopedSetup?.id || null,
                  forceRefresh: true,
                  surface: 'spx_coach_quick_exit',
                })
              }}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-white/18 bg-white/[0.04] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.06em] text-white/78 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60"
            >
              <TriangleAlert className="h-3 w-3 text-rose-300" />
              Exit Trade Focus
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setHistoryOpen((previous) => {
              const next = !previous
              if (next) {
                trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_HISTORY_OPENED, {
                  setupId: scopedSetup?.id || null,
                  tradeMode,
                  decisionId: effectiveCoachDecision?.decisionId || null,
                }, { persist: true })
              }
              return next
            })
          }}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-[9px] uppercase tracking-[0.08em] text-white/70 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60"
        >
          <History className="h-3 w-3" />
          {historyOpen ? 'Hide history' : 'Open history'}
        </button>

        {uxFlags.coachTimelineV2 && showJumpToLatest && historyOpen && (
          <button
            type="button"
            data-testid="spx-ai-coach-jump-latest"
            onClick={() => {
              scrollTimelineToBottom(prefersReducedMotion ? 'auto' : 'smooth')
              setShowJumpToLatest(false)
              setIsTimelineAtBottom(true)
            }}
            className="min-h-[36px] rounded-full border border-emerald-300/35 bg-emerald-500/12 px-2.5 py-1 text-[9px] uppercase tracking-[0.08em] text-emerald-100 hover:bg-emerald-500/20"
          >
            New messages
          </button>
        )}
      </div>

      <AnimatePresence initial={false} mode="wait">
        {historyOpen ? (
          <motion.div
            key="history-open"
            initial={uxFlags.coachMotionV1 && !prefersReducedMotion ? { opacity: 0, height: 0 } : undefined}
            animate={uxFlags.coachMotionV1 && !prefersReducedMotion ? { opacity: 1, height: 'auto' } : undefined}
            exit={uxFlags.coachMotionV1 && !prefersReducedMotion ? { opacity: 0, height: 0 } : undefined}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              ref={timelineRef}
              onScroll={handleTimelineScroll}
              data-testid="spx-ai-coach-timeline"
              className="space-y-1.5 max-h-[260px] overflow-auto pr-0.5"
            >
              {groupedMessages.length === 0 ? (
                <p className="text-[11px] text-white/45">
                  {scopedSetup ? 'No coaching messages in this scope yet.' : 'No coaching messages yet. Ask coach a question below.'}
                </p>
              ) : (
                groupedMessages.map((group) => (
                  <div key={group.id} className="space-y-1.5">
                    {showAllMessages && groupedMessages.length > 1 && (
                      <p className="px-1 text-[9px] uppercase tracking-[0.1em] text-white/40">{group.label}</p>
                    )}
                    <AnimatePresence initial={false}>
                      {[...group.messages].reverse().map((message) => (
                        <motion.div
                          key={message.id}
                          layout={uxFlags.coachMotionV1 && !prefersReducedMotion}
                          initial={uxFlags.coachMotionV1 && !prefersReducedMotion ? { opacity: 0, y: 6 } : undefined}
                          animate={uxFlags.coachMotionV1 && !prefersReducedMotion ? { opacity: 1, y: 0 } : undefined}
                          exit={uxFlags.coachMotionV1 && !prefersReducedMotion ? { opacity: 0, y: -6 } : undefined}
                          transition={{ duration: 0.16, ease: 'easeOut' }}
                        >
                          <CoachMessageCard
                            message={message}
                            onActionChipClick={readOnly ? undefined : handleMessageActionChip}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="history-preview"
            initial={uxFlags.coachMotionV1 && !prefersReducedMotion ? { opacity: 0, y: 4 } : undefined}
            animate={uxFlags.coachMotionV1 && !prefersReducedMotion ? { opacity: 1, y: 0 } : undefined}
            exit={uxFlags.coachMotionV1 && !prefersReducedMotion ? { opacity: 0, y: -4 } : undefined}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-2"
          >
            <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Latest message</p>
            <p className="mt-1 text-[12px] text-white/78 leading-snug">
              {latestMessage?.content || 'Coach ready. Select a setup for execution guidance.'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {readOnly ? (
        <p className="text-[10px] text-white/40">Read-only on this surface.</p>
      ) : (
        <div className="space-y-1.5">
          {(sendError || coachDecisionError) && (
            <div className="rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-100">
              {sendError || coachDecisionError}
            </div>
          )}
          <form onSubmit={onSubmit} className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={tradeMode === 'in_trade' ? 'Ask about this live trade...' : (scopedSetup ? 'Ask about this setup...' : 'Ask coach...')}
              disabled={isSending}
              className="min-h-[40px] flex-1 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-2.5 text-[12px] text-ivory placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-emerald-300/50"
            />
            <button
              type="submit"
              disabled={isSending || !prompt.trim()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/12 text-emerald-200 disabled:opacity-40"
              aria-label="Send coach message"
            >
              {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
