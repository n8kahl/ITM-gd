'use client'

import { useCallback, useEffect, useState } from 'react'

export interface HoverTarget {
  type: 'level' | 'symbol'
  value: string
  price?: number
  sourcePanel: 'chat' | 'center'
  messageId?: string
}

export function emitHoverTarget(target: HoverTarget) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('ai-coach-hover-coordinate', { detail: target }))
}

export function clearHoverTarget() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('ai-coach-hover-clear'))
}

export function useHoverCoordination() {
  const [activeHover, setActiveHover] = useState<HoverTarget | null>(null)

  const hoverLevel = useCallback((value: string, price: number | undefined, sourcePanel: 'chat' | 'center', messageId?: string) => {
    setActiveHover({
      type: 'level',
      value,
      price,
      sourcePanel,
      messageId,
    })
  }, [])

  const clearHover = useCallback(() => {
    setActiveHover(null)
  }, [])

  useEffect(() => {
    if (activeHover) {
      emitHoverTarget(activeHover)
      return
    }
    clearHoverTarget()
  }, [activeHover])

  return {
    activeHover,
    hoverLevel,
    clearHover,
  }
}
