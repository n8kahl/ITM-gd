import { MoneyMakerExecutionState, MoneyMakerSignal, MoneyMakerSymbolSnapshot } from './types'
import { MoneyMakerExecutionSummary, summarizeMoneyMakerExecution } from './execution-summary'

export interface MoneyMakerExecutionAlert {
    symbol: string
    title: string
    description: string
}

export interface MoneyMakerExecutionAlertCandidate {
    symbol: string
    signalId: string
    summary: MoneyMakerExecutionSummary
    signal: MoneyMakerSignal
}

export function buildMoneyMakerExecutionAlert(candidate: MoneyMakerExecutionAlertCandidate): MoneyMakerExecutionAlert | null {
    const { signal, summary, symbol } = candidate

    switch (summary.executionState) {
        case 'armed':
            return {
                symbol,
                title: `${symbol} setup armed`,
                description: `${signal.direction === 'long' ? 'Long' : 'Short'} trigger is approaching ${signal.entry.toFixed(2)}. Ideal entry stays inside ${summary.idealEntryLow.toFixed(2)}-${summary.idealEntryHigh.toFixed(2)}.`,
            }
        case 'triggered':
            return {
                symbol,
                title: `${symbol} triggered`,
                description: `${signal.direction === 'long' ? 'Long' : 'Short'} trigger cleared ${signal.entry.toFixed(2)}. Invalidate at ${signal.stop.toFixed(2)} and manage for T1 ${signal.target.toFixed(2)}.`,
            }
        case 'target1_hit':
            return {
                symbol,
                title: `${symbol} hit target 1`,
                description: `Target 1 at ${signal.target.toFixed(2)} was reached. Reduce exposure and only hold for extension if price structure stays clean.`,
            }
        case 'failed':
            return {
                symbol,
                title: `${symbol} failed`,
                description: `The setup lost ${signal.stop.toFixed(2)}. Stand down on fresh entries until structure resets.`,
            }
        default:
            return null
    }
}

export function isMoneyMakerAlertableState(state: MoneyMakerExecutionState): boolean {
    return ['armed', 'triggered', 'target1_hit', 'failed'].includes(state)
}

function buildFingerprint(candidate: MoneyMakerExecutionAlertCandidate): string {
    return `${candidate.signalId}:${candidate.summary.executionState}`
}

export function buildMoneyMakerExecutionAlertCandidates(
    signals: MoneyMakerSignal[],
    symbolSnapshots: MoneyMakerSymbolSnapshot[],
    currentTimestamp: number = Date.now(),
): MoneyMakerExecutionAlertCandidate[] {
    return signals.flatMap((signal) => {
        const symbolSnapshot = symbolSnapshots.find((snapshot) => snapshot.symbol === signal.symbol)
        const summary = summarizeMoneyMakerExecution(signal, symbolSnapshot, currentTimestamp)

        if (!symbolSnapshot || !summary) {
            return []
        }

        return [{
            symbol: signal.symbol,
            signalId: signal.id,
            signal,
            summary,
        }]
    })
}

export function collectMoneyMakerExecutionAlerts(params: {
    candidates: MoneyMakerExecutionAlertCandidate[]
    previousFingerprints: Record<string, string>
    suppressInitialAlerts?: boolean
}) {
    const { candidates, previousFingerprints, suppressInitialAlerts = false } = params
    const nextFingerprints: Record<string, string> = {}
    const alerts: MoneyMakerExecutionAlert[] = []

    for (const candidate of candidates) {
        const fingerprint = buildFingerprint(candidate)
        nextFingerprints[candidate.symbol] = fingerprint

        if (!isMoneyMakerAlertableState(candidate.summary.executionState)) {
            continue
        }

        const previousFingerprint = previousFingerprints[candidate.symbol]
        const hasChanged = previousFingerprint !== fingerprint

        if (!hasChanged || suppressInitialAlerts) {
            continue
        }

        const alert = buildMoneyMakerExecutionAlert(candidate)
        if (alert) {
            alerts.push(alert)
        }
    }

    return {
        nextFingerprints,
        alerts,
    }
}
