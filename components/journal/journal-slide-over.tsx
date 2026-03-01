'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, BookOpen } from 'lucide-react'
import { JournalCardView } from '@/components/journal/journal-card-view'
import { JournalTableView } from '@/components/journal/journal-table-view'
import { Button } from '@/components/ui/button'
import type { JournalEntry, JournalFilters } from '@/lib/types/journal'
import { DEFAULT_JOURNAL_FILTERS } from '@/lib/types/journal'
import { sanitizeJournalEntries } from '@/lib/journal/sanitize-entry'

interface JournalSlideOverProps {
  open: boolean
  onClose: () => void
  initialFilters?: Partial<JournalFilters>
}

const MOBILE_BREAKPOINT = 768

export function JournalSlideOver({ open, onClose, initialFilters }: JournalSlideOverProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    setError(null)

    const filters: JournalFilters = { ...DEFAULT_JOURNAL_FILTERS, ...initialFilters }
    const params = new URLSearchParams()
    if (filters.symbol) params.set('symbol', filters.symbol)
    if (filters.direction !== 'all') params.set('direction', filters.direction)
    params.set('sortBy', filters.sortBy)
    params.set('sortDir', filters.sortDir)
    params.set('limit', '50')
    params.set('offset', '0')

    try {
      const response = await fetch(`/api/members/journal?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || `Request failed (${response.status})`)
      }

      const payload = await response.json()
      if (!payload.success) {
        throw new Error(payload.error || 'Failed to load journal entries')
      }

      setEntries(sanitizeJournalEntries(payload.data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries')
    } finally {
      setLoading(false)
    }
  }, [initialFilters])

  useEffect(() => {
    if (open) {
      void loadEntries()
    }
  }, [open, loadEntries])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-xl flex-col border-l border-white/10 bg-[var(--onyx)] animate-in slide-in-from-right-8 duration-300"
        role="dialog"
        aria-modal="true"
        aria-label="Trade Journal"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
            <h2 className="font-['Playfair_Display'] text-sm font-semibold text-ivory">
              Trade Journal
            </h2>
            <span className="text-xs text-white/40">
              {entries.length} entries
            </span>
          </div>
          <Button
            type="button"
            onClick={onClose}
            variant="luxury-outline"
            size="icon-sm"
            className="h-10 w-10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
            aria-label="Close journal"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              <span className="ml-2 text-sm text-white/50">Loading entries...</span>
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-muted-foreground">
              No journal entries found.
              <a href="/members/journal" className="ml-1 text-emerald-400 underline hover:text-emerald-300">
                Open full journal
              </a>
            </div>
          ) : isMobile ? (
            <JournalCardView
              entries={entries}
              onSelectEntry={() => {}}
              onEditEntry={() => {}}
              onDeleteEntry={() => {}}
              onToggleFavorite={() => Promise.resolve()}
              disableActions
            />
          ) : (
            <JournalTableView
              entries={entries}
              onSelectEntry={() => {}}
              onEditEntry={() => {}}
              onDeleteEntry={() => {}}
              disableActions
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 px-4 py-2.5">
          <a
            href="/members/journal"
            className="inline-flex items-center gap-1.5 text-xs text-emerald-400 transition-colors hover:text-emerald-300"
          >
            Open full journal
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>
    </>
  )
}
