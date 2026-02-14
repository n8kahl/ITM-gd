'use client'

import type { WidgetAction } from './widget-actions'
import { type TieredActions, WidgetActionBarV2 } from './widget-action-bar-v2'

interface WidgetActionBarProps {
  actions: WidgetAction[]
  compact?: boolean
  className?: string
}

export function WidgetActionBar({ actions, compact = false, className }: WidgetActionBarProps) {
  const tiered = toTieredActions(actions)

  return (
    <WidgetActionBarV2
      actions={tiered}
      compact={compact}
      className={className}
    />
  )
}

export function toTieredActions(actions: WidgetAction[]): TieredActions {
  if (actions.length <= 3) {
    return {
      quick: actions,
      overflow: [],
    }
  }

  const quick: WidgetAction[] = []
  const overflow: WidgetAction[] = []
  const primary = actions.find((action) => action.variant === 'primary')

  if (primary) {
    quick.push(primary)
  }

  for (const action of actions) {
    if (primary && action === primary) continue
    if (quick.length < 3) {
      quick.push(action)
      continue
    }
    overflow.push(action)
  }

  return { quick, overflow }
}
