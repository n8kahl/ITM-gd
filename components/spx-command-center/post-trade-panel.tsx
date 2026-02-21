'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  SPX_TRADE_JOURNAL_EVENT,
  loadSPXTradeJournalArtifacts,
  summarizeSPXTradeJournalArtifacts,
  type SPXTradeJournalArtifact,
} from '@/lib/spx/trade-journal-capture'
import { cn } from '@/lib/utils'

function pnlTone(value: number | null): string {
  if (value == null) return 'text-white/70'
  if (value > 0) return 'text-emerald-200'
  if (value < 0) return 'text-rose-200'
  return 'text-white/72'
}

export function PostTradePanel({ compact = false }: { compact?: boolean }) {
  const [artifacts, setArtifacts] = useState<SPXTradeJournalArtifact[]>([])

  useEffect(() => {
    const sync = () => setArtifacts(loadSPXTradeJournalArtifacts().slice(0, 12))
    sync()
    window.addEventListener(SPX_TRADE_JOURNAL_EVENT, sync as EventListener)
    return () => {
      window.removeEventListener(SPX_TRADE_JOURNAL_EVENT, sync as EventListener)
    }
  }, [])

  const summary = useMemo(() => summarizeSPXTradeJournalArtifacts(artifacts), [artifacts])
  const latest = artifacts.slice(0, compact ? 3 : 6)

  return (
    <section
      className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5"
      data-testid="spx-post-trade-panel"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[10px] uppercase tracking-[0.1em] text-white/55">Post-Trade Analytics</h3>
        <span className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-white/72">
          {summary.totalTrades} logged
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded border border-white/12 bg-white/[0.03] px-2 py-1.5">
          <p className="text-white/45">Win rate</p>
          <p className="font-mono text-white/88">{summary.winRatePercent.toFixed(1)}%</p>
        </div>
        <div className="rounded border border-white/12 bg-white/[0.03] px-2 py-1.5">
          <p className="text-white/45">Expectancy R</p>
          <p className="font-mono text-white/88">{summary.expectancyR != null ? summary.expectancyR.toFixed(3) : '--'}</p>
        </div>
        <div className="rounded border border-white/12 bg-white/[0.03] px-2 py-1.5">
          <p className="text-white/45">Adherence</p>
          <p className="font-mono text-white/88">{summary.averageAdherenceScore.toFixed(1)}</p>
        </div>
        <div className="rounded border border-white/12 bg-white/[0.03] px-2 py-1.5">
          <p className="text-white/45">W/L</p>
          <p className="font-mono text-white/88">{summary.wins}/{summary.losses}</p>
        </div>
      </div>

      <div className={cn('mt-2.5 space-y-1.5', compact && 'max-h-[180px] overflow-auto')}>
        {latest.length === 0 ? (
          <p className="text-[10px] text-white/42">Trade exits will auto-capture here.</p>
        ) : latest.map((artifact) => (
          <div key={artifact.artifactId} className="rounded border border-white/12 bg-white/[0.03] px-2 py-1.5 text-[10px]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-white/72">
                {(artifact.setupType || 'setup').replace(/_/g, ' ')} · {artifact.direction || 'n/a'}
              </p>
              <p className={cn('font-mono', pnlTone(artifact.pnlPoints))}>
                {artifact.pnlPoints == null ? '--' : `${artifact.pnlPoints >= 0 ? '+' : ''}${artifact.pnlPoints.toFixed(1)}pt`}
              </p>
            </div>
            <div className="mt-0.5 flex items-center justify-between text-white/48">
              <span>{artifact.regime || 'unknown'} · {artifact.chartContext.timeframe || '--'}</span>
              <span>adh {artifact.adherenceScore}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
