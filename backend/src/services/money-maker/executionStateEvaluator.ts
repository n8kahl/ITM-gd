import {
  MoneyMakerEntryQuality,
  MoneyMakerExecutionState,
  MoneyMakerSignal,
  MoneyMakerTimeWarning,
} from '../../lib/money-maker/types'
import { getMarketStatus, toEasternTime } from '../marketHours'

export interface ExecutionStateEvaluation {
  executionState: MoneyMakerExecutionState
  entryQuality: MoneyMakerEntryQuality
  timeWarning: MoneyMakerTimeWarning
  triggerDistance: number
  triggerDistancePct: number
  riskPerShare: number
  idealEntryLow: number
  idealEntryHigh: number
  chaseCutoff: number
  idealEntryBuffer: number
  maxChaseBuffer: number
}

export interface EvaluateExecutionStateParams {
  signal: MoneyMakerSignal
  currentPrice: number
  currentTimestamp: number
  target2: number | null
}

function roundToCents(value: number): number {
  return Number(value.toFixed(2))
}

export function evaluateTimeWarning(timestamp: number): MoneyMakerTimeWarning {
  const et = toEasternTime(new Date(timestamp))
  const minutesFromMidnight = et.hour * 60 + et.minute

  if (minutesFromMidnight >= 840 || minutesFromMidnight < 570) {
    return 'avoid_new_entries'
  }
  if (minutesFromMidnight >= 810) {
    return 'late_session'
  }
  return 'normal'
}

function isRegularSession(timestamp: number): boolean {
  const status = getMarketStatus(new Date(timestamp))
  return status.status === 'open' && status.session === 'regular'
}

function deriveEntryQuality(
  signal: MoneyMakerSignal,
  currentPrice: number,
  idealBuffer: number,
  maxChaseBuffer: number,
): MoneyMakerEntryQuality {
  if (signal.direction === 'long') {
    if (currentPrice <= signal.entry + idealBuffer) {
      return 'ideal'
    }
    if (currentPrice <= signal.entry + maxChaseBuffer) {
      return 'acceptable'
    }
    return 'late'
  }

  if (currentPrice >= signal.entry - idealBuffer) {
    return 'ideal'
  }
  if (currentPrice >= signal.entry - maxChaseBuffer) {
    return 'acceptable'
  }
  return 'late'
}

function deriveTriggerDistance(signal: MoneyMakerSignal, currentPrice: number): number {
  return signal.direction === 'long'
    ? signal.entry - currentPrice
    : currentPrice - signal.entry
}

export function evaluateExecutionState({
  signal,
  currentPrice,
  currentTimestamp,
  target2,
}: EvaluateExecutionStateParams): ExecutionStateEvaluation {
  const riskPerShare = Math.abs(signal.entry - signal.stop)
  const idealEntryBuffer = Math.min(riskPerShare * 0.15, currentPrice * 0.001)
  const maxChaseBuffer = Math.min(riskPerShare * 0.25, currentPrice * 0.0015)
  const armingBuffer = riskPerShare * 0.65
  const triggerDistance = deriveTriggerDistance(signal, currentPrice)
  const triggerDistancePct = signal.entry !== 0 ? (triggerDistance / signal.entry) * 100 : 0
  const entryQuality = deriveEntryQuality(signal, currentPrice, idealEntryBuffer, maxChaseBuffer)
  const timeWarning = evaluateTimeWarning(currentTimestamp)

  const idealEntryLow = signal.direction === 'long'
    ? signal.entry
    : signal.entry - idealEntryBuffer
  const idealEntryHigh = signal.direction === 'long'
    ? signal.entry + idealEntryBuffer
    : signal.entry
  const chaseCutoff = signal.direction === 'long'
    ? signal.entry + maxChaseBuffer
    : signal.entry - maxChaseBuffer

  let executionState: MoneyMakerExecutionState = 'watching'

  if (!isRegularSession(currentTimestamp)) {
    executionState = 'closed'
  } else if (
    (signal.direction === 'long' && currentPrice <= signal.stop)
    || (signal.direction === 'short' && currentPrice >= signal.stop)
  ) {
    executionState = 'failed'
  } else if (
    signal.direction === 'long'
      ? currentPrice >= signal.target
      : currentPrice <= signal.target
  ) {
    const extensionTrigger = signal.direction === 'long'
      ? signal.target + idealEntryBuffer
      : signal.target - idealEntryBuffer

    if (
      target2 !== null
      && (
        signal.direction === 'long'
          ? currentPrice >= extensionTrigger
          : currentPrice <= extensionTrigger
      )
    ) {
      executionState = 'target2_in_play'
    } else {
      executionState = 'target1_hit'
    }
  } else if (entryQuality === 'late') {
    executionState = 'extended'
  } else if (
    (signal.direction === 'long' && currentPrice >= signal.entry)
    || (signal.direction === 'short' && currentPrice <= signal.entry)
  ) {
    executionState = 'triggered'
  } else if (Math.abs(triggerDistance) <= armingBuffer) {
    executionState = 'armed'
  }

  return {
    executionState,
    entryQuality,
    timeWarning,
    triggerDistance: roundToCents(triggerDistance),
    triggerDistancePct: roundToCents(triggerDistancePct),
    riskPerShare: roundToCents(riskPerShare),
    idealEntryLow: roundToCents(idealEntryLow),
    idealEntryHigh: roundToCents(idealEntryHigh),
    chaseCutoff: roundToCents(chaseCutoff),
    idealEntryBuffer: roundToCents(idealEntryBuffer),
    maxChaseBuffer: roundToCents(maxChaseBuffer),
  }
}
