import type { EnrichedTrade, SessionStats } from './types'

export type SessionGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface SessionGradeResult {
  grade: SessionGrade
  score: number
  factors: string[]
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Compute a session grade (A–F) from session stats and trade evaluations.
 *
 * Scoring (100-point scale):
 * - Win rate contribution (0–30)
 * - R:R ratio contribution (0–25)
 * - Discipline / alignment contribution (0–25)
 * - Risk management contribution (0–20)
 *
 * Grade thresholds: A >= 85, B >= 70, C >= 55, D >= 40, F < 40
 */
export function computeSessionGrade(
  stats: SessionStats,
  trades: EnrichedTrade[],
): SessionGradeResult {
  const factors: string[] = []

  // 1. Win rate contribution (0–30)
  let winRateScore: number
  if (stats.winRate >= 80) {
    winRateScore = 30
    factors.push(`Strong win rate: ${stats.winRate.toFixed(0)}%`)
  } else if (stats.winRate >= 60) {
    winRateScore = 22
    factors.push(`Solid win rate: ${stats.winRate.toFixed(0)}%`)
  } else if (stats.winRate >= 40) {
    winRateScore = 14
    factors.push(`Below-average win rate: ${stats.winRate.toFixed(0)}%`)
  } else {
    winRateScore = 6
    factors.push(`Low win rate: ${stats.winRate.toFixed(0)}%`)
  }

  // 2. R:R ratio contribution (0–25) from average expectedValueR
  const evRValues = trades
    .map((t) => t.evaluation?.expectedValueR)
    .filter(isFiniteNumber)
  const avgEvR = evRValues.length > 0
    ? evRValues.reduce((sum, v) => sum + v, 0) / evRValues.length
    : 0

  let rrScore: number
  if (avgEvR >= 2.0) {
    rrScore = 25
    factors.push(`Excellent R:R (${avgEvR.toFixed(1)})`)
  } else if (avgEvR >= 1.5) {
    rrScore = 20
    factors.push(`Good R:R (${avgEvR.toFixed(1)})`)
  } else if (avgEvR >= 1.0) {
    rrScore = 14
    factors.push(`Fair R:R (${avgEvR.toFixed(1)})`)
  } else if (avgEvR >= 0.5) {
    rrScore = 8
    factors.push(`Below-average R:R (${avgEvR.toFixed(1)})`)
  } else {
    rrScore = 3
    factors.push(`Poor R:R (${avgEvR.toFixed(1)})`)
  }

  // 3. Discipline / alignment contribution (0–25)
  const alignmentScores = trades
    .map((t) => t.evaluation?.alignmentScore)
    .filter(isFiniteNumber)
  const avgAlignment = alignmentScores.length > 0
    ? alignmentScores.reduce((sum, v) => sum + v, 0) / alignmentScores.length
    : 0

  let disciplineScore: number
  if (avgAlignment >= 80) {
    disciplineScore = 25
    factors.push(`High discipline (${avgAlignment.toFixed(0)}% alignment)`)
  } else if (avgAlignment >= 60) {
    disciplineScore = 18
    factors.push(`Moderate discipline (${avgAlignment.toFixed(0)}% alignment)`)
  } else if (avgAlignment >= 40) {
    disciplineScore = 11
    factors.push(`Low discipline (${avgAlignment.toFixed(0)}% alignment)`)
  } else {
    disciplineScore = 5
    factors.push(`Poor discipline (${avgAlignment.toFixed(0)}% alignment)`)
  }

  // 4. Risk management contribution (0–20)
  let riskScore = 0
  const tradeCount = trades.length
  if (tradeCount === 0) {
    riskScore = 0
  } else {
    // Check for stop usage
    const tradesWithStops = trades.filter((t) => Array.isArray(t.stopLevels) && t.stopLevels.length > 0)
    const stopUsageRatio = tradesWithStops.length / tradeCount
    if (stopUsageRatio >= 0.8) {
      riskScore += 8
      factors.push('Consistent stop usage')
    } else if (stopUsageRatio >= 0.5) {
      riskScore += 4
      factors.push('Partial stop usage')
    } else {
      factors.push('Minimal stop usage')
    }

    // Check for trim behavior
    const tradesWithTrims = trades.filter((t) =>
      Array.isArray(t.exitEvents) && t.exitEvents.some((e) => e.type === 'trim'),
    )
    const trimRatio = tradesWithTrims.length / tradeCount
    if (trimRatio >= 0.3) {
      riskScore += 6
      factors.push('Active trim management')
    } else if (trimRatio > 0) {
      riskScore += 3
      factors.push('Some trim management')
    }

    // Check for reasonable sizing
    const lightSizedTrades = trades.filter((t) => t.sizing === 'light')
    if (lightSizedTrades.length > 0 && tradeCount > 2) {
      riskScore += 6
      factors.push('Adaptive position sizing')
    } else {
      riskScore += 3
    }
  }

  const totalScore = winRateScore + rrScore + disciplineScore + riskScore

  let grade: SessionGrade
  if (totalScore >= 85) grade = 'A'
  else if (totalScore >= 70) grade = 'B'
  else if (totalScore >= 55) grade = 'C'
  else if (totalScore >= 40) grade = 'D'
  else grade = 'F'

  return { grade, score: totalScore, factors }
}
