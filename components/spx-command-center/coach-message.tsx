'use client'

import type { CoachMessage } from '@/lib/types/spx-command-center'
import { cn } from '@/lib/utils'

function priorityClass(priority: CoachMessage['priority']): string {
  if (priority === 'alert') return 'border-rose-400/40 bg-rose-500/10'
  if (priority === 'setup') return 'border-emerald-400/40 bg-emerald-500/10'
  if (priority === 'behavioral') return 'border-champagne/35 bg-champagne/10'
  return 'border-white/15 bg-white/[0.03]'
}

export function CoachMessageCard({ message }: { message: CoachMessage }) {
  return (
    <article className={cn('rounded-xl border p-3 text-left', priorityClass(message.priority))}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.13em] text-white/60">{message.priority}</p>
        <p className="text-[10px] text-white/50">{new Date(message.timestamp).toLocaleTimeString()}</p>
      </div>
      <p className="mt-1 text-sm text-ivory leading-relaxed">{message.content}</p>
    </article>
  )
}
