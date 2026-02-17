'use client'

import { useMemo, useState } from 'react'
import type { CoachMessage } from '@/lib/types/spx-command-center'
import { cn } from '@/lib/utils'

function priorityClass(priority: CoachMessage['priority']): string {
  if (priority === 'alert') return 'border-rose-400/40 bg-rose-500/10'
  if (priority === 'setup') return 'border-emerald-400/40 bg-emerald-500/10'
  if (priority === 'behavioral') return 'border-champagne/35 bg-champagne/10'
  return 'border-white/15 bg-white/[0.03]'
}

function extractActionChips(message: CoachMessage): string[] {
  const chips: string[] = []

  if (message.structuredData && typeof message.structuredData === 'object') {
    const data = message.structuredData as Record<string, unknown>
    const candidates = ['actions', 'actionItems', 'recommendedActions', 'keywords']

    for (const key of candidates) {
      const value = data[key]
      if (!Array.isArray(value)) continue

      for (const item of value) {
        if (typeof item === 'string') {
          const text = item.trim()
          if (text) chips.push(text)
          continue
        }
        if (item && typeof item === 'object') {
          const objectItem = item as Record<string, unknown>
          const textCandidate = objectItem.label || objectItem.text || objectItem.action
          if (typeof textCandidate === 'string' && textCandidate.trim()) {
            chips.push(textCandidate.trim())
          }
        }
      }
    }
  }

  const phraseMap: Array<[RegExp, string]> = [
    [/consider entering|enter now|entry valid/i, 'Consider Entry'],
    [/tighten stop|move stop|raise stop|lower stop/i, 'Adjust Stop'],
    [/take partial|scale out|trim position/i, 'Take Partial'],
    [/full exit|exit now|close position/i, 'Exit Position'],
    [/hold|wait for confirmation/i, 'Hold / Wait'],
    [/size down|reduce risk|risk-off/i, 'Reduce Size'],
  ]

  for (const [pattern, label] of phraseMap) {
    if (pattern.test(message.content)) {
      chips.push(label)
    }
  }

  return [...new Set(chips.map((chip) => chip.trim()).filter(Boolean))].slice(0, 4)
}

export function CoachMessageCard({ message }: { message: CoachMessage }) {
  const [expanded, setExpanded] = useState(false)
  const isExpandable = message.content.length > 180
  const actionChips = useMemo(() => extractActionChips(message), [message])
  const preview = useMemo(() => {
    if (!isExpandable || expanded) return message.content
    return `${message.content.slice(0, 180).trimEnd()}...`
  }, [expanded, isExpandable, message.content])

  return (
    <article className={cn('rounded-xl border p-3 text-left', priorityClass(message.priority))}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.13em] text-white/60">{message.priority}</p>
        <p className="text-[10px] text-white/50">{new Date(message.timestamp).toLocaleTimeString()}</p>
      </div>

      {actionChips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {actionChips.map((chip) => (
            <span
              key={`${message.id}-${chip}`}
              className="rounded-full border border-emerald-400/30 bg-emerald-500/12 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-emerald-200"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <p className="mt-1 text-sm text-ivory leading-relaxed">{preview}</p>
      {isExpandable && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 text-[11px] uppercase tracking-[0.12em] text-emerald-200 hover:text-emerald-100"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      )}
    </article>
  )
}
