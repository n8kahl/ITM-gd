'use client'

import { useMemo } from 'react'
import { Bot, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import { useSPXCoachContext } from '@/contexts/spx/SPXCoachContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { cn } from '@/lib/utils'

function verdictTone(verdict: string | null | undefined): string {
  if (verdict === 'ENTER') return 'text-emerald-200'
  if (verdict === 'EXIT') return 'text-rose-200'
  if (verdict === 'REDUCE') return 'text-amber-200'
  return 'text-white/60'
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
  const { coachMessages, coachDecision, coachDecisionStatus } = useSPXCoachContext()
  const { tradeMode, inTradeSetup } = useSPXSetupContext()

  const previewMessage = useMemo(() => {
    if (coachDecision?.primaryText) return coachDecision.primaryText
    return coachMessages[0]?.content || 'Coach standing by. Open for setup-scoped guidance.'
  }, [coachDecision?.primaryText, coachMessages])

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
            <span className="rounded-full border border-white/18 bg-white/[0.05] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-white/65">
              {coachDecisionStatus}
            </span>
            {coachDecision?.verdict && (
              <span className={cn('text-[9px] uppercase tracking-[0.08em]', verdictTone(coachDecision.verdict))}>
                {coachDecision.verdict}
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/80">
            {previewMessage}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-[9px] uppercase tracking-[0.08em] text-white/50">
            {tradeMode === 'in_trade' && inTradeSetup ? (
              <span>In Trade · {inTradeSetup.direction} {inTradeSetup.regime}</span>
            ) : (
              <span>Scan Mode</span>
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
