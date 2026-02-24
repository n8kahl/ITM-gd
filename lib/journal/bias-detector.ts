/**
 * Cognitive Bias Detector
 *
 * Analyzes a trader's journal history to detect common cognitive biases:
 *   1. Loss Aversion — holding losers too long relative to winners
 *   2. Recency Bias — over-weighting recent outcomes in decision-making
 *   3. Revenge Trading — rapid-fire entries after losses
 *   4. Overconfidence — position sizing inflates after winning streaks
 *   5. Anchoring — entries cluster near round numbers / previous levels
 *
 * Each detector returns a BiasSignal with confidence (0-1) and evidence.
 * The overall analyze function returns the top actionable biases.
 *
 * Spec: TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md — Phase 3, Slice 3A
 */

import type { JournalEntry } from '@/lib/types/journal'

export type BiasType =
  | 'loss_aversion'
  | 'recency_bias'
  | 'revenge_trading'
  | 'overconfidence'
  | 'anchoring'

export interface BiasSignal {
  type: BiasType
  label: string
  description: string
  confidence: number
  evidence: string
  recommendation: string
}

export interface BiasAnalysisResult {
  signals: BiasSignal[]
  tradeCount: number
  analyzedPeriod: string
}

/**
 * Detect Loss Aversion:
 * Compare average hold duration of winners vs losers.
 * Bias signal if losers are held 50%+ longer than winners.
 */
function detectLossAversion(entries: JournalEntry[]): BiasSignal | null {
  const closed = entries.filter((e) => !e.is_open && e.hold_duration_min != null && e.pnl != null)
  if (closed.length < 5) return null

  const winners = closed.filter((e) => e.pnl! > 0)
  const losers = closed.filter((e) => e.pnl! < 0)

  if (winners.length < 2 || losers.length < 2) return null

  const avgWinDuration = winners.reduce((s, e) => s + (e.hold_duration_min ?? 0), 0) / winners.length
  const avgLossDuration = losers.reduce((s, e) => s + (e.hold_duration_min ?? 0), 0) / losers.length

  if (avgWinDuration <= 0) return null

  const ratio = avgLossDuration / avgWinDuration
  if (ratio < 1.5) return null

  const confidence = Math.min((ratio - 1.5) / 1.5, 1)

  return {
    type: 'loss_aversion',
    label: 'Loss Aversion',
    description: `You hold losing trades ${Math.round(ratio * 100 - 100)}% longer than winners.`,
    confidence: Math.round(confidence * 100) / 100,
    evidence: `Avg winner hold: ${Math.round(avgWinDuration)}min, avg loser hold: ${Math.round(avgLossDuration)}min (${winners.length} wins, ${losers.length} losses).`,
    recommendation: 'Set time-based stop rules. If a trade hasn\'t worked within your average winning hold time, consider exiting.',
  }
}

/**
 * Detect Recency Bias:
 * Check if recent trade direction strongly follows last 3 outcomes.
 * Signal if 80%+ of trades in the last 10 match the P&L direction of the last 3.
 */
function detectRecencyBias(entries: JournalEntry[]): BiasSignal | null {
  const closed = entries
    .filter((e) => !e.is_open && e.pnl != null)
    .sort((a, b) => new Date(b.trade_date).getTime() - new Date(a.trade_date).getTime())

  if (closed.length < 10) return null

  const last3 = closed.slice(0, 3)
  const last3WinRate = last3.filter((e) => e.pnl! > 0).length / last3.length

  const next7 = closed.slice(3, 10)
  const next7Directions = next7.map((e) => e.direction)

  // If last 3 were mostly winners, check if next 7 are mostly same direction as last 3
  const last3Direction = last3[0]?.direction
  if (!last3Direction) return null

  const sameDirectionRate = next7Directions.filter((d) => d === last3Direction).length / next7Directions.length

  // If recent outcomes were strong in one direction and trader follows the same direction
  if (last3WinRate > 0.66 && sameDirectionRate > 0.7) {
    return {
      type: 'recency_bias',
      label: 'Recency Bias',
      description: 'Your recent trade direction is heavily influenced by your last few outcomes.',
      confidence: Math.round(sameDirectionRate * 100) / 100,
      evidence: `Last 3 trades: ${Math.round(last3WinRate * 100)}% win rate. Next 7 trades: ${Math.round(sameDirectionRate * 100)}% same direction.`,
      recommendation: 'Review your setup criteria independently of recent results. Each trade should stand on its own merit.',
    }
  }

  return null
}

/**
 * Detect Revenge Trading:
 * Rapid entries (< 15min apart) after a loss, especially multiple in sequence.
 */
