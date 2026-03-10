'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type {
  SwingSniperStructureStrategy,
  SwingSniperWatchlistPayload,
} from '@/lib/swing-sniper/types'

interface MandateDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: SwingSniperWatchlistPayload['filters']
  saving: boolean
  onRiskModeChange: (riskMode: SwingSniperWatchlistPayload['filters']['riskMode']) => void
  onSwingWindowChange: (swingWindow: SwingSniperWatchlistPayload['filters']['swingWindow']) => void
  onMinScoreChange: (minScore: number) => void
  onToggleSetup: (setup: SwingSniperStructureStrategy) => void
  onSave: () => void
}

const SETUP_OPTIONS: Array<{
  value: SwingSniperStructureStrategy
  label: string
  tier: 'defined' | 'advanced'
}> = [
  { value: 'long_call', label: 'Long Call', tier: 'advanced' },
  { value: 'long_put', label: 'Long Put', tier: 'advanced' },
  { value: 'long_straddle', label: 'Long Straddle', tier: 'advanced' },
  { value: 'long_strangle', label: 'Long Strangle', tier: 'advanced' },
  { value: 'call_debit_spread', label: 'Call Debit Spread', tier: 'defined' },
  { value: 'put_debit_spread', label: 'Put Debit Spread', tier: 'defined' },
  { value: 'call_calendar', label: 'Call Calendar', tier: 'defined' },
  { value: 'put_calendar', label: 'Put Calendar', tier: 'defined' },
  { value: 'call_diagonal', label: 'Call Diagonal', tier: 'defined' },
  { value: 'put_diagonal', label: 'Put Diagonal', tier: 'defined' },
  { value: 'call_butterfly', label: 'Call Butterfly', tier: 'defined' },
  { value: 'put_butterfly', label: 'Put Butterfly', tier: 'defined' },
]

export function MandateDrawer({
  open,
  onOpenChange,
  filters,
  saving,
  onRiskModeChange,
  onSwingWindowChange,
  onMinScoreChange,
  onToggleSetup,
  onSave,
}: MandateDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 h-screen w-full max-w-[440px] translate-x-0 translate-y-0 gap-0 rounded-none border-white/10 bg-[#09090a]/95 p-0 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="flex h-full flex-col">
          <DialogHeader className="border-b border-white/10 px-6 py-5 text-left">
            <DialogTitle className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne">
              Mandate
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">
              Define the structures and timing Swing Sniper should prioritize for your board and dossier.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <section>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Risk profile</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onRiskModeChange('defined_risk_only')}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition-colors',
                    filters.riskMode === 'defined_risk_only'
                      ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100'
                      : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]',
                  )}
                >
                  Defined risk only
                </button>
                <button
                  type="button"
                  onClick={() => onRiskModeChange('naked_allowed')}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition-colors',
                    filters.riskMode === 'naked_allowed'
                      ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100'
                      : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]',
                  )}
                >
                  Include naked / single-leg
                </button>
              </div>
            </section>

            <section>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Holding window</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ['seven_to_fourteen', '7-14D'],
                  ['fourteen_to_thirty', '14-30D'],
                  ['all', 'All expiries'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onSwingWindowChange(value as SwingSniperWatchlistPayload['filters']['swingWindow'])}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition-colors',
                      filters.swingWindow === value
                        ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100'
                        : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Minimum ORC</p>
                <p className="font-mono text-xs text-white/80">{filters.minScore}</p>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={filters.minScore}
                onChange={(event) => onMinScoreChange(Number(event.currentTarget.value))}
                className="mt-3 w-full accent-emerald-500"
              />
            </section>

            <section>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Setup types</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SETUP_OPTIONS.map((option) => {
                  const checked = filters.preferredSetups.includes(option.value)
                  const disabled = filters.riskMode === 'defined_risk_only' && option.tier === 'advanced'

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => !disabled && onToggleSetup(option.value)}
                      disabled={disabled}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs transition-colors',
                        checked
                          ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100'
                          : 'border-white/10 bg-white/[0.03] text-white/75 hover:bg-white/[0.08]',
                        disabled && 'cursor-not-allowed border-white/5 text-white/30 hover:bg-white/[0.03]',
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </section>
          </div>

          <div className="border-t border-white/10 px-6 py-4">
            <Button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="w-full rounded-full bg-emerald-500 text-black hover:bg-emerald-400"
            >
              {saving ? 'Saving mandate…' : 'Apply mandate'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
