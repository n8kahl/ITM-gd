'use client'

import { useState, type ReactNode } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Loader2, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetAction } from './widget-actions'

interface WidgetRowActionsProps {
  actions: WidgetAction[]
  children: ReactNode
  className?: string
}

export function WidgetRowActions({ actions, children, className }: WidgetRowActionsProps) {
  const [open, setOpen] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)

  if (actions.length === 0) return <>{children}</>

  const runAction = async (action: WidgetAction) => {
    try {
      const result = action.action()
      if (result && typeof (result as Promise<void>).then === 'function') {
        setLoadingLabel(action.label)
        await result
      }
    } finally {
      setLoadingLabel((current) => (current === action.label ? null : current))
      setOpen(false)
    }
  }

  return (
    <div className={cn('group/row relative flex items-center', className)}>
      <div className="min-w-0 flex-1">{children}</div>

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label="Row actions"
            data-card-ignore="true"
            className="ml-1 shrink-0 rounded p-0.5 text-white/20 opacity-0 transition-all group-hover/row:opacity-100 focus:opacity-100 hover:bg-white/5 hover:text-white/55"
          >
            <MoreVertical className="h-3 w-3" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="left"
            align="start"
            sideOffset={4}
            className="z-50 min-w-[160px] rounded-lg border border-white/15 bg-[#111216] p-1 shadow-2xl"
          >
            {actions.map((action) => {
              const Icon = action.icon
              const isLoading = loadingLabel === action.label
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => void runAction(action)}
                  disabled={action.disabled || isLoading}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs outline-none transition-colors',
                    action.disabled
                      ? 'cursor-not-allowed text-white/25'
                      : 'cursor-pointer text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                  <span>{action.label}</span>
                </button>
              )
            })}
            <Popover.Arrow className="fill-[#111216]" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
