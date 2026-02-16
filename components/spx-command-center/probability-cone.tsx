'use client'

import type { PredictionState } from '@/lib/types/spx-command-center'
import { InfoTip } from '@/components/ui/info-tip'

export function ProbabilityCone({ prediction }: { prediction: PredictionState | null }) {
  if (!prediction) {
    return <p className="text-xs text-white/55">Probability cone unavailable.</p>
  }

  const maxSpread = Math.max(
    ...prediction.probabilityCone.map((point) => point.high - point.low),
    1,
  )

  return (
    <section className="glass-card-heavy rounded-2xl p-3 md:p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">Probability Cone</h3>
        <InfoTip label="How to read probability cone" panelClassName="w-64">
          Wider bars imply larger expected movement range. Narrow bars imply compression. Use with regime confidence, not in isolation.
        </InfoTip>
      </div>
      <div className="mt-3 space-y-2">
        {prediction.probabilityCone.map((point) => {
          const spread = point.high - point.low
          const width = Math.max(18, (spread / maxSpread) * 100)

          return (
            <div key={point.minutesForward} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-white/65">
                <span>{point.minutesForward}m</span>
                <span className="font-mono">{point.low.toFixed(2)} - {point.high.toFixed(2)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/[0.04] border border-white/10 overflow-hidden flex items-center">
                <div
                  className="h-full rounded-full bg-emerald-400/40 border-r border-emerald-300/40"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
