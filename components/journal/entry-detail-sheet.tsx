'use client'

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import {
  X,
  Star,
  CheckCircle,
  AlertTriangle,
  Bot,
  ArrowRight,
  Share2,
  Pencil,
  Trash2,
  Activity,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ChevronDown,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import type { JournalEntry, MarketContextSnapshot } from '@/lib/types/journal'
import { TradeReplayChart } from '@/components/journal/trade-replay-chart'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import { useIsMobile } from '@/hooks/use-is-mobile'

// ============================================
// HELPERS
// ============================================

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return '—'
  const prefix = val >= 0 ? '+$' : '-$'
  return `${prefix}${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatPercent(val: number | null | undefined): string {
  if (val == null) return '—'
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
}

function gradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'bg-emerald-900/30 text-emerald-400 border-emerald-800/30'
  if (grade.startsWith('B')) return 'bg-champagne/10 text-champagne border-champagne/20'
  if (grade.startsWith('C')) return 'bg-amber-900/30 text-amber-400 border-amber-800/30'
  return 'bg-red-900/30 text-red-400 border-red-800/30'
}

// ============================================
// MARKET CONTEXT SECTION
// ============================================

function MarketContextDisplay({ context }: { context: MarketContextSnapshot }) {
  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-4 h-4 text-champagne" />
        <h4 className="text-xs font-medium text-ivory uppercase tracking-wider">Market Context</h4>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Entry Context */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">At Entry</p>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">VWAP</span>
              <span className="font-mono text-ivory tabular-nums">${context.entryContext.vwap.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ATR(14)</span>
              <span className="font-mono text-ivory tabular-nums">${context.entryContext.atr14.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Volume</span>
              <span className={cn('font-mono tabular-nums', context.entryContext.volumeVsAvg >= 1.5 ? 'text-emerald-400' : 'text-ivory')}>
                {(context.entryContext.volumeVsAvg * 100).toFixed(0)}% avg
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nearest Level</span>
              <span className="font-mono text-champagne text-[11px]">
                {context.entryContext.nearestLevel.name} ({context.entryContext.nearestLevel.distance.toFixed(1)} ATR)
              </span>
            </div>
          </div>
        </div>

        {/* Exit Context */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">At Exit</p>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">VWAP</span>
              <span className="font-mono text-ivory tabular-nums">${context.exitContext.vwap.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ATR(14)</span>
              <span className="font-mono text-ivory tabular-nums">${context.exitContext.atr14.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Volume</span>
              <span className={cn('font-mono tabular-nums', context.exitContext.volumeVsAvg >= 1.5 ? 'text-emerald-400' : 'text-ivory')}>
                {(context.exitContext.volumeVsAvg * 100).toFixed(0)}% avg
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nearest Level</span>
              <span className="font-mono text-champagne text-[11px]">
                {context.exitContext.nearestLevel.name} ({context.exitContext.nearestLevel.distance.toFixed(1)} ATR)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Day Context */}
      <div className="pt-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-3 text-xs">
          <span className={cn(
            'px-2 py-0.5 rounded-full text-[10px] font-medium capitalize',
            context.dayContext.marketTrend === 'bullish' ? 'bg-emerald-900/30 text-emerald-400' :
            context.dayContext.marketTrend === 'bearish' ? 'bg-red-900/30 text-red-400' :
            'bg-white/[0.06] text-muted-foreground'
          )}>
            {context.dayContext.marketTrend}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.04] text-muted-foreground capitalize">
            {context.dayContext.sessionType}
          </span>
          <span className="text-muted-foreground font-mono">
            ATR used: {(context.dayContext.atrUsed * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Options Context */}
      {context.optionsContext && (
        <div className="pt-2 border-t border-white/[0.04]">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Options Data</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground block">IV Rank</span>
              <span className="font-mono text-ivory">{context.optionsContext.ivRankAtEntry}%</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Delta</span>
              <span className="font-mono text-ivory">{context.optionsContext.deltaAtEntry.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">DTE</span>
              <span className="font-mono text-ivory">{context.optionsContext.dteAtEntry}d</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// ACCORDION SECTION
// ============================================

function NotesAccordion({ title, content }: { title: string; content: string | null }) {
  const [open, setOpen] = useState(false)
  if (!content) return null

  return (
    <div className="border-b border-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="focus-champagne flex items-center justify-between w-full py-3 text-sm text-muted-foreground hover:text-ivory transition-colors"
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
      >
        <span>{title}</span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="pb-3 text-xs text-ivory/70 leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  )
}

// ============================================
// ENTRY DETAIL SHEET
// ============================================

interface EntryDetailSheetProps {
  entry: JournalEntry | null
  onClose: () => void
  onEdit: (entry: JournalEntry) => void
  onDelete: (entryId: string) => void
}

interface SessionContextMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export function EntryDetailSheet({ entry, onClose, onEdit, onDelete }: EntryDetailSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const prefersReducedMotion = useReducedMotion()
  const [sessionMessages, setSessionMessages] = useState<SessionContextMessage[]>([])
  const [sessionContextLoading, setSessionContextLoading] = useState(false)
  const [sessionContextError, setSessionContextError] = useState<string | null>(null)

  useFocusTrap({
    active: Boolean(entry),
    containerRef: panelRef,
    onEscape: onClose,
  })

  useEffect(() => {
    if (!entry) return

    const originalOverflow = document.body.style.overflow
    const originalOverscrollBehavior = document.body.style.overscrollBehavior

    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'contain'

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.overscrollBehavior = originalOverscrollBehavior
    }
  }, [entry])

  useEffect(() => {
    if (!entry?.session_id) return

    const controller = new AbortController()

    const loadSessionContext = async () => {
      setSessionContextLoading(true)
      setSessionContextError(null)

      try {
        const response = await fetch(`/api/members/journal/session-context/${entry.session_id}?limit=8`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload?.error || 'Failed to load AI session context')
        }

        const payload = await response.json()
        const messages = payload?.data?.messages
        if (!Array.isArray(messages)) {
          throw new Error('Invalid AI session context response')
        }

        setSessionMessages(messages)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setSessionMessages([])
        setSessionContextError(error instanceof Error ? error.message : 'Failed to load AI session context')
      } finally {
        setSessionContextLoading(false)
      }
    }

    void loadSessionContext()

    return () => controller.abort()
  }, [entry?.id, entry?.session_id])

  if (!entry || typeof document === 'undefined') return null

  const isWinner = (entry.pnl ?? 0) > 0
  const isLoss = (entry.pnl ?? 0) < 0
  const grade = entry.ai_analysis?.grade

  return createPortal(
    <AnimatePresence>
      <div className={cn('fixed inset-0 z-50 flex', isMobile ? 'items-end justify-center' : 'justify-end')}>
        {/* Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Sheet */}
        <motion.div
          ref={panelRef}
          initial={isMobile ? { y: '100%' } : { x: '100%' }}
          animate={isMobile ? { y: 0 } : { x: 0 }}
          exit={isMobile ? { y: '100%' } : { x: '100%' }}
          transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 35 }}
          role="dialog"
          aria-modal="true"
          aria-label="Trade entry details"
          tabIndex={-1}
          className={cn(
            'relative w-full bg-[#0A0A0B] flex flex-col overflow-hidden',
            isMobile
              ? 'h-[92dvh] max-h-[92dvh] rounded-t-2xl border-t border-white/[0.08]'
              : 'max-w-[600px] h-[100dvh] max-h-[100dvh] border-l border-white/[0.08]',
          )}
        >
          {isMobile && (
            <div className="pt-2 flex justify-center">
              <div className="h-1 w-12 rounded-full bg-white/20" />
            </div>
          )}
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <div>
              <h2 className="text-base font-medium text-ivory flex items-center gap-2">
                <span className="font-mono font-bold">{entry.symbol}</span>
                {entry.direction && (
                  <span className={cn(
                    'text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full',
                    entry.direction === 'long' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'
                  )}>
                    {entry.direction}
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(entry.trade_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="focus-champagne p-1.5 rounded-lg text-muted-foreground hover:text-ivory hover:bg-white/5 transition-colors"
              aria-label="Close trade details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Trade Replay Chart */}
            <TradeReplayChart entryId={entry.id} symbol={entry.symbol} tradeDate={entry.trade_date} />

            {/* Screenshot */}
            {entry.screenshot_url && (
              <div className="rounded-xl overflow-hidden border border-white/[0.08]">
                <div className="relative h-[300px] w-full bg-black/40">
                  <Image
                    src={entry.screenshot_url}
                    alt="Trade screenshot"
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 600px"
                    className="object-contain"
                  />
                </div>
              </div>
            )}

            {/* Trade Summary Card */}
            <div className="glass-card rounded-xl p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">P&L</p>
                  <p className={cn('text-lg font-mono font-bold tabular-nums', isWinner ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-ivory')}>
                    {formatCurrency(entry.pnl)}
                  </p>
                  <p className={cn('text-xs font-mono tabular-nums', isWinner ? 'text-emerald-400/70' : isLoss ? 'text-red-400/70' : 'text-muted-foreground')}>
                    {formatPercent(entry.pnl_percentage)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Entry</p>
                  <p className="text-sm font-mono text-ivory tabular-nums">{entry.entry_price != null ? `$${entry.entry_price.toLocaleString()}` : '—'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">→ ${entry.exit_price != null ? entry.exit_price.toLocaleString() : '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Size</p>
                  <p className="text-sm font-mono text-ivory tabular-nums">{entry.position_size ?? '—'}</p>
                </div>
              </div>

              {/* Verification + Rating row */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                <div className="flex items-center gap-2">
                  {entry.verification?.isVerified && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                      <CheckCircle className="w-3 h-3" /> Verified by TradeITM
                    </span>
                  )}
                </div>
                {entry.rating && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className={cn('w-3 h-3', i < entry.rating! ? 'fill-emerald-400 text-emerald-400' : 'text-white/10')} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Market Context */}
            {entry.market_context && <MarketContextDisplay context={entry.market_context} />}

            {/* AI Analysis */}
            {entry.ai_analysis && (
              <div className="glass-card rounded-xl p-4 border-champagne/[0.08]">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="w-4 h-4 text-champagne" />
                  <h4 className="text-xs font-medium text-ivory uppercase tracking-wider">AI Analysis</h4>
                  {grade && (
                    <span className={cn('ml-auto inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold border', gradeColor(grade))}>
                      {grade}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ivory/80 leading-relaxed">{entry.ai_analysis.summary}</p>

                {entry.ai_analysis.trend_analysis && (
                  <div className="mt-3 p-2 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Trend:</span>
                      <span className="text-ivory capitalize">{entry.ai_analysis.trend_analysis.direction}</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-ivory capitalize">{entry.ai_analysis.trend_analysis.strength}</span>
                    </div>
                    {entry.ai_analysis.trend_analysis.notes && (
                      <p className="text-[11px] text-muted-foreground mt-1">{entry.ai_analysis.trend_analysis.notes}</p>
                    )}
                  </div>
                )}

                {entry.ai_analysis.entry_analysis && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Entry: {entry.ai_analysis.entry_analysis.quality}</p>
                    {entry.ai_analysis.entry_analysis.observations.map((obs, i) => (
                      <p key={i} className="text-[11px] text-ivory/70 flex items-start gap-1.5">
                        <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" /> {obs}
                      </p>
                    ))}
                    {entry.ai_analysis.entry_analysis.improvements.map((imp, i) => (
                      <p key={i} className="text-[11px] text-ivory/70 flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" /> {imp}
                      </p>
                    ))}
                  </div>
                )}

                {entry.ai_analysis.risk_management && (
                  <div className="mt-3 p-2 rounded-lg bg-white/[0.02]">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                      Risk Management: {entry.ai_analysis.risk_management.score}/10
                    </p>
                  </div>
                )}

                {entry.ai_analysis.coaching_notes && (
                  <p className="mt-3 text-[11px] text-muted-foreground italic">{entry.ai_analysis.coaching_notes}</p>
                )}

                <Link
                  href={`/members/ai-coach?context=journal&entryId=${entry.id}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Discuss with AI Coach <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}

            {entry.session_id && (
              <section className="glass-card rounded-xl p-4 border-emerald-500/15">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-xs font-medium uppercase tracking-wider text-emerald-300">
                    AI Coach Context
                  </h4>
                  <Link
                    href={`/members/ai-coach?context=journal&entryId=${entry.id}&session=${entry.session_id}`}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Open Session
                  </Link>
                </div>

                {sessionContextLoading && (
                  <p className="text-[11px] text-muted-foreground">Loading AI session context...</p>
                )}

                {!sessionContextLoading && sessionContextError && (
                  <p className="text-[11px] text-amber-300">{sessionContextError}</p>
                )}

                {!sessionContextLoading && !sessionContextError && sessionMessages.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No messages found for this AI Coach session.</p>
                )}

                {!sessionContextLoading && !sessionContextError && sessionMessages.length > 0 && (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {sessionMessages.map((message) => {
                      const isUserMessage = message.role === 'user'
                      return (
                        <div
                          key={message.id}
                          className={cn(
                            'rounded-lg border px-2.5 py-2',
                            isUserMessage
                              ? 'border-champagne/20 bg-champagne/10'
                              : 'border-emerald-500/20 bg-emerald-500/10',
                          )}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-[10px] uppercase tracking-wide text-white/60">
                              {isUserMessage ? 'You' : message.role === 'assistant' ? 'AI Coach' : 'System'}
                            </span>
                            <span className="text-[10px] text-white/30">
                              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-ivory/85">
                            {message.content}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Notes Accordion */}
            <div className="space-y-0">
              <NotesAccordion title="Setup Notes" content={entry.setup_notes} />
              <NotesAccordion title="Execution Notes" content={entry.execution_notes} />
              <NotesAccordion title="Lessons Learned" content={entry.lessons_learned} />
            </div>

            {/* Tags */}
            {(entry.tags.length > 0 || entry.smart_tags.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {entry.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/[0.05] text-muted-foreground border border-white/[0.06]">
                    {tag}
                  </span>
                ))}
                {entry.smart_tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-champagne/10 text-champagne border border-champagne/20">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/[0.06] flex items-center gap-2">
            <button
              type="button"
              aria-label="Share this trade"
              className="focus-champagne flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-ivory border border-white/[0.08] hover:bg-white/[0.04] transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
            <button
              type="button"
              onClick={() => { onEdit(entry); onClose() }}
              aria-label="Edit this trade"
              className="focus-champagne flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-ivory border border-white/[0.08] hover:bg-white/[0.04] transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              type="button"
              onClick={() => { onDelete(entry.id); onClose() }}
              aria-label="Delete this trade"
              className="focus-champagne flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-red-400/60 hover:text-red-400 border border-red-500/10 hover:bg-red-500/5 transition-colors ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  )
}
