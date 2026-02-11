'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { LUXURY_SPRING } from '@/lib/motion-primitives'

interface CounterProps {
  value: number
  className?: string
  format?: (value: number) => string
  flashDirection?: 'up' | 'down' | null
}

export function Counter({ value, className, format, flashDirection = null }: CounterProps) {
  const formattedValue = useMemo(
    () => (format ? format(value) : value.toLocaleString('en-US')),
    [value, format],
  )

  return (
    <span className={cn('relative inline-flex overflow-hidden font-mono tabular-nums', className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={`${value}-${formattedValue}`}
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -14, opacity: 0 }}
          transition={LUXURY_SPRING}
          className={cn(
            'inline-block text-ivory',
            flashDirection === 'up' && 'counter-flash-up',
            flashDirection === 'down' && 'counter-flash-down',
          )}
        >
          {formattedValue}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
