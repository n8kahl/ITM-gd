'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Pencil, Share2, Star, Trash2, X } from 'lucide-react'
import Image from 'next/image'
import type { AITradeAnalysis, JournalEntry } from '@/lib/types/journal'
import { Button } from '@/components/ui/button'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import { AIGradeDisplay } from '@/components/journal/ai-grade-display'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import { ShareTradeSheet } from '@/components/social/share-trade-sheet'
import { Analytics } from '@/lib/analytics'
import { CoachReviewButton } from '@/components/journal/coach-review-button'
import { CoachFeedbackSection } from '@/components/journal/coach-feedback-section'

interface EntryDetailSheetProps {
  entry: JournalEntry | null
  onClose: () => void
  onEdit: (entry: JournalEntry) => void
  onDelete: (entryId: string) => void
  disableActions?: boolean
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  const abs = Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return `${value >= 0 ? '+' : '-'}$${abs}`
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function EntryDetailSheet({
  entry,
  onClose,
  onEdit,
  onDelete,
  disableActions = false,
}: EntryDetailSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [grading, setGrading] = useState(false)
  const [localEntry, setLocalEntry] = useState<JournalEntry | null>(entry)
  const [shareOpen, setShareOpen] = useState(false)
  const [alreadyShared, setAlreadyShared] = useState(false)
  const [screenshotZoomOpen, setScreenshotZoomOpen] = useState(false)

  const handleCoachReviewStatusChange = (nextStatus: JournalEntry['coach_review_status']) => {
    setLocalEntry((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        coach_review_status: nextStatus,
        coach_review_requested_at: nextStatus === 'pending'
          ? new Date().toISOString()
          : prev.coach_review_requested_at,
      }
    })
  }

  useEffect(() => {
    setLocalEntry(entry)
    setScreenshotZoomOpen(false)
  }, [entry])

  useEffect(() => {
    let cancelled = false

    async function checkSharedState() {
      if (!entry) {
        setAlreadyShared(false)
        return
      }

      if (entry.is_open || entry.pnl == null) {
        setAlreadyShared(false)
        return
      }

      try {
        const supabase = createBrowserSupabase()
        const { data, error } = await supabase
          .from('shared_trade_cards')
          .select('id')
          .eq('journal_entry_id', entry.id)
          .limit(1)

        if (!cancelled) {
          setAlreadyShared(!error && (data?.length ?? 0) > 0)
        }
      } catch {
        if (!cancelled) {
          setAlreadyShared(false)
        }
      }
    }

    checkSharedState()

    return () => {
      cancelled = true
    }
  }, [entry])

  useFocusTrap({
    active: Boolean(entry),
    containerRef: panelRef,
    onEscape: onClose,
  })

  useEffect(() => {
    if (!entry) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [entry])

  const handleGrade = async () => {
    if (!entry || grading) return

    setGrading(true)

    try {
      const response = await fetch('/api/members/journal/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryIds: [entry.id] }),
      })

      if (!response.ok) {
        console.error('Failed to grade trade:', response.statusText)
        setGrading(false)
        return
      }

      const result = await response.json()
      const analysisCandidate = result?.data?.[0]?.ai_analysis ?? result?.data?.[0]?.grade
      const aiAnalysis = (
        analysisCandidate
        && typeof analysisCandidate === 'object'
        && 'grade' in analysisCandidate
      )
        ? analysisCandidate as AITradeAnalysis
        : undefined

      if (aiAnalysis) {
        setLocalEntry((prev) => (prev ? { ...prev, ai_analysis: aiAnalysis } : null))
      }
    } catch (error) {
      console.error('Grade trade failed:', error)
    } finally {
      setGrading(false)
    }
  }

  if (!entry || typeof document === 'undefined') return null
  const displayEntry = localEntry || entry

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 animate-in fade-in-0 duration-200 sm:items-center">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex h-[92vh] w-full max-w-2xl flex-col rounded-t-xl border border-white/10 bg-[var(--onyx)] p-4 animate-in slide-in-from-bottom-4 duration-300 sm:h-auto sm:max-h-[90vh] sm:rounded-xl sm:zoom-in-95"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ivory">{displayEntry.symbol} Trade</h2>
            <p className="text-xs text-muted-foreground">{formatDate(displayEntry.trade_date)}</p>
          </div>
          <Button
            type="button"
            onClick={onClose}
            variant="luxury-outline"
            size="icon-sm"
            className="h-10 w-10 text-muted-foreground hover:text-ivory"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <Info label="Direction" value={displayEntry.direction.toUpperCase()} />
          <Info label="Contract" value={displayEntry.contract_type.toUpperCase()} />
          <Info label="Entry Price" value={displayEntry.entry_price == null ? '—' : `$${displayEntry.entry_price}`} />
          <Info label="Exit Price" value={displayEntry.exit_price == null ? '—' : `$${displayEntry.exit_price}`} />
          <Info label="P&L" value={formatCurrency(displayEntry.pnl)} />
          <Info label="P&L %" value={displayEntry.pnl_percentage == null ? '—' : `${displayEntry.pnl_percentage.toFixed(2)}%`} />
          <Info label="Open Position" value={displayEntry.is_open ? 'Yes' : 'No'} />
          <Info label="Favorite" value={displayEntry.is_favorite ? 'Yes' : 'No'} />
        </div>

