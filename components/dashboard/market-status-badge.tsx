
'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useMarketStatus } from '@/hooks/useMarketData'

function getMarketStatusLabel(status: string, session: string): string {
    if (status === 'closed') return 'Closed'
    if (status === 'early-close') return 'Early Close'

    switch (session) {
        case 'pre-market': return 'Pre-Market'
        case 'regular': return 'Open'
        case 'after-hours': return 'After Hours'
        default: return 'Open'
    }
}

function getMarketStatusColor(status: string, session: string): string {
    if (status === 'closed') return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    if (status === 'early-close') return 'bg-amber-400/10 text-amber-400 border-amber-400/20'

    switch (session) {
        case 'regular': return 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
        case 'pre-market': return 'bg-amber-400/10 text-amber-400 border-amber-400/20'
        case 'after-hours': return 'bg-blue-400/10 text-blue-400 border-blue-400/20'
        default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    }
}

interface MarketStatusBadgeProps {
    className?: string
    showIcon?: boolean
}

export function MarketStatusBadge({ className, showIcon = true }: MarketStatusBadgeProps) {
    const { status: marketStatusData, isLoading } = useMarketStatus()

    const status = marketStatusData?.status || 'closed'
    const session = marketStatusData?.session || 'closed'

    const label = getMarketStatusLabel(status, session)
    const colorClass = getMarketStatusColor(status, session)
    const isLive = status === 'open' && session === 'regular'

    if (isLoading) {
        return <Badge variant="outline" className={cn("animate-pulse w-16 h-5", className)} />
    }

    return (
        <Badge variant="outline" className={cn(colorClass, "gap-1.5", className)}>
            {showIcon && (
                <span className={cn(
                    "relative flex h-2 w-2",
                    isLive && "items-center justify-center"
                )}>
                    <span className={cn(
                        "absolute inline-flex h-full w-full rounded-full opacity-75",
                        isLive ? "bg-emerald-400 animate-ping" : "bg-current"
                    )}></span>
                    <span className={cn(
                        "relative inline-flex rounded-full h-1.5 w-1.5",
                        isLive ? "bg-emerald-500" : "bg-current"
                    )}></span>
                </span>
            )}
            {label}
        </Badge>
    )
}
