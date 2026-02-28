'use client'

import { useMemo, useState } from 'react'
import type {
  TradeStreamItem,
  TradeStreamLifecycleState,
  TradeStreamSnapshot,
} from '@/lib/types/spx-command-center'
import { cn } from '@/lib/utils'

const LIFECYCLE_ORDER: TradeStreamLifecycleState[] = ['forming', 'triggered', 'past']

const LIFECYCLE_GROUP_TEST_IDS: Record<TradeStreamLifecycleState, string> = {
  forming: 'spx-trade-stream-lifecycle-forming',
  triggered: 'spx-trade-stream-lifecycle-triggered',
  past: 'spx-trade-stream-lifecycle-past',
}

const LIFECYCLE_LABELS: Record<TradeStreamLifecycleState, string> = {
  forming: 'Forming',
  triggered: 'Triggered',
  past: 'Past',
}

function formatSetupType(value: string): string {
  return value.replace(/_/g, ' ')
}

function formatFreshness(item: TradeStreamItem): string {
  if (item.freshness.degraded) return 'Degraded'
  if (item.freshness.ageMs < 60_000) return 'Live'
  if (item.freshness.ageMs < 300_000) return 'Recent'
  return 'Stale'
}

function resolveNowFocusItem(snapshot: TradeStreamSnapshot): TradeStreamItem | null {
  if (snapshot.items.length === 0) return null
  if (!snapshot.nowFocusItemId) return snapshot.items[0] || null
  return snapshot.items.find((item) => item.id === snapshot.nowFocusItemId) || snapshot.items[0] || null
}

export function TradeStreamPanel({
  snapshot,
  className,
  onRowSelect,
  onRowAction,
  suppressStageAction = false,
}: {
  snapshot: TradeStreamSnapshot
  className?: string
  onRowSelect?: (item: TradeStreamItem) => void
  onRowAction?: (item: TradeStreamItem) => void
  suppressStageAction?: boolean
}) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const nowFocusItem = useMemo(() => resolveNowFocusItem(snapshot), [snapshot])

  const toggleRowExpanded = (id: string) => {
    setExpandedRows((current) => ({
      ...current,
      [id]: !current[id],
    }))
  }

  return (
    <section
      className={cn(
        'relative z-10 mt-2 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-2',
        className,
      )}
      data-testid="spx-trade-stream"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.08em] text-white/65">Trade Stream</p>
        <span className="rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-mono text-white/70">
          {snapshot.items.length}
        </span>
      </div>

      {nowFocusItem ? (
        <article
          className="mt-1.5 rounded border border-emerald-300/25 bg-emerald-500/[0.07] px-2 py-1.5"
          data-testid="spx-now-focus"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] uppercase tracking-[0.08em] text-emerald-100/85">Now Focus</p>
            <span
              className="rounded border border-emerald-300/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-emerald-100"
              data-testid="spx-now-focus-lifecycle"
            >
              {nowFocusItem.lifecycleState}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-emerald-50/90">
            {nowFocusItem.direction.toUpperCase()} {formatSetupType(nowFocusItem.setupType)}
          </p>
          <span
            className="mt-1 inline-flex rounded border border-emerald-300/35 bg-emerald-500/16 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-emerald-100"
            data-testid="spx-now-focus-action"
          >
            {nowFocusItem.recommendedAction}
          </span>
        </article>
      ) : (
        <p className="mt-1.5 text-[10px] text-white/40">No focus item available.</p>
      )}

      <div className="mt-1.5 space-y-1.5">
        {LIFECYCLE_ORDER.map((lifecycle) => {
          const rows = snapshot.items.filter((item) => item.lifecycleState === lifecycle)
          return (
            <div
              key={lifecycle}
              className="rounded border border-white/10 bg-black/15 px-2 py-1.5"
              data-testid={LIFECYCLE_GROUP_TEST_IDS[lifecycle]}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[9px] uppercase tracking-[0.08em] text-white/55">{LIFECYCLE_LABELS[lifecycle]}</p>
                <span className="text-[9px] font-mono text-white/55">{rows.length}</span>
              </div>
              {rows.length === 0 ? (
                <p className="text-[10px] text-white/40">No rows.</p>
              ) : (
                <div className="space-y-1">
                  {rows.map((item) => {
                    const expanded = Boolean(expandedRows[item.id])
                    const stageActionSuppressed = suppressStageAction && item.recommendedAction === 'STAGE'
                    return (
                      <article
                        key={item.id}
                        className={cn(
                          'rounded border border-white/10 bg-white/[0.02] px-2 py-1.5',
                          onRowSelect ? 'cursor-pointer transition-colors hover:bg-white/[0.05]' : '',
                        )}
                        data-testid={`spx-trade-stream-row-${item.stableIdHash}`}
                        role={onRowSelect ? 'button' : undefined}
                        tabIndex={onRowSelect ? 0 : undefined}
                        onClick={() => onRowSelect?.(item)}
                        onKeyDown={(event) => {
                          if (!onRowSelect) return
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          onRowSelect(item)
                        }}
                      >
                        <div data-testid="spx-trade-stream-row">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-white/70"
                              data-testid="spx-trade-stream-row-lifecycle"
                            >
                              {item.lifecycleState}
                            </span>
                            <span
                              className="rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-white/70"
                              data-testid="spx-trade-stream-row-freshness"
                            >
                              {formatFreshness(item)}
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] text-white/85">
                            {item.direction.toUpperCase()} {formatSetupType(item.setupType)}
                          </p>
                          <p className="mt-0.5 text-[9px] text-white/55">
                            Entry {item.entryZone.low.toFixed(2)}-{item.entryZone.high.toFixed(2)} · Stop {item.stop.toFixed(2)} · T1 {item.target1.toFixed(2)} · T2 {item.target2.toFixed(2)}
                          </p>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            {stageActionSuppressed ? (
                              <span
                                className="inline-flex rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-white/70"
                                data-testid="spx-trade-stream-row-stage-via-primary-cta"
                              >
                                STAGE via Primary CTA
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="inline-flex rounded border border-emerald-300/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-emerald-100"
                                data-testid="spx-trade-stream-row-action"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onRowAction?.(item)
                                }}
                              >
                                {item.recommendedAction}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                toggleRowExpanded(item.id)
                              }}
                              className="rounded border border-white/12 bg-white/[0.02] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-white/65 transition-colors hover:text-white/85"
                              data-testid="spx-trade-stream-row-details-toggle"
                            >
                              {expanded ? 'Hide details' : 'Show details'}
                            </button>
                          </div>
                          {expanded && (
                            <div
                              className="mt-1 rounded border border-white/12 bg-black/20 px-1.5 py-1 text-[9px] text-white/65"
                              data-testid="spx-trade-stream-row-expanded"
                            >
                              <p>
                                Status {item.status} · Priority {item.momentPriority}
                              </p>
                              <p className="mt-0.5">
                                Trigger {item.reason.triggerContext || 'n/a'}
                              </p>
                            </div>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
