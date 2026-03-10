'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Clock } from 'lucide-react'

interface StrategyTimeWindow {
    id: string
    label: string
    start: string // HH:MM in NY Time (EST)
    end: string   // HH:MM in NY Time (EST)
    type: 'AM' | 'ALL_DAY' | 'PM'
}

const STRATEGIES: StrategyTimeWindow[] = [
    { id: 'pmo', label: 'Pre-Market Output', start: '08:00', end: '09:45', type: 'AM' },
    { id: 'orb', label: 'Opening Range Break', start: '09:30', end: '10:30', type: 'AM' },
    { id: 'trend', label: 'Trend Continuation', start: '09:30', end: '15:45', type: 'ALL_DAY' },
    { id: 'power', label: 'Power Hour', start: '15:00', end: '15:55', type: 'PM' },
]

export function ActiveStrategiesClock() {
    const [nyTime, setNyTime] = useState(new Date())

    // Fast tick for testing, normally 1 minute or 1 second is fine
    useEffect(() => {
        const timer = setInterval(() => {
            // In a real app we'd fetch precise server time. Here we use browser time
            // and assume the user is or has converted to NY time for visual demo.
            setNyTime(new Date())
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    // Format HH:MM string for comparison
    const nyTimeString = nyTime.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    })

    return (
        <Card className="flex items-center space-x-4 border-white/10 bg-black/40 backdrop-blur-md px-4 py-2">
            <div className="flex items-center space-x-2 border-r border-white/10 pr-4">
                <Clock className="h-4 w-4 text-emerald-500" />
                <span className="font-mono text-sm text-ivory">
                    {nyTime.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit' })} EST
                </span>
            </div>

            <div className="flex items-center space-x-2">
                {STRATEGIES.map(strat => {
                    const isActive = nyTimeString >= strat.start && nyTimeString < strat.end
                    return (
                        <div
                            key={strat.id}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-all duration-500 ${isActive
                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_-2px_rgba(16,185,129,0.3)]'
                                    : 'bg-white/5 border-white/5 text-muted-foreground/50 opacity-50'
                                }`}
                        >
                            {strat.label}
                        </div>
                    )
                })}
            </div>
        </Card>
    )
}
