import type { JournalEntry } from '@/lib/types/journal'
import { sanitizeJournalEntries } from '@/lib/journal/sanitize-entry'

const JOURNAL_CACHE_KEY = 'journal-cache-v2'
const MAX_CACHE_ENTRIES = 500

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

export function readCachedJournalEntries(): JournalEntry[] {
  if (!isBrowser()) return []
  const cached = safeParse<CachedJournalEntries | null>(
    window.localStorage.getItem(JOURNAL_CACHE_KEY),
    null,
  )

  if (!cached || !Array.isArray(cached.entries)) return []
  return sanitizeJournalEntries(cached.entries)
}

export function writeCachedJournalEntries(entries: JournalEntry[]): void {
  if (!isBrowser()) return
  const sanitized = sanitizeJournalEntries(entries).slice(0, MAX_CACHE_ENTRIES)

  const payload: CachedJournalEntries = {
    saved_at: new Date().toISOString(),
    entries: sanitized,
  }

  window.localStorage.setItem(JOURNAL_CACHE_KEY, JSON.stringify(payload))
}

export function clearCachedJournalEntries(): void {
  if (!isBrowser()) return
  window.localStorage.removeItem(JOURNAL_CACHE_KEY)
}
