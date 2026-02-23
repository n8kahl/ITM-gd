'use client'

import { cn } from '@/lib/utils'
import { useTradierBroker } from '@/hooks/use-tradier-broker'

interface BrokerHeaderChipProps {
  onClick: () => void
}

export function BrokerHeaderChip({ onClick }: BrokerHeaderChipProps) {
  const { isConnected, isSandbox, executionMode } = useTradierBroker()

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="spx-header-broker-chip"
      className="rounded border border-white/12 bg-white/[0.03] px-2 py-1 text-right transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60"
    >
      <div className="text-[8px] uppercase tracking-[0.1em] text-white/45">Broker</div>
      <div className="flex items-center justify-end gap-1">
        <span className={cn(
          'inline-block h-1.5 w-1.5 rounded-full',
          isConnected ? 'animate-pulse bg-emerald-400' : 'bg-white/30',
        )} />
        <span className={cn(
          'font-mono text-[11px]',
          isConnected
            ? executionMode === 'auto' ? 'text-emerald-300' : executionMode === 'manual' ? 'text-champagne' : 'text-white/55'
            : 'text-white/40',
        )}>
          {isConnected
            ? `${isSandbox ? 'Sandbox' : 'Live'} · ${executionMode === 'auto' ? 'Auto' : executionMode === 'manual' ? 'Manual' : 'Off'}`
            : 'Disconnected'}
        </span>
      </div>
    </button>
  )
}
