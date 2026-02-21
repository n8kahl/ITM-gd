import type { CoachDecisionBrief, Setup } from '@/lib/types/spx-command-center'

export const SPX_TRADE_JOURNAL_STORAGE_KEY = 'spx.command_center.trade_journal.v1'
export const SPX_TRADE_JOURNAL_EVENT = 'spx:trade-journal-updated'
const SPX_TRADE_JOURNAL_MAX_ITEMS = 240

export interface SPXTradeJournalArtifact {
  artifactId: string
  setupId: string | null
  setupType: Setup['type'] | null
  direction: Setup['direction'] | null
  regime: Setup['regime'] | null
  statusAtClose: Setup['status'] | null
  openedAt: string | null
  closedAt: string
  holdDurationMinutes: number | null
  entryPrice: number | null
  exitPrice: number | null
  pnlPoints: number | null
  pnlDollars: number | null
  contractDescription: string | null
  contractEntryMid: number | null
  contractExitMid: number | null
  decisionId: string | null
  decisionVerdict: CoachDecisionBrief['verdict'] | null
  adherenceScore: number
  expectancyR: number | null
  chartContext: {
    timeframe: string | null
    snapshotTag: string
  }
  riskContext: {
    stop: number | null
    target1: number | null
    target2: number | null
    confluenceScore: number | null
    probability: number | null
  }
}

export interface SPXTradeJournalSummary {
  totalTrades: number
  wins: number
  losses: number
  winRatePercent: number
  expectancyR: number | null
  averageAdherenceScore: number
  byRegime: Array<{ regime: string; total: number; winRatePercent: number }>
  byTimeBucket: Array<{ bucket: string; total: number; winRatePercent: number }>
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals))
}

function toEpoch(iso: string | null | undefined): number {
  if (!iso) return 0
  const parsed = Date.parse(iso)
  return Number.isFinite(parsed) ? parsed : 0
}

function timeBucket(iso: string): string {
  const epoch = Date.parse(iso)
  if (!Number.isFinite(epoch)) return 'unknown'
  const date = new Date(epoch)
  const hour = date.getUTCHours()
  if (hour < 13) return 'pre_open'
  if (hour < 16) return 'open_drive'
  if (hour < 19) return 'midday'
  if (hour < 21) return 'power_hour'
  return 'after_hours'
}

export function calculateSPXTradeAdherenceScore(input: {
  setup: Setup | null
  entryPrice: number | null
  exitPrice: number | null
  stop: number | null
  target1: number | null
  coachDecision?: CoachDecisionBrief | null
}): number {
  const { setup, entryPrice, exitPrice, stop, target1, coachDecision } = input
  let score = 55

  if (setup) {
    score += clamp(setup.confluenceScore * 5, 0, 25)
    score += clamp((setup.probability - 50) * 0.3, 0, 12)
  }

  if (entryPrice != null && stop != null && target1 != null) {
    const risk = Math.abs(entryPrice - stop)
    const reward = Math.abs(target1 - entryPrice)
    if (risk > 0) {
      const rr = reward / risk
      score += clamp(rr * 8, 0, 16)
    }
  }

  if (coachDecision?.severity === 'critical') score -= 18
  if (coachDecision?.severity === 'warning') score -= 8

  if (entryPrice != null && exitPrice != null && setup) {
    const pnl = setup.direction === 'bullish' ? (exitPrice - entryPrice) : (entryPrice - exitPrice)
    if (pnl > 0) score += 6
    if (pnl < 0) score -= 6
  }

  return Math.round(clamp(score, 5, 99))
}

