'use client'

import { Info, Loader2, RefreshCw, Waves, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IVAnalysisResponse } from '@/lib/api/ai-coach'

interface IVDashboardProps {
  profile: IVAnalysisResponse | null
  isLoading?: boolean
  error?: string | null
  onRefresh?: () => void
}

function formatPct(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return `${value.toFixed(1)}%`
}

function formatIv(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return `${value.toFixed(2)}`
}

export function IVDashboard({
  profile,
  isLoading,
  error,
  onRefresh,
}: IVDashboardProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-3 rounded border border-blue-500/30 bg-blue-500/10 p-2.5 text-[11px] text-blue-100/90">
        <div className="mb-1 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-blue-300" />
          <span className="font-medium">Implied Volatility Guide</span>
        </div>
        <ul className="space-y-0.5 text-blue-100/75">
          <li><strong>IV Rank:</strong> Position of current IV inside the 52-week range.</li>
          <li><strong>Term Structure:</strong> IV by expiration; steep curves imply event risk.</li>
          <li><strong>Skew:</strong> Put-vs-call demand imbalance (fear vs upside chase).</li>
        </ul>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Waves className="h-3.5 w-3.5 text-violet-300" />
          <h4 className="text-xs font-medium text-white">IV Intelligence</h4>
          {profile?.termStructure?.shape && (
            <span className={cn(
              'rounded px-1.5 py-0.5 text-[10px]',
              profile.termStructure.shape === 'backwardation'
                ? 'bg-red-500/15 text-red-300'
                : profile.termStructure.shape === 'contango'
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-white/10 text-white/55'
            )}>
              {profile.termStructure.shape}
            </span>
          )}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={!!isLoading}
            className="rounded p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-violet-300 disabled:opacity-40"
            title="Refresh IV analysis"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </button>
        )}
      </div>

      {error && (
        <p className="mb-2 text-[11px] text-amber-400">{error}</p>
      )}

      {isLoading && !profile && (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
        </div>
      )}

      {profile && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded border border-white/10 bg-black/20 p-2">
              <p className="mb-1 text-white/50">Current IV</p>
              <p className="font-medium text-white">{formatIv(profile.ivRank.currentIV)}</p>
              <p className="text-white/45">Rank {formatPct(profile.ivRank.ivRank)}</p>
            </div>
            <div className="rounded border border-white/10 bg-black/20 p-2">
              <p className="mb-1 text-white/50">Skew</p>
              <p className="font-medium text-white">{formatIv(profile.skew.skew25delta)}</p>
              <p className="text-white/45">{profile.skew.skewDirection.replace('_', ' ')}</p>
            </div>
          </div>

          <div className="rounded border border-white/10 bg-black/20 p-2 text-[11px]">
            <p className="mb-1 text-white/50">Term Structure</p>
            <div className="space-y-1">
              {profile.termStructure.expirations.slice(0, 3).map((point) => (
                <div key={point.date} className="flex items-center justify-between text-white/70">
                  <span>{point.date} ({point.dte}d)</span>
                  <span>{formatIv(point.atmIV)}</span>
                </div>
              ))}
              {profile.termStructure.expirations.length === 0 && (
                <p className="text-white/45">No expirations available</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-white/45">
            {profile.ivRank.ivTrend === 'rising' ? (
              <TrendingUp className="h-3 w-3 text-red-300" />
            ) : profile.ivRank.ivTrend === 'falling' ? (
              <TrendingDown className="h-3 w-3 text-emerald-300" />
            ) : null}
            Trend: <span className="text-white/70">{profile.ivRank.ivTrend}</span>
          </div>
        </div>
      )}
    </div>
  )
}
