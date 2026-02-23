'use client'

import { useCallback, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TradierExecutionMode } from '@/hooks/use-tradier-broker'

interface ExecutionModeToggleProps {
  currentMode: TradierExecutionMode
  isConnected: boolean
  isSettingMode: boolean
  onModeChange: (mode: TradierExecutionMode) => Promise<void>
}

const MODES: { value: TradierExecutionMode; label: string; description: string }[] = [
  { value: 'off', label: 'Off', description: 'No order execution' },
  { value: 'manual', label: 'Manual', description: 'Confirm each trade' },
  { value: 'auto', label: 'Auto', description: 'Automatic execution' },
]

function modeTone(mode: TradierExecutionMode, active: boolean): string {
  if (!active) return 'border-white/10 bg-white/[0.03] text-white/40'
  if (mode === 'off') return 'border-white/20 bg-white/[0.08] text-white/80'
  if (mode === 'manual') return 'border-champagne/40 bg-champagne/12 text-champagne'
  return 'border-emerald-300/40 bg-emerald-500/15 text-emerald-100'
}

function modeDot(mode: TradierExecutionMode): string {
  if (mode === 'off') return 'bg-white/40'
  if (mode === 'manual') return 'bg-champagne'
  return 'bg-emerald-400'
}

export function ExecutionModeToggle({
  currentMode,
  isConnected,
  isSettingMode,
  onModeChange,
}: ExecutionModeToggleProps) {
  const [pendingConfirm, setPendingConfirm] = useState<TradierExecutionMode | null>(null)

  const handleClick = useCallback(async (mode: TradierExecutionMode) => {
    if (mode === currentMode || isSettingMode || !isConnected) return

    if (mode === 'auto' && !pendingConfirm) {
      setPendingConfirm('auto')
      return
    }

    setPendingConfirm(null)
    try {
      await onModeChange(mode)
    } catch {
      // Error is surfaced via hook's modeError
    }
  }, [currentMode, isConnected, isSettingMode, onModeChange, pendingConfirm])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {MODES.map((mode) => {
          const active = mode.value === currentMode
          return (
            <button
              key={mode.value}
              type="button"
              disabled={!isConnected || isSettingMode}
              onClick={() => handleClick(mode.value)}
              data-testid={`broker-mode-${mode.value}`}
              className={cn(
                'flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                modeTone(mode.value, active),
                !active && isConnected && 'hover:bg-white/[0.06] hover:text-white/70',
              )}
            >
              {isSettingMode && active ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span className={cn('inline-block h-2 w-2 rounded-full', active ? modeDot(mode.value) : 'bg-white/20')} />
              )}
              {mode.label}
            </button>
          )
        })}
      </div>

      <p className="text-[9px] text-white/45">
        {MODES.find((m) => m.value === currentMode)?.description}
      </p>

      {pendingConfirm === 'auto' && (
        <div className="rounded border border-amber-300/30 bg-amber-500/10 p-2 text-[10px] text-amber-100">
          <p className="mb-1.5 font-mono uppercase tracking-[0.08em]">Confirm Auto Execution</p>
          <p className="text-amber-100/70">
            Auto mode will execute trades without manual confirmation. Ensure your risk parameters are configured.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => handleClick('auto')}
              disabled={isSettingMode}
              className="min-h-[30px] rounded border border-emerald-300/35 bg-emerald-500/12 px-3 py-1 text-[10px] uppercase tracking-[0.08em] text-emerald-100 hover:bg-emerald-500/18 disabled:opacity-50"
            >
              Enable Auto
            </button>
            <button
              type="button"
              onClick={() => setPendingConfirm(null)}
              className="min-h-[30px] rounded border border-white/15 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.08em] text-white/60 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
