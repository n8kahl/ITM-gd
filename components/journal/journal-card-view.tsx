'use client'

import { useCallback, useMemo, useRef, useState, type TouchEvent } from 'react'
import Image from 'next/image'
import { Star, Pencil, Trash2, Image as ImageIcon, CheckCircle, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-is-mobile'
import type { JournalEntry } from '@/lib/types/journal'

const ACTION_REVEAL_WIDTH = 176
const LEFT_SWIPE_REVEAL_THRESHOLD = 72
const RIGHT_SWIPE_FAVORITE_THRESHOLD = 72
const MAX_RIGHT_SWIPE_DISTANCE = 88

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(val: number | null): string {
  if (val == null) return '—'
  const prefix = val >= 0 ? '+$' : '-$'
  return `${prefix}${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function gradeColor(grade: string | null | undefined): string {
  if (!grade) return 'bg-white/10 text-muted-foreground'
  if (grade.startsWith('A')) return 'bg-emerald-900/30 text-emerald-400'
  if (grade.startsWith('B')) return 'bg-champagne/10 text-champagne'
  if (grade.startsWith('C')) return 'bg-amber-900/30 text-amber-400'
  return 'bg-red-900/30 text-red-400'
}

function isTouchSwipe(
  startPoint: { x: number; y: number } | null,
  currentPoint: { x: number; y: number } | null,
): boolean {
  if (!startPoint || !currentPoint) return false
  const deltaX = currentPoint.x - startPoint.x
  const deltaY = currentPoint.y - startPoint.y
  return Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8
}

interface JournalCardViewProps {
  entries: JournalEntry[]
  onSelectEntry: (entry: JournalEntry) => void
  onEditEntry: (entry: JournalEntry) => void
  onDeleteEntry: (entryId: string) => void
  onToggleFavorite: (entry: JournalEntry, nextValue?: boolean) => void
}

export function JournalCardView({
  entries,
  onSelectEntry,
  onEditEntry,
  onDeleteEntry,
  onToggleFavorite,
}: JournalCardViewProps) {
  const isMobile = useIsMobile()
  const [revealedEntryId, setRevealedEntryId] = useState<string | null>(null)
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({})
  const [activeSwipeEntryId, setActiveSwipeEntryId] = useState<string | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const touchCurrentRef = useRef<{ x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)

  const closeSwipeState = useCallback((entryId?: string) => {
    if (entryId) {
      setSwipeOffset((prev) => ({ ...prev, [entryId]: 0 }))
      setActiveSwipeEntryId((prev) => (prev === entryId ? null : prev))
      setRevealedEntryId((prev) => (prev === entryId ? null : prev))
      return
    }

    setSwipeOffset({})
    setActiveSwipeEntryId(null)
    setRevealedEntryId(null)
  }, [])

  const handleShare = useCallback(async (entry: JournalEntry) => {
    const shareText = `${entry.symbol} ${entry.direction || 'trade'} ${formatCurrency(entry.pnl)} on ${formatDate(entry.trade_date)}`
    const shareUrl = `${window.location.origin}/members/journal?entry=${entry.id}`

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${entry.symbol} Trade`,
          text: shareText,
          url: shareUrl,
        })
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
        toast.success('Trade summary copied to clipboard')
      } else {
        toast.error('Sharing is not supported on this browser')
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      toast.error('Unable to share trade')
    }
  }, [])

  const handleTouchStart = useCallback((entryId: string, event: TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return
    if (event.touches.length !== 1) return

    const touch = event.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    touchCurrentRef.current = { x: touch.clientX, y: touch.clientY }
    setActiveSwipeEntryId(entryId)

    if (revealedEntryId && revealedEntryId !== entryId) {
      closeSwipeState(revealedEntryId)
    }
  }, [closeSwipeState, isMobile, revealedEntryId])

  const handleTouchMove = useCallback((entryId: string, event: TouchEvent<HTMLDivElement>) => {
    if (!isMobile || activeSwipeEntryId !== entryId) return
    if (!touchStartRef.current || event.touches.length !== 1) return

    const touch = event.touches[0]
    const currentPoint = { x: touch.clientX, y: touch.clientY }
    touchCurrentRef.current = currentPoint

    if (!isTouchSwipe(touchStartRef.current, currentPoint)) return

    const deltaX = currentPoint.x - touchStartRef.current.x
    const baseOffset = revealedEntryId === entryId ? -ACTION_REVEAL_WIDTH : 0
    const nextOffset = Math.max(
      -ACTION_REVEAL_WIDTH,
      Math.min(MAX_RIGHT_SWIPE_DISTANCE, baseOffset + deltaX),
    )

    setSwipeOffset((prev) => ({ ...prev, [entryId]: nextOffset }))
    suppressClickRef.current = true
    event.preventDefault()
  }, [activeSwipeEntryId, isMobile, revealedEntryId])

  const handleTouchEnd = useCallback((entry: JournalEntry) => {
    if (!isMobile || activeSwipeEntryId !== entry.id) return

    const offset = swipeOffset[entry.id] || 0
    const didSwipe = isTouchSwipe(touchStartRef.current, touchCurrentRef.current)

    if (!didSwipe) {
      setSwipeOffset((prev) => ({ ...prev, [entry.id]: revealedEntryId === entry.id ? -ACTION_REVEAL_WIDTH : 0 }))
      setActiveSwipeEntryId(null)
      touchStartRef.current = null
      touchCurrentRef.current = null
      return
    }

    if (offset <= -LEFT_SWIPE_REVEAL_THRESHOLD) {
      setRevealedEntryId(entry.id)
      setSwipeOffset((prev) => ({ ...prev, [entry.id]: -ACTION_REVEAL_WIDTH }))
    } else if (offset >= RIGHT_SWIPE_FAVORITE_THRESHOLD) {
      onToggleFavorite(entry, true)
      setSwipeOffset((prev) => ({ ...prev, [entry.id]: 0 }))
      setRevealedEntryId(null)
    } else {
      setSwipeOffset((prev) => ({ ...prev, [entry.id]: 0 }))
      setRevealedEntryId((prev) => (prev === entry.id ? null : prev))
    }

    setActiveSwipeEntryId(null)
    touchStartRef.current = null
    touchCurrentRef.current = null
    setTimeout(() => {
      suppressClickRef.current = false
    }, 120)
  }, [activeSwipeEntryId, isMobile, onToggleFavorite, revealedEntryId, swipeOffset])

  const handleCardActivate = useCallback((entry: JournalEntry) => {
    if (suppressClickRef.current) return
    if (revealedEntryId === entry.id) {
      closeSwipeState(entry.id)
      return
    }
    onSelectEntry(entry)
  }, [closeSwipeState, onSelectEntry, revealedEntryId])

  const revealableEntries = useMemo(() => new Set(entries.map((entry) => entry.id)), [entries])

  if (entries.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-live="polite">
      {entries.map((entry) => {
        const isWinner = (entry.pnl ?? 0) > 0
        const isLoss = (entry.pnl ?? 0) < 0
        const grade = entry.ai_analysis?.grade
        const hasScreenshot = !!(entry.screenshot_url || entry.screenshot_storage_path)
        const isVerified = entry.verification?.isVerified
        const isFavorite = Boolean(entry.is_favorite)
        const currentOffset = swipeOffset[entry.id] ?? (revealedEntryId === entry.id ? -ACTION_REVEAL_WIDTH : 0)

        return (
          <div
            key={entry.id}
            className="relative overflow-hidden rounded-xl"
            onTouchStart={(event) => handleTouchStart(entry.id, event)}
            onTouchMove={(event) => handleTouchMove(entry.id, event)}
            onTouchEnd={() => handleTouchEnd(entry)}
            onTouchCancel={() => closeSwipeState(entry.id)}
          >
            {isMobile && (
              <>
                <div className="absolute inset-y-0 left-0 flex w-16 items-center justify-center bg-emerald-900/25">
                  <button
                    type="button"
                    aria-label={isFavorite ? 'Trade already favorited' : 'Mark trade as favorite'}
                    className="focus-champagne inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleFavorite(entry, true)
                      closeSwipeState(entry.id)
                    }}
                  >
                    <Star className={cn('h-4 w-4', isFavorite && 'fill-emerald-300')} />
                  </button>
                </div>

                <div className="absolute inset-y-0 right-0 flex w-44 items-stretch overflow-hidden rounded-r-xl border-l border-white/[0.08] bg-[#0D1012]">
                  <button
                    type="button"
                    aria-label="Edit trade"
                    className="focus-champagne flex min-w-[58px] flex-1 items-center justify-center text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-ivory"
                    onClick={(event) => {
                      event.stopPropagation()
                      onEditEntry(entry)
                      closeSwipeState(entry.id)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Share trade"
                    className="focus-champagne flex min-w-[58px] flex-1 items-center justify-center text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-ivory"
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleShare(entry)
                      closeSwipeState(entry.id)
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete trade"
                    className="focus-champagne flex min-w-[58px] flex-1 items-center justify-center text-red-400/70 transition-colors hover:bg-red-500/12 hover:text-red-300"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDeleteEntry(entry.id)
                      closeSwipeState(entry.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            <div
              role="button"
              tabIndex={0}
              aria-label={`Open ${entry.symbol} trade details`}
              onClick={() => handleCardActivate(entry)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleCardActivate(entry)
                }
              }}
              style={isMobile && revealableEntries.has(entry.id) ? { transform: `translate3d(${currentOffset}px, 0, 0)` } : undefined}
              className={cn(
                'focus-champagne glass-card rounded-xl border-t-2 p-4 transition-[transform,border-color,box-shadow] duration-200',
                isMobile && 'touch-pan-y will-change-transform',
                !isMobile && 'cursor-pointer hover:-translate-y-0.5 hover:border-white/[0.14]',
                isWinner ? 'border-t-emerald-500/50' : isLoss ? 'border-t-red-500/50' : 'border-t-transparent',
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-base font-bold text-ivory">{entry.symbol}</span>
                  {entry.direction && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                        entry.direction === 'long' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400',
                      )}
                    >
                      {entry.direction}
                    </span>
                  )}
                  {isFavorite && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-champagne/25 bg-champagne/10 px-2 py-0.5 text-[10px] font-medium text-champagne">
                      <Star className="h-3 w-3 fill-champagne" />
                      Favorite
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'font-mono text-base font-semibold tabular-nums',
                    isWinner ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-muted-foreground',
                  )}
                >
                  {formatCurrency(entry.pnl)}
                </span>
              </div>

              <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">
                  {entry.entry_price != null && entry.exit_price != null
                    ? `$${entry.entry_price.toLocaleString()} → $${entry.exit_price.toLocaleString()}`
                    : '—'}
                </span>
                <span>{formatDate(entry.trade_date)}</span>
              </div>

              <div className="flex items-center gap-2">
                {grade && (
                  <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold', gradeColor(grade))}>
                    {grade}
                  </span>
                )}
                {entry.rating && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className={cn('h-3 w-3', i < entry.rating! ? 'fill-emerald-400 text-emerald-400' : 'text-white/10')} />
                    ))}
                  </div>
                )}
                <div className="ml-auto flex flex-wrap justify-end gap-1">
                  {entry.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-muted-foreground">{tag}</span>
                  ))}
                </div>
              </div>

              {isMobile && entry.screenshot_url && (
                <div className="mt-3 overflow-x-auto rounded-lg border border-white/[0.08] bg-black/30">
                  <div className="flex snap-x snap-mandatory">
                    <div className="relative h-28 w-full min-w-full snap-center">
                      <Image
                        src={entry.screenshot_url}
                        alt={`${entry.symbol} trade screenshot`}
                        fill
                        unoptimized
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-2 flex items-center gap-2 border-t border-white/[0.04] pt-2">
                {hasScreenshot && <ImageIcon className="h-3 w-3 text-muted-foreground/50" />}
                {isVerified && (
                  <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                    <CheckCircle className="h-3 w-3" /> Verified
                  </span>
                )}
                {!isMobile && (
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Edit trade"
                      onClick={(event) => {
                        event.stopPropagation()
                        onEditEntry(entry)
                      }}
                      className="focus-champagne rounded-md p-2 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-ivory"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      onClick={(event) => {
                        event.stopPropagation()
                        onToggleFavorite(entry)
                      }}
                      className={cn(
                        'focus-champagne rounded-md p-2 transition-colors',
                        isFavorite
                          ? 'text-champagne hover:bg-champagne/10'
                          : 'text-muted-foreground hover:bg-white/[0.06] hover:text-ivory',
                      )}
                    >
                      <Star className={cn('h-3.5 w-3.5', isFavorite && 'fill-champagne')} />
                    </button>
                    <button
                      type="button"
                      aria-label="Share trade"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleShare(entry)
                      }}
                      className="focus-champagne rounded-md p-2 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-ivory"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete trade"
                      onClick={(event) => {
                        event.stopPropagation()
                        onDeleteEntry(entry.id)
                      }}
                      className="focus-champagne rounded-md p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
