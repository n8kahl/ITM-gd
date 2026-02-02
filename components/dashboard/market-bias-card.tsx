'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MarketBiasCardProps {
  bias: 'bullish' | 'neutral' | 'bearish'
  confidence?: number // 0-100
}

export function MarketBiasCard({ bias = 'neutral', confidence = 50 }: MarketBiasCardProps) {
  const getBiasConfig = () => {
    switch (bias) {
      case 'bullish':
        return {
          icon: TrendingUp,
          label: 'Bullish',
          color: 'text-emerald-500',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/30',
          gaugeColor: 'bg-emerald-500',
          position: 75, // Gauge position (0-100)
        }
      case 'bearish':
        return {
          icon: TrendingDown,
          label: 'Bearish',
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          gaugeColor: 'bg-red-500',
          position: 25,
        }
      default:
        return {
          icon: Minus,
          label: 'Neutral',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          gaugeColor: 'bg-yellow-500',
          position: 50,
        }
    }
  }

  const config = getBiasConfig()
  const Icon = config.icon

  return (
    <Card className="glass-card-heavy border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${config.color}`} />
          Market Bias
        </CardTitle>
        <CardDescription>Current market conditions assessment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bias Indicator */}
        <div className={`flex items-center justify-center p-6 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
          <div className="text-center">
            <Icon className={`w-12 h-12 ${config.color} mx-auto mb-3`} />
            <div className={`text-2xl font-bold ${config.color} mb-1`}>
              {config.label}
            </div>
            <div className="text-sm text-white/60">
              {confidence}% confidence
            </div>
          </div>
        </div>

        {/* Gauge Meter */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-white/60">
            <span>Bearish</span>
            <span>Neutral</span>
            <span>Bullish</span>
          </div>
          <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/30 via-yellow-500/30 to-emerald-500/30" />

            {/* Indicator */}
            <div
              className={`absolute top-0 bottom-0 w-1 ${config.gaugeColor} transition-all duration-500`}
              style={{ left: `${config.position}%` }}
            >
              <div className={`absolute -top-1 -left-1 w-3 h-5 ${config.gaugeColor} rounded-sm shadow-lg`} />
            </div>
          </div>
        </div>

        {/* Info Text */}
        <p className="text-sm text-white/60 text-center">
          {bias === 'bullish' && 'Market showing strong upward momentum. Consider long positions.'}
          {bias === 'bearish' && 'Market showing downward pressure. Consider short positions or caution.'}
          {bias === 'neutral' && 'Market showing mixed signals. Wait for clear direction.'}
        </p>
      </CardContent>
    </Card>
  )
}
