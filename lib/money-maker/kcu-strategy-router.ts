import { ORBRegime } from './orb-calculator'
import { ConfluenceZone, KCUStrategyType } from './types'

export interface StrategyRouterContext {
    timestamp: number // milliseconds epoch
    orbRegime: ORBRegime
    confluenceZone: ConfluenceZone
    direction?: 'long' | 'short'
    isVwapCrossFromBelow?: boolean
    isMorningTrend?: boolean
    isPrevDayTrend?: boolean
    isSteepTrend?: boolean
}

export interface RouterResult {
    isValid: boolean
    strategyType?: KCUStrategyType
    strategyLabel?: string
    reason?: string // if blocked
}

// Ensure parsing in Eastern Time since market schedules are ET-based.
export function getETTimeStr(timestamp: number): string {
    const d = new Date(timestamp)
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(d) // e.g. "09:30", "15:00"
}

export function determineStrategy(context: StrategyRouterContext): RouterResult {
    const timeStr = getETTimeStr(context.timestamp)

    // 1. Hard Blocks
    if (timeStr < "09:35") {
        return { isValid: false, reason: "Before 9:35 ET - ORB still forming" }
    }
    if (timeStr >= "15:00") {
        return { isValid: false, reason: "After 3:00 PM ET - Trading suspended" }
    }

    const { confluenceZone, orbRegime } = context
    const hasVwap = confluenceZone.isKingQueen

    if (orbRegime === 'choppy' && !hasVwap) {
        return { isValid: false, reason: "Choppy regime requires VWAP confluence" }
    }

    // 2. Strategy Assignment (Priority Order)

    // King & Queen: VWAP + another level. 9:40+ ET. Any regime.
    if (hasVwap && confluenceZone.levels.length > 1 && timeStr >= "09:40") {
        return { isValid: true, strategyType: 'KING_AND_QUEEN', strategyLabel: 'King & Queen' }
    }

    // Advanced VWAP: Cross from below. 10:00+ ET. Any regime.
    if (context.isVwapCrossFromBelow && timeStr >= "10:00") {
        return { isValid: true, strategyType: 'ADVANCED_VWAP', strategyLabel: 'Advanced VWAP' }
    }

    // VWAP Strategy: Fallback if it's just VWAP (or K&Q conditions not met). 10:00+ ET. Trending.
    if (hasVwap && timeStr >= "10:00" && orbRegime !== 'choppy') {
        return { isValid: true, strategyType: 'VWAP_STRATEGY', strategyLabel: 'VWAP Strategy' }
    }

    // Cloud Strategy: Ripster cloud zone. 1:00-3:00 PM ET. Trending morning.
    const hasCloud = confluenceZone.levels.some(l => l.source.includes('Cloud'))
    if (hasCloud && timeStr >= "13:00" && timeStr < "15:00" && context.isMorningTrend) {
        return { isValid: true, strategyType: 'CLOUD_STRATEGY', strategyLabel: 'Cloud Strategy' }
    }

    // Fib Bounce/Reject: Fib level. Trending prev day.
    const hasFib = confluenceZone.levels.some(l => l.source.includes('Fib'))
    if (hasFib && context.isPrevDayTrend) {
        const type = context.direction === 'short' ? 'FIB_REJECT' : 'FIB_BOUNCE'
        return { isValid: true, strategyType: type, strategyLabel: 'Fibonacci Strategy' }
    }

    // EMA Bounce: 8 EMA. Trending regime. Steep trend.
    const has8Ema = confluenceZone.levels.some(l => l.source.includes('8 EMA'))
    if (has8Ema && orbRegime !== 'choppy' && context.isSteepTrend) {
        return { isValid: true, strategyType: 'EMA_BOUNCE', strategyLabel: 'EMA Bounce' }
    }

    return { isValid: false, reason: "No valid strategy matched for this configuration" }
}
