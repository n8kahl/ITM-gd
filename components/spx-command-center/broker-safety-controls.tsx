'use client'

import type { TradierBrokerStatus } from '@/hooks/use-tradier-broker'

interface BrokerSafetyControlsProps {
  status: TradierBrokerStatus | null
  isConnected: boolean
}

export function BrokerSafetyControls({ status, isConnected }: BrokerSafetyControlsProps) {
  if (!isConnected || !status) return null

  return (
    <section className="rounded-xl border border-white/12 bg-black/30 p-3">
      <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-white/58">Safety Controls</p>
      <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1.5 text-[10px] text-white/78">
        <p>0DTE Auto-Flatten</p>
        <p className="font-mono text-emerald-200/80">Enforced</p>

        <p>Flatten Window</p>
        <p className="font-mono text-white/92">5 min before close</p>

        <p>sell_to_open Guard</p>
        <p className="font-mono text-emerald-200/80">Enforced</p>

        <p>PDT Alert Threshold</p>
        <p className="font-mono text-white/92">3 trades / day</p>

        <p>Max Contracts / Trade</p>
        <p className="font-mono text-white/92">Risk-limited</p>

        <p>Portfolio Sync</p>
        <p className="font-mono text-white/92">
          {status.runtime.portfolioSync.enabled ? 'Active' : 'Inactive'}
        </p>

        <p>Credential Encryption</p>
        <p className="font-mono text-emerald-200/80">AES-256-GCM</p>

        <p>Environment</p>
        <p className="font-mono text-white/92">
          {status.credential?.sandbox ? 'Sandbox' : 'Live'}
        </p>
      </div>
    </section>
  )
}
