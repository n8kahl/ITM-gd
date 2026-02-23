'use client'

import { Shield, ShieldCheck, ShieldOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TradierBrokerStatus } from '@/hooks/use-tradier-broker'

interface BrokerConnectionCardProps {
  status: TradierBrokerStatus | null
  isConnected: boolean
  isSandbox: boolean
  isLoading: boolean
}

function formatSyncAge(isoTime: string | undefined): string {
  if (!isoTime) return '--'
  const diffMs = Date.now() - Date.parse(isoTime)
  if (!Number.isFinite(diffMs) || diffMs < 0) return '--'
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m ago`
}

export function BrokerConnectionCard({ status, isConnected, isSandbox, isLoading }: BrokerConnectionCardProps) {
  const credential = status?.credential

  if (isLoading && !status) {
    return (
      <section className="rounded-xl border border-white/12 bg-black/30 p-3">
        <p className="text-[11px] text-white/55">Loading broker status...</p>
      </section>
    )
  }

  if (!credential?.configured) {
    return (
      <section className="rounded-xl border border-white/12 bg-black/30 p-3">
        <div className="flex items-center gap-1.5 text-white/60">
          <ShieldOff className="h-3.5 w-3.5" />
          <p className="text-[10px] uppercase tracking-[0.1em]">Broker Connection</p>
        </div>
        <p className="mt-2 text-[11px] text-white/45">
          No Tradier credentials configured. Add credentials via the backend API to enable broker execution.
        </p>
      </section>
    )
  }

  return (
    <section className={cn(
      'rounded-xl border p-3',
      isConnected
        ? 'border-emerald-400/25 bg-emerald-500/[0.05]'
        : 'border-rose-400/25 bg-rose-500/[0.05]',
    )}>
      <div className="flex items-center gap-1.5">
        {isConnected ? (
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
        ) : (
          <Shield className="h-3.5 w-3.5 text-rose-300" />
        )}
        <p className={cn(
          'text-[10px] uppercase tracking-[0.1em]',
          isConnected ? 'text-emerald-100' : 'text-rose-100',
        )}>
          Broker Connection
        </p>
        <span className={cn(
          'ml-auto inline-flex h-2 w-2 rounded-full',
          isConnected ? 'animate-pulse bg-emerald-400' : 'bg-rose-400/60',
        )} />
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[10px] text-white/78">
        <p>Status</p>
        <p className={cn('font-mono', isConnected ? 'text-emerald-200' : 'text-rose-200')}>
          {isConnected ? 'Connected' : 'Inactive'}
        </p>

        <p>Account</p>
        <p className="font-mono text-white/92">
          {credential.accountIdMasked ? `••••${credential.accountIdMasked}` : '--'}
        </p>

        <p>Environment</p>
        <p className="font-mono">
          <span className={cn(
            'rounded border px-1 py-0.5 text-[9px] uppercase',
            isSandbox
              ? 'border-champagne/35 bg-champagne/10 text-champagne'
              : 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100',
          )}>
            {isSandbox ? 'Sandbox' : 'Live'}
          </span>
        </p>

        <p>Last sync</p>
        <p className="font-mono text-white/92">
          {formatSyncAge(status?.latestPortfolioSnapshot?.snapshot_time)}
        </p>

        <p>Encryption</p>
        <p className="font-mono text-emerald-200/80">AES-256-GCM</p>

        <p>Execution engine</p>
        <p className={cn(
          'font-mono',
          status?.runtime.execution.enabled ? 'text-emerald-200' : 'text-white/55',
        )}>
          {status?.runtime.execution.enabled ? 'Enabled' : 'Disabled'}
        </p>

        <p>Tracked trades</p>
        <p className="font-mono text-white/92">
          {status?.runtime.execution.trackedTrades ?? 0}
        </p>
      </div>
    </section>
  )
}
