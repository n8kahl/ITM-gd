'use client'

import { type FormEvent, useCallback, useMemo, useState } from 'react'
import { ChevronDown, Loader2, Send } from 'lucide-react'
import { useSPXCoachContext } from '@/contexts/spx/SPXCoachContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { normalizeCoachDecisionForMode } from '@/lib/spx/coach-decision-policy'
import type { CoachDecisionAction, CoachDecisionBrief, CoachMessage, Setup } from '@/lib/types/spx-command-center'
import { cn } from '@/lib/utils'

type CoachFactsModel = {
  verdict: string
  confidence: string
  invalidation: string
  riskConstraint: string
  nextReview: string
  why: string[]
  counterCase: string[]
  riskChecklist: string[]
  history: string[]
  statusLabel: string
}

function isActionableSetup(setup: Setup | null | undefined): boolean {
  if (!setup) return false
  return setup.status === 'ready' || setup.status === 'triggered'
}

function findSetupById(setups: Setup[], setupId?: string | null): Setup | null {
  if (!setupId) return null
  return setups.find((setup) => setup.id === setupId) || null
}

function resolveActionLabel(action: CoachDecisionAction): string {
  if (action.id === 'REVERT_AI_CONTRACT') return 'Use AI Contract'
  if (action.id === 'EXIT_TRADE_FOCUS') return 'Exit Trade Focus'
  return action.label
}

function isFactsActionContextValid(input: {
  action: CoachDecisionAction
  tradeMode: 'scan' | 'in_trade'
  actionSetup: Setup | null
}): boolean {
  const { action, tradeMode, actionSetup } = input

  if (action.id === 'OPEN_HISTORY') return false
  if (action.id === 'ENTER_TRADE_FOCUS') return tradeMode !== 'in_trade' && isActionableSetup(actionSetup)
  if (action.id === 'EXIT_TRADE_FOCUS') return tradeMode === 'in_trade'
  if (action.id === 'REVERT_AI_CONTRACT') return Boolean(actionSetup?.recommendedContract)
  if (action.id === 'TIGHTEN_STOP_GUIDANCE' || action.id === 'REDUCE_SIZE_GUIDANCE') return tradeMode === 'in_trade'
  return true
}

function formatClockTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const epochMs = Date.parse(iso)
  if (!Number.isFinite(epochMs)) return null
  return new Date(epochMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatSetupLabel(setup: Setup | null): string {
  if (!setup) return 'selected setup'
  return `${setup.direction} ${setup.type.replace(/_/g, ' ')}`
}

function buildInvalidation(decision: CoachDecisionBrief | null, setup: Setup | null): string {
  if (decision?.riskPlan?.invalidation) return decision.riskPlan.invalidation
  if (typeof decision?.riskPlan?.stop === 'number') return `Invalidate below stop ${decision.riskPlan.stop.toFixed(1)}.`
  if (setup) return `Invalidate on stop break at ${setup.stop.toFixed(1)} or failed hold of entry zone.`
  return 'Invalidate if structure or flow alignment fails to confirm.'
}

function buildRiskConstraint(decision: CoachDecisionBrief | null, setup: Setup | null): string {
  const parts: string[] = []
  if (typeof decision?.riskPlan?.maxRiskDollars === 'number') {
    parts.push(`Risk cap $${decision.riskPlan.maxRiskDollars.toFixed(0)}`)
  } else {
    parts.push('Risk cap 1R')
  }
  if (decision?.riskPlan?.positionGuidance) {
    parts.push(decision.riskPlan.positionGuidance)
  } else if (setup) {
    parts.push(`Trade ${formatSetupLabel(setup)} only on trigger confirmation`)
  } else {
    parts.push('Stay flat until conviction improves')
  }
  return `${parts.join(' · ')}.`
}

function buildNextReview(decision: CoachDecisionBrief | null): string {
  const expiresAtLabel = formatClockTime(decision?.freshness.expiresAt)
  if (expiresAtLabel) return `Refresh by ${expiresAtLabel} or on setup-status change.`
  return 'Review on next setup-status, flow, or regime change.'
}

function decisionStatusLabel(status: 'idle' | 'loading' | 'ready' | 'error', hasDecision: boolean): string {
  if (status === 'loading') return hasDecision ? 'Live (refreshing)' : 'Refreshing'
  if (status === 'error') return 'Fallback'
  if (status === 'ready') return 'Live'
  return hasDecision ? 'Live' : 'Fallback'
}

function fallbackConfidence(setup: Setup | null): string {
  if (setup && typeof setup.probability === 'number' && Number.isFinite(setup.probability)) {
    return `${Math.round(setup.probability)}%`
  }
  return '50%'
}

function buildHistoryFacts(
  setup: Setup | null,
  scopedMessageCount: number,
  latestMessageAt: string | null,
  decision: CoachDecisionBrief | null,
): string[] {
  const latestLabel = formatClockTime(latestMessageAt)
  return [
    `Setup scope: ${formatSetupLabel(setup)}.`,
    `Coach messages in scope: ${scopedMessageCount}.`,
    `Latest coach note: ${latestLabel ? `${latestLabel} local time` : 'none loaded yet'}.`,
    `Decision source: ${decision?.source || 'fallback'}.`,
  ]
}

function formatMessageTimestamp(iso: string): string {
  const epochMs = Date.parse(iso)
  if (!Number.isFinite(epochMs)) return 'Unknown time'
  return new Date(epochMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function timelineMessageTypeLabel(message: CoachMessage): string {
  return message.type.replace(/_/g, ' ')
}

function buildFactsModel(input: {
  decision: CoachDecisionBrief | null
  setup: Setup | null
  scopedMessageCount: number
  latestMessageAt: string | null
  status: 'idle' | 'loading' | 'ready' | 'error'
}): CoachFactsModel {
  const { decision, setup, scopedMessageCount, latestMessageAt, status } = input
  const confidence = decision ? `${Math.round(decision.confidence)}%` : fallbackConfidence(setup)
  const verdict = decision?.verdict || 'WAIT'
  const history = buildHistoryFacts(setup, scopedMessageCount, latestMessageAt, decision)

  return {
    verdict,
    confidence,
    invalidation: buildInvalidation(decision, setup),
    riskConstraint: buildRiskConstraint(decision, setup),
    nextReview: buildNextReview(decision),
    why: decision?.why?.length
      ? decision.why.slice(0, 3)
      : ['Decision payload unavailable; preserve optionality and wait for confirmation.'],
    counterCase: decision
      ? [
        decision.verdict === 'ENTER'
          ? 'If confirmation weakens or stop risk expands, downgrade to WAIT/REDUCE.'
          : 'If confluence and trigger quality improve, verdict can escalate from WAIT.',
      ]
      : ['If confluence, trigger, and flow align, reassess for ENTER.'],
    riskChecklist: [
      decision?.riskPlan?.positionGuidance || 'Use predefined size rules only.',
      buildInvalidation(decision, setup),
      buildRiskConstraint(decision, setup),
    ],
    history,
    statusLabel: decisionStatusLabel(status, Boolean(decision)),
  }
}

export function CoachFactsRail() {
  const { coachDecision, coachDecisionStatus, coachMessages, sendCoachMessage, requestCoachDecision } = useSPXCoachContext()
  const {
    activeSetups,
    selectedSetup,
    inTradeSetup,
    tradeMode,
    selectSetup,
    enterTrade,
    exitTrade,
    setSetupContractChoice,
  } = useSPXSetupContext()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [activeActionId, setActiveActionId] = useState<string | null>(null)
  const [detailsPrompt, setDetailsPrompt] = useState('')
  const [detailsSendError, setDetailsSendError] = useState<string | null>(null)
  const [detailsSending, setDetailsSending] = useState(false)

  const scopedSetup = inTradeSetup || selectedSetup || null
  const scopedSetupId = scopedSetup?.id || null
  const scopedSetupActionable = isActionableSetup(scopedSetup)
  const coachDecisionMode = tradeMode === 'in_trade' ? 'in_trade' : (scopedSetupActionable ? 'evaluate' : 'scan')
  const normalizedDecision = useMemo(
    () => normalizeCoachDecisionForMode(
      coachDecision,
      coachDecisionMode,
      { scopedSetupId },
    ),
    [coachDecision, coachDecisionMode, scopedSetupId],
  )

  const scopedMessages = useMemo(
    () => coachMessages.filter((message) => !scopedSetupId || !message.setupId || message.setupId === scopedSetupId),
    [coachMessages, scopedSetupId],
  )
  const latestMessageAt = scopedMessages[0]?.timestamp || null
  const timelineMessages = useMemo(
    () => scopedMessages.slice(0, 12),
    [scopedMessages],
  )
  const facts = useMemo(
    () => buildFactsModel({
      decision: normalizedDecision,
      setup: scopedSetup,
      scopedMessageCount: scopedMessages.length,
      latestMessageAt,
      status: coachDecisionStatus,
    }),
    [coachDecisionStatus, latestMessageAt, normalizedDecision, scopedMessages.length, scopedSetup],
  )
  const factsActions = useMemo(() => {
    const actions = normalizedDecision?.actions || []
    const deduped: CoachDecisionAction[] = []
    const seen = new Set<string>()

    for (const action of actions) {
      const actionSetupId = typeof action.payload?.setupId === 'string' ? action.payload.setupId : scopedSetupId
      const actionSetup = findSetupById(activeSetups, actionSetupId) || scopedSetup
      if (!isFactsActionContextValid({ action, tradeMode, actionSetup })) continue
      const label = resolveActionLabel(action).trim().toLowerCase()
      const key = `${action.id}:${label}`
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(action)
      if (deduped.length >= 2) break
    }

    return deduped
  }, [activeSetups, normalizedDecision?.actions, scopedSetup, scopedSetupId, tradeMode])

  const handleFactsAction = useCallback(async (action: CoachDecisionAction) => {
    const actionSetupId = typeof action.payload?.setupId === 'string' ? action.payload.setupId : scopedSetupId
    const actionSetup = findSetupById(activeSetups, actionSetupId) || scopedSetup
    if (!isFactsActionContextValid({ action, tradeMode, actionSetup })) return

    setActiveActionId(action.id)
    try {
      if (action.id === 'ENTER_TRADE_FOCUS' && actionSetup && isActionableSetup(actionSetup)) {
        selectSetup(actionSetup)
        enterTrade(actionSetup)
        await requestCoachDecision({
          setupId: actionSetup.id,
          forceRefresh: true,
          surface: 'spx_coach_facts_action_enter',
        })
        return
      }

      if (action.id === 'EXIT_TRADE_FOCUS') {
        exitTrade()
        await requestCoachDecision({
          setupId: actionSetupId,
          forceRefresh: true,
          surface: 'spx_coach_facts_action_exit',
        })
        return
      }

      if (action.id === 'REVERT_AI_CONTRACT') {
        if (actionSetup?.recommendedContract) {
          setSetupContractChoice(actionSetup, actionSetup.recommendedContract)
        }
        await requestCoachDecision({
          setupId: actionSetup?.id || actionSetupId,
          forceRefresh: true,
          surface: 'spx_coach_facts_action_revert_contract',
        })
        return
      }

      if (action.id === 'ASK_FOLLOW_UP') {
        await sendCoachMessage('Give me the single highest-priority follow-up for this setup right now.', actionSetupId)
        return
      }

      if (action.id === 'TIGHTEN_STOP_GUIDANCE') {
        await sendCoachMessage('Give precise stop-tightening guidance now based on this exact setup and live flow.', actionSetupId)
        return
      }

      if (action.id === 'REDUCE_SIZE_GUIDANCE') {
        await sendCoachMessage('Should I reduce size now? Quantify urgency, trigger conditions, and specific risk actions.', actionSetupId)
      }
    } finally {
      setActiveActionId(null)
    }
  }, [
    activeSetups,
    enterTrade,
    exitTrade,
    requestCoachDecision,
    scopedSetup,
    scopedSetupId,
    selectSetup,
    sendCoachMessage,
    setSetupContractChoice,
    tradeMode,
  ])

  const onDetailsComposerSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextPrompt = detailsPrompt.trim()
    if (!nextPrompt || detailsSending) return

    setDetailsSending(true)
    setDetailsSendError(null)
    try {
      await sendCoachMessage(nextPrompt, scopedSetupId)
      setDetailsPrompt('')
    } catch (error) {
      setDetailsSendError(error instanceof Error ? error.message : 'Coach message failed. Please retry.')
    } finally {
      setDetailsSending(false)
    }
  }, [detailsPrompt, detailsSending, scopedSetupId, sendCoachMessage])

  return (
    <section
      className="glass-card-heavy rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.02] to-champagne/5 p-3"
      data-testid="spx-coach-facts-rail"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-white/60">Coach Facts</h3>
        <span className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-white/70">
          {facts.statusLabel}
        </span>
      </div>

      <div className="space-y-1.5 text-[11px] text-white/80">
        <p data-testid="spx-coach-facts-verdict"><span className="text-white/55">Verdict:</span> {facts.verdict}</p>
        <p data-testid="spx-coach-facts-confidence"><span className="text-white/55">Confidence:</span> {facts.confidence}</p>
        <p data-testid="spx-coach-facts-invalidation"><span className="text-white/55">Invalidation:</span> {facts.invalidation}</p>
        <p data-testid="spx-coach-facts-risk-constraint"><span className="text-white/55">Risk:</span> {facts.riskConstraint}</p>
        <p data-testid="spx-coach-facts-next-review"><span className="text-white/55">Next review:</span> {facts.nextReview}</p>
      </div>

      <button
        type="button"
        data-testid="spx-coach-facts-details-toggle"
        onClick={() => setDetailsOpen((previous) => !previous)}
        className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] text-white/70 hover:bg-white/[0.1] hover:text-white"
        aria-expanded={detailsOpen}
      >
        Details
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', detailsOpen && 'rotate-180')} />
      </button>

      <div
        className="mt-2 flex flex-wrap gap-1.5"
        data-testid="spx-coach-facts-actions"
      >
        {factsActions.length > 0 ? factsActions.map((action, index) => (
          <button
            key={`${action.id}-${index}`}
            type="button"
            data-testid={`spx-coach-facts-action-${action.id}`}
            disabled={activeActionId != null}
            onClick={() => {
              void handleFactsAction(action)
            }}
            className={cn(
              'inline-flex min-h-[36px] items-center rounded-lg border px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-45',
              index === 0
                ? 'border-emerald-300/40 bg-emerald-500/14 text-emerald-100 hover:bg-emerald-500/24'
                : 'border-white/15 bg-white/[0.05] text-white/78 hover:bg-white/[0.12]',
            )}
          >
            {resolveActionLabel(action)}
          </button>
        )) : (
          <p
            className="text-[10px] uppercase tracking-[0.08em] text-white/45"
            data-testid="spx-coach-facts-actions-empty"
          >
            No context-valid actions
          </p>
        )}
      </div>

      {detailsOpen && (
        <div
          className="mt-2 space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[11px] text-white/78"
          data-testid="spx-coach-facts-details"
        >
          <div>
            <p className="text-[9px] uppercase tracking-[0.1em] text-white/50">Why</p>
            <ul className="mt-1 space-y-1">
              {facts.why.map((line, index) => (
                <li key={`why-${index}`}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.1em] text-white/50">Counter-Case</p>
            <ul className="mt-1 space-y-1">
              {facts.counterCase.map((line, index) => (
                <li key={`counter-${index}`}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.1em] text-white/50">Risk Checklist</p>
            <ul className="mt-1 space-y-1">
              {facts.riskChecklist.map((line, index) => (
                <li key={`risk-${index}`}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.1em] text-white/50">History</p>
            <ul className="mt-1 space-y-1">
              {facts.history.map((line, index) => (
                <li key={`history-${index}`}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5" data-testid="spx-coach-facts-details-history">
            <p className="text-[9px] uppercase tracking-[0.1em] text-white/50">Timeline</p>
            <div
              className="max-h-[180px] space-y-1.5 overflow-auto rounded-md border border-white/10 bg-white/[0.02] p-2"
              data-testid="spx-coach-facts-details-timeline"
            >
              {timelineMessages.length === 0 ? (
                <p className="text-[10px] text-white/45">
                  {scopedSetup ? 'No coach notes in this setup scope yet.' : 'No coach notes yet. Send a message below.'}
                </p>
              ) : (
                timelineMessages.map((message) => (
                  <article key={message.id} className="rounded border border-white/8 bg-white/[0.025] px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.08em] text-white/45">
                      <span>{timelineMessageTypeLabel(message)}</span>
                      <span>{formatMessageTimestamp(message.timestamp)}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-white/82">{message.content}</p>
                  </article>
                ))
              )}
            </div>
          </div>

          <form
            className="space-y-1.5"
            data-testid="spx-coach-facts-details-composer"
            onSubmit={(event) => {
              void onDetailsComposerSubmit(event)
            }}
          >
            {detailsSendError && (
              <p className="rounded border border-rose-300/30 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-100">
                {detailsSendError}
              </p>
            )}
            <div className="flex items-center gap-1.5">
              <input
                data-testid="spx-coach-facts-details-input"
                value={detailsPrompt}
                onChange={(event) => setDetailsPrompt(event.target.value)}
                placeholder={tradeMode === 'in_trade' ? 'Ask about this active trade...' : 'Ask coach for follow-up...'}
                disabled={detailsSending}
                className="min-h-[36px] flex-1 rounded-md border border-white/12 bg-white/[0.03] px-2.5 py-2 text-[11px] text-ivory placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-emerald-300/50"
              />
              <button
                type="submit"
                data-testid="spx-coach-facts-details-send"
                disabled={detailsSending || !detailsPrompt.trim()}
                aria-label="Send coach message"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-emerald-300/35 bg-emerald-500/14 text-emerald-100 disabled:opacity-40"
              >
                {detailsSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
