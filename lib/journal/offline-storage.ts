import type { JournalEntry } from '@/lib/types/journal'
import { sanitizeJournalEntries } from '@/lib/journal/sanitize-entry'

const JOURNAL_CACHE_KEY = 'journal-cache-v1'
const JOURNAL_MUTATION_QUEUE_KEY = 'journal-offline-mutations-v1'
const MAX_CACHE_ENTRIES = 500

export type OfflineJournalMutationMethod = 'POST' | 'PATCH'

export interface OfflineJournalMutation {
  id: string
  method: OfflineJournalMutationMethod
  queued_at: string
  payload: Record<string, unknown>
}

interface CachedJournalEntries {
  saved_at: string
  entries: JournalEntry[]
}

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeBoolean(value: unknown, fallback: boolean = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return fallback
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((tag) => normalizeString(tag))
    .filter((tag): tag is string => Boolean(tag))
}

function normalizeTradeDate(value: unknown, fallback: string): string {
  const candidate = normalizeString(value)
  if (!candidate) return fallback
  const parsed = Date.parse(candidate)
  if (Number.isNaN(parsed)) return fallback
  return new Date(parsed).toISOString()
}

function normalizeDirection(value: unknown): 'long' | 'short' | 'neutral' | null {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase().trim()
  if (normalized === 'long') return 'long'
  if (normalized === 'short') return 'short'
  if (normalized === 'neutral') return 'neutral'
  return null
}

function normalizeContractType(value: unknown): 'stock' | 'call' | 'put' | null {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase().trim()
  if (normalized === 'stock' || normalized === 'call' || normalized === 'put') {
    return normalized
  }
  return null
}

export function readCachedJournalEntries(): JournalEntry[] {
  if (!isBrowser()) return []
  const parsed = safeParse<CachedJournalEntries | null>(
    window.localStorage.getItem(JOURNAL_CACHE_KEY),
    null,
  )

  if (!parsed || !Array.isArray(parsed.entries)) return []
  return sanitizeJournalEntries(parsed.entries)
}

export function writeCachedJournalEntries(entries: JournalEntry[]): void {
  if (!isBrowser()) return
  const sanitized = sanitizeJournalEntries(entries)
  const payload: CachedJournalEntries = {
    saved_at: new Date().toISOString(),
    entries: sanitized.slice(0, MAX_CACHE_ENTRIES),
  }
  window.localStorage.setItem(JOURNAL_CACHE_KEY, JSON.stringify(payload))
}

export function readOfflineJournalMutations(): OfflineJournalMutation[] {
  if (!isBrowser()) return []
  const parsed = safeParse<OfflineJournalMutation[]>(
    window.localStorage.getItem(JOURNAL_MUTATION_QUEUE_KEY),
    [],
  )
  if (!Array.isArray(parsed)) return []
  return parsed.filter((mutation) => (
    mutation
    && typeof mutation.id === 'string'
    && (mutation.method === 'POST' || mutation.method === 'PATCH')
    && typeof mutation.queued_at === 'string'
    && mutation.payload
    && typeof mutation.payload === 'object'
  ))
}

export function writeOfflineJournalMutations(mutations: OfflineJournalMutation[]): void {
  if (!isBrowser()) return
  window.localStorage.setItem(JOURNAL_MUTATION_QUEUE_KEY, JSON.stringify(mutations))
}

export function enqueueOfflineJournalMutation(
  method: OfflineJournalMutationMethod,
  payload: Record<string, unknown>,
): OfflineJournalMutation {
  const mutation: OfflineJournalMutation = {
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    method,
    queued_at: new Date().toISOString(),
    payload,
  }

  const queue = readOfflineJournalMutations()
  queue.push(mutation)
  writeOfflineJournalMutations(queue)
  return mutation
}

export function getPendingOfflineJournalEntries(): JournalEntry[] {
  const queuedMutations = readOfflineJournalMutations()
  return queuedMutations
    .filter((mutation) => mutation.method === 'POST')
    .map((mutation) => buildOptimisticEntryFromMutation(mutation))
    .filter((entry): entry is JournalEntry => Boolean(entry))
}

