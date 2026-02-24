'use client'

import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Loader2, MoreHorizontal } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { WidgetAction } from './widget-actions'

export interface TieredActions {
  quick: WidgetAction[]
  overflow: WidgetAction[]
}

interface WidgetActionBarProps {
  actions: WidgetAction[]
  compact?: boolean
  className?: string
}

const PRESSABLE_PROPS = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.98 },
}

export function WidgetActionBar({ actions, compact = false, className }: WidgetActionBarProps) {
  const tiered = toTieredActions(actions)
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)

  const runAction = async (action: WidgetAction) => {
    try {
      const result = action.action()
      if (result && typeof (result as Promise<void>).then === 'function') {
        setLoadingLabel(action.label)
        await result
      }
    } finally {
      setLoadingLabel((current) => (current === action.label ? null : current))
    }
  }

  if (tiered.quick.length === 0 && tiered.overflow.length === 0) return null

  return (
    <div className={cn('mt-2 rounded-lg border border-white/10 bg-black/20 px-1.5 py-1.5', className)}>
      <div className={cn('flex items-center gap-1.5', compact && 'overflow-x-auto pb-0.5 sm:overflow-visible')}>
        {tiered.quick.map((action) => {
          const Icon = action.icon
          const isLoading = loadingLabel === action.label
          return (
            <motion.button
              key={action.label}
              type="button"
              onClick={() => void runAction(action)}
              disabled={action.disabled || isLoading}
              title={action.tooltip || action.label}
              aria-label={action.label}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border px-2.5 py-1 text-[10px] font-medium transition-colors min-h-[30px]',
                action.variant === 'primary' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15',
                action.variant === 'danger' && 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15',
                (!action.variant || action.variant === 'secondary') && 'border-white/10 bg-white/5 text-white/60 hover:text-white/75 hover:bg-white/10',
                (action.disabled || isLoading) && 'opacity-40 cursor-not-allowed',
              )}
              {...PRESSABLE_PROPS}
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
              <span>{action.label}</span>
            </motion.button>
          )
        })}

        {tiered.overflow.length > 0 && (
          <Popover.Root open={overflowOpen} onOpenChange={setOverflowOpen}>
            <Popover.Trigger asChild>
              <motion.button
                type="button"
                aria-label="More actions"
                className="inline-flex shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-white/40 hover:text-white/60 hover:bg-white/10 transition-colors w-[30px] h-[30px]"
                {...PRESSABLE_PROPS}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </motion.button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="top"
                align="end"
                sideOffset={6}
                className="z-50 min-w-[180px] rounded-lg border border-white/15 bg-[#111216] p-1 shadow-2xl"
              >
                {tiered.overflow.map((action) => {
                  const Icon = action.icon
                  const isLoading = loadingLabel === action.label
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => {
                        void runAction(action)
                        setOverflowOpen(false)
                      }}
                      disabled={action.disabled || isLoading}
                      className={cn(
                        'flex w-full items-center gap-2 rounded px-2.5 py-2 text-xs outline-none transition-colors',
                        action.disabled
                          ? 'cursor-not-allowed text-white/25'
                          : 'cursor-pointer text-white/70 hover:bg-white/10 hover:text-white',
                      )}
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
                      <span>{action.label}</span>
                    </button>
                  )
                })}
                <Popover.Arrow className="fill-[#111216]" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>
    </div>
  )
}

export function toTieredActions(actions: WidgetAction[]): TieredActions {
  if (actions.length <= 3) {
    return {
      quick: actions,
      overflow: [],
    }
  }

  const quick: WidgetAction[] = []
  const overflow: WidgetAction[] = []
  const primary = actions.find((action) => action.variant === 'primary')

  if (primary) {
    quick.push(primary)
  }

  for (const action of actions) {
    if (primary && action === primary) continue
    if (quick.length < 3) {
      quick.push(action)
      continue
    }
    overflow.push(action)
  }

  return { quick, overflow }
}
