'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  CandlestickChart,
  Calculator,
  Copy,
  MessageSquare,
  TableProperties,
} from 'lucide-react'
import type { AlertType, ChartTimeframe, PositionInput } from '@/lib/api/ai-coach'

export interface WidgetAction {
  label: string
  icon: LucideIcon
  action: () => void | Promise<void>
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  tooltip?: string
}

function dispatchWidgetEvent<T>(name: string, detail: T) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

export function chartAction(
  symbol: string,
  level?: number,
  timeframe: ChartTimeframe = '1D',
  label?: string,
): WidgetAction {
  return {
    label: typeof level === 'number' ? 'Show on Chart' : 'Open Chart',
    icon: CandlestickChart,
    variant: 'primary',
    action: () => {
      dispatchWidgetEvent('ai-coach-widget-chart', {
        symbol,
        level,
        timeframe,
        label,
      })
    },
  }
}

export function optionsAction(
  symbol: string,
  strike?: number,
  expiry?: string,
): WidgetAction {
  return {
    label: 'View Options',
    icon: TableProperties,
    variant: 'secondary',
    action: () => {
      dispatchWidgetEvent('ai-coach-widget-options', {
        symbol,
        strike,
        expiry,
      })
    },
  }
}

export function alertAction(
  symbol: string,
  price: number,
  alertType: AlertType = 'level_approach',
  notes?: string,
): WidgetAction {
  return {
    label: 'Set Alert',
    icon: Bell,
    variant: 'secondary',
    action: () => {
      dispatchWidgetEvent('ai-coach-widget-alert', {
        symbol,
        price,
        alertType,
        notes,
      })
    },
  }
}

export function analyzeAction(position: PositionInput): WidgetAction {
  return {
    label: 'Analyze',
    icon: Calculator,
    variant: 'primary',
    action: () => {
      dispatchWidgetEvent('ai-coach-widget-analyze', {
        setup: position,
      })
    },
  }
}

export function chatAction(prompt: string): WidgetAction {
  return {
    label: 'Ask AI',
    icon: MessageSquare,
    variant: 'secondary',
    action: () => {
      dispatchWidgetEvent('ai-coach-widget-chat', {
        prompt,
      })
    },
  }
}

export function copyAction(text: string): WidgetAction {
  return {
    label: 'Copy',
    icon: Copy,
    variant: 'secondary',
    action: async () => {
      if (typeof window === 'undefined') return

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return
      }

      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    },
  }
}
