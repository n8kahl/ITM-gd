'use client'

import { Loader2 } from 'lucide-react'

interface QuickEntryFormProps {
  symbol: string
  direction: 'long' | 'short'
  entryPrice: string
  exitPrice: string
  pnl: string
  symbolError: string | null
  saving: boolean
  disabled?: boolean
  onSymbolChange: (value: string) => void
  onDirectionChange: (value: 'long' | 'short') => void
  onEntryPriceChange: (value: string) => void
  onExitPriceChange: (value: string) => void
  onPnlChange: (value: string) => void
  onSave: () => void
}

export function QuickEntryForm({
  symbol,
  direction,
  entryPrice,
  exitPrice,
  pnl,
  symbolError,
  saving,
  disabled = false,
  onSymbolChange,
  onDirectionChange,
  onEntryPriceChange,
  onExitPriceChange,
  onPnlChange,
  onSave,
}: QuickEntryFormProps) {
  const isDisabled = disabled || saving

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Symbol</label>
          <input
            value={symbol}
            onChange={(event) => onSymbolChange(event.target.value.toUpperCase())}
            className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-ivory"
            placeholder="AAPL"
            disabled={isDisabled}
          />
          {symbolError ? (
            <p className="mt-1 text-xs text-red-400">{symbolError}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Direction</label>
          <select
            value={direction}
            onChange={(event) => onDirectionChange(event.target.value as 'long' | 'short')}
            className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-ivory"
            disabled={isDisabled}
          >
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Entry Price</label>
          <input
            value={entryPrice}
            onChange={(event) => onEntryPriceChange(event.target.value)}
            type="number"
            step="0.01"
            className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-ivory"
            placeholder="0.00"
            disabled={isDisabled}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Exit Price</label>
          <input
            value={exitPrice}
            onChange={(event) => onExitPriceChange(event.target.value)}
            type="number"
            step="0.01"
            className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-ivory"
            placeholder="0.00"
            disabled={isDisabled}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">P&L</label>
          <input
            value={pnl}
            onChange={(event) => onPnlChange(event.target.value)}
            type="number"
            step="0.01"
            className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-ivory"
            placeholder="Optional"
            disabled={isDisabled}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={isDisabled}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save
        </button>
      </div>
    </div>
  )
}
