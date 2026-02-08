'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  X,
  Loader2,
  Globe,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  RefreshCw,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { API_BASE } from '@/lib/api/ai-coach'

// ============================================
// TYPES
// ============================================

interface EconomicEvent {
  date: string
  event: string
  expected: string | null
  previous: string | null
  actual: string | null
  impact: 'HIGH' | 'MEDIUM' | 'LOW'
  relevance: string
}

interface FedPolicy {
  currentRate: string
  nextMeetingDate: string
  marketImpliedProbabilities: {
    hold: number
    cut25: number
    hike25: number
  }
  currentTone: 'hawkish' | 'dovish' | 'neutral'
  expectedOutcome: string
}

interface SectorData {
  name: string
  relativeStrength: 'strong' | 'neutral' | 'weak'
  trend: 'bullish' | 'bearish' | 'neutral'
}

interface MacroData {
  economicCalendar: EconomicEvent[]
  fedPolicy: FedPolicy
  sectorRotation: {
    sectors: SectorData[]
    moneyFlowDirection: string
  }
  earningsSeason: {
    currentPhase: string
    beatRate: number
    implication: string
  }
  timestamp: string
}

interface MacroContextProps {
  onClose: () => void
  onSendPrompt?: (prompt: string) => void
}

// ============================================
// COMPONENT
// ============================================

