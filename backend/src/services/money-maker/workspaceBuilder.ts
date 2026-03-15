import { cacheGet, cacheSet } from '../../config/redis'
import { supabase } from '../../config/database'
import { logger } from '../../lib/logger'
import { MoneyMakerWorkspaceResponse, MoneyMakerContractCandidate } from '../../lib/money-maker/types'
import { buildContractGuide } from './contractGuideBuilder'
import { buildExecutionPlan } from './executionPlanBuilder'
import { buildSnapshot } from './snapshotBuilder'
import { fetchExpirationDates, fetchOptionsChain } from '../options/optionsChainFetcher'
import { toEasternTime } from '../marketHours'

const WORKSPACE_CACHE_TTL_SECONDS = 8
const CONTRACT_CHAIN_STRIKE_RANGE = 12
const MAX_WORKSPACE_EXPIRATIONS = 4

interface BuildWorkspaceParams {
  symbol: string
  userId: string
}

function getWorkspaceCacheKey(userId: string, symbol: string): string {
  return `money_maker_workspace:${userId}:${symbol.toUpperCase()}`
}

function dayDifference(expiry: string, now: Date): number {
  const todayEt = toEasternTime(now).dateStr
  const start = Date.parse(`${todayEt}T00:00:00Z`)
  const end = Date.parse(`${expiry}T00:00:00Z`)

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return Number.POSITIVE_INFINITY
  }

  return Math.round((end - start) / 86_400_000)
}

function selectWorkspaceExpirations(expirations: string[], now: Date): string[] {
  const futureExpirations = expirations
    .map((expiry) => ({
      expiry,
      dayOffset: dayDifference(expiry, now),
    }))
    .filter((row) => row.dayOffset >= 2 && row.dayOffset <= 14)
    .sort((left, right) => left.dayOffset - right.dayOffset)
    .slice(0, MAX_WORKSPACE_EXPIRATIONS)
    .map((row) => row.expiry)

  if (futureExpirations.length > 0) {
    return futureExpirations
  }

  return expirations
    .map((expiry) => ({
      expiry,
      dayOffset: dayDifference(expiry, now),
    }))
    .filter((row) => row.dayOffset >= 2 && row.dayOffset <= 21)
    .sort((left, right) => left.dayOffset - right.dayOffset)
    .slice(0, MAX_WORKSPACE_EXPIRATIONS)
    .map((row) => row.expiry)
}

async function fetchWorkspaceChains(symbol: string, now: Date) {
  const expirations = await fetchExpirationDates(symbol, {
    maxDaysAhead: 21,
    maxPages: 4,
  })
  const targetExpirations = selectWorkspaceExpirations(expirations, now)

  return Promise.all(
    targetExpirations.map((expiry) => fetchOptionsChain(symbol, expiry, CONTRACT_CHAIN_STRIKE_RANGE)),
  )
}

async function persistWorkspaceSnapshot(
  userId: string,
  workspace: MoneyMakerWorkspaceResponse,
): Promise<void> {
  if (!workspace.executionPlan) {
    return
  }

  const signal = workspace.activeSignal
  const direction = signal?.direction
    ?? (workspace.executionPlan.target1 >= workspace.executionPlan.entry ? 'long' : 'short')

  const { data, error } = await supabase
    .from('money_maker_guidance_snapshots')
    .insert({
      user_id: userId,
      signal_id: workspace.activeSignal?.id ?? null,
      symbol: workspace.symbolSnapshot.symbol,
      direction,
      execution_state: workspace.executionPlan.executionState,
      entry_price: workspace.executionPlan.entry,
      stop_price: workspace.executionPlan.stop,
      target1_price: workspace.executionPlan.target1,
      target2_price: workspace.executionPlan.target2,
      entry_quality: workspace.executionPlan.entryQuality,
      time_warning: workspace.executionPlan.timeWarning,
      plan_json: {
        symbolSnapshot: workspace.symbolSnapshot,
        activeSignal: workspace.activeSignal,
        executionPlan: workspace.executionPlan,
        degradedReason: workspace.degradedReason,
        generatedAt: workspace.generatedAt,
      },
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw error ?? new Error('Failed to persist money maker guidance snapshot')
  }

  if (workspace.contracts.length === 0) {
    return
  }

  const contractRows = workspace.contracts.map((contract: MoneyMakerContractCandidate) => ({
    guidance_snapshot_id: data.id,
    candidate_label: contract.label,
    option_symbol: contract.optionSymbol,
    expiry: contract.expiry,
    strike: contract.strike,
    option_type: contract.type,
    bid: contract.bid,
    ask: contract.ask,
    mid: contract.mid,
    spread_pct: contract.spreadPct,
    delta: contract.delta,
    theta: contract.theta,
    implied_volatility: contract.impliedVolatility,
    open_interest: contract.openInterest,
    volume: contract.volume,
    premium_per_contract: contract.premiumPerContract,
    quality: contract.quality,
    explanation: contract.explanation,
  }))

  const { error: contractsError } = await supabase
    .from('money_maker_contract_guidance')
    .insert(contractRows)

  if (contractsError) {
    throw contractsError
  }
}

export async function buildWorkspace({
  symbol,
  userId,
}: BuildWorkspaceParams): Promise<MoneyMakerWorkspaceResponse> {
  const cacheKey = getWorkspaceCacheKey(userId, symbol)
  const cached = await cacheGet<MoneyMakerWorkspaceResponse>(cacheKey)
  if (cached) {
    return cached
  }

  const now = new Date()
  const snapshot = await buildSnapshot([symbol], userId)
  const symbolSnapshot = snapshot.symbolSnapshots.find((entry) => entry.symbol === symbol)

  if (!symbolSnapshot) {
    throw new Error(`Unable to build Money Maker workspace for ${symbol}`)
  }

  const activeSignal = snapshot.signals.find((entry) => entry.symbol === symbol) ?? null
  const executionPlan = buildExecutionPlan({
    signal: activeSignal,
    symbolSnapshot,
    currentTimestamp: now.getTime(),
  })

  let contracts: MoneyMakerContractCandidate[] = []
  let degradedReason: string | null = executionPlan
    ? null
    : 'No active Money Maker signal is available for this symbol right now.'

  if (executionPlan) {
    try {
      const chains = await fetchWorkspaceChains(symbol, now)
      const guide = buildContractGuide({
        executionPlan,
        chains,
      })
      contracts = guide.contracts
      degradedReason = guide.degradedReason
    } catch (error) {
      degradedReason = 'Options data is temporarily unavailable. The underlying execution plan is still valid.'
      logger.warn('Money Maker workspace contract guidance degraded', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const workspace: MoneyMakerWorkspaceResponse = {
    symbolSnapshot,
    activeSignal,
    executionPlan,
    contracts,
    generatedAt: now.getTime(),
    degradedReason,
  }

  await cacheSet(cacheKey, workspace, WORKSPACE_CACHE_TTL_SECONDS)

  if (executionPlan) {
    try {
      await persistWorkspaceSnapshot(userId, workspace)
    } catch (error) {
      logger.warn('Money Maker workspace persistence failed', {
        symbol,
        userId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return workspace
}
