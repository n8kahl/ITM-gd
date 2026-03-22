'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Analytics } from '@/lib/analytics'
import { useMarketIndices, useMarketStatus } from '@/hooks/useMarketData'
import {
  formatAICoachAgeLabel,
  formatAICoachAsOfEt,
  formatAICoachFreshnessLabel,
  pushAICoachMarketTelemetry,
  resolveAICoachMarketFreshnessStatus,
  type AICoachMarketSnapshot,
} from '@/lib/ai-coach/market-snapshot'

interface TelemetryState {
  freshnessStatus: AICoachMarketSnapshot['freshnessStatus']
  source: string | null
  marketStatus: string | null
  isStale: boolean
}

function resolveErrorMessage(error: unknown): string | null {
  if (!error) return null
  if (error instanceof Error && error.message.trim().length > 0) return error.message.trim()
  return 'Market snapshot unavailable'
}

export function useAICoachMarketSnapshot(): AICoachMarketSnapshot {
  const [nowEpochMs, setNowEpochMs] = useState(() => Date.now())
  const {
    indices,
    source,
    generatedAt,
    isLoading: isLoadingIndices,
    isError: indicesError,
    refresh: refreshIndices,
  } = useMarketIndices()
  const { status, isLoading: isLoadingStatus, isError: statusError, refresh: refreshStatus } = useMarketStatus()
  const telemetryStateRef = useRef<TelemetryState | null>(null)

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      setNowEpochMs(Date.now())
    }, 15_000)
    return () => window.clearInterval(interval)
  }, [])

  const spxQuote = useMemo(() => {
    return indices.find((quote) => quote.symbol === 'SPX') || null
  }, [indices])

  const generatedAtEpochMs = useMemo(() => {
    if (!generatedAt) return null
    const parsed = Date.parse(generatedAt)
    return Number.isFinite(parsed) ? parsed : null
  }, [generatedAt])

  const ageMs = useMemo(() => {
    if (generatedAtEpochMs == null) return null
    return Math.max(nowEpochMs - generatedAtEpochMs, 0)
  }, [generatedAtEpochMs, nowEpochMs])

  const freshnessStatus = resolveAICoachMarketFreshnessStatus({
    marketStatus: status?.status || null,
    source: source || null,
    ageMs,
  })

  const refresh = useCallback(async () => {
    await Promise.all([
      refreshIndices(),
      refreshStatus(),
    ])
  }, [refreshIndices, refreshStatus])

  const snapshot = useMemo<AICoachMarketSnapshot>(() => {
    const resolvedSource = source || null
    const resolvedMarketStatus = status?.status || null
    const resolvedMarketSession = status?.session || null
    const resolvedMarketMessage = status?.message || null
    const resolvedError = resolveErrorMessage(indicesError) || resolveErrorMessage(statusError)

    return {
      price: spxQuote ? Number(spxQuote.price.toFixed(2)) : null,
      change: spxQuote ? Number(spxQuote.change.toFixed(2)) : null,
      changePct: spxQuote ? Number(spxQuote.changePercent.toFixed(2)) : null,
      source: resolvedSource,
      marketStatus: resolvedMarketStatus,
      marketSession: resolvedMarketSession,
      marketMessage: resolvedMarketMessage,
      asOfEt: formatAICoachAsOfEt(generatedAtEpochMs),
      updatedAtMs: generatedAtEpochMs,
      ageMs,
      freshnessStatus,
      freshnessLabel: formatAICoachFreshnessLabel(freshnessStatus),
      freshnessDetail: formatAICoachAgeLabel(ageMs),
      isStale: freshnessStatus === 'stale',
      isLoading: isLoadingIndices || isLoadingStatus,
      error: resolvedError,
      refresh,
    }
  }, [
    ageMs,
    freshnessStatus,
    generatedAtEpochMs,
    indicesError,
    isLoadingIndices,
    isLoadingStatus,
    refresh,
    source,
    spxQuote,
    status?.message,
    status?.session,
    status?.status,
    statusError,
  ])

  useEffect(() => {
    const currentState: TelemetryState = {
      freshnessStatus: snapshot.freshnessStatus,
      source: snapshot.source,
      marketStatus: snapshot.marketStatus,
      isStale: snapshot.isStale,
    }
    const previousState = telemetryStateRef.current

    if (
      previousState
      && previousState.freshnessStatus === currentState.freshnessStatus
      && previousState.source === currentState.source
      && previousState.marketStatus === currentState.marketStatus
    ) {
      return
    }

    const becameStale = currentState.isStale && !previousState?.isStale
    const recoveredFromStale = !currentState.isStale && Boolean(previousState?.isStale)
    const shouldPersist = becameStale || recoveredFromStale

    if (becameStale) {
      Analytics.trackAICoachAction('market_snapshot_stale')
    } else if (recoveredFromStale) {
      Analytics.trackAICoachAction('market_snapshot_recovered')
    }

    pushAICoachMarketTelemetry({
      freshnessStatus: currentState.freshnessStatus,
      source: currentState.source,
      marketStatus: currentState.marketStatus,
      ageMs: snapshot.ageMs,
      asOfEt: snapshot.asOfEt,
      stale: currentState.isStale,
    }, {
      persist: shouldPersist,
    })

    telemetryStateRef.current = currentState
  }, [
    snapshot.ageMs,
    snapshot.asOfEt,
    snapshot.freshnessStatus,
    snapshot.isStale,
    snapshot.marketStatus,
    snapshot.source,
  ])

  return snapshot
}