export function buildOptimisticEntryFromMutation(mutation: OfflineJournalMutation): JournalEntry | null {
  if (mutation.method !== 'POST') return null

  const tradeDateFallback = mutation.queued_at
  const symbol = normalizeString(mutation.payload.symbol)?.toUpperCase() || 'PENDING'
  const direction = normalizeDirection(mutation.payload.direction) || 'long'
  const nowIso = mutation.queued_at

  return {
    id: mutation.id,
    user_id: 'offline',
    trade_date: normalizeTradeDate(mutation.payload.trade_date, tradeDateFallback),
    symbol,
    direction,
    entry_price: normalizeNumber(mutation.payload.entry_price),
    exit_price: normalizeNumber(mutation.payload.exit_price),
    position_size: normalizeNumber(mutation.payload.position_size),
    pnl: normalizeNumber(mutation.payload.pnl),
    pnl_percentage: normalizeNumber(mutation.payload.pnl_percentage),
    is_winner: normalizeNumber(mutation.payload.pnl) == null
      ? null
      : normalizeNumber(mutation.payload.pnl)! > 0,
    screenshot_url: normalizeString(mutation.payload.screenshot_url),
    screenshot_storage_path: normalizeString(mutation.payload.screenshot_storage_path),
    ai_analysis: null,
    setup_notes: normalizeString(mutation.payload.setup_notes),
    execution_notes: normalizeString(mutation.payload.execution_notes),
    lessons_learned: normalizeString(mutation.payload.lessons_learned),
    tags: normalizeTags(mutation.payload.tags),
    smart_tags: ['Offline'],
    rating: normalizeNumber(mutation.payload.rating),
    market_context: null,
    verification: null,
    entry_timestamp: null,
    exit_timestamp: null,
    stop_loss: normalizeNumber(mutation.payload.stop_loss),
    initial_target: normalizeNumber(mutation.payload.initial_target),
    strategy: normalizeString(mutation.payload.strategy),
    hold_duration_min: normalizeNumber(mutation.payload.hold_duration_min),
    mfe_percent: normalizeNumber(mutation.payload.mfe_percent),
    mae_percent: normalizeNumber(mutation.payload.mae_percent),
    contract_type: normalizeContractType(mutation.payload.contract_type),
    strike_price: normalizeNumber(mutation.payload.strike_price),
    expiration_date: normalizeString(mutation.payload.expiration_date),
    dte_at_entry: normalizeNumber(mutation.payload.dte_at_entry),
    dte_at_exit: normalizeNumber(mutation.payload.dte_at_exit),
    iv_at_entry: normalizeNumber(mutation.payload.iv_at_entry),
    iv_at_exit: normalizeNumber(mutation.payload.iv_at_exit),
    delta_at_entry: normalizeNumber(mutation.payload.delta_at_entry),
    theta_at_entry: normalizeNumber(mutation.payload.theta_at_entry),
    gamma_at_entry: normalizeNumber(mutation.payload.gamma_at_entry),
    vega_at_entry: normalizeNumber(mutation.payload.vega_at_entry),
    underlying_at_entry: normalizeNumber(mutation.payload.underlying_at_entry),
    underlying_at_exit: normalizeNumber(mutation.payload.underlying_at_exit),
    mood_before: null,
    mood_after: null,
    discipline_score: normalizeNumber(mutation.payload.discipline_score),
    followed_plan: typeof mutation.payload.followed_plan === 'boolean'
      ? mutation.payload.followed_plan
      : null,
    deviation_notes: normalizeString(mutation.payload.deviation_notes),
    session_id: normalizeString(mutation.payload.session_id),
    draft_status: null,
    is_draft: false,
    draft_expires_at: null,
    is_open: false,
    enriched_at: null,
    share_count: 0,
    is_favorite: normalizeBoolean(mutation.payload.is_favorite, false),
    created_at: nowIso,
    updated_at: nowIso,
    sync_status: 'pending_offline',
    offline_queue_id: mutation.id,
  }
}

export function mergeServerEntriesWithPendingOffline(serverEntries: JournalEntry[]): JournalEntry[] {
  const sanitizedServerEntries = sanitizeJournalEntries(serverEntries)
  const pendingEntries = getPendingOfflineJournalEntries()
  if (pendingEntries.length === 0) return sanitizedServerEntries

  const dedupe = new Map<string, JournalEntry>()
  for (const pendingEntry of pendingEntries) {
    dedupe.set(pendingEntry.id, pendingEntry)
  }
  for (const entry of sanitizedServerEntries) {
    dedupe.set(entry.id, entry)
  }

  return Array.from(dedupe.values()).sort((a, b) => b.trade_date.localeCompare(a.trade_date))
}

export function getOfflineMutationCount(): number {
  return readOfflineJournalMutations().length
}
