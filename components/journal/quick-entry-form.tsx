'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

const inputClassName = 'h-10 border-white/10 bg-white/5 text-sm text-ivory placeholder:text-muted-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50'
const selectClassName = 'h-10 border-white/10 bg-white/5 text-sm text-ivory focus:ring-2 focus:ring-emerald-500/50'

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
          <Input
            value={symbol}
            onChange={(event) => onSymbolChange(event.target.value.toUpperCase())}
            className={inputClassName}
            placeholder="AAPL"
            disabled={isDisabled}
          />
          {symbolError ? (
            <p className="mt-1 text-xs text-red-400">{symbolError}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Direction</label>
          <Select
            value={direction}
            onValueChange={(value) => onDirectionChange(value as 'long' | 'short')}
            disabled={isDisabled}
          >
            <SelectTrigger className={selectClassName}>
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="long">Long</SelectItem>
              <SelectItem value="short">Short</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Entry Price</label>
          <Input
            value={entryPrice}
            onChange={(event) => onEntryPriceChange(event.target.value)}
            type="number"
            inputMode="decimal"
            step="0.01"
            className={inputClassName}
            placeholder="0.00"
            disabled={isDisabled}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Exit Price</label>
          <Input
            value={exitPrice}
            onChange={(event) => onExitPriceChange(event.target.value)}
            type="number"
            inputMode="decimal"
            step="0.01"
            className={inputClassName}
            placeholder="0.00"
            disabled={isDisabled}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">P&L</label>
          <Input
            value={pnl}
            onChange={(event) => onPnlChange(event.target.value)}
            type="number"
            inputMode="decimal"
            step="0.01"
            className={inputClassName}
            placeholder="Optional"
            disabled={isDisabled}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={onSave}
          disabled={isDisabled}
          size="sm"
          className="h-10 px-4"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  )
}
