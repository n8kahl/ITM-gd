'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, DoorOpen, Scale, Send, ShieldCheck, Target } from 'lucide-react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXCoachContext } from '@/contexts/spx/SPXCoachContext'
import { useSPXFlowContext } from '@/contexts/spx/SPXFlowContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { CoachMessageCard } from '@/components/spx-command-center/coach-message'
import { cn } from '@/lib/utils'
import type { CoachMessage } from '@/lib/types/spx-command-center'
import { summarizeFlowAlignment } from '@/lib/spx/coach-context'
import { SPX_SHORTCUT_EVENT, type SPXCoachQuickActionEventDetail } from '@/lib/spx/shortcut-events'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import {
  COACH_ALERT_DISMISS_EVENT,
  acknowledgeCoachAlert,
  findTopCoachAlert,
  loadDismissedCoachAlertIds,
} from '@/lib/spx/coach-alert-state'

const PRE_TRADE_ACTIONS = [
  { id: 'confirm_entry', label: 'Confirm entry?', icon: Target },
  { id: 'risk_check', label: 'Risk check', icon: ShieldCheck },
  { id: 'exit_strategy', label: 'Exit strategy', icon: DoorOpen },
  { id: 'size_guidance', label: 'Size guidance', icon: Scale },
] as const

const ACTIVE_TRADE_ACTIONS = [
  { id: 'risk_check', label: 'Risk check', icon: ShieldCheck },
  { id: 'exit_strategy', label: 'Exit strategy', icon: DoorOpen },
  { id: 'hold_or_trim', label: 'Hold or trim?', icon: Target },
  { id: 'size_adjustment', label: 'Size adjustment', icon: Scale },
] as const

function toScopedPrompt(prompt: string, setupId?: string | null): string {
  if (!setupId) return prompt
  return `${prompt}\nSetup ID: ${setupId}`
}

