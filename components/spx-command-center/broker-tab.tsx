'use client'

import { Shield } from 'lucide-react'
import { useTradierBroker } from '@/hooks/use-tradier-broker'
import { BrokerConnectionCard } from './broker-connection-card'
import { BrokerFillQuality } from './broker-fill-quality'
import { BrokerPositionMonitor } from './broker-position-monitor'
import { BrokerSafetyControls } from './broker-safety-controls'
import { ExecutionModeToggle } from './execution-mode-toggle'
import { KillSwitchButton } from './kill-switch-button'
import { cn } from '@/lib/utils'

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '--'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function BrokerTab() {
  const {
    status,
    isConnected,
    isSandbox,
    executionMode,
    portfolio,
    isLoading,
    error,
    isSettingMode,
    modeError,
    isKilling,
    killError,
    setExecutionMode,
    killAll,
  } = useTradierBroker()

  const errorMessage = error instanceof Error ? error.message : error ? String(error) : null
  const actionError = modeError || killError

  return (
    <>
      {(errorMessage || actionError) && (
        <div className="px-4 pb-2 pt-2">
          <p className="rounded border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-rose-100">
            {actionError || errorMessage}
          </p>
        </div>
      )}

      <div className="grid gap-3 p-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="max-h-[calc(100vh-260px)] space-y-3 overflow-y-auto pr-1">
          <BrokerConnectionCard
            status={status}
            isConnected={isConnected}
            isSandbox={isSandbox}
            isLoading={isLoading}
          />

          {portfolio && (
            <section className="rounded-xl border border-white/12 bg-black/30 p-3">
              <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-white/58">Portfolio</p>
              <div className="space-y-2">
                <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Total Equity</p>
                  <p className="font-mono text-[13px] text-white/92">{formatCurrency(portfolio.totalEquity)}</p>
                </div>
                <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Day Trade Buying Power</p>
                  <p className="font-mono text-[13px] text-white/92">{formatCurrency(portfolio.dayTradeBuyingPower)}</p>
                </div>
                <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Realized P&L (Daily)</p>
                  <p className={cn(
                    'font-mono text-[13px]',
                    portfolio.realizedPnlDaily > 0 ? 'text-emerald-200' : portfolio.realizedPnlDaily < 0 ? 'text-rose-200' : 'text-white/70',
                  )}>
                    {portfolio.realizedPnlDaily > 0 ? '+' : ''}{formatCurrency(portfolio.realizedPnlDaily)}
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-white/12 bg-black/30 p-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-white/58">Execution Mode</p>
            <ExecutionModeToggle
              currentMode={executionMode}
              isConnected={isConnected}
              isSettingMode={isSettingMode}
              onModeChange={setExecutionMode}
            />
          </section>

          <KillSwitchButton
            isConnected={isConnected}
            isKilling={isKilling}
            onKill={killAll}
          />
        </aside>

        <main className="max-h-[calc(100vh-260px)] space-y-3 overflow-y-auto pr-1">
          {!isConnected ? (
            <section className="flex flex-col items-center justify-center rounded-xl border border-white/12 bg-black/30 p-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/[0.08]">
                <Shield className="h-5 w-5 text-emerald-300/70" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-white/70">
                Connect your broker to enable execution
              </p>
              <p className="mt-1 text-[10px] text-white/45">
                Tradier integration supports manual and automated order routing for SPX 0DTE setups.
              </p>
            </section>
          ) : (
            <>
              <BrokerPositionMonitor isConnected={isConnected} />
              <BrokerFillQuality status={status} isConnected={isConnected} />
              <BrokerSafetyControls status={status} isConnected={isConnected} />
            </>
          )}
        </main>
      </div>
    </>
  )
}
