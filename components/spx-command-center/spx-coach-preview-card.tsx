'use client'

import { useSPXCoachContext } from '@/contexts/spx/SPXCoachContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'

export function SPXCoachPreviewCard() {
  const { tradeMode, inTradeSetup } = useSPXSetupContext()
  const { coachMessages } = useSPXCoachContext()
  const latestMessage = coachMessages[0] || null

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] uppercase tracking-[0.12em] text-white/55">Coach Preview</h3>
        <span className="text-[9px] text-white/45">{tradeMode === 'in_trade' ? 'In-Trade' : 'Scan'}</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-white/75">
        {latestMessage?.content || 'Coach ready. Select a setup to get contextual guidance.'}
      </p>
      {inTradeSetup && (
        <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-emerald-200/80">
          Focused: {inTradeSetup.direction} {inTradeSetup.regime}
        </p>
      )}
    </section>
  )
}