function detectRevengeTrading(entries: JournalEntry[]): BiasSignal | null {
  const sorted = [...entries]
    .filter((e) => e.entry_timestamp != null && e.pnl != null)
    .sort((a, b) => new Date(a.entry_timestamp!).getTime() - new Date(b.entry_timestamp!).getTime())

  if (sorted.length < 5) return null

  let revengeCount = 0
  let totalPostLoss = 0

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]

    if (prev.pnl! < 0) {
      totalPostLoss++
      const gapMs = new Date(curr.entry_timestamp!).getTime() - new Date(prev.exit_timestamp ?? prev.entry_timestamp!).getTime()
      const gapMinutes = gapMs / 60_000

      if (gapMinutes >= 0 && gapMinutes < 15) {
        revengeCount++
      }
    }
  }

  if (totalPostLoss < 3 || revengeCount < 2) return null

  const revengeRate = revengeCount / totalPostLoss
  if (revengeRate < 0.3) return null

  return {
    type: 'revenge_trading',
    label: 'Revenge Trading',
    description: `${Math.round(revengeRate * 100)}% of your post-loss trades happen within 15 minutes.`,
    confidence: Math.round(Math.min(revengeRate * 1.5, 1) * 100) / 100,
    evidence: `${revengeCount} rapid re-entries out of ${totalPostLoss} post-loss trades.`,
    recommendation: 'Implement a mandatory cool-down timer (15-30min) after any losing trade before re-entering.',
  }
}

/**
 * Detect Overconfidence:
 * Position size increases after winning streaks (3+ consecutive wins).
 */
function detectOverconfidence(entries: JournalEntry[]): BiasSignal | null {
  const sorted = [...entries]
    .filter((e) => !e.is_open && e.pnl != null && e.position_size != null && e.position_size > 0)
    .sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime())

  if (sorted.length < 8) return null

  let streak = 0
  let postStreakSizeIncrease = 0
  let postStreakCount = 0

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]
    if (entry.pnl! > 0) {
      streak++
    } else {
      if (streak >= 3 && i < sorted.length - 1) {
        const nextEntry = sorted[i + 1]
        if (nextEntry && nextEntry.position_size != null && entry.position_size != null) {
          const avgSize = sorted.slice(Math.max(0, i - streak), i).reduce((s, e) => s + (e.position_size ?? 0), 0) / streak
          if (nextEntry.position_size > avgSize * 1.3) {
            postStreakSizeIncrease++
          }
          postStreakCount++
        }
      }
      streak = 0
    }
  }

  if (postStreakCount < 2 || postStreakSizeIncrease < 1) return null

  const rate = postStreakSizeIncrease / postStreakCount
  if (rate < 0.4) return null

  return {
    type: 'overconfidence',
    label: 'Overconfidence',
    description: 'You increase position size after winning streaks, which can amplify losses.',
    confidence: Math.round(Math.min(rate * 1.2, 1) * 100) / 100,
    evidence: `${postStreakSizeIncrease} of ${postStreakCount} post-streak trades had 30%+ larger size.`,
    recommendation: 'Keep position sizing consistent regardless of recent streak. Use a fixed % of account per trade.',
  }
}

/**
 * Detect Anchoring:
 * Entry prices cluster near round numbers (multiples of 5/10/50/100).
 */
function detectAnchoring(entries: JournalEntry[]): BiasSignal | null {
  const withEntry = entries.filter((e) => e.entry_price != null && e.entry_price > 0)
  if (withEntry.length < 10) return null

  let roundCount = 0
  for (const entry of withEntry) {
    const price = entry.entry_price!
    // Check if within 0.5% of a round number (multiples of 5)
    const nearestRound = Math.round(price / 5) * 5
    const distance = Math.abs(price - nearestRound) / price
    if (distance < 0.005) {
      roundCount++
    }
  }

  const roundRate = roundCount / withEntry.length

  // With random distribution, ~20% of prices would be near round-5 numbers.
  // Signal if significantly higher.
  if (roundRate < 0.4) return null

  return {
    type: 'anchoring',
    label: 'Anchoring Bias',
    description: `${Math.round(roundRate * 100)}% of your entries are near round numbers.`,
    confidence: Math.round(Math.min((roundRate - 0.2) / 0.4, 1) * 100) / 100,
    evidence: `${roundCount} of ${withEntry.length} entries within 0.5% of a round-5 price level.`,
    recommendation: 'Focus on levels defined by market structure (VWAP, prior high/low) rather than round numbers.',
  }
}

/**
 * Analyze journal entries for cognitive biases.
 *
 * Returns the top detected biases sorted by confidence.
 */
export function analyzeBiases(entries: JournalEntry[]): BiasAnalysisResult {
  if (entries.length === 0) {
    return { signals: [], tradeCount: 0, analyzedPeriod: 'none' }
  }

  const dates = entries.map((e) => new Date(e.trade_date).getTime()).filter((d) => !isNaN(d))
  const minDate = dates.length > 0 ? new Date(Math.min(...dates)).toISOString().slice(0, 10) : 'unknown'
  const maxDate = dates.length > 0 ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : 'unknown'

  const detectors = [
    detectLossAversion,
    detectRecencyBias,
    detectRevengeTrading,
    detectOverconfidence,
    detectAnchoring,
  ]

  const signals = detectors
    .map((detector) => detector(entries))
    .filter((signal): signal is BiasSignal => signal !== null)
    .sort((a, b) => b.confidence - a.confidence)

  return {
    signals,
    tradeCount: entries.length,
    analyzedPeriod: `${minDate} to ${maxDate}`,
  }
}
