'use client'

import { FormEvent, useState } from 'react'
import { Send } from 'lucide-react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { CoachMessageCard } from '@/components/spx-command-center/coach-message'

export function AICoachFeed() {
  const { coachMessages, selectedSetup, sendCoachMessage } = useSPXCommandCenter()
  const [prompt, setPrompt] = useState('')
  const [isSending, setIsSending] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!prompt.trim() || isSending) return

    setIsSending(true)
    try {
      await sendCoachMessage(prompt.trim(), selectedSetup?.id)
      setPrompt('')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="glass-card-heavy rounded-2xl p-3 md:p-4 flex flex-col gap-3 min-h-[260px]">
      <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">AI Coach</h3>

      <div className="flex-1 space-y-2 max-h-[280px] overflow-auto pr-1">
        {coachMessages.length === 0 ? (
          <p className="text-xs text-white/55">No coaching messages yet.</p>
        ) : (
          coachMessages.map((message) => (
            <CoachMessageCard key={message.id} message={message} />
          ))
        )}
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask coach for setup guidance"
          className="flex-1 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-ivory placeholder:text-white/45 focus:outline-none focus:ring-1 focus:ring-emerald-300/60"
        />
        <button
          type="submit"
          disabled={isSending || !prompt.trim()}
          className="inline-flex items-center justify-center rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-3 py-2 text-emerald-200 disabled:opacity-50"
          aria-label="Send coach message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  )
}