export function createSPXTradeJournalArtifact(input: {
  setup: Setup | null
  openedAt: string | null
  closedAt?: string
  entryPrice: number | null
  exitPrice: number | null
  pnlPoints: number | null
  pnlDollars: number | null
  contractDescription: string | null
  contractEntryMid: number | null
  contractExitMid: number | null
  timeframe: string | null
  coachDecision?: CoachDecisionBrief | null
}): SPXTradeJournalArtifact {
  const setup = input.setup
  const closedAt = input.closedAt || new Date().toISOString()
  const openedEpoch = toEpoch(input.openedAt)
  const closedEpoch = toEpoch(closedAt)
  const holdDurationMinutes = openedEpoch > 0 && closedEpoch > openedEpoch
    ? Math.max(Math.round((closedEpoch - openedEpoch) / 60_000), 1)
    : null
  const adherenceScore = calculateSPXTradeAdherenceScore({
    setup,
    entryPrice: input.entryPrice,
    exitPrice: input.exitPrice,
    stop: setup?.stop ?? null,
    target1: setup?.target1.price ?? null,
    coachDecision: input.coachDecision,
  })
  const riskUnit = (
    input.entryPrice != null
    && setup?.stop != null
    && Number.isFinite(input.entryPrice)
    && Number.isFinite(setup.stop)
  )
    ? Math.max(Math.abs(input.entryPrice - setup.stop), 0.01)
    : null
  const expectancyR = riskUnit != null && input.pnlPoints != null
    ? round(input.pnlPoints / riskUnit, 3)
    : null

  return {
    artifactId: `spx_journal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    setupId: setup?.id || null,
    setupType: setup?.type || null,
    direction: setup?.direction || null,
    regime: setup?.regime || null,
    statusAtClose: setup?.status || null,
    openedAt: input.openedAt,
    closedAt,
    holdDurationMinutes,
    entryPrice: input.entryPrice != null ? round(input.entryPrice) : null,
    exitPrice: input.exitPrice != null ? round(input.exitPrice) : null,
    pnlPoints: input.pnlPoints != null ? round(input.pnlPoints) : null,
    pnlDollars: input.pnlDollars != null ? round(input.pnlDollars) : null,
    contractDescription: input.contractDescription,
    contractEntryMid: input.contractEntryMid != null ? round(input.contractEntryMid, 3) : null,
    contractExitMid: input.contractExitMid != null ? round(input.contractExitMid, 3) : null,
    decisionId: input.coachDecision?.decisionId || null,
    decisionVerdict: input.coachDecision?.verdict || null,
    adherenceScore,
    expectancyR,
    chartContext: {
      timeframe: input.timeframe,
      snapshotTag: `${setup?.id || 'global'}:${closedAt.slice(0, 19)}`,
    },
    riskContext: {
      stop: setup?.stop ?? null,
      target1: setup?.target1.price ?? null,
      target2: setup?.target2.price ?? null,
      confluenceScore: setup?.confluenceScore ?? null,
      probability: setup?.probability ?? null,
    },
  }
}

function safeParseArtifacts(raw: string | null): SPXTradeJournalArtifact[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is SPXTradeJournalArtifact => (
      item
      && typeof item === 'object'
      && typeof (item as SPXTradeJournalArtifact).artifactId === 'string'
      && typeof (item as SPXTradeJournalArtifact).closedAt === 'string'
    ))
  } catch {
    return []
  }
}

export function loadSPXTradeJournalArtifacts(): SPXTradeJournalArtifact[] {
  if (typeof window === 'undefined') return []
  return safeParseArtifacts(window.localStorage.getItem(SPX_TRADE_JOURNAL_STORAGE_KEY))
}

export function persistSPXTradeJournalArtifact(artifact: SPXTradeJournalArtifact): SPXTradeJournalArtifact[] {
  if (typeof window === 'undefined') return [artifact]
  const existing = loadSPXTradeJournalArtifacts()
  const deduped = [artifact, ...existing.filter((item) => item.artifactId !== artifact.artifactId)]
    .slice(0, SPX_TRADE_JOURNAL_MAX_ITEMS)
    .sort((a, b) => toEpoch(b.closedAt) - toEpoch(a.closedAt))
  window.localStorage.setItem(SPX_TRADE_JOURNAL_STORAGE_KEY, JSON.stringify(deduped))
  window.dispatchEvent(new CustomEvent(SPX_TRADE_JOURNAL_EVENT, { detail: { latestArtifactId: artifact.artifactId } }))
  return deduped
}

export function summarizeSPXTradeJournalArtifacts(artifacts: SPXTradeJournalArtifact[]): SPXTradeJournalSummary {
  const totalTrades = artifacts.length
  const wins = artifacts.filter((artifact) => (artifact.pnlPoints ?? 0) > 0).length
  const losses = artifacts.filter((artifact) => (artifact.pnlPoints ?? 0) < 0).length
  const averageAdherenceScore = totalTrades > 0
    ? round(artifacts.reduce((sum, artifact) => sum + artifact.adherenceScore, 0) / totalTrades, 1)
    : 0
  const expectancyValues = artifacts
    .map((artifact) => artifact.expectancyR)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const expectancyR = expectancyValues.length > 0
    ? round(expectancyValues.reduce((sum, value) => sum + value, 0) / expectancyValues.length, 3)
    : null

  const byRegimeMap = new Map<string, { total: number; wins: number }>()
  const byTimeBucketMap = new Map<string, { total: number; wins: number }>()

  for (const artifact of artifacts) {
    const regimeKey = artifact.regime || 'unknown'
    const regimeEntry = byRegimeMap.get(regimeKey) || { total: 0, wins: 0 }
    regimeEntry.total += 1
    if ((artifact.pnlPoints ?? 0) > 0) regimeEntry.wins += 1
    byRegimeMap.set(regimeKey, regimeEntry)

    const bucketKey = timeBucket(artifact.closedAt)
    const bucketEntry = byTimeBucketMap.get(bucketKey) || { total: 0, wins: 0 }
    bucketEntry.total += 1
    if ((artifact.pnlPoints ?? 0) > 0) bucketEntry.wins += 1
    byTimeBucketMap.set(bucketKey, bucketEntry)
  }

  return {
    totalTrades,
    wins,
    losses,
    winRatePercent: totalTrades > 0 ? round((wins / totalTrades) * 100, 1) : 0,
    expectancyR,
    averageAdherenceScore,
    byRegime: Array.from(byRegimeMap.entries())
      .map(([regime, stats]) => ({
        regime,
        total: stats.total,
        winRatePercent: stats.total > 0 ? round((stats.wins / stats.total) * 100, 1) : 0,
      }))
      .sort((a, b) => b.total - a.total),
    byTimeBucket: Array.from(byTimeBucketMap.entries())
      .map(([bucket, stats]) => ({
        bucket,
        total: stats.total,
        winRatePercent: stats.total > 0 ? round((stats.wins / stats.total) * 100, 1) : 0,
      }))
      .sort((a, b) => b.total - a.total),
  }
}
