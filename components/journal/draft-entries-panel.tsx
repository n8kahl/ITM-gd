'use client'

import { useEffect, useState } from 'react'
import { FileClock, Check, X } from 'lucide-react'
import type { JournalEntry } from '@/lib/types/journal'
import { createAppError, createAppErrorFromResponse, notifyAppError } from '@/lib/error-handler'

interface DraftEntriesPanelProps {
  onUpdated?: () => void
}

export function DraftEntriesPanel({ onUpdated }: DraftEntriesPanelProps) {
  const [drafts, setDrafts] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)

  const loadDrafts = async () => {
    try {
      const response = await fetch('/api/members/journal/drafts?status=pending&limit=20', { cache: 'no-store' })
      if (!response.ok) throw await createAppErrorFromResponse(response)
      const result = await response.json()
      setDrafts(Array.isArray(result.data) ? result.data : [])
    } catch (error) {
      notifyAppError(createAppError(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDrafts()
  }, [])

  const updateDraft = async (id: string, action: 'confirm' | 'dismiss') => {
    try {
      const response = await fetch(`/api/members/journal/drafts/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!response.ok) throw await createAppErrorFromResponse(response)
      setDrafts((prev) => prev.filter((draft) => draft.id !== id))
      if (onUpdated) onUpdated()
    } catch (error) {
      notifyAppError(createAppError(error))
    }
  }

  if (loading || drafts.length === 0) return null

  return (
    <section className="glass-card rounded-xl p-4 border border-champagne/20 space-y-2.5">
      <div className="flex items-center gap-2">
        <FileClock className="w-4 h-4 text-champagne" />
        <h3 className="text-sm font-medium text-ivory">Pending Draft Entries</h3>
      </div>

      <div className="space-y-2">
        {drafts.map((draft) => (
          <div key={draft.id} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-mono text-ivory">{draft.symbol}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(draft.trade_date).toLocaleDateString()} · {draft.direction || 'long'}
                </p>
                {draft.setup_notes && (
                  <p className="text-[11px] text-ivory/75 mt-1 line-clamp-2">{draft.setup_notes}</p>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateDraft(draft.id, 'confirm')}
                  className="p-1.5 rounded-md bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                  aria-label="Confirm draft"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateDraft(draft.id, 'dismiss')}
                  className="p-1.5 rounded-md bg-red-500/15 text-red-300 hover:bg-red-500/25"
                  aria-label="Dismiss draft"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
