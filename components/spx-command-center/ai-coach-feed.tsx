'use client'

import { FormEvent, useState } from 'react'
import { Send, Target, ShieldCheck, DoorOpen, Scale } from 'lucide-react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { CoachMessageCard } from '@/components/spx-command-center/coach-message'
import { cn } from '@/lib/utils'

const QUICK_ACTIONS = [
  { label: 'Confirm entry?', icon: Target, prompt: 'Should I enter this setup now? Validate confluence and timing.' },
  { label: 'Risk check', icon: ShieldCheck, prompt: 'Run a risk check on the selected setup. What could go wrong?' },
  { label: 'Exit strategy', icon: DoorOpen, prompt: 'What is the optimal exit strategy for this setup? When to take partials?' },
  { label: 'Size guidance', icon: Scale, prompt: 'What position size is appropriate for this setup given current conditions?' },
] as const

export function AICoachFeed({ readOnly = false }: { readOnly?: boolean }) {
  const { coachMessages, selectedSetup, sendCoachMessage } = useSPXCommandCenter()
  const [prompt, setPrompt] = useState('')
  const [isSending, setIsSending] = useState(false)

  const filteredMessages = selectedSetup
    ? coachMessages.filter((m) => !m.setupId || m.setupId === selectedSetup.id)
    : coachMessages

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!prompt.trim() || isSending) return
    await sendMessage(prompt.trim())
  }

  const sendMessage = async (text: string) => {
    setIsSending(true)
    try {
      await sendCoachMessage(text, selectedSetup?.id)
      setPrompt('')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="glass-card-heavy rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.025] to-champagne/5 p-3 flex flex-col gap-2 min-h-[220px]">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-white/60">AI Coach</h3>
        {selectedSetup && (
          <span className="text-[9px] text-champagne/60 font-mono">
            Focused: {selectedSetup.type.replace('_', ' ')}
          </span>
        )}
      </div>

      {/* Quick-action buttons */}
      {!readOnly && selectedSetup && (
        <div className="flex flex-wrap gap-1">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={isSending}
              onClick={() => sendMessage(action.prompt)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] uppercase tracking-[0.06em] transition-colors',
                'border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-200/80 hover:bg-emerald-500/15 hover:text-emerald-200',
                'disabled:opacity-40',
              )}
            >
              <action.icon className="h-2.5 w-2.5" />
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-1.5 max-h-[240px] overflow-auto pr-0.5">
        {filteredMessages.length === 0 ? (
          <p className="text-[11px] text-white/45">
            {selectedSetup ? 'No coaching for this setup yet. Use quick actions above.' : 'Select a setup for contextual coaching.'}
          </p>
        ) : (
          filteredMessages.map((message) => (
            <CoachMessageCard key={message.id} message={message} />
          ))
        )}
      </div>

      {/* Input */}
      {readOnly ? (
        <p className="text-[10px] text-white/40">Read-only on mobile.</p>
      ) : (
        <form onSubmit={onSubmit} className="flex items-center gap-1.5">
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={selectedSetup ? 'Ask about this setup...' : 'Ask coach...'}
            className="flex-1 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-ivory placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-emerald-300/50"
          />
          <button
            type="submit"
            disabled={isSending || !prompt.trim()}
            className="inline-flex items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/12 p-1.5 text-emerald-200 disabled:opacity-40"
            aria-label="Send coach message"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      )}
    </section>
  )
}
