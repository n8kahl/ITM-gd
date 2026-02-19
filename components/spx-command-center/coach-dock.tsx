'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bot, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import { useSPXCoachContext } from '@/contexts/spx/SPXCoachContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { cn } from '@/lib/utils'
import {
  COACH_ALERT_LIFECYCLE_EVENT,
  findTopCoachAlertV2,
  loadCoachAlertLifecycleState,
  resolveCoachAlertSeverity,
  type CoachAlertLifecycleState,
} from '@/lib/spx/coach-alert-state-v2'

function isUnreadAlert(
  status: CoachAlertLifecycleState[string]['status'] | undefined,
): boolean {
  return status !== 'seen' && status !== 'snoozed' && status !== 'muted'
}

export function CoachDock({
  surface,
  isOpen = false,
  onToggle,
  className,
}: {
  surface: 'desktop' | 'mobile'
  isOpen?: boolean
  onToggle: () => void
  className?: string
}) {
  const { coachMessages } = useSPXCoachContext()
  const { tradeMode, inTradeSetup } = useSPXSetupContext()
  const [alertLifecycleState, setAlertLifecycleState] = useState<CoachAlertLifecycleState>(() => loadCoachAlertLifecycleState())

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

  const topAlert = useMemo(
    () => findTopCoachAlertV2(coachMessages, alertLifecycleState),
    [alertLifecycleState, coachMessages],
  )

  const alertSeverity = topAlert ? resolveCoachAlertSeverity(topAlert) : null
  const previewMessage = topAlert || coachMessages[0] || null

  const unreadAlertCount = useMemo(() => {
    return coachMessages
      .filter((message) => message.priority === 'alert' || message.priority === 'setup')
      .filter((message) => isUnreadAlert(alertLifecycleState[message.id]?.status))
      .length
  }, [alertLifecycleState, coachMessages])

  return (
    <section
      className={cn(
        'rounded-xl border border-white/12 bg-[#090B0F]/95 px-3 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.35)] backdrop-blur',
        className,
      )}
      data-testid={`spx-coach-dock-${surface}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5 text-emerald-300" />
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/65">Coach Dock</p>
            {unreadAlertCount > 0 && (
              <span className="rounded-full border border-emerald-300/35 bg-emerald-500/18 px-1.5 py-0.5 text-[9px] text-emerald-100">
                {unreadAlertCount}
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/80">
            {previewMessage?.content || 'Coach standing by. Open for setup-scoped guidance.'}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-[9px] uppercase tracking-[0.08em] text-white/50">
            {tradeMode === 'in_trade' && inTradeSetup ? (
              <span>In Trade · {inTradeSetup.direction} {inTradeSetup.regime}</span>
            ) : (
              <span>Scan Mode</span>
            )}
            {alertSeverity && (
              <span className={cn(
                'inline-flex items-center gap-1',
                alertSeverity === 'critical'
                  ? 'text-rose-200'
                  : alertSeverity === 'warning'
                    ? 'text-amber-200'
                    : 'text-emerald-200',
              )}>
                <AlertTriangle className="h-3 w-3" />
                {alertSeverity}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          data-testid={`spx-coach-dock-toggle-${surface}`}
          className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-white/20 bg-white/[0.06] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-white/80 hover:bg-white/[0.12]"
        >
          <MessageSquare className="h-3 w-3" />
          {isOpen ? 'Hide' : 'Open'}
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>
      </div>
    </section>
  )
}
