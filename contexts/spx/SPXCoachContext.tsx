'use client'

import { createContext, useContext } from 'react'
import type { CoachDecisionBrief, CoachMessage } from '@/lib/types/spx-command-center'

export type SPXCoachDecisionStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface RequestCoachDecisionInput {
  setupId?: string | null
  question?: string
  forceRefresh?: boolean
  surface?: string
}

export interface SPXCoachContextState {
  coachMessages: CoachMessage[]
  sendCoachMessage: (prompt: string, setupId?: string | null) => Promise<CoachMessage>
  coachDecision: CoachDecisionBrief | null
  coachDecisionStatus: SPXCoachDecisionStatus
  coachDecisionError: string | null
  requestCoachDecision: (input?: RequestCoachDecisionInput) => Promise<CoachDecisionBrief | null>
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
