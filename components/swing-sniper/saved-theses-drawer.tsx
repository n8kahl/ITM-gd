'use client'

import { useMemo, useState } from 'react'
import { Bookmark, BookmarkCheck, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type {
  SwingSniperMonitoringPayload,
  SwingSniperWatchlistPayload,
} from '@/lib/swing-sniper/types'

interface SavedThesesDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  savedTheses: SwingSniperWatchlistPayload['savedTheses']
  monitoring: SwingSniperMonitoringPayload | null
  activeSymbol: string | null
  pendingSymbol: string | null
  onOpenSymbol: (symbol: string) => void
  onRemoveSymbol: (symbol: string) => void
}

type SavedFilter = 'all' | 'active' | 'degrading' | 'invalidated'

function formatSavedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Saved recently'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function driftLabel(from: number | null, to: number | null): string | null {
  if (from == null || to == null) return null
  const drift = to - from
  return `${drift > 0 ? '+' : ''}${drift.toFixed(1)} IVr`
}

function statusTone(status: string): string {
  if (status === 'active') return 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100'
  if (status === 'degrading') return 'border-amber-400/35 bg-amber-400/10 text-amber-100'
  if (status === 'invalidated') return 'border-red-400/35 bg-red-500/10 text-red-100'
  return 'border-white/10 bg-white/[0.04] text-white/75'
}

export function SavedThesesDrawer({
  open,
  onOpenChange,
  savedTheses,
  monitoring,
  activeSymbol,
  pendingSymbol,
  onOpenSymbol,
  onRemoveSymbol,
}: SavedThesesDrawerProps) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<SavedFilter>('all')

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return savedTheses.filter((item) => {
      const snapshot = monitoring?.savedTheses.find((candidate) => candidate.symbol === item.symbol)
      const status = snapshot?.monitoring.status ?? 'forming'

      if (statusFilter !== 'all' && status !== statusFilter) return false
      if (!normalizedQuery) return true

      return [
        item.symbol,
        item.setupLabel,
        item.thesis,
        item.catalystLabel ?? '',
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    })
  }, [monitoring, query, savedTheses, statusFilter])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 h-screen w-full max-w-[520px] translate-x-0 translate-y-0 gap-0 rounded-none border-white/10 bg-[#09090a]/95 p-0 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="flex h-full flex-col">
          <DialogHeader className="border-b border-white/10 px-6 py-5 text-left">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-champagne">
              <BookmarkCheck className="h-4 w-4" strokeWidth={1.6} />
              Saved Theses
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">
              Review saved ideas, reopen the dossier, and remove theses that no longer belong in your queue.
            </DialogDescription>
          </DialogHeader>

          <div className="border-b border-white/10 px-6 py-4">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <Search className="h-4 w-4 text-white/45" />
              <input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search symbol or thesis"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ['all', 'All'],
                ['active', 'Active'],
                ['degrading', 'Degrading'],
                ['invalidated', 'Invalidated'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value as SavedFilter)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] transition-colors',
                    statusFilter === value
                      ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100'
                      : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-6">
            {rows.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm text-muted-foreground">
                No saved theses match this filter.
              </div>
            ) : null}

            {rows.map((item) => {
              const snapshot = monitoring?.savedTheses.find((candidate) => candidate.symbol === item.symbol)
              const status = snapshot?.monitoring.status ?? 'forming'
              const drift = driftLabel(snapshot?.ivRankAtSave ?? null, snapshot?.ivRankNow ?? null)
              const isActive = activeSymbol === item.symbol

              return (
                <article
                  key={`${item.symbol}-${item.savedAt}`}
                  className={cn(
                    'rounded-3xl border bg-white/[0.03] p-4 transition-colors',
                    isActive ? 'border-emerald-500/35 shadow-[0_0_0_1px_rgba(16,185,129,0.16)]' : 'border-white/10',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold tracking-tight text-white">{item.symbol}</p>
                        <span className={cn('rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em]', statusTone(status))}>
                          {status}
                        </span>
                        {isActive ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/70">
                            Open
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-white/85">{item.setupLabel}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.thesis}</p>
                    </div>

                    <Bookmark className="mt-1 h-4 w-4 text-emerald-200/80" strokeWidth={1.8} />
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Saved</p>
                      <p className="mt-1 text-sm text-white">{formatSavedAt(item.savedAt)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Catalyst</p>
                      <p className="mt-1 text-sm text-white">{item.catalystLabel ?? 'Monitoring only'}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">IV drift</p>
                      <p className="mt-1 text-sm text-white">{drift ?? 'Waiting for refresh'}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => onOpenSymbol(item.symbol)}
                      className="rounded-full bg-white text-black hover:bg-white/90"
                    >
                      Open thesis
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onRemoveSymbol(item.symbol)}
                      disabled={pendingSymbol === item.symbol}
                      className="rounded-full border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {pendingSymbol === item.symbol ? 'Removing…' : 'Remove'}
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
