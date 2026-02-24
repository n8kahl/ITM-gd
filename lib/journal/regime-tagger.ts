/**
 * Regime Tagging Service
 *
 * Retroactively tags journal entries with regime data when market_context
 * is present but regime tags are missing. Also provides batch-tag functionality
 * for entries that were created before regime tagging was available.
 *
 * Regime tags:
 *   vix_bucket, trend_state, gex_regime, time_bucket, regime_confidence
 *
 * Spec: TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md — Phase 3, Slice 3B
 */

import type { JournalEntry } from '@/lib/types/journal'
import type { RegimeTags, VixBucket, TrendState, GexRegime, TimeBucket } from '@/lib/journal/context-builder'

/** Check if an entry already has regime tags in its market_context. */
export function hasRegimeTags(entry: JournalEntry): boolean {
  if (!entry.market_context) return false
  const ctx = entry.market_context as unknown as Record<string, unknown>
  return (
    typeof ctx.vix_bucket === 'string' &&
    typeof ctx.trend_state === 'string' &&
    typeof ctx.gex_regime === 'string'
  )
}

/** Infer regime tags from existing market_context data. */
export function inferRegimeTags(marketContext: Record<string, unknown>): RegimeTags {
  // Try to extract VIX from dayContext or direct field
  const dayContext = marketContext.dayContext as Record<string, unknown> | undefined
  const marketTrend = dayContext?.marketTrend as string | undefined
  const sessionType = dayContext?.sessionType as string | undefined

  // Infer trend state from dayContext.marketTrend
  let trendState: TrendState = 'ranging'
  if (marketTrend === 'bullish') trendState = 'trending_up'
  else if (marketTrend === 'bearish') trendState = 'trending_down'

  // Infer session type for GEX regime (approximation from session type)
  let gexRegime: GexRegime = 'positive_gamma'
  if (sessionType === 'volatile') gexRegime = 'negative_gamma'
  else if (sessionType === 'range-bound') gexRegime = 'positive_gamma'

  // Infer time bucket from entry timestamp
  const entryContext = marketContext.entryContext as Record<string, unknown> | undefined
  const timestamp = entryContext?.timestamp as string | undefined
  const timeBucket = inferTimeBucket(timestamp)

  // VIX bucket — default to mid-range if not available
  const vixBucket: VixBucket = '15-20'

  return {
    vix_bucket: vixBucket,
    trend_state: trendState,
    gex_regime: gexRegime,
    time_bucket: timeBucket,
    regime_confidence: 'low',
  }
}

function inferTimeBucket(timestamp: string | undefined): TimeBucket {
  if (!timestamp) return 'mid_morning'
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return 'mid_morning'

  const etHour = (date.getUTCHours() - 5 + 24) % 24

  if (etHour < 10) return 'open'
  if (etHour < 11) return 'mid_morning'
  if (etHour < 14) return 'lunch'
  if (etHour < 15) return 'power_hour'
  return 'close'
}

/**
 * Returns entries that need regime tagging (have market_context but missing regime tags).
 */
export function findUntaggedEntries(entries: JournalEntry[]): JournalEntry[] {
  return entries.filter(
    (entry) => entry.market_context != null && !hasRegimeTags(entry),
  )
}

/**
 * Builds PATCH payloads for batch regime tagging.
 *
 * Returns an array of { id, market_context } ready for submission to the journal API.
 */
export function buildRegimeTagPatches(
  entries: JournalEntry[],
): Array<{ id: string; market_context: Record<string, unknown> }> {
  const untagged = findUntaggedEntries(entries)

  return untagged.map((entry) => {
    const existing = entry.market_context as unknown as Record<string, unknown>
    const tags = inferRegimeTags(existing)

    return {
      id: entry.id,
      market_context: {
        ...existing,
        ...tags,
      },
    }
  })
}

/**
 * Submits batch regime tag patches to the journal API.
 *
 * Processes entries sequentially to avoid rate limiting.
 * Returns { tagged, failed } counts.
 */
export async function batchTagRegimes(
  entries: JournalEntry[],
): Promise<{ tagged: number; failed: number }> {
  const patches = buildRegimeTagPatches(entries)

  let tagged = 0
  let failed = 0

  for (const patch of patches) {
    try {
      const response = await fetch('/api/members/journal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (response.ok) {
        tagged++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return { tagged, failed }
}

/**
 * Aggregates regime distribution from tagged entries for analytics.
 */
export function aggregateRegimeDistribution(
  entries: JournalEntry[],
): Record<string, Record<string, { count: number; pnl: number; winRate: number }>> {
  const result: Record<string, Record<string, { count: number; wins: number; pnl: number }>> = {
    vix_bucket: {},
    trend_state: {},
    gex_regime: {},
    time_bucket: {},
  }

  for (const entry of entries) {
    if (!entry.market_context || entry.is_open) continue
    const ctx = entry.market_context as unknown as Record<string, unknown>

    for (const key of ['vix_bucket', 'trend_state', 'gex_regime', 'time_bucket'] as const) {
      const value = ctx[key] as string | undefined
      if (!value) continue

      if (!result[key][value]) {
        result[key][value] = { count: 0, wins: 0, pnl: 0 }
      }

      result[key][value].count++
      result[key][value].pnl += entry.pnl ?? 0

      if (entry.pnl != null && entry.pnl > 0) {
        result[key][value].wins++
      }
    }
  }

  // Convert wins to winRate
  const withWinRate: Record<string, Record<string, { count: number; pnl: number; winRate: number }>> = {}

  for (const [key, buckets] of Object.entries(result)) {
    withWinRate[key] = {}
    for (const [bucket, stats] of Object.entries(buckets)) {
      withWinRate[key][bucket] = {
        count: stats.count,
        pnl: Math.round(stats.pnl * 100) / 100,
        winRate: stats.count > 0 ? Math.round((stats.wins / stats.count) * 10000) / 100 : 0,
      }
    }
  }

  return withWinRate
}
