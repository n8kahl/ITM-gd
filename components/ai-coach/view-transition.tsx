'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

export function ViewTransition({
  viewKey,
  children,
}: {
  viewKey: string
  children: ReactNode
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewKey}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
