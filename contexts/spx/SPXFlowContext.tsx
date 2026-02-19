'use client'

import { createContext, useContext } from 'react'
import type { FlowEvent } from '@/lib/types/spx-command-center'

export interface SPXFlowContextState {
  flowEvents: FlowEvent[]
}

const SPXFlowContext = createContext<SPXFlowContextState | null>(null)

export function SPXFlowProvider({
  value,
  children,
}: {
  value: SPXFlowContextState
  children: React.ReactNode
}) {
  return (
    <SPXFlowContext.Provider value={value}>
      {children}
    </SPXFlowContext.Provider>
  )
}

export function useSPXFlowContext() {
  const context = useContext(SPXFlowContext)
  if (!context) {
    throw new Error('useSPXFlowContext must be used inside SPXFlowProvider')
  }

  return context
}
