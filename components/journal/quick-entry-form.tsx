'use client'

import { Calculator, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SymbolSearch } from '@/components/ai-coach/symbol-search'
import type { AIFieldKey, AIFieldStatus, TradeEntryFormData } from './trade-entry-types'

interface QuickEntryFormProps {
  form: TradeEntryFormData
  saving: boolean
  quickPnlPreview: number | null
  onFieldChange: (field: keyof TradeEntryFormData, value: string | string[] | number) => void
  onSaveAndClose: () => void
  onSaveAndAddDetails: () => void
  canSaveQuick: boolean
  showActions?: boolean
  aiFieldStatus: Partial<Record<AIFieldKey, AIFieldStatus>>
  onAcceptAiField: (field: AIFieldKey) => void
  onRejectAiField: (field: AIFieldKey) => void
}

function FieldStatusActions({
  field,
  status,
  onAccept,
  onReject,
}: {
  field: AIFieldKey
  status?: AIFieldStatus
  onAccept: (field: AIFieldKey) => void
  onReject: (field: AIFieldKey) => void
}) {
  if (status !== 'pending') return null

  return (
    <div className="inline-flex items-center gap-1 ml-1.5">
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-champagne/10 text-champagne border border-champagne/20">
        <Sparkles className="w-2.5 h-2.5" />
        AI
      </span>
      <button
        type="button"
        onClick={() => onAccept(field)}
        className="focus-champagne px-1.5 py-0.5 rounded-md text-[9px] text-emerald-300 hover:text-emerald-200 bg-emerald-900/20 border border-emerald-800/40"
        aria-label={`Accept AI suggestion for ${field.replace('_', ' ')}`}
      >
        Accept
      </button>
      <button
        type="button"
        onClick={() => onReject(field)}
        className="focus-champagne px-1.5 py-0.5 rounded-md text-[9px] text-red-300 hover:text-red-200 bg-red-900/20 border border-red-800/40"
        aria-label={`Reject AI suggestion for ${field.replace('_', ' ')}`}
      >
        Reject
      </button>
    </div>
  )
}

function parsePrice(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function QuickEntryForm({
  form,
  saving,
  quickPnlPreview,
  onFieldChange,
  onSaveAndClose,
  onSaveAndAddDetails,
  canSaveQuick,
  showActions = true,
  aiFieldStatus,
  onAcceptAiField,
  onRejectAiField,
}: QuickEntryFormProps) {
  const entryPrice = parsePrice(form.entry_price)
  const exitPrice = parsePrice(form.exit_price)

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            Trade Date
          </label>
          <input
            type="date"
            value={form.trade_date}
            onChange={(e) => onFieldChange('trade_date', e.target.value)}
            className="focus-champagne w-full h-11 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            aria-label="Trade date"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            Symbol
            <FieldStatusActions
              field="symbol"
              status={aiFieldStatus.symbol}
              onAccept={onAcceptAiField}
              onReject={onRejectAiField}
            />
          </label>
          <SymbolSearch
            value={form.symbol}
            onChange={(next) => onFieldChange('symbol', next)}
            className={cn(
              '[&>div>input]:h-11 [&>div>input]:rounded-lg [&>div>input]:border [&>div>input]:border-white/[0.08] [&>div>input]:bg-white/[0.05] [&>div>input]:text-sm',
              aiFieldStatus.symbol === 'pending' && '[&>div>input]:border-champagne/30 [&>div>input]:bg-champagne/5',
            )}
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            Direction
            <FieldStatusActions
              field="direction"
              status={aiFieldStatus.direction}
              onAccept={onAcceptAiField}
              onReject={onRejectAiField}
            />
          </label>
          <div className={cn(
            'grid grid-cols-2 rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.03] h-11',
            aiFieldStatus.direction === 'pending' && 'border-champagne/30 bg-champagne/5',
          )}>
            {(['long', 'short'] as const).map((direction) => (
              <button
                key={direction}
                type="button"
                onClick={() => onFieldChange('direction', direction)}
                className={cn(
                  'focus-champagne text-sm font-medium capitalize transition-colors',
                  form.direction === direction
                    ? direction === 'long'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-red-600 text-white'
                    : 'text-muted-foreground hover:text-ivory',
                )}
                aria-pressed={form.direction === direction}
              >
                {direction}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            Entry Price
            <FieldStatusActions
              field="entry_price"
              status={aiFieldStatus.entry_price}
              onAccept={onAcceptAiField}
              onReject={onRejectAiField}
            />
          </label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={form.entry_price}
            onChange={(e) => onFieldChange('entry_price', e.target.value)}
            placeholder="0.00"
            className={cn(
              'focus-champagne w-full h-11 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm font-mono text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30',
              aiFieldStatus.entry_price === 'pending' && 'border-champagne/30 bg-champagne/5',
            )}
            aria-label="Entry price"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            Exit Price
            <FieldStatusActions
              field="exit_price"
              status={aiFieldStatus.exit_price}
              onAccept={onAcceptAiField}
              onReject={onRejectAiField}
            />
          </label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={form.exit_price}
            onChange={(e) => onFieldChange('exit_price', e.target.value)}
            placeholder="0.00"
            className={cn(
              'focus-champagne w-full h-11 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm font-mono text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30',
              aiFieldStatus.exit_price === 'pending' && 'border-champagne/30 bg-champagne/5',
            )}
            aria-label="Exit price"
          />
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-emerald-400" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Calculated P&L Preview</p>
            <p className="text-sm font-mono tabular-nums text-ivory">
              {quickPnlPreview == null
                ? 'Enter prices to calculate'
                : `${quickPnlPreview >= 0 ? '+' : '-'}$${Math.abs(quickPnlPreview).toFixed(2)}`}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {entryPrice != null && exitPrice != null
            ? `Based on 1 unit (${form.direction === 'long' ? 'long' : 'short'}).`
            : 'P&L updates in real time as prices change.'}
        </p>
      </div>

      {showActions && (
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onSaveAndAddDetails}
            className="focus-champagne h-10 px-4 rounded-lg border border-white/[0.1] text-sm text-ivory hover:bg-white/[0.05] transition-colors"
          >
            Save & Add Details
          </button>
          <button
            type="button"
            onClick={onSaveAndClose}
            disabled={!canSaveQuick || saving}
            className="focus-champagne h-10 px-4 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {saving ? 'Saving…' : 'Save & Close'}
          </button>
        </div>
      )}
    </section>
  )
}
