'use client'

import { useSPXQuery } from '@/hooks/use-spx-api'
import { cn } from '@/lib/utils'

interface TradierPosition {
  symbol: string
  quantity: number
  costBasis: number | null
  dateAcquired: string | null
}

interface PositionsResponse {
  positions: TradierPosition[]
  isActive: boolean
  positionCount: number
  message?: string
}

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '--'
  return `$${value.toFixed(2)}`
}

export function BrokerPositionMonitor({ isConnected }: { isConnected: boolean }) {
  const { data, isLoading } = useSPXQuery<PositionsResponse>(
    '/api/spx/broker/tradier/positions',
    { refreshInterval: isConnected ? 30_000 : 0, revalidateOnFocus: false },
  )

  if (!isConnected) return null

  if (isLoading && !data) {
    return (
      <section className="rounded-xl border border-white/12 bg-black/30 p-3">
        <p className="text-[11px] text-white/55">Loading positions...</p>
      </section>
    )
  }

  const positions = data?.positions || []

  return (
    <section className="rounded-xl border border-white/12 bg-black/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.1em] text-white/58">Open Positions</p>
        <p className="text-[9px] font-mono text-white/42">{positions.length} position{positions.length !== 1 ? 's' : ''}</p>
      </div>

      {positions.length === 0 ? (
        <p className="text-[11px] text-white/45">No open positions.</p>
      ) : (
        <div className="space-y-1">
          <div className="hidden grid-cols-[1fr_60px_80px_80px] gap-2 text-[9px] uppercase tracking-[0.08em] text-white/40 md:grid">
            <p>Contract</p>
            <p className="text-right">Qty</p>
            <p className="text-right">Cost Basis</p>
            <p className="text-right">Acquired</p>
          </div>
          <div className="max-h-[240px] space-y-1 overflow-y-auto pr-0.5">
            {positions.map((pos, index) => (
              <div
                key={`${pos.symbol}_${index}`}
                className="rounded border border-white/8 bg-black/30 px-1.5 py-1 md:grid md:grid-cols-[1fr_60px_80px_80px] md:gap-2"
              >
                <p className="truncate font-mono text-[10px] text-white/84">{pos.symbol}</p>
                <p className={cn(
                  'font-mono text-[10px] md:text-right',
                  pos.quantity > 0 ? 'text-emerald-200' : 'text-rose-200',
                )}>
                  {pos.quantity}
                </p>
                <p className="font-mono text-[10px] text-white/70 md:text-right">
                  {formatCurrency(pos.costBasis)}
                </p>
                <p className="font-mono text-[9px] text-white/50 md:text-right">
                  {pos.dateAcquired || '--'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
