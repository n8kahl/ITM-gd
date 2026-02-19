'use client'

import { createContext, useContext } from 'react'
import type { CoachMessage } from '@/lib/types/spx-command-center'

export interface SPXCoachContextState {
  coachMessages: CoachMessage[]
  sendCoachMessage: (prompt: string, setupId?: string | null) => Promise<CoachMessage>
}

const SPXCoachContext = createContext<SPXCoachContextState | null>(null)

export function SPXCoachProvider({
  value,
  children,
}: {
  value: SPXCoachContextState
  children: React.ReactNode
}) {
  return (
    <SPXCoachContext.Provider value={value}>
      {children}
    </SPXCoachContext.Provider>
  )
}

export function useSPXCoachContext() {
  const context = useContext(SPXCoachContext)
  if (!context) {
    throw new Error('useSPXCoachContext must be used inside SPXCoachProvider')
  }

  return context
}
