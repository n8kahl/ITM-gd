'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const ATTENTION_EVENTS = [
  'ai-coach-widget-chart',
  'ai-coach-widget-options',
  'ai-coach-widget-alert',
  'ai-coach-widget-analyze',
  'ai-coach-widget-view',
  'ai-coach-show-chart',
] as const

const ATTENTION_LABELS: Record<(typeof ATTENTION_EVENTS)[number], string> = {
  'ai-coach-widget-chart': 'Chart updated',
  'ai-coach-widget-options': 'Options loaded',
  'ai-coach-widget-alert': 'Alert prompt prepared',
  'ai-coach-widget-analyze': 'Analyzing position',
  'ai-coach-widget-view': 'View changed',
  'ai-coach-show-chart': 'Chart updated',
}

export function resolvePanelAttentionLabel(eventType: string): string | null {
  if (!ATTENTION_EVENTS.includes(eventType as (typeof ATTENTION_EVENTS)[number])) {
    return null
  }
  return ATTENTION_LABELS[eventType as (typeof ATTENTION_EVENTS)[number]]
}

export function usePanelAttentionPulse() {
  const [isPulsing, setIsPulsing] = useState(false)
  const [pulseLabel, setPulseLabel] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const triggerPulse = useCallback((label?: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    setIsPulsing(true)
    setPulseLabel(label ?? null)
    timerRef.current = window.setTimeout(() => {
      setIsPulsing(false)
      setPulseLabel(null)
    }, 1200)
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      if (window.innerWidth < 1024) return
      const label = resolvePanelAttentionLabel(event.type)
      if (!label) return
      triggerPulse(label)
    }

    for (const eventName of ATTENTION_EVENTS) {
      window.addEventListener(eventName, handler)
    }

    return () => {
      for (const eventName of ATTENTION_EVENTS) {
        window.removeEventListener(eventName, handler)
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [triggerPulse])

  return {
    isPulsing,
    pulseLabel,
    triggerPulse,
  }
}