export function AICoachFeed({ readOnly = false }: { readOnly?: boolean }) {
  const { uxFlags } = useSPXCommandCenter()
  const { regime } = useSPXAnalyticsContext()
  const {
    selectedSetup,
    activeSetups,
    tradeMode,
    inTradeSetup,
    inTradeContract,
    tradeEntryContractMid,
    tradeCurrentContractMid,
    tradePnlDollars,
  } = useSPXSetupContext()
  const { coachMessages, sendCoachMessage } = useSPXCoachContext()
  const { flowEvents } = useSPXFlowContext()
  const [prompt, setPrompt] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showAllMessages, setShowAllMessages] = useState(false)
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(() => loadDismissedCoachAlertIds())

  const scopedSetup = inTradeSetup || selectedSetup

  useEffect(() => {
    setShowAllMessages(false)
  }, [scopedSetup?.id])

  useEffect(() => {
    const handleDismissSync = (event: Event) => {
      const custom = event as CustomEvent<{ ids?: string[] }>
      const ids = custom.detail?.ids
      if (!Array.isArray(ids)) return
      setDismissedAlertIds(new Set(ids))
    }

    window.addEventListener(COACH_ALERT_DISMISS_EVENT, handleDismissSync as EventListener)
    return () => {
      window.removeEventListener(COACH_ALERT_DISMISS_EVENT, handleDismissSync as EventListener)
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

  const pinnedAlert = useMemo(
    () => findTopCoachAlert(scopedMessages, dismissedAlertIds),
    [dismissedAlertIds, scopedMessages],
  )

  const visibleMessages = useMemo(
    () => scopedMessages.filter((message) => message.id !== pinnedAlert?.id),
    [pinnedAlert?.id, scopedMessages],
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
          const pnlHint = tradePnlDollars == null ? 'P&L is flat.' : `Contract P&L is ${tradePnlDollars >= 0 ? '+' : ''}$${tradePnlDollars.toFixed(0)}.`
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
  }, [flowSummary, regime, scopedSetup, tradeMode, tradePnlDollars, uxFlags.coachProactive])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!prompt.trim() || isSending) return
    await sendMessage(prompt.trim())
  }

  const sendMessage = useCallback(async (text: string) => {
    setSendError(null)
    setIsSending(true)
    try {
      const contractContext = tradeMode === 'in_trade' && inTradeContract
        ? `\nContract: ${inTradeContract.description}\nEntry mid: ${tradeEntryContractMid?.toFixed(2) ?? '--'}\nCurrent mid: ${tradeCurrentContractMid?.toFixed(2) ?? '--'}\nContract P&L: ${tradePnlDollars == null ? '--' : `${tradePnlDollars >= 0 ? '+' : ''}$${tradePnlDollars.toFixed(0)}`}`
        : ''
      await sendCoachMessage(`${text}${contractContext}`, scopedSetup?.id)
      setPrompt('')
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Coach request failed. Please try again.')
    } finally {
      setIsSending(false)
    }
  }, [
    inTradeContract,
    scopedSetup?.id,
    sendCoachMessage,
    tradeCurrentContractMid,
    tradeEntryContractMid,
    tradeMode,
    tradePnlDollars,
  ])

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

  const dismissPinnedAlert = (message: CoachMessage) => {
    setDismissedAlertIds((previous) => acknowledgeCoachAlert(previous, message.id))

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_ALERT_ACK, {
      messageId: message.id,
      priority: message.priority,
      setupId: message.setupId,
      surface: 'ai_coach_feed',
    }, { persist: true })
  }

  return (
    <section
      className="glass-card-heavy rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.025] to-champagne/5 p-3 flex flex-col gap-2 min-h-[220px]"
      data-testid="spx-ai-coach-feed"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-white/60">AI Coach</h3>
        {scopedSetup ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowAllMessages(false)}
              className={cn(
                'rounded border px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em]',
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
                'rounded border px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em]',
                showAllMessages
                  ? 'border-champagne/35 bg-champagne/12 text-champagne'
                  : 'border-white/15 bg-white/[0.03] text-white/50',
              )}
            >
              All
            </button>
          </div>
        ) : null}
      </div>

      {tradeMode === 'in_trade' && inTradeSetup && (
        <div className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2 py-1">
          <p className="text-[9px] uppercase tracking-[0.1em] text-emerald-200/85">
            In-Trade Guidance Active · {inTradeSetup.direction} {inTradeSetup.regime}
          </p>
        </div>
      )}

      {pinnedAlert && (
        <div
          className="rounded-lg border border-rose-400/35 bg-rose-500/12 px-3 py-2"
          data-testid="spx-ai-coach-pinned-alert"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.1em] text-rose-100">
              <AlertTriangle className="h-3 w-3" />
              Alert
            </p>
            <button
              type="button"
              data-testid="spx-ai-coach-alert-ack"
              onClick={() => dismissPinnedAlert(pinnedAlert)}
              className="rounded border border-rose-300/35 bg-rose-400/15 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em] text-rose-100 hover:bg-rose-400/25"
            >
              Acknowledge
            </button>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-rose-50">{pinnedAlert.content}</p>
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap gap-1">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={isSending}
              onClick={() => sendMessage(toScopedPrompt(action.prompt, scopedSetup?.id))}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] uppercase tracking-[0.06em] transition-colors',
                'border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-200/80 hover:bg-emerald-500/15 hover:text-emerald-200',
                'disabled:opacity-40',
              )}
            >
              <action.icon className="h-2.5 w-2.5" />
              {action.label}
            </button>
          ))}
        </div>
      )}

      {isSending && (
        <p className="text-[10px] text-emerald-200/75">
          Coach is analyzing context...
        </p>
      )}

      <div className="flex-1 space-y-1.5 max-h-[240px] overflow-auto pr-0.5">
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
              {group.messages.map((message) => (
                <CoachMessageCard key={message.id} message={message} />
              ))}
            </div>
          ))
        )}
      </div>

      {readOnly ? (
        <p className="text-[10px] text-white/40">Read-only on mobile.</p>
      ) : (
        <div className="space-y-1.5">
          {sendError && (
            <div className="rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-100">
              {sendError}
            </div>
          )}
          <form onSubmit={onSubmit} className="flex items-center gap-1.5">
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={tradeMode === 'in_trade' ? 'Ask about this live trade...' : (scopedSetup ? 'Ask about this setup...' : 'Ask coach...')}
              disabled={isSending}
              className="flex-1 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-ivory placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-emerald-300/50"
            />
            <button
              type="submit"
              disabled={isSending || !prompt.trim()}
              className="inline-flex items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/12 p-1.5 text-emerald-200 disabled:opacity-40"
              aria-label="Send coach message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
