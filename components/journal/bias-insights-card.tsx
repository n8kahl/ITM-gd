'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Brain, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import type { BiasAnalysisResult, BiasSignal } from '@/lib/journal/bias-detector'

/**
 * Bias Insights Card
 *
 * Displays detected cognitive biases from the user's trading history.
 * Shows confidence level, evidence, and actionable recommendations.
 *
 * Spec: TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md — Phase 3, Slice 3D
 */

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'text-red-400 border-red-500/30 bg-red-500/10',
  medium: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  low: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
}

function confidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.7) return 'high'
  if (confidence >= 0.4) return 'medium'
  return 'low'
}

function BiasSignalRow({ signal }: { signal: BiasSignal }) {
  const [expanded, setExpanded] = useState(false)
  const level = confidenceLevel(signal.confidence)
  const colorClass = CONFIDENCE_COLORS[level]

  return (
    <div className={`rounded-md border p-3 ${colorClass}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
        <div className="flex-1">
          <span className="text-xs font-medium">{signal.label}</span>
          <span className="ml-2 text-[11px] opacity-70">
            ({Math.round(signal.confidence * 100)}% confidence)
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 opacity-50" strokeWidth={1.5} />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 opacity-50" strokeWidth={1.5} />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 text-[11px]">
          <p className="opacity-80">{signal.description}</p>
          <div className="rounded bg-black/20 p-2">
            <p className="font-medium opacity-60">Evidence</p>
            <p className="opacity-80">{signal.evidence}</p>
          </div>
          <div className="rounded bg-black/20 p-2">
            <p className="font-medium text-emerald-400">Recommendation</p>
            <p className="opacity-80">{signal.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export function BiasInsightsCard() {
  const [result, setResult] = useState<BiasAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBiases = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/members/journal/biases?period=90d', { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? `Request failed (${response.status})`)
      }

      const payload = await response.json()
      if (!payload.success) throw new Error(payload.error ?? 'Failed to analyze biases')

      setResult(payload.data as BiasAnalysisResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bias analysis')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBiases()
  }, [loadBiases])

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-amber-400" strokeWidth={1.5} />
          <h3 className="text-sm font-medium text-ivory">Cognitive Bias Analysis</h3>
        </div>
        <button
          type="button"
          onClick={() => void loadBiases()}
          disabled={loading}
          className="rounded-md p-1 text-white/40 transition-colors hover:text-white/60 disabled:opacity-40"
          aria-label="Refresh bias analysis"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
        </button>
      </div>

      {loading && !result ? (
        <div className="py-4 text-center text-xs text-white/50">
          Analyzing your trading patterns...
        </div>
      ) : error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : result && result.signals.length === 0 ? (
        <p className="text-xs text-white/50">
          No significant biases detected across {result.tradeCount} trades ({result.analyzedPeriod}).
        </p>
      ) : result ? (
        <div className="space-y-2">
          <p className="text-[11px] text-white/40">
            {result.signals.length} pattern{result.signals.length !== 1 ? 's' : ''} detected across {result.tradeCount} trades
          </p>
          {result.signals.map((signal: BiasSignal) => (
            <BiasSignalRow key={signal.type} signal={signal} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
