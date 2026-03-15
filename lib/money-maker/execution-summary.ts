import {
    MoneyMakerEntryQuality,
    MoneyMakerExecutionState,
    MoneyMakerSignal,
    MoneyMakerSymbolSnapshot,
    MoneyMakerTimeWarning,
} from './types'

export interface MoneyMakerExecutionSummary {
    executionState: MoneyMakerExecutionState
    entryQuality: MoneyMakerEntryQuality
    triggerDistance: number
    triggerDistancePct: number
    targetProgress: 'T1 pending' | 'At T1' | 'T2 in play' | 'Failed after trigger' | 'Market closed'
    target2: number | null
    timeWarning: MoneyMakerTimeWarning
    riskPerShare: number
    idealEntryLow: number
    idealEntryHigh: number
    chaseCutoff: number
}

function roundToCents(value: number): number {
    return Number(value.toFixed(2))
}

function getEasternDateParts(timestamp: number) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })

    const parts = formatter.formatToParts(new Date(timestamp))
    const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))

    return {
        weekday: lookup.weekday ?? 'Mon',
        hour: Number(lookup.hour ?? '0'),
        minute: Number(lookup.minute ?? '0'),
    }
}

function evaluateTimeWarning(timestamp: number): MoneyMakerTimeWarning {
    const et = getEasternDateParts(timestamp)
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
    const et = getEasternDateParts(timestamp)
    const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(et.weekday)
    const minutesFromMidnight = et.hour * 60 + et.minute

    return isWeekday && minutesFromMidnight >= 570 && minutesFromMidnight < 960
}

function selectTarget2(signal: MoneyMakerSignal, symbolSnapshot: MoneyMakerSymbolSnapshot): number | null {
    const hourlyLevels = symbolSnapshot.hourlyLevels
    if (!hourlyLevels) return null

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

function deriveEntryQuality(
    signal: MoneyMakerSignal,
    currentPrice: number,
    idealEntryBuffer: number,
    maxChaseBuffer: number,
): MoneyMakerEntryQuality {
    if (signal.direction === 'long') {
        if (currentPrice <= signal.entry + idealEntryBuffer) return 'ideal'
        if (currentPrice <= signal.entry + maxChaseBuffer) return 'acceptable'
        return 'late'
    }

    if (currentPrice >= signal.entry - idealEntryBuffer) return 'ideal'
    if (currentPrice >= signal.entry - maxChaseBuffer) return 'acceptable'
    return 'late'
}

export function summarizeMoneyMakerExecution(
    signal: MoneyMakerSignal | null | undefined,
    symbolSnapshot: MoneyMakerSymbolSnapshot | null | undefined,
    currentTimestamp: number = Date.now(),
): MoneyMakerExecutionSummary | null {
    if (!signal || !symbolSnapshot) {
        return null
    }

    const currentPrice = symbolSnapshot.price
    const riskPerShare = Math.abs(signal.entry - signal.stop)
    const idealEntryBuffer = Math.min(riskPerShare * 0.15, currentPrice * 0.001)
    const maxChaseBuffer = Math.min(riskPerShare * 0.25, currentPrice * 0.0015)
    const armingBuffer = riskPerShare * 0.65
    const triggerDistance = signal.direction === 'long'
        ? signal.entry - currentPrice
        : currentPrice - signal.entry
    const triggerDistancePct = signal.entry !== 0 ? (triggerDistance / signal.entry) * 100 : 0
    const entryQuality = deriveEntryQuality(signal, currentPrice, idealEntryBuffer, maxChaseBuffer)
    const timeWarning = evaluateTimeWarning(currentTimestamp)
    const target2 = selectTarget2(signal, symbolSnapshot)

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

    const targetProgress = executionState === 'target2_in_play'
        ? 'T2 in play'
        : executionState === 'target1_hit'
            ? 'At T1'
            : executionState === 'failed'
                ? 'Failed after trigger'
                : executionState === 'closed'
                    ? 'Market closed'
                    : 'T1 pending'

    return {
        executionState,
        entryQuality,
        triggerDistance: roundToCents(triggerDistance),
        triggerDistancePct: roundToCents(triggerDistancePct),
        targetProgress,
        target2: target2 !== null ? roundToCents(target2) : null,
        timeWarning,
        riskPerShare: roundToCents(riskPerShare),
        idealEntryLow: roundToCents(signal.direction === 'long' ? signal.entry : signal.entry - idealEntryBuffer),
        idealEntryHigh: roundToCents(signal.direction === 'long' ? signal.entry + idealEntryBuffer : signal.entry),
        chaseCutoff: roundToCents(signal.direction === 'long' ? signal.entry + maxChaseBuffer : signal.entry - maxChaseBuffer),
    }
}
