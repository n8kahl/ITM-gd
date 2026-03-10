'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Target, Info } from 'lucide-react'
import { useMoneyMaker } from './money-maker-provider'
import { SignalWhyPanel } from './signal-why-panel'

export function SetupCard({ symbol }: { symbol: string }) {
    const { state } = useMoneyMaker()
    const signal = state.signals.find(s => s.symbol === symbol)
    const [isWhyPanelOpen, setIsWhyPanelOpen] = useState(false)
    // Placeholder card for Slice 3.4 that will eventually consume the signal data snapshot
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
                                <span className="text-sm font-medium text-emerald-400">---</span>
                                <span className="text-xs text-muted-foreground">Stock</span>
                            </div>
                        </div>
                        <Badge variant="outline" className="border-amber-500/50 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 capitalize">
                            {signal ? signal.orbRegime.replace(/_/g, ' ') : 'Analyzing'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    {/* Indicators from Zone */}
                    {signal && signal.confluenceZone.levels.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {signal.confluenceZone.levels.slice(0, 4).map((lvl, idx) => (
                                <div key={idx} className="rounded-md bg-white/5 p-2 flex flex-col items-center justify-center">
                                    <span className="text-muted-foreground mb-1 block truncate w-full text-center">{lvl.source}</span>
                                    <span className="font-medium">{lvl.price.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 text-xs opacity-50">
                            <div className="rounded-md bg-white/5 p-2 flex flex-col items-center justify-center">
                                <span className="text-muted-foreground mb-1">VWAP</span>
                                <span className="font-medium">--</span>
                            </div>
                            <div className="rounded-md bg-white/5 p-2 flex flex-col items-center justify-center">
                                <span className="text-muted-foreground mb-1">8 EMA</span>
                                <span className="font-medium">--</span>
                            </div>
                        </div>
                    )}

                    {/* Signals Box */}
                    {signal ? (
                        <div className={`rounded-lg border p-3 cursor-pointer transition-colors hover:bg-opacity-80 ${signal.direction === 'long'
                            ? 'border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-500/50'
                            : 'border-red-500/30 bg-red-500/10 hover:border-red-500/50'
                            }`} onClick={() => setIsWhyPanelOpen(true)}>
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
