import { ConfluenceZone, MoneyMakerTimeWarning } from './types'

export type MoneyMakerFreshnessStatus = 'live' | 'delayed' | 'stale'

interface MoneyMakerZoneSummary {
    title: string
    description: string
}

const ZONE_INTENSITY_LABEL: Record<ConfluenceZone['label'], string> = {
    moderate: 'Moderate',
    strong: 'Strong',
    fortress: 'Heavy',
}

export function normalizeMoneyMakerLevelSource(source: string): string {
    return source.replace(/^(Hourly (?:High|Low))\s+-?\d+(?:\.\d+)?$/, '$1').trim()
}

export function describeMoneyMakerZone(
    zone: ConfluenceZone | null | undefined,
    currentPrice: number | null | undefined,
): MoneyMakerZoneSummary | null {
    if (!zone) return null

    const intensity = ZONE_INTENSITY_LABEL[zone.label]
    const referencePrice = typeof currentPrice === 'number' && Number.isFinite(currentPrice) ? currentPrice : null
    const priceGapTolerance = referencePrice ? Math.max(referencePrice * 0.0001, 0.03) : 0.03

    if (referencePrice !== null && zone.priceHigh < referencePrice - priceGapTolerance) {
        return {
            title: `${intensity} support cluster`,
            description: zone.isKingQueen
                ? 'VWAP is stacked inside this support area, which can help define pullback entries.'
                : 'Stacked levels below price can help define support on pullbacks.',
        }
    }

    if (referencePrice !== null && zone.priceLow > referencePrice + priceGapTolerance) {
        return {
            title: `${intensity} resistance cluster`,
            description: zone.isKingQueen
                ? 'VWAP is stacked inside this resistance area, which can matter for targets or failed breakouts.'
                : 'Stacked levels above price can cap upside and help frame profit targets.',
        }
    }

    return {
        title: `${intensity} active inflection zone`,
        description: 'Price is trading inside a stacked level area. Wait for confirmation before forcing a new entry.',
    }
}

export function getMoneyMakerFreshnessStatus(
    updatedAt: number | null | undefined,
    nowMs: number = Date.now(),
): MoneyMakerFreshnessStatus {
    if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) {
        return 'stale'
    }

    const ageMs = Math.max(nowMs - updatedAt, 0)
    if (ageMs <= 15_000) return 'live'
    if (ageMs <= 45_000) return 'delayed'
    return 'stale'
}

export function getMoneyMakerFreshnessLabel(status: MoneyMakerFreshnessStatus): string {
    switch (status) {
        case 'live':
            return 'Data live'
        case 'delayed':
            return 'Data delayed'
        case 'stale':
        default:
            return 'Data stale'
    }
}

export function describeMoneyMakerTimeWarning(value: MoneyMakerTimeWarning): string {
    switch (value) {
        case 'late_session':
            return 'Late session. Tighten expectations and avoid chasing fresh entries.'
        case 'avoid_new_entries':
            return 'Avoid fresh entries outside the regular session. Focus on managing existing risk only.'
        case 'normal':
        default:
            return 'Time-of-day is supportive for fresh entries if the rest of the plan still confirms.'
    }
}

export function formatMoneyMakerEasternTime(
    input: number | Date,
    options: { withSeconds?: boolean } = {},
): string {
    const date = input instanceof Date ? input : new Date(input)
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        ...(options.withSeconds ? { second: '2-digit' as const } : {}),
        timeZoneName: 'short',
    }).format(date)
}
