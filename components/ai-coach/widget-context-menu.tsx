'use client'

import * as ContextMenu from '@radix-ui/react-context-menu'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { WidgetAction } from './widget-actions'

interface WidgetContextMenuProps {
  children: ReactNode
  actions: WidgetAction[]
  className?: string
}

export function WidgetContextMenu({ children, actions, className }: WidgetContextMenuProps) {
  if (actions.length === 0) {
    return <>{children}</>
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div className={cn('contents', className)}>{children}</div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content
          className="z-50 min-w-[180px] rounded-md border border-white/15 bg-[#111216] p-1 shadow-2xl"
        >
          {actions.map((action, index) => {
            const Icon = action.icon
            return (
              <ContextMenu.Item
                key={`${action.label}-${index}`}
                onSelect={(event) => {
                  event.preventDefault()
                  if (!action.disabled) {
                    void action.action()
                  }
                }}
                disabled={action.disabled}
                className={cn(
                  'flex items-center gap-2 rounded px-2 py-1.5 text-xs outline-none transition-colors',
                  action.disabled
                    ? 'cursor-not-allowed text-white/25'
                    : 'cursor-pointer text-white/75 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{action.label}</span>
              </ContextMenu.Item>
            )
          })}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}
