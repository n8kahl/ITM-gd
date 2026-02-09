'use client'

import { Loader2, RefreshCw, Gauge, Clock3, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ZeroDTEAnalysisResponse } from '@/lib/api/ai-coach'

interface ZeroDTEDashboardProps {
  analysis: ZeroDTEAnalysisResponse | null
  isLoading?: boolean
  error?: string | null
  onRefresh?: () => void
}

function formatPct(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return `${value.toFixed(1)}%`
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return `$${value.toFixed(2)}`
}

export function ZeroDTEDashboard({
  analysis,
  isLoading,
  error,
  onRefresh,
}: ZeroDTEDashboardProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 text-emerald-300" />
          <h4 className="text-xs font-medium text-white">0DTE Pulse</h4>
          {analysis?.hasZeroDTE ? (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">Active</span>
          ) : (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">Inactive</span>
          )}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={!!isLoading}
            className="rounded p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-emerald-300 disabled:opacity-40"
            title="Refresh 0DTE analytics"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </button>
        )}
      </div>

      {error && (
        <p className="mb-2 text-[11px] text-amber-400">{error}</p>
      )}

      {isLoading && !analysis && (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
        </div>
      )}

      {analysis && (
        <div className="space-y-2">
          <p className="text-[11px] text-white/55">{analysis.message}</p>

          {analysis.expectedMove && (
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded border border-white/10 bg-black/20 p-2">
                <div className="mb-1 flex items-center gap-1 text-white/50">
                  <Activity className="h-3 w-3" />
                  Expected Move
                </div>
                <p className="font-medium text-white">{formatMoney(analysis.expectedMove.totalExpectedMove)}</p>
                <p className="text-white/45">Remaining {formatPct(analysis.expectedMove.remainingPct)}</p>
              </div>
              <div className="rounded border border-white/10 bg-black/20 p-2">
                <div className="mb-1 flex items-center gap-1 text-white/50">
                  <Clock3 className="h-3 w-3" />
                  Session Clock
                </div>
                <p className="font-medium text-white">{analysis.expectedMove.minutesLeft} min left</p>
                <p className="text-white/45">Used {formatPct(analysis.expectedMove.usedPct)}</p>
              </div>
            </div>
          )}

          {analysis.gammaProfile && (
            <div className="rounded border border-white/10 bg-black/20 p-2 text-[11px]">
              <p className="mb-1 text-white/50">Gamma Risk</p>
              <p className={cn(
                'font-medium',
                analysis.gammaProfile.riskLevel === 'extreme' ? 'text-red-300'
                  : analysis.gammaProfile.riskLevel === 'high' ? 'text-amber-300'
                  : 'text-emerald-300'
              )}>
                {analysis.gammaProfile.riskLevel.toUpperCase()}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

