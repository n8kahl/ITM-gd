'use client'

import type { TradierBrokerStatus } from '@/hooks/use-tradier-broker'

interface BrokerSafetyControlsProps {
  status: TradierBrokerStatus | null
  isConnected: boolean
  autoFlattenEnabled?: boolean
  pdtTrackingEnabled?: boolean
}

export function BrokerSafetyControls({
  status,
  isConnected,
  autoFlattenEnabled = false,
  pdtTrackingEnabled = false,
}: BrokerSafetyControlsProps) {
  if (!isConnected || !status) return null

  return (
    <section className="rounded-xl border border-white/12 bg-black/30 p-3">
      <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-white/58">Safety Controls</p>
      <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1.5 text-[10px] text-white/78">
        <p>0DTE Auto-Flatten</p>
        <p className="font-mono">
          {autoFlattenEnabled ? (
            <span className="text-emerald-200/80">Enforced</span>
          ) : (
            <span className="text-amber-200/70">Manual</span>
          )}
        </p>

        <p>Flatten Window</p>
        <p className="font-mono text-white/92">5 min before close</p>

        <p>sell_to_open Guard</p>
        <p className="font-mono text-emerald-200/80">Enforced</p>

        <p>PDT Protection</p>
        <p className="font-mono">
          {pdtTrackingEnabled ? (
            <span className="text-emerald-200/80">Enforced (3/day)</span>
          ) : (
            <span className="text-amber-200/70">Display Only</span>
          )}
        </p>

        <p>Max Contracts / Trade</p>
        <p className="font-mono text-white/92">Risk-limited</p>

        <p>Execution State</p>
        <p className="font-mono text-emerald-200/80">Persistent</p>

        <p>Order Status Polling</p>
        <p className="font-mono text-emerald-200/80">Active</p>

        <p>Kill Switch</p>
        <p className="font-mono text-emerald-200/80">Cancels Orders</p>

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
