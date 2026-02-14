
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMarketAnalytics } from '@/hooks/useMarketData'
import { cn } from '@/lib/utils'
import { Activity, TrendingUp, TrendingDown, BarChart3, Shield, Flame, Minus } from 'lucide-react'

function RegimeBadge({ label }: { label: 'Risk-On' | 'Risk-Off' | 'Neutral' }) {
    const config = {
        'Risk-On': { icon: Flame, bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30' },
        'Risk-Off': { icon: Shield, bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30' },
        Neutral: { icon: Minus, bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30' },
    }
    const c = config[label]
    const Icon = c.icon

    return (
        <div className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold', c.bg, c.text, c.border)}>
            <Icon className="w-3.5 h-3.5" />
            {label}
        </div>
    )
}

function BreadthBar({ advancers, decliners }: { advancers: number; decliners: number }) {
    const total = advancers + decliners || 1
    const advPct = Math.round((advancers / total) * 100)

    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
                <span className="text-emerald-500">{advancers} Adv</span>
                <span className="text-red-500">{decliners} Dec</span>
            </div>
            <div className="h-2 rounded-full bg-red-500/20 overflow-hidden">
                <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${advPct}%` }}
                />
            </div>
        </div>
    )
}

export function MarketAnalyticsCard() {
    const { analytics, isLoading, isError } = useMarketAnalytics()

    if (isLoading) {
        return (
            <Card className="glass-card border-none shadow-none h-full">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-500" />
                        Market Analytics
                    </CardTitle>
                    <CardDescription>Loading market health data...</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-12 rounded bg-white/5 animate-pulse" />
                    ))}
                </CardContent>
            </Card>
        )
    }

    if (isError || !analytics || !analytics.regime || !analytics.breadth || !Array.isArray(analytics.indices)) {
        return (
            <Card className="glass-card border-none shadow-none h-full">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-500" />
                        Market Analytics
                    </CardTitle>
                    <CardDescription>Market analytics are temporarily unavailable.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground">Retrying in the background.</div>
                </CardContent>
            </Card>
        )
    }

    const { regime, breadth } = analytics
    const indices = Array.isArray(analytics.indices) ? analytics.indices : []

    return (
        <Card className="glass-card border-none shadow-none h-full">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-500" />
                        Market Analytics
                    </CardTitle>
                    <RegimeBadge label={regime.label} />
                </div>
                <CardDescription>{regime.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Index Performance */}
                <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Index Performance</div>
                    <div className="grid grid-cols-2 gap-2">
                        {indices.map((idx) => {
                            const isUp = idx.changePercent >= 0
                            return (
                                <div key={idx.symbol} className="flex items-center justify-between bg-muted/20 rounded-lg p-2.5">
                                    <div>
                                        <div className="font-semibold text-sm">{idx.symbol}</div>
                                        <div className="text-xs text-muted-foreground font-mono tabular-nums">${idx.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    </div>
                                    <div className={cn('flex items-center gap-0.5 text-sm font-mono font-medium tabular-nums', isUp ? 'text-emerald-500' : 'text-red-500')}>
                                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {isUp ? '+' : ''}{idx.changePercent.toFixed(2)}%
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Market Breadth */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                            <BarChart3 className="w-3 h-3" />
                            Market Breadth
                        </div>
                        <div className="text-xs text-muted-foreground">{breadth.label}</div>
                    </div>
                    <BreadthBar advancers={breadth.advancers} decliners={breadth.decliners} />
                    <div className="text-xs text-center text-muted-foreground">A/D Ratio: <span className="font-mono font-medium">{breadth.ratio}</span></div>
                </div>

                {/* Regime Signals */}
                {regime.signals.length > 0 && (
                    <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Signals</div>
                        <div className="flex flex-wrap gap-1.5">
                            {regime.signals.map((signal, i) => (
                                <span key={i} className="text-xs bg-muted/30 text-muted-foreground px-2 py-0.5 rounded-full">
                                    {signal}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
