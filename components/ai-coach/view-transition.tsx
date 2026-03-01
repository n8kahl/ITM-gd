'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

export function ViewTransition({
  viewKey,
  children,
}: {
  viewKey: string
  children: ReactNode
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      key={viewKey}
      initial={shouldReduceMotion ? false : { opacity: 0.96, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }}
      className="h-full"
    >
      {children}
    </motion.div>
  )
}
