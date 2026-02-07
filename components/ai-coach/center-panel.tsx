'use client'

import {
  BarChart3,
  TrendingUp,
  Target,
  Zap,
  ArrowRight,
} from 'lucide-react'

interface CenterPanelProps {
  onSendPrompt?: (prompt: string) => void
}

const EXAMPLE_PROMPTS = [
  {
    icon: Target,
    label: 'Key Levels',
    prompt: "Where's PDH for SPX today?",
    description: 'Get pivot points, support & resistance',
  },
  {
    icon: TrendingUp,
    label: 'Market Status',
    prompt: "What's the current market status?",
    description: 'Check if market is open, pre-market, or closed',
  },
  {
    icon: BarChart3,
    label: 'ATR Analysis',
    prompt: "What's the ATR for SPX and NDX?",
    description: 'Volatility measurement for position sizing',
  },
  {
    icon: Zap,
    label: 'VWAP Check',
    prompt: "Where is VWAP for SPX right now?",
    description: 'Volume-weighted average price for intraday reference',
  },
]

/**
 * Right 70% panel — Phase 2 placeholder with welcome content and example prompts.
 * Will be replaced with charts (Phase 3), widgets (Phase 4), etc.
 */
export function CenterPanel({ onSendPrompt }: CenterPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-white">AI Coach Center</h2>
          <p className="text-xs text-white/40">Charts & analytics coming soon</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto">
          {/* Welcome */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Welcome to AI Coach
            </h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Your AI-powered trading assistant. Ask about key levels, market conditions,
              options data, and more. Try one of the examples below to get started.
            </p>
          </div>

          {/* Example Prompts */}
          <div className="grid gap-3">
            {EXAMPLE_PROMPTS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  onClick={() => onSendPrompt?.(item.prompt)}
                  className="group glass-card-heavy border-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-4 text-left transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">
                          {item.label}
                        </span>
                        <ArrowRight className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-white/40 mb-1.5">{item.description}</p>
                      <p className="text-xs text-emerald-500/70 italic">
                        &ldquo;{item.prompt}&rdquo;
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Upcoming Features Teaser */}
          <div className="mt-8 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
            <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
              Coming Soon
            </h4>
            <div className="space-y-2">
              {[
                'Live charts with key level annotations',
                'Options chain visualization',
                'Position P&L dashboard',
                'Trade journal integration',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-xs text-white/30">
                  <div className="w-1 h-1 rounded-full bg-emerald-500/30" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
