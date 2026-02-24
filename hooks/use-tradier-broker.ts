'use client'

import { useCallback, useMemo, useState } from 'react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { postSPX, SPXRequestError, useSPXQuery } from '@/hooks/use-spx-api'

export type TradierExecutionMode = 'off' | 'manual' | 'auto'

export interface TradierCredentialStatus {
  configured: boolean
  isActive?: boolean
  accountIdMasked?: string
  sandbox?: boolean
  autoExecute?: boolean
  updatedAt?: string
}

export interface TradierPortfolioSnapshot {
  snapshot_time: string
  total_equity: number
  day_trade_buying_power: number
  realized_pnl_daily: number
}

export interface TradierExecutionRuntime {
  enabled: boolean
  reason: string | null
  sandboxDefault: boolean
  metadataRequired: boolean
  trackedTrades: number
}

export interface TradierPortfolioSyncRuntime {
  enabled: boolean
  reason: string | null
}

export interface TradierBrokerStatus {
  broker: 'tradier'
  credential: TradierCredentialStatus
  latestPortfolioSnapshot: TradierPortfolioSnapshot | null
  runtime: {
    execution: TradierExecutionRuntime
    portfolioSync: TradierPortfolioSyncRuntime
  }
}

const TRADIER_STATUS_BASE_REFRESH_MS = 15_000
const TRADIER_STATUS_MAX_BACKOFF_MS = 5 * 60 * 1000
const TRADIER_STATUS_MISSING_ENDPOINT_BACKOFF_MS = 20 * 60 * 1000

let tradierStatusConsecutiveFailures = 0
let tradierStatusCooldownUntilMs = 0

function getTradierStatusRefreshInterval(): number {
  const now = Date.now()
  if (tradierStatusCooldownUntilMs > now) {
    return Math.max(tradierStatusCooldownUntilMs - now, TRADIER_STATUS_BASE_REFRESH_MS)
  }
  return TRADIER_STATUS_BASE_REFRESH_MS
}

function markTradierStatusFailure(error: Error): void {
  if (error instanceof SPXRequestError && (error.status === 404 || error.status === 405)) {
    tradierStatusConsecutiveFailures = 0
    tradierStatusCooldownUntilMs = Date.now() + TRADIER_STATUS_MISSING_ENDPOINT_BACKOFF_MS
    return
  }

  tradierStatusConsecutiveFailures = Math.min(tradierStatusConsecutiveFailures + 1, 6)
  const delay = Math.min(
    TRADIER_STATUS_BASE_REFRESH_MS * (2 ** Math.max(tradierStatusConsecutiveFailures - 1, 0)),
    TRADIER_STATUS_MAX_BACKOFF_MS,
  )
  tradierStatusCooldownUntilMs = Date.now() + delay
}

function clearTradierStatusFailureState(): void {
  tradierStatusConsecutiveFailures = 0
  tradierStatusCooldownUntilMs = 0
}

export function useTradierBroker() {
  const { session } = useMemberAuth()
  const [modeError, setModeError] = useState<string | null>(null)
  const [isSettingMode, setIsSettingMode] = useState(false)
  const [killError, setKillError] = useState<string | null>(null)
  const [isKilling, setIsKilling] = useState(false)

  const statusQuery = useSPXQuery<TradierBrokerStatus>('/api/spx/broker/tradier/status', {
    refreshInterval: () => getTradierStatusRefreshInterval(),
    revalidateOnFocus: false,
    errorRetryCount: 0,
    onError: markTradierStatusFailure,
    onSuccess: clearTradierStatusFailureState,
  })

  const status = statusQuery.data || null

  const isConnected = useMemo(() => {
    if (!status?.credential) return false
    return status.credential.configured && status.credential.isActive === true
  }, [status])

  const isSandbox = useMemo(() => {
    return status?.credential?.sandbox ?? true
  }, [status])

  const executionMode: TradierExecutionMode = useMemo(() => {
    if (!isConnected) return 'off'
    if (!status?.runtime.execution.enabled) return 'off'
    if (status.credential.autoExecute) return 'auto'
    return 'manual'
  }, [isConnected, status])

  const portfolio = useMemo(() => {
    const snap = status?.latestPortfolioSnapshot
    if (!snap) return null
    return {
      totalEquity: snap.total_equity,
      dayTradeBuyingPower: snap.day_trade_buying_power,
      realizedPnlDaily: snap.realized_pnl_daily,
      snapshotTime: snap.snapshot_time,
    }
  }, [status])

  const setExecutionMode = useCallback(async (mode: TradierExecutionMode) => {
    const token = session?.access_token
    if (!token) throw new Error('Session unavailable')

    setIsSettingMode(true)
    setModeError(null)
    try {
      await postSPX('/api/spx/broker/tradier/mode', token, { mode })
      await statusQuery.mutate()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set execution mode'
      setModeError(message)
      throw error
    } finally {
      setIsSettingMode(false)
    }
  }, [session?.access_token, statusQuery])

  const killAll = useCallback(async () => {
    const token = session?.access_token
    if (!token) throw new Error('Session unavailable')

    setIsKilling(true)
    setKillError(null)
    try {
      await postSPX('/api/spx/broker/tradier/kill', token, {})
      await statusQuery.mutate()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kill switch failed'
      setKillError(message)
      throw error
    } finally {
      setIsKilling(false)
    }
  }, [session?.access_token, statusQuery])

  const testBalance = useCallback(async () => {
    const token = session?.access_token
    if (!token) throw new Error('Session unavailable')
    return postSPX<{ sandbox: boolean; balances: Record<string, unknown> }>(
      '/api/spx/broker/tradier/test-balance',
      token,
      {},
    )
  }, [session?.access_token])

  return {
    status,
    isConnected,
    isSandbox,
    executionMode,
    portfolio,
    isLoading: statusQuery.isLoading,
    error: statusQuery.error,
    isSettingMode,
    modeError,
    isKilling,
    killError,
    setExecutionMode,
    killAll,
    testBalance,
    refresh: statusQuery.mutate,
  }
}