export function MacroContext({ onClose, onSendPrompt }: MacroContextProps) {
  const { session } = useMemberAuth()
  const [data, setData] = useState<MacroData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'calendar' | 'fed' | 'sectors' | 'earnings'>('calendar')

  const token = session?.access_token

  const fetchMacro = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/macro`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to fetch')
      setData(result)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchMacro()
  }, [fetchMacro])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-medium text-white">Macro Context</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMacro}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all',
              isLoading
                ? 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                : 'text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20'
            )}
          >
            <RefreshCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-4 py-2 flex items-center gap-1 border-b border-white/5">
        {([
          { key: 'calendar', label: 'Economic Calendar' },
          { key: 'fed', label: 'Fed Policy' },
          { key: 'sectors', label: 'Sectors' },
          { key: 'earnings', label: 'Earnings' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'text-xs px-2.5 py-1 rounded transition-colors',
              activeTab === tab.key
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-white/40 hover:text-white/60'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-sm text-white/50">Loading macro data...</p>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="text-center py-12">
            <p className="text-sm text-red-400 mb-2">{error}</p>
            <button onClick={fetchMacro} className="text-xs text-emerald-500 hover:text-emerald-400">
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {data && !isLoading && (
          <div className="p-4">
            {activeTab === 'calendar' && (
              <EconomicCalendarView events={data.economicCalendar} />
            )}
            {activeTab === 'fed' && (
              <FedPolicyView policy={data.fedPolicy} />
            )}
            {activeTab === 'sectors' && (
              <SectorRotationView
                sectors={data.sectorRotation.sectors}
                moneyFlow={data.sectorRotation.moneyFlowDirection}
              />
            )}
            {activeTab === 'earnings' && (
              <EarningsView
                phase={data.earningsSeason.currentPhase}
                beatRate={data.earningsSeason.beatRate}
                implication={data.earningsSeason.implication}
              />
            )}

            {/* Ask AI */}
            {onSendPrompt && (
              <div className="mt-4 pt-3 border-t border-white/5">
                <button
                  onClick={() => onSendPrompt('What does the current macro environment mean for my positions? How should I adjust my strategy?')}
                  className="flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  <Zap className="w-3 h-3" />
                  Ask AI about macro impact
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// SUB-VIEWS
// ============================================

function EconomicCalendarView({ events }: { events: EconomicEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-white/40 text-center py-8">No upcoming economic events</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-white/30 font-medium mb-2">UPCOMING ECONOMIC EVENTS</p>
      {events.map((event, i) => (
        <div key={i} className="glass-card-heavy rounded-lg p-2.5 border border-white/5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-3 h-3 text-white/30" />
              <span className="text-xs text-white/70 font-medium">{event.event}</span>
            </div>
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded font-medium',
              event.impact === 'HIGH' ? 'bg-red-500/10 text-red-400' :
              event.impact === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400' :
              'bg-white/5 text-white/40'
            )}>
              {event.impact}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-white/30">{new Date(event.date).toLocaleDateString()}</span>
          </div>
          <p className="text-[10px] text-white/40 mt-1">{event.relevance}</p>
        </div>
      ))}
    </div>
  )
}

function FedPolicyView({ policy }: { policy: FedPolicy }) {
  const toneColor = policy.currentTone === 'hawkish' ? 'text-red-400' :
    policy.currentTone === 'dovish' ? 'text-emerald-400' : 'text-amber-400'

  return (
    <div className="space-y-3">
      <div className="glass-card-heavy rounded-lg p-3 border border-white/5">
        <p className="text-[10px] text-white/30 mb-2">FEDERAL RESERVE POLICY</p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-white/30">Current Rate:</span>
            <p className="text-white/70 font-medium">{policy.currentRate}</p>
          </div>
          <div>
            <span className="text-white/30">Next Meeting:</span>
            <p className="text-white/70 font-medium">
              {new Date(policy.nextMeetingDate).toLocaleDateString()}
            </p>
          </div>
          <div>
            <span className="text-white/30">Fed Tone:</span>
            <p className={cn('font-medium capitalize', toneColor)}>{policy.currentTone}</p>
          </div>
          <div>
            <span className="text-white/30">Outlook:</span>
            <p className="text-white/60">{policy.expectedOutcome}</p>
          </div>
        </div>
      </div>

      <div className="glass-card-heavy rounded-lg p-3 border border-white/5">
        <p className="text-[10px] text-white/30 mb-2">MARKET-IMPLIED PROBABILITIES</p>
        <div className="space-y-2">
          <ProbabilityBar label="Hold (No Change)" pct={policy.marketImpliedProbabilities.hold} color="text-amber-400" />
          <ProbabilityBar label="Cut 0.25%" pct={policy.marketImpliedProbabilities.cut25} color="text-emerald-400" />
          <ProbabilityBar label="Hike 0.25%" pct={policy.marketImpliedProbabilities.hike25} color="text-red-400" />
        </div>
      </div>
    </div>
  )
}

function ProbabilityBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className="text-white/50">{label}</span>
        <span className={cn('font-medium', color)}>{(pct * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color.replace('text-', 'bg-').replace('400', '500/40'))}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  )
}

function SectorRotationView({ sectors, moneyFlow }: { sectors: SectorData[]; moneyFlow: string }) {
  return (
    <div className="space-y-3">
      <div className="glass-card-heavy rounded-lg p-3 border border-white/5">
        <p className="text-[10px] text-white/30 mb-2">MONEY FLOW</p>
        <p className="text-xs text-white/60">{moneyFlow}</p>
      </div>

      <div className="glass-card-heavy rounded-lg p-3 border border-white/5">
        <p className="text-[10px] text-white/30 mb-2">SECTOR STRENGTH</p>
        <div className="space-y-1.5">
          {sectors.map((sector, i) => {
            const Icon = sector.trend === 'bullish' ? TrendingUp :
              sector.trend === 'bearish' ? TrendingDown : Minus
            const color = sector.relativeStrength === 'strong' ? 'text-emerald-400' :
              sector.relativeStrength === 'weak' ? 'text-red-400' : 'text-white/40'

            return (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-3 h-3', color)} />
                  <span className="text-white/60">{sector.name}</span>
                </div>
                <span className={cn('text-[10px] font-medium capitalize', color)}>
                  {sector.relativeStrength}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EarningsView({
  phase,
  beatRate,
  implication,
}: {
  phase: string
  beatRate: number
  implication: string
}) {
  return (
    <div className="space-y-3">
      <div className="glass-card-heavy rounded-lg p-3 border border-white/5">
        <p className="text-[10px] text-white/30 mb-2">EARNINGS SEASON</p>
        <div className="space-y-2 text-xs">
          <div>
            <span className="text-white/30">Phase:</span>
            <span className="text-white/70 ml-1 font-medium">{phase}</span>
          </div>
          <div>
            <span className="text-white/30">Beat Rate:</span>
            <span className={cn(
              'ml-1 font-medium',
              beatRate > 0.75 ? 'text-emerald-400' : beatRate > 0.5 ? 'text-amber-400' : 'text-red-400'
            )}>
              {(beatRate * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      <div className="glass-card-heavy rounded-lg p-3 border border-white/5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <p className="text-[10px] text-white/30">IMPLICATION</p>
        </div>
        <p className="text-xs text-white/60">{implication}</p>
      </div>
    </div>
  )
}
