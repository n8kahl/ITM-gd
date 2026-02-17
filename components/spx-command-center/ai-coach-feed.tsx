'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, DoorOpen, Scale, Send, ShieldCheck, Target } from 'lucide-react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { CoachMessageCard } from '@/components/spx-command-center/coach-message'
import { cn } from '@/lib/utils'
import type { CoachMessage } from '@/lib/types/spx-command-center'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import {
  COACH_ALERT_DISMISS_EVENT,
  acknowledgeCoachAlert,
  findTopCoachAlert,
  loadDismissedCoachAlertIds,
} from '@/lib/spx/coach-alert-state'

const QUICK_ACTIONS = [
  { label: 'Confirm entry?', icon: Target, prompt: 'Should I enter this setup now? Validate confluence and timing.' },
  { label: 'Risk check', icon: ShieldCheck, prompt: 'Run a risk check on the selected setup. What could go wrong?' },
  { label: 'Exit strategy', icon: DoorOpen, prompt: 'What is the optimal exit strategy for this setup? When to take partials?' },
  { label: 'Size guidance', icon: Scale, prompt: 'What position size is appropriate for this setup given current conditions?' },
] as const

export function AICoachFeed({ readOnly = false }: { readOnly?: boolean }) {
  const { coachMessages, selectedSetup, activeSetups, sendCoachMessage } = useSPXCommandCenter()
  const [prompt, setPrompt] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showAllMessages, setShowAllMessages] = useState(false)
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(() => loadDismissedCoachAlertIds())

  useEffect(() => {
    setShowAllMessages(false)
  }, [selectedSetup?.id])

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
    if (selectedSetup && !showAllMessages) {
      return coachMessages.filter((message) => !message.setupId || message.setupId === selectedSetup.id)
    }
    return coachMessages
  }, [coachMessages, selectedSetup, showAllMessages])

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
      if (selectedSetup && groupId === selectedSetup.id) {
        return { id: groupId, label: 'Selected Setup', messages }
      }
      const setupType = setupTypeById.get(groupId)
      return {
        id: groupId,
        label: setupType ? `Setup · ${setupType}` : `Setup · ${groupId.slice(0, 8)}`,
        messages,
      }
    })
  }, [selectedSetup, setupTypeById, visibleMessages])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!prompt.trim() || isSending) return
    await sendMessage(prompt.trim())
  }

  const sendMessage = async (text: string) => {
    setIsSending(true)
    try {
      await sendCoachMessage(text, selectedSetup?.id)
      setPrompt('')
    } finally {
      setIsSending(false)
    }
  }

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
        {selectedSetup ? (
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

      {!readOnly && selectedSetup && (
        <div className="flex flex-wrap gap-1">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={isSending}
              onClick={() => sendMessage(`${action.prompt}\nSetup ID: ${selectedSetup.id}`)}
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

      <div className="flex-1 space-y-1.5 max-h-[240px] overflow-auto pr-0.5">
        {groupedMessages.length === 0 ? (
          <p className="text-[11px] text-white/45">
            {selectedSetup ? 'No coaching messages in this scope yet.' : 'Select a setup for contextual coaching.'}
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
        <form onSubmit={onSubmit} className="flex items-center gap-1.5">
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={selectedSetup ? 'Ask about this setup...' : 'Ask coach...'}
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
      )}
    </section>
  )
}
