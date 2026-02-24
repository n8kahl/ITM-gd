/**
 * Trade Journal Module — Barrel Exports
 *
 * Centralised re-exports for all journal domain logic.
 * Import from '@/lib/journal' instead of individual files.
 */

// ── Auto-Draft ──────────────────────────────────────────
export { buildDraftPayload, createAutoDraft } from './auto-draft'
export type { AutoDraftInput, AutoDraftResult } from './auto-draft'

// ── Bias Detector ───────────────────────────────────────
export { analyzeBiases } from './bias-detector'
export type { BiasType, BiasSignal, BiasAnalysisResult } from './bias-detector'

// ── Context Builder ─────────────────────────────────────
export { buildRegimeTags, buildMarketContext } from './context-builder'
export type {
  SPXEngineSnapshot,
  RegimeTags,
  VixBucket,
  TrendState,
  GexRegime,
  TimeBucket,
} from './context-builder'

// ── Insights Enricher ───────────────────────────────────
export { fetchEnrichedInsights } from './insights-enricher'
export type { EnrichedJournalInsights } from './insights-enricher'

// ── Import Normalization ────────────────────────────────
export { normalizeImportedRow } from './import-normalization'
export type { ImportBroker, NormalizedImportedRow } from './import-normalization'

// ── Number Parsing ──────────────────────────────────────
export { parseNumericInput } from './number-parsing'
export type { ParsedNumericInput } from './number-parsing'

// ── Offline Storage ─────────────────────────────────────
export {
  readCachedJournalEntries,
  writeCachedJournalEntries,
  clearCachedJournalEntries,
} from './offline-storage'

// ── Regime Tagger ───────────────────────────────────────
export {
  hasRegimeTags,
  inferRegimeTags,
  findUntaggedEntries,
  buildRegimeTagPatches,
  batchTagRegimes,
  aggregateRegimeDistribution,
} from './regime-tagger'

// ── Sanitize Entry ──────────────────────────────────────
export {
  sanitizeJournalWriteInput,
  sanitizeJournalEntry,
  sanitizeJournalEntries,
} from './sanitize-entry'

// ── Analytics Refresh Queue ─────────────────────────────
export { enqueueJournalAnalyticsRefresh } from './analytics-refresh-queue'
