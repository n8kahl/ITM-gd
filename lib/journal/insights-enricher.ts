/**
 * Journal Insights Enricher
 *
 * Enriches journal insights data with behavioral analytics for AI Coach consumption.
 * When the AI Coach calls get_journal_insights, the frontend can supplement the
 * backend response with bias signals and regime analysis from the client.
 *
 * Spec: TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md — Phase 4, Slice 4C
 */

import type { BiasAnalysisResult } from '@/lib/journal/bias-detector'

export interface EnrichedJournalInsights {
  period: string
  tradeCount: number
  summary: string
  biases: BiasAnalysisResult | null
  regimePerformance: Record<string, Array<{ value: string; pnl: number; count: number; win_rate: number }>> | null
  setupPerformance: Array<{ setup_type: string; pnl: number; count: number; win_rate: number }> | null
}

/**
 * Fetches enriched journal insights by combining the analytics and bias endpoints.
 *
 * Returns a unified insights object that can be displayed in the AI Coach's
 * journal insights card or passed as context for AI-generated recommendations.
 */
export async function fetchEnrichedInsights(period: string = '90d'): Promise<EnrichedJournalInsights> {
  const [analyticsResponse, biasesResponse] = await Promise.allSettled([
    fetch(`/api/members/journal/analytics?period=${period}`, { cache: 'no-store' }),
    fetch(`/api/members/journal/biases?period=${period}`, { cache: 'no-store' }),
  ])

  let tradeCount = 0
  let winRate: number | null = null
  let totalPnl: number | null = null
  let profitFactor: number | null = null
  let setupPerformance: EnrichedJournalInsights['setupPerformance'] = null
  let regimePerformance: EnrichedJournalInsights['regimePerformance'] = null

  if (analyticsResponse.status === 'fulfilled' && analyticsResponse.value.ok) {
    const payload = await analyticsResponse.value.json().catch(() => null)
    if (payload?.success && payload.data) {
      const data = payload.data as Record<string, unknown>
      tradeCount = typeof data.total_trades === 'number' ? data.total_trades : 0
      winRate = typeof data.win_rate === 'number' ? data.win_rate : null
      totalPnl = typeof data.total_pnl === 'number' ? data.total_pnl : null
      profitFactor = typeof data.profit_factor === 'number' ? data.profit_factor : null
      setupPerformance = Array.isArray(data.setup_stats) ? data.setup_stats as EnrichedJournalInsights['setupPerformance'] : null
      regimePerformance = typeof data.regime_stats === 'object' && data.regime_stats !== null
        ? data.regime_stats as EnrichedJournalInsights['regimePerformance']
        : null
    }
  }

  let biases: BiasAnalysisResult | null = null
  if (biasesResponse.status === 'fulfilled' && biasesResponse.value.ok) {
    const payload = await biasesResponse.value.json().catch(() => null)
    if (payload?.success && payload.data) {
      biases = payload.data as BiasAnalysisResult
    }
  }

  // Build summary
  const parts: string[] = []
  parts.push(`${tradeCount} trades analyzed over ${period}`)
  if (winRate != null) parts.push(`win rate ${winRate.toFixed(1)}%`)
  if (totalPnl != null) parts.push(`total P&L $${totalPnl.toFixed(2)}`)
  if (profitFactor != null) parts.push(`profit factor ${profitFactor.toFixed(2)}`)
  if (biases && biases.signals.length > 0) {
    parts.push(`${biases.signals.length} behavioral pattern${biases.signals.length !== 1 ? 's' : ''} detected`)
  }

  return {
    period,
    tradeCount,
    summary: parts.join(' | '),
    biases,
    regimePerformance,
    setupPerformance,
  }
}
