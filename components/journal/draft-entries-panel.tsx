'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileClock, Check, X, Loader2 } from 'lucide-react'
import type { JournalEntry } from '@/lib/types/journal'
import { toast } from 'sonner'
import { createAppError, createAppErrorFromResponse, notifyAppError } from '@/lib/error-handler'

interface DraftEntriesPanelProps {
  onUpdated?: () => void
}

const AUTO_JOURNAL_RUN_KEY = 'journal-auto-journal-last-run-et'

function getEasternDateAndMinutes(): { date: string; minutes: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(new Date())
  const values = new Map<string, string>()
  for (const part of parts) {
    if (part.type !== 'literal') {
      values.set(part.type, part.value)
    }
  }

  const year = values.get('year') || '1970'
  const month = values.get('month') || '01'
  const day = values.get('day') || '01'
  const hour = Number.parseInt(values.get('hour') || '0', 10)
  const minute = Number.parseInt(values.get('minute') || '0', 10)

  return {
    date: `${year}-${month}-${day}`,
    minutes: hour * 60 + minute,
  }
}

export function DraftEntriesPanel({ onUpdated }: DraftEntriesPanelProps) {
  const [drafts, setDrafts] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [autoGenerating, setAutoGenerating] = useState(false)

  const loadDrafts = useCallback(async () => {
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
  }, [])

  const runAutoJournal = useCallback(async (silent: boolean) => {
    setAutoGenerating(true)
    try {
      const response = await fetch('/api/members/journal/auto-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!response.ok) throw await createAppErrorFromResponse(response)

      const result = await response.json()
      if (!result.success) {
        throw createAppError(result.error || 'Failed to generate auto-journal drafts.')
      }

      const created = Number(result?.data?.created || 0)
      if (created > 0) {
        toast.success(`We detected ${created} trade${created === 1 ? '' : 's'} from today. Review and confirm your draft entries.`)
        await loadDrafts()
        if (onUpdated) onUpdated()
      } else if (!silent) {
        toast.message(result?.data?.message || 'No new drafts detected for today.')
      }
    } catch (error) {
      notifyAppError(createAppError(error))
    } finally {
      setAutoGenerating(false)
    }
  }, [loadDrafts, onUpdated])

  useEffect(() => {
    void loadDrafts()
  }, [loadDrafts])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const { date, minutes } = getEasternDateAndMinutes()
    const marketCloseBufferMinutes = 16 * 60 + 5
    if (minutes < marketCloseBufferMinutes) return

    const lastRunDate = window.localStorage.getItem(AUTO_JOURNAL_RUN_KEY)
    if (lastRunDate === date) return

    window.localStorage.setItem(AUTO_JOURNAL_RUN_KEY, date)
    void runAutoJournal(true)
  }, [runAutoJournal])

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

  if (loading) return null

  if (drafts.length === 0) {
    return (
      <section className="glass-card rounded-xl border border-champagne/15 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileClock className="h-4 w-4 text-champagne" />
            <div>
              <h3 className="text-sm font-medium text-ivory">Auto-Journal Drafts</h3>
              <p className="text-[11px] text-muted-foreground">
                No pending drafts. Run end-of-day detection to generate today&apos;s draft trades.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void runAutoJournal(false)
            }}
            disabled={autoGenerating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-champagne/25 px-3 py-1.5 text-xs text-champagne hover:bg-champagne/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {autoGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Detect Today&apos;s Drafts
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="glass-card rounded-xl p-4 border border-champagne/20 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileClock className="w-4 h-4 text-champagne" />
          <h3 className="text-sm font-medium text-ivory">Pending Draft Entries</h3>
        </div>
        <button
          type="button"
          onClick={() => {
            void runAutoJournal(false)
          }}
          disabled={autoGenerating}
          className="inline-flex items-center gap-1.5 rounded-lg border border-champagne/25 px-2.5 py-1 text-[11px] text-champagne hover:bg-champagne/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {autoGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Detect More
        </button>
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
