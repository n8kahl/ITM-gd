'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  CandlestickChart,
  Calculator,
  Copy,
  LayoutDashboard,
  MessageSquare,
  TableProperties,
} from 'lucide-react'
import type { ChartTimeframe, PositionInput } from '@/lib/api/ai-coach'

export type WidgetViewTarget =
  | 'chart'
  | 'options'
  | 'journal'
  | 'preferences'

export type AlertType = 'price_above' | 'price_below' | 'level_approach' | 'level_break' | 'volume_spike'

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
  timeframe: ChartTimeframe = '5m',
  label?: string,
  buttonLabel?: string,
): WidgetAction {
  return {
    label: buttonLabel || (typeof level === 'number' ? 'Show on Chart' : 'Open Chart'),
    icon: CandlestickChart,
    variant: 'primary',
    tooltip: typeof level === 'number'
      ? `${symbol} @ ${level.toFixed(2)} (${timeframe})`
      : `${symbol} chart (${timeframe})`,
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
  buttonLabel?: string,
): WidgetAction {
  return {
    label: buttonLabel || 'View Options',
    icon: TableProperties,
    variant: 'secondary',
    tooltip: expiry
      ? `${symbol} ${expiry}${typeof strike === 'number' ? ` @ ${strike}` : ''}`
      : `${symbol}${typeof strike === 'number' ? ` @ ${strike}` : ''}`,
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
  buttonLabel?: string,
): WidgetAction {
  return {
    label: buttonLabel || 'Set Alert',
    icon: Bell,
    variant: 'secondary',
    tooltip: `${symbol} ${price.toFixed(2)} (${alertType})`,
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

export function analyzeAction(position: PositionInput, buttonLabel = 'Analyze'): WidgetAction {
  return {
    label: buttonLabel,
    icon: Calculator,
    variant: 'primary',
    tooltip: `${position.symbol}${position.strike ? ` ${position.strike}` : ''} ${position.type.toUpperCase()}`,
    action: () => {
      dispatchWidgetEvent('ai-coach-widget-analyze', {
        setup: position,
      })
    },
  }
}

export function chatAction(prompt: string, buttonLabel = 'Ask AI'): WidgetAction {
  return {
    label: buttonLabel,
    icon: MessageSquare,
    variant: 'secondary',
    tooltip: 'Send targeted follow-up prompt',
    action: () => {
      dispatchWidgetEvent('ai-coach-widget-chat', {
        prompt,
      })
    },
  }
}

export function copyAction(text: string, buttonLabel = 'Copy'): WidgetAction {
  return {
    label: buttonLabel,
    icon: Copy,
    variant: 'secondary',
    tooltip: 'Copy to clipboard',
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

export function viewAction(
  view: WidgetViewTarget,
  buttonLabel = 'Open View',
  symbol?: string,
): WidgetAction {
  return {
    label: buttonLabel,
    icon: LayoutDashboard,
    variant: 'secondary',
    tooltip: `Open ${buttonLabel}`,
    action: () => {
      dispatchWidgetEvent('ai-coach-widget-view', {
        view,
        symbol,
        label: buttonLabel,
      })
    },
  }
}