        <div className="mt-3">
          <CoachReviewButton
            entryId={displayEntry.id}
            status={displayEntry.coach_review_status}
            onStatusChange={handleCoachReviewStatusChange}
            disabled={disableActions}
          />
        </div>

        <div className="mt-4 space-y-3 overflow-y-auto pr-1">
          {displayEntry.strategy ? <TextBlock label="Strategy" value={displayEntry.strategy} /> : null}
          {displayEntry.setup_notes ? <TextBlock label="Setup Notes" value={displayEntry.setup_notes} /> : null}
          {displayEntry.execution_notes ? <TextBlock label="Execution Notes" value={displayEntry.execution_notes} /> : null}
          {displayEntry.lessons_learned ? <TextBlock label="Lessons Learned" value={displayEntry.lessons_learned} /> : null}
          {displayEntry.deviation_notes ? <TextBlock label="Deviation Notes" value={displayEntry.deviation_notes} /> : null}

          {displayEntry.tags.length > 0 ? (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Tags</p>
              <div className="flex flex-wrap gap-2">
                {displayEntry.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-ivory">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {displayEntry.screenshot_url ? (
            <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Trade Screenshot</p>
              <button
                type="button"
                onClick={() => setScreenshotZoomOpen(true)}
                className="relative block aspect-video w-full overflow-hidden rounded-md border border-white/10 bg-black/20"
              >
                <Image
                  src={displayEntry.screenshot_url}
                  alt={`${displayEntry.symbol} trade screenshot`}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </button>
            </div>
          ) : null}
          <CoachFeedbackSection entryId={displayEntry.id} />
          {displayEntry.ai_analysis ? <AIGradeDisplay analysis={displayEntry.ai_analysis} /> : null}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/10 pt-4">
          {/* Share to Community button — only for closed trades with P&L */}
          {!displayEntry.is_open && displayEntry.pnl != null && (
            <Button
              type="button"
              onClick={() => {
                Analytics.trackMembersSocialAction('share_trade')
                setShareOpen(true)
              }}
              disabled={disableActions || alreadyShared}
              variant="luxury-outline"
              size="sm"
              className="h-10 border-emerald-500/40 px-4 text-emerald-400 hover:bg-emerald-500/10"
            >
              <Share2 className="h-4 w-4" />
              {alreadyShared ? 'Shared' : 'Share'}
            </Button>
          )}
          <Button
            type="button"
            onClick={() => {
              Analytics.trackJournalAction('grade_trade')
              void handleGrade()
            }}
            disabled={disableActions || grading || Boolean(displayEntry.ai_analysis)}
            variant="luxury-outline"
            size="sm"
            className="h-10 px-4"
          >
            {grading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
            {displayEntry.ai_analysis ? 'Graded' : grading ? 'Grading...' : 'Grade Trade'}
          </Button>
          <Button
            type="button"
            onClick={() => onEdit(entry)}
            disabled={disableActions}
            variant="luxury-outline"
            size="sm"
            className="h-10 px-4"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            type="button"
            onClick={() => {
              onDelete(entry.id)
              onClose()
            }}
            disabled={disableActions}
            variant="destructive"
            size="sm"
            className="h-10 border-red-500/40 px-4 text-red-300 hover:bg-red-500/20"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {screenshotZoomOpen && displayEntry.screenshot_url ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setScreenshotZoomOpen(false)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-20 rounded-md border border-white/20 bg-black/70 p-2 text-white hover:bg-black"
            aria-label="Close screenshot zoom"
            onClick={() => setScreenshotZoomOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
          <div
            className="relative z-10 h-[80vh] w-[92vw] max-w-5xl overflow-hidden rounded-xl border border-white/15 bg-black"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={displayEntry.screenshot_url}
              alt={`${displayEntry.symbol} trade screenshot full size`}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        </div>
      ) : null}

      {shareOpen && entry && (
        <ShareTradeSheet
          journalEntryId={entry.id}
          open={shareOpen}
          onOpenChange={setShareOpen}
          onShared={() => setAlreadyShared(true)}
        />
      )}
    </div>,
    document.body,
  )
}

function Info({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-ivory">{value}</p>
    </div>
  )
}

function TextBlock({ label, value }: { label: string, value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm text-ivory/90">{value}</p>
    </div>
  )
}
