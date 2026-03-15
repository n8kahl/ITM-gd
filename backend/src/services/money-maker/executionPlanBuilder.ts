import {
  MoneyMakerExecutionPlan,
  MoneyMakerSignal,
  MoneyMakerSymbolSnapshot,
} from '../../lib/money-maker/types'
import { evaluateExecutionState } from './executionStateEvaluator'

export interface BuildExecutionPlanParams {
  signal: MoneyMakerSignal | null
  symbolSnapshot: MoneyMakerSymbolSnapshot | null
  currentTimestamp?: number
}

function roundToCents(value: number): number {
  return Number(value.toFixed(2))
}

export function selectTarget2(
  signal: MoneyMakerSignal,
  symbolSnapshot: MoneyMakerSymbolSnapshot,
): number | null {
  const hourlyLevels = symbolSnapshot.hourlyLevels
  if (!hourlyLevels) {
    return null
  }

  if (signal.direction === 'long') {
    const candidates = [hourlyLevels.nearestResistance, hourlyLevels.nextResistance]
      .filter((level): level is number => typeof level === 'number' && level > signal.target)
      .sort((left, right) => left - right)

    return candidates[0] ?? null
  }

  const candidates = [hourlyLevels.nearestSupport, hourlyLevels.nextSupport]
    .filter((level): level is number => typeof level === 'number' && level < signal.target)
    .sort((left, right) => right - left)

  return candidates[0] ?? null
}

function buildHoldWhile(signal: MoneyMakerSignal): string[] {
  if (signal.direction === 'long') {
    return [
      `Hold while price remains above ${signal.entry.toFixed(2)} after trigger confirmation.`,
      'Hold while VWAP or the 8 EMA remains supportive underneath price.',
      'Hold while the structure continues to print higher lows.',
      'Hold while target 1 has not rejected hard.',
    ]
  }

  return [
    `Hold while price remains below ${signal.entry.toFixed(2)} after trigger confirmation.`,
    'Hold while VWAP or the 8 EMA remains overhead.',
    'Hold while the structure continues to print lower highs.',
    'Hold while target 1 has not rejected hard.',
  ]
}

function buildReduceWhen(
  signal: MoneyMakerSignal,
  target2: number | null,
  timeWarning: MoneyMakerExecutionPlan['timeWarning'],
): string[] {
  const guidance = [
    `Reduce or take gains when target 1 at ${signal.target.toFixed(2)} is hit.`,
    target2 !== null
      ? `Reduce more aggressively if the extension into target 2 at ${target2.toFixed(2)} stalls.`
      : 'Reduce more aggressively if the first hourly target stalls after the initial impulse.',
    'Reduce when momentum extension stalls after a fast impulse.',
  ]

  if (timeWarning !== 'normal') {
    guidance.push('Reduce sooner when late-day time decay or time-of-day degradation weakens the edge.')
  }

  return guidance
}

function buildExitImmediatelyWhen(signal: MoneyMakerSignal, stop: number): string[] {
  if (signal.direction === 'long') {
    return [
      `Exit immediately if stop ${stop.toFixed(2)} is breached.`,
      'Exit immediately if price loses key support after trigger.',
      'Exit immediately if the underlying re-enters a failed long structure.',
    ]
  }

  return [
    `Exit immediately if stop ${stop.toFixed(2)} is breached.`,
    'Exit immediately if price reclaims failed short structure.',
    'Exit immediately if overhead support flips back into regained momentum.',
  ]
}

function buildInvalidationReason(signal: MoneyMakerSignal, stop: number): string {
  if (signal.direction === 'long') {
    return `Long setup invalidates below ${stop.toFixed(2)} because it loses the patience-candle low and breaks the support-led structure.`
  }

  return `Short setup invalidates above ${stop.toFixed(2)} because it reclaims the patience-candle high and restores failed bearish structure.`
}

export function buildExecutionPlan({
  signal,
  symbolSnapshot,
  currentTimestamp = Date.now(),
}: BuildExecutionPlanParams): MoneyMakerExecutionPlan | null {
  if (!signal || !symbolSnapshot) {
    return null
  }

  const target2 = selectTarget2(signal, symbolSnapshot)
  const evaluation = evaluateExecutionState({
    signal,
    currentPrice: symbolSnapshot.price,
    currentTimestamp,
    target2,
  })
  const rewardToTarget1 = Math.abs(signal.target - signal.entry)
  const rewardToTarget2 = target2 !== null ? Math.abs(target2 - signal.entry) : null
  const invalidationReason = buildInvalidationReason(signal, signal.stop)

  return {
    symbol: signal.symbol,
    signalId: signal.id,
    executionState: evaluation.executionState,
    triggerDistance: evaluation.triggerDistance,
    triggerDistancePct: evaluation.triggerDistancePct,
    entry: roundToCents(signal.entry),
    stop: roundToCents(signal.stop),
    target1: roundToCents(signal.target),
    target2: target2 !== null ? roundToCents(target2) : null,
    riskPerShare: evaluation.riskPerShare,
    rewardToTarget1: roundToCents(rewardToTarget1),
    rewardToTarget2: rewardToTarget2 !== null ? roundToCents(rewardToTarget2) : null,
    riskRewardRatio: roundToCents(signal.riskRewardRatio),
    entryQuality: evaluation.entryQuality,
    idealEntryLow: evaluation.idealEntryLow,
    idealEntryHigh: evaluation.idealEntryHigh,
    chaseCutoff: evaluation.chaseCutoff,
    timeWarning: evaluation.timeWarning,
    invalidationReason,
    holdWhile: buildHoldWhile(signal),
    reduceWhen: buildReduceWhen(signal, target2, evaluation.timeWarning),
    exitImmediatelyWhen: buildExitImmediatelyWhen(signal, signal.stop),
  }
}
