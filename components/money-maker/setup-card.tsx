'use client'

import { useState } from 'react'
import { Activity, Info, Target } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMoneyMaker } from './money-maker-provider'
import { SignalWhyPanel } from './signal-why-panel'

function formatPrice(value: number | null | undefined) {
    return typeof value === 'number' ? value.toFixed(2) : '--'
}

function formatPercent(value: number | null | undefined) {
    if (typeof value !== 'number') return null
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function SetupCard({ symbol }: { symbol: string }) {
    const { state } = useMoneyMaker()
    const signal = state.signals.find((entry) => entry.symbol === symbol)
    const symbolSnapshot = state.symbolSnapshots.find((entry) => entry.symbol === symbol)
    const [isWhyPanelOpen, setIsWhyPanelOpen] = useState(false)

    const priceChangePercent = formatPercent(symbolSnapshot?.priceChangePercent)
    const priceToneClass = typeof symbolSnapshot?.priceChangePercent === 'number'
        ? symbolSnapshot.priceChangePercent >= 0
            ? 'text-emerald-400'
            : 'text-red-400'
        : 'text-muted-foreground'
    const regimeLabel = signal?.orbRegime || symbolSnapshot?.orbRegime || null
    const regimeBadgeClass = regimeLabel === 'trending_up'
        ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
        : regimeLabel === 'trending_down'
            ? 'border-red-500/50 text-red-400 bg-red-500/10'
            : 'border-amber-500/50 text-amber-500 bg-amber-500/10'
    const indicators = [
        { label: 'VWAP', value: symbolSnapshot?.indicators.vwap ?? null },
        { label: '8 EMA', value: symbolSnapshot?.indicators.ema8 ?? null },
        { label: '21 EMA', value: symbolSnapshot?.indicators.ema21 ?? null },
        { label: '200 SMA', value: symbolSnapshot?.indicators.sma200 ?? null },
    ]
    const strongestZone = signal?.confluenceZone || symbolSnapshot?.strongestConfluence || null

    return (
        <>
            <Card className={`border-white/10 bg-black/40 backdrop-blur-md overflow-hidden relative group transition-colors hover:border-white/20 ${signal ? (signal.direction === 'long' ? 'ring-1 ring-emerald-500/50 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]' : 'ring-1 ring-red-500/50 shadow-[0_0_15px_-3px_rgba(239,68,68,0.3)]') : ''}`}>
                {signal && (
                    <div className={`absolute top-0 left-0 w-full h-1 ${signal.direction === 'long' ? 'bg-gradient-to-r from-emerald-500 to-transparent' : 'bg-gradient-to-r from-red-500 to-transparent'}`} />
                )}
                <CardHeader className="pb-3 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-bold tracking-tight text-white">{symbol}</CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
                                <span className={`text-sm font-medium ${priceToneClass}`}>
                                    {symbolSnapshot ? `$${formatPrice(symbolSnapshot.price)}` : '---'}
                                </span>
                                {priceChangePercent && (
                                    <span className={`text-xs font-medium ${priceToneClass}`}>{priceChangePercent}</span>
                                )}
                                <span className="text-xs text-muted-foreground">Stock</span>
                            </div>
                        </div>
                        <Badge variant="outline" className={`hover:bg-white/10 capitalize ${regimeBadgeClass}`}>
                            {regimeLabel ? regimeLabel.replace(/_/g, ' ') : 'Analyzing'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    <div className={`grid grid-cols-2 gap-2 text-xs ${symbolSnapshot ? '' : 'opacity-50'}`}>
                        {indicators.map((indicator) => (
                            <div key={indicator.label} className="rounded-md bg-white/5 p-2 flex flex-col items-center justify-center">
                                <span className="text-muted-foreground mb-1 block truncate w-full text-center">{indicator.label}</span>
                                <span className="font-medium">{formatPrice(indicator.value)}</span>
                            </div>
                        ))}
                    </div>

                    {signal ? (
                        <div
                            className={`rounded-lg border p-3 cursor-pointer transition-colors hover:bg-opacity-80 ${signal.direction === 'long'
                                ? 'border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-500/50'
                                : 'border-red-500/30 bg-red-500/10 hover:border-red-500/50'
                                }`}
                            onClick={() => setIsWhyPanelOpen(true)}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Target className={`h-4 w-4 ${signal.direction === 'long' ? 'text-emerald-500' : 'text-red-500'} ${signal.status === 'ready' ? 'animate-pulse' : ''}`} />
                                    <span className={`text-xs font-bold uppercase tracking-wider ${signal.direction === 'long' ? 'text-emerald-400' : 'text-red-400'
                                        }`}>
                                        {signal.strategyLabel}
                                    </span>
                                </div>
                                <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 hover:bg-white/10">
                                    <span>R:R {signal.riskRewardRatio}</span>
                                    <Info className="h-3 w-3 text-muted-foreground ml-1" />
                                </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-1 text-center text-xs">
                                <div>
                                    <div className="text-muted-foreground mb-0.5">Entry</div>
                                    <div className="font-mono text-white">{signal.entry.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground mb-0.5">Stop</div>
                                    <div className="font-mono text-white">{signal.stop.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground mb-0.5">Target</div>
                                    <div className="font-mono text-white">{signal.target.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                    ) : symbolSnapshot ? (
                        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                    <Activity className="h-3.5 w-3.5 text-emerald-400" />
                                    Monitoring
                                </div>
                                {strongestZone ? (
                                    <Badge variant="secondary" className="text-[10px] px-1.5">
                                        Score {strongestZone.score.toFixed(1)}
                                    </Badge>
                                ) : null}
                            </div>

                            {strongestZone ? (
                                <>
                                    <div className="text-sm text-white/90">
                                        Strongest zone: <span className="capitalize">{strongestZone.label}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {strongestZone.levels.slice(0, 3).map((level, index) => (
                                            <span key={`${level.source}-${index}`} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-muted-foreground">
                                                {level.source} {level.price.toFixed(2)}
                                            </span>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="text-sm text-muted-foreground/80">
                                    No confluence stack yet. Monitoring for the next patience candle setup.
                                </div>
                            )}

                            <div className="text-[11px] text-muted-foreground/70">
                                Last candle: {new Date(symbolSnapshot.lastCandleAt).toLocaleTimeString('en-US', { timeStyle: 'short' })}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-white/20 p-4 bg-white/[0.01] flex flex-col justify-center items-center h-[90px]">
                            {state.isLoading ? (
                                <div className="flex items-center gap-2 text-muted-foreground/60">
                                    <div className="h-4 w-4 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                                    <span className="text-xs font-medium">Scanning Markets...</span>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <p className="text-sm font-medium text-muted-foreground/80">Scanning for KCU Setups</p>
                                    <p className="text-xs text-muted-foreground/50 mt-1">Waiting for Patience Candle</p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <SignalWhyPanel
                signal={signal || null}
                isOpen={isWhyPanelOpen}
                onClose={() => setIsWhyPanelOpen(false)}
            />
        </>
    )
}
