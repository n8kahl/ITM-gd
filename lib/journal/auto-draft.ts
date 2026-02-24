/**
 * Auto-Draft Creation Service
 *
 * Creates draft journal entries when trades are detected (e.g., from SPX Command Center
 * position tracking or broker webhook signals). Drafts use the existing is_draft /
 * draft_status / draft_expires_at columns added in the placeholder-guardrails migration.
 *
 * Spec: TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md — Phase 2, Slice 2A
 */

import type { JournalDirection, JournalContractType } from '@/lib/types/journal'

/** Input required to create an auto-draft entry. */
export interface AutoDraftInput {
  symbol: string
  direction: JournalDirection
  contractType: JournalContractType

  entryPrice?: number | null
  exitPrice?: number | null
  positionSize?: number | null
  pnl?: number | null

  strikePrice?: number | null
  expirationDate?: string | null

  /** Free-form setup type from SPX CC detector (e.g. "Bull Bounce", "Fade") */
  setupType?: string | null

  /** Pre-built market context snapshot (from context-builder) */
  marketContext?: Record<string, unknown> | null

  /** Source of the draft (for analytics) */
  source?: 'spx_cc' | 'broker_webhook' | 'ai_coach' | 'manual'
}

/** Shape returned after draft creation. */
export interface AutoDraftResult {
  success: boolean
  entryId?: string
  error?: string
}

const DRAFT_EXPIRY_DAYS = 7

/**
 * Builds the payload for a draft journal entry ready for POST to /api/members/journal.
 *
 * This is a pure function — it does not perform I/O. The caller is responsible
 * for submitting the payload to the journal API.
 */
export function buildDraftPayload(input: AutoDraftInput): Record<string, unknown> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  return {
    symbol: input.symbol.toUpperCase().trim(),
    direction: input.direction,
    contract_type: input.contractType,
    trade_date: now.toISOString(),

    entry_price: input.entryPrice ?? null,
    exit_price: input.exitPrice ?? null,
    position_size: input.positionSize ?? null,
    pnl: input.pnl ?? null,

    strike_price: input.strikePrice ?? null,
    expiration_date: input.expirationDate ?? null,

    is_open: input.exitPrice == null,
    is_draft: true,
    draft_status: 'pending',
    draft_expires_at: expiresAt.toISOString(),

    setup_type: input.setupType ?? null,
    market_context: input.marketContext ?? null,

    tags: input.source ? [`auto:${input.source}`] : ['auto:detected'],
  }
}

/**
 * Submits an auto-draft to the journal API. Intended for client-side use.
 *
 * Returns `{ success, entryId }` on success, or `{ success: false, error }` on failure.
 */
export async function createAutoDraft(input: AutoDraftInput): Promise<AutoDraftResult> {
  const payload = buildDraftPayload(input)

  try {
    const response = await fetch('/api/members/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok || !data?.success) {
      return {
        success: false,
        error: data?.error ?? `Draft creation failed (${response.status})`,
      }
    }

    return {
      success: true,
      entryId: data.data?.id as string | undefined,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error creating draft',
    }
  }
}
