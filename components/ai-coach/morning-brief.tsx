'use client'

import { useCallback, useEffect, useState } from 'react'
import { Sunrise, RefreshCw, Loader2, X, CheckCircle2 } from 'lucide-react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import {
  getMorningBrief,
  setMorningBriefViewed,
  AICoachAPIError,
  type MorningBrief,
} from '@/lib/api/ai-coach'
import { cn } from '@/lib/utils'

interface MorningBriefPanelProps {
  onClose: () => void
  onSendPrompt?: (prompt: string) => void
}

export function MorningBriefPanel({ onClose, onSendPrompt }: MorningBriefPanelProps) {
  const { session } = useMemberAuth()
  const token = session?.access_token

  const [brief, setBrief] = useState<MorningBrief | null>(null)
  const [marketDate, setMarketDate] = useState<string>('')
  const [viewed, setViewed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isMarkingViewed, setIsMarkingViewed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBrief = useCallback(async (force = false) => {
    if (!token) return

    if (force) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      const result = await getMorningBrief(token, { force })
      setBrief(result.brief)
      setMarketDate(result.marketDate)
      setViewed(result.viewed)
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to load morning brief.'
      setError(message)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    void loadBrief(false)
  }, [loadBrief, token])

  const handleMarkViewed = useCallback(async () => {
    if (!token) return
    setIsMarkingViewed(true)

    try {
      const result = await setMorningBriefViewed(token, true)
      setViewed(result.viewed)
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Unable to mark brief as viewed.'
      setError(message)
    } finally {
      setIsMarkingViewed(false)
    }
  }, [token])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
          <p className="text-sm text-white/60">Loading morning brief...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sunrise className="w-4 h-4 text-emerald-500" />
          <div>
            <h2 className="text-sm font-medium text-white">Morning Brief</h2>
            <p className="text-[11px] text-white/40">
              {marketDate || brief?.marketDate || 'Today'}
            </p>
          </div>
          {viewed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
              Viewed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadBrief(true)}
            disabled={isRefreshing}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-all',
              isRefreshing
                ? 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                : 'text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20'
            )}
          >
            {isRefreshing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Refresh
          </button>
          <button
            onClick={handleMarkViewed}
            disabled={viewed || isMarkingViewed}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-all',
              viewed || isMarkingViewed
                ? 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                : 'text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20'
            )}
          >
            {isMarkingViewed ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            Mark Viewed
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <section className="glass-card-heavy rounded-lg p-3 border border-white/5">
          <p className="text-[10px] text-white/35 uppercase tracking-wide mb-2">Summary</p>
          <p className="text-sm text-white/75 leading-relaxed">
            {brief?.aiSummary || 'No AI summary available yet.'}
          </p>
          {brief?.marketStatus?.message && (
            <p className="text-xs text-white/50 mt-2">
              Market Status: <span className="text-white/70">{brief.marketStatus.message}</span>
            </p>
          )}
        </section>

        <section className="glass-card-heavy rounded-lg p-3 border border-white/5">
          <p className="text-[10px] text-white/35 uppercase tracking-wide mb-2">Watchlist</p>
          <div className="flex flex-wrap gap-2">
            {(brief?.watchlist || []).map((symbol) => (
              <button
                key={symbol}
                onClick={() => onSendPrompt?.(`Show me key levels and current setup context for ${symbol}.`)}
                className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 text-xs hover:bg-emerald-500/20 transition-colors"
              >
                {symbol}
              </button>
            ))}
          </div>
        </section>

        <section className="glass-card-heavy rounded-lg p-3 border border-white/5">
          <p className="text-[10px] text-white/35 uppercase tracking-wide mb-2">Watch Items</p>
          <ul className="space-y-1.5">
            {(brief?.watchItems || []).map((item) => (
              <li key={item} className="text-xs text-white/70">
                - {item}
              </li>
            ))}
            {(brief?.watchItems || []).length === 0 && (
              <li className="text-xs text-white/40">No watch items generated yet.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}
