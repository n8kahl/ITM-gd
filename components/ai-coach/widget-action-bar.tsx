'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { WidgetAction } from './widget-actions'

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
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null)

  if (actions.length === 0) return null

  const runAction = async (action: WidgetAction, index: number) => {
    try {
      const result = action.action()
      if (result && typeof (result as Promise<void>).then === 'function') {
        setLoadingIndex(index)
        await result
      }
    } finally {
      setLoadingIndex((current) => (current === index ? null : current))
    }
  }

  return (
    <div className={cn('mt-2 flex flex-wrap gap-1.5', className)}>
      {actions.map((action, index) => {
        const Icon = action.icon
        const isLoading = loadingIndex === index
        const tooltip = action.tooltip || action.label

        return (
          <motion.button
            key={`${action.label}-${index}`}
            type="button"
            onClick={() => void runAction(action, index)}
            disabled={action.disabled || isLoading}
            title={tooltip}
            aria-label={tooltip}
            className={cn(
              'inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-medium transition-colors min-h-[32px]',
              compact && 'px-1.5 py-1 min-h-[28px]',
              action.variant === 'primary' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15',
              action.variant === 'danger' && 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15',
              (!action.variant || action.variant === 'secondary') && 'border-white/10 bg-white/5 text-white/60 hover:text-white/75 hover:bg-white/10',
              (action.disabled || isLoading) && 'opacity-40 cursor-not-allowed'
            )}
            {...PRESSABLE_PROPS}
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Icon className="w-3 h-3" />
            )}
            {!compact && action.label}
          </motion.button>
        )
      })}
    </div>
  )
}
