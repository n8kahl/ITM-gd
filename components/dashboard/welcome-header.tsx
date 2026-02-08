'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface WelcomeHeaderProps {
  username: string
}

type MarketStatus = 'pre-market' | 'open' | 'after-hours' | 'closed'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getMarketStatus(): MarketStatus {
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const hours = et.getHours()
  const minutes = et.getMinutes()
  const day = et.getDay()
  const time = hours * 60 + minutes

  if (day === 0 || day === 6) return 'closed'
  if (time >= 240 && time < 570) return 'pre-market'
  if (time >= 570 && time < 960) return 'open'
  if (time >= 960 && time < 1200) return 'after-hours'
  return 'closed'
}

function getMarketStatusConfig(status: MarketStatus) {
  switch (status) {
    case 'pre-market':
      return { label: 'Pre-Market', dotColor: 'bg-amber-400', textColor: 'text-amber-400', pulse: true }
    case 'open':
      return { label: 'Market Open', dotColor: 'bg-emerald-400', textColor: 'text-emerald-400', pulse: true }
    case 'after-hours':
      return { label: 'After Hours', dotColor: 'bg-blue-400', textColor: 'text-blue-400', pulse: false }
    case 'closed':
      return { label: 'Market Closed', dotColor: 'bg-gray-500', textColor: 'text-muted-foreground', pulse: false }
  }
}

export function WelcomeHeader({ username }: WelcomeHeaderProps) {
  const [currentTime, setCurrentTime] = useState('')
  const [marketStatus, setMarketStatus] = useState<MarketStatus>(getMarketStatus())

  useEffect(() => {
    const update = () => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour: '2-digit',
          minute: '2-digit',
        })
      )
      setMarketStatus(getMarketStatus())
    }
    update()
    const interval = setInterval(update, 30_000)
    return () => clearInterval(interval)
  }, [])

  const statusConfig = getMarketStatusConfig(marketStatus)
  const firstName = username?.split(' ')[0] || username || 'Trader'

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      {/* Left: Greeting */}
      <div>
        <h1 className="text-xl lg:text-2xl font-serif text-ivory font-medium tracking-tight">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{dateStr}</p>
      </div>

      {/* Right: Market Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08]">
          <div className={cn(
            'w-2 h-2 rounded-full',
            statusConfig.dotColor,
            statusConfig.pulse && 'animate-pulse'
          )} />
          <span className={cn('text-xs font-medium', statusConfig.textColor)}>
            {statusConfig.label}
          </span>
        </div>
        {currentTime && (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {currentTime} ET
          </span>
        )}
      </div>
    </div>
  )
}
