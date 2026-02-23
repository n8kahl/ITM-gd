'use client'

import { cn } from '@/lib/utils'
import type { TradierBrokerStatus } from '@/hooks/use-tradier-broker'

interface BrokerFillQualityProps {
  status: TradierBrokerStatus | null
  isConnected: boolean
}

export function BrokerFillQuality({ status, isConnected }: BrokerFillQualityProps) {
  if (!isConnected || !status) return null

  const runtime = status.runtime.execution

  return (
    <section className="rounded-xl border border-white/12 bg-black/30 p-3">
      <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-white/58">Execution Runtime</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Engine</p>
          <p className={cn(
            'font-mono text-[12px]',
            runtime.enabled ? 'text-emerald-200' : 'text-white/55',
          )}>
            {runtime.enabled ? 'Active' : 'Disabled'}
          </p>
        </div>
        <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Tracked Trades</p>
          <p className="font-mono text-[12px] text-white/92">{runtime.trackedTrades}</p>
        </div>
        <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Sandbox Default</p>
          <p className="font-mono text-[12px] text-white/78">
            {runtime.sandboxDefault ? 'Yes' : 'No'}
          </p>
        </div>
        <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Metadata Req</p>
          <p className="font-mono text-[12px] text-white/78">
            {runtime.metadataRequired ? 'Yes' : 'No'}
          </p>
        </div>
      </div>
      {runtime.reason && (
        <p className="mt-2 rounded border border-amber-300/25 bg-amber-500/8 px-2 py-1 text-[9px] text-amber-100/80">
          {runtime.reason}
        </p>
      )}
    </section>
  )
}
