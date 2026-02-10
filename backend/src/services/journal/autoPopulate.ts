import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { isUSEasternDST } from '../marketHours';

interface MessageRow {
  session_id: string | null;
  content: string;
  created_at: string;
}

interface ExistingDraftRow {
  session_id: string | null;
  symbol: string | null;
}

interface JournalDraftInsert {
  user_id: string;
  trade_date: string;
  symbol: string;
  direction: 'long' | 'short';
  entry_price: number | null;
  exit_price: number | null;
  strategy: string | null;
  setup_notes: string;
  tags: string[];
  smart_tags: string[];
  session_id: string;
  is_draft: true;
  draft_status: 'pending';
  draft_expires_at: string;
  is_open: false;
}

interface DraftCandidate {
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number | null;
  exitPrice: number | null;
  strategy: string | null;
  notes: string;
}

interface DraftCandidateAccumulator {
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number | null;
  exitPrice: number | null;
  strategy: string | null;
  snippets: string[];
}

export interface AutoPopulateRunStats {
  userId: string;
  marketDate: string;
  generated: number;
  skippedExisting: number;
  sourceCounts: {
    sessions: number;
    messages: number;
    detectedTrades: number;
  };
  notified: number;
}

export interface AutoPopulateBatchStats {
  marketDate: string;
  candidates: number;
  generated: number;
  skippedExisting: number;
  failed: number;
  notified: number;
}

const MAX_CANDIDATES_PER_SESSION = 10;
const MAX_INSERTS_PER_USER = 50;
const DRAFT_EXPIRY_HOURS = 48;

const IGNORE_SYMBOLS = new Set([
  'I',
  'A',
  'THE',
  'AND',
  'OR',
  'TO',
  'FOR',
  'WITH',
  'THIS',
  'THAT',
  'LONG',
  'SHORT',
  'CALL',
  'PUT',
  'SPREAD',
  'DTE',
  'VWAP',
  'ATR',
]);

const SETUP_KEYWORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\borb\b/i, label: 'ORB' },
  { pattern: /break\s*(and|&)\s*retest/i, label: 'Break & Retest' },
  { pattern: /\bbreakout\b/i, label: 'Breakout' },
  { pattern: /\bpullback\b/i, label: 'Pullback' },
  { pattern: /\breversal\b/i, label: 'Reversal' },
  { pattern: /\btrend\b/i, label: 'Trend Continuation' },
];

function asDateParts(marketDate: string): { year: number; month: number; day: number } {
  const [yearRaw, monthRaw, dayRaw] = marketDate.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`Invalid marketDate format: ${marketDate}`);
  }

  return { year, month, day };
}

function getEasternOffsetHours(marketDate: string): number {
  const { year, month, day } = asDateParts(marketDate);
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return isUSEasternDST(noonUtc) ? -4 : -5;
}

function etDateToUtcRange(marketDate: string): { startIso: string; endIso: string } {
  const { year, month, day } = asDateParts(marketDate);
  const offset = getEasternOffsetHours(marketDate);

  const startUtcMs = Date.UTC(year, month - 1, day, 0 - offset, 0, 0);
  const endUtcMs = startUtcMs + (24 * 60 * 60 * 1000);

  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
  };
}

function marketDateToAutoDraftTimestamp(marketDate: string): string {
  const { year, month, day } = asDateParts(marketDate);
  const offset = getEasternOffsetHours(marketDate);
  const utcHour = 16 - offset;

  return new Date(Date.UTC(year, month - 1, day, utcHour, 5, 0)).toISOString();
}

function buildDraftDedupKey(sessionId: string, symbol: string): string {
  return `${sessionId}:${symbol.toUpperCase()}`;
}

function detectDirection(text: string): 'long' | 'short' {
  const normalized = text.toLowerCase();
  if (
    normalized.includes('short')
    || normalized.includes('put')
    || normalized.includes('bearish')
    || normalized.includes('sell')
  ) {
    return 'short';
  }
  return 'long';
}

function extractSymbolCandidates(text: string): string[] {
  const matches = text.match(/\b[A-Z]{1,5}\b/g) || [];
  return matches
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => symbol.length > 0 && !IGNORE_SYMBOLS.has(symbol));
}

function toCandidatePrice(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= 0 || parsed > 100000) return null;
  return Number(parsed.toFixed(2));
}

export function extractMentionedPrices(text: string, max: number = 2): number[] {
  const matches = Array.from(
    text.matchAll(/(?:^|[^\d])\$?(\d{1,5}(?:\.\d{1,2})?)(?!\d)/g),
    (match) => match[1],
  );
  const unique = new Set<number>();

  for (const match of matches) {
    const normalized = match.trim();
    const candidate = toCandidatePrice(normalized);
    if (candidate === null) continue;
    unique.add(candidate);
    if (unique.size >= max) break;
  }

  return Array.from(unique.values());
}

export function extractSetupType(text: string): string | null {
  for (const rule of SETUP_KEYWORDS) {
    if (rule.pattern.test(text)) {
      return rule.label;
    }
  }
  return null;
}

function truncateSnippet(text: string, maxLength: number = 220): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}…`;
}

export function extractSessionDraftCandidates(messages: MessageRow[], maxCandidates: number = MAX_CANDIDATES_PER_SESSION): DraftCandidate[] {
  const candidates = new Map<string, DraftCandidateAccumulator>();

  for (const message of messages) {
    const content = typeof message.content === 'string' ? message.content.trim() : '';
    if (!content) continue;

    const symbols = extractSymbolCandidates(content);
    if (symbols.length === 0) continue;

    const prices = extractMentionedPrices(content, 2);
    const strategy = extractSetupType(content);
    const direction = detectDirection(content);
    const snippet = truncateSnippet(content);

    for (const symbol of symbols) {
      const existing = candidates.get(symbol);
      if (!existing) {
        candidates.set(symbol, {
          symbol,
          direction,
          entryPrice: prices[0] ?? null,
          exitPrice: prices[1] ?? null,
          strategy,
          snippets: [snippet],
        });
      } else {
        if (existing.direction !== 'short' && direction === 'short') {
          existing.direction = 'short';
        }
        if (existing.entryPrice === null && prices[0] !== undefined) {
          existing.entryPrice = prices[0];
        }
        if (existing.exitPrice === null && prices[1] !== undefined) {
          existing.exitPrice = prices[1];
        }
        if (!existing.strategy && strategy) {
          existing.strategy = strategy;
        }
        if (existing.snippets.length < 3) {
          existing.snippets.push(snippet);
        }
      }

      if (candidates.size >= maxCandidates) break;
    }

    if (candidates.size >= maxCandidates) break;
  }

  return Array.from(candidates.values()).map((candidate) => ({
    symbol: candidate.symbol,
    direction: candidate.direction,
    entryPrice: candidate.entryPrice,
    exitPrice: candidate.exitPrice,
    strategy: candidate.strategy,
    notes: candidate.snippets.join(' | '),
  }));
}

async function loadCandidateUserIdsForMarketDate(marketDate: string): Promise<string[]> {
  const { startIso, endIso } = etDateToUtcRange(marketDate);
  const userIds = new Set<string>();

  const { data, error } = await supabase
    .from('ai_coach_messages')
    .select('user_id')
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .limit(5000);

  if (error) {
    logger.warn('Auto-populate: failed to load candidate users from ai_coach_messages', {
      marketDate,
      error: error.message,
      code: (error as { code?: string }).code,
    });
    return [];
  }

  for (const row of data || []) {
    const record = row as unknown as { user_id?: unknown };
    if (typeof record.user_id === 'string' && record.user_id.length > 0) {
      userIds.add(record.user_id);
    }
  }

  return Array.from(userIds);
}

async function loadExistingDraftKeys(userId: string, marketDate: string): Promise<Set<string>> {
  const { startIso, endIso } = etDateToUtcRange(marketDate);

  const { data, error } = await supabase
    .from('journal_entries')
    .select('session_id,symbol')
    .eq('user_id', userId)
    .gte('trade_date', startIso)
    .lt('trade_date', endIso)
    .not('session_id', 'is', null)
    .not('symbol', 'is', null);

  if (error) {
    logger.warn('Auto-populate: failed to load existing journal draft keys', {
      userId,
      marketDate,
      error: error.message,
      code: (error as { code?: string }).code,
    });
    return new Set<string>();
  }

  const keys = new Set<string>();
  for (const row of (data || []) as ExistingDraftRow[]) {
    if (!row.session_id || !row.symbol) continue;
    keys.add(buildDraftDedupKey(row.session_id, row.symbol));
  }

  return keys;
}

async function upsertAutoJournalNotification(input: {
  userId: string;
  marketDate: string;
  createdCount: number;
  sessionsScanned: number;
}): Promise<boolean> {
  if (input.createdCount <= 0) return false;

  const title = 'Auto-Journal Drafts Ready';
  const message = `We detected ${input.createdCount} trade${input.createdCount === 1 ? '' : 's'} from today. Review and confirm your journal entries.`;

  const { error } = await supabase
    .from('journal_notifications')
    .upsert({
      user_id: input.userId,
      type: 'auto_journal_ready',
      market_date: input.marketDate,
      title,
      message,
      payload: {
        created: input.createdCount,
        sessionsScanned: input.sessionsScanned,
      },
      read_at: null,
    }, { onConflict: 'user_id,type,market_date' });

  if (error) {
    logger.warn('Auto-populate: failed to upsert in-app journal notification', {
      userId: input.userId,
      marketDate: input.marketDate,
      error: error.message,
      code: (error as { code?: string }).code,
    });
    return false;
  }

  return true;
}

function toDraftInsert(input: {
  userId: string;
  marketDate: string;
  sessionId: string;
  candidate: DraftCandidate;
}): JournalDraftInsert {
  return {
    user_id: input.userId,
    trade_date: marketDateToAutoDraftTimestamp(input.marketDate),
    symbol: input.candidate.symbol,
    direction: input.candidate.direction,
    entry_price: input.candidate.entryPrice,
    exit_price: input.candidate.exitPrice,
    strategy: input.candidate.strategy,
    setup_notes: `Auto-draft from AI Coach session ${input.sessionId}:\n\n${input.candidate.notes}`,
    tags: ['ai-session-draft', 'auto-journal'],
    smart_tags: ['Auto Draft'],
    session_id: input.sessionId,
    is_draft: true,
    draft_status: 'pending',
    draft_expires_at: new Date(Date.now() + (DRAFT_EXPIRY_HOURS * 60 * 60 * 1000)).toISOString(),
    is_open: false,
  };
}

export class JournalAutoPopulateService {
  async generateDraftsForUser(userId: string, marketDate: string): Promise<AutoPopulateRunStats> {
    const { startIso, endIso } = etDateToUtcRange(marketDate);

    const { data: messagesData, error: messagesError } = await supabase
      .from('ai_coach_messages')
      .select('session_id,content,created_at')
      .eq('user_id', userId)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: true })
      .limit(2000);

    if (messagesError) {
      throw new Error(`Failed to load AI Coach messages: ${messagesError.message}`);
    }

    const messages = (messagesData || []) as MessageRow[];
    const messagesBySession = new Map<string, MessageRow[]>();

    for (const message of messages) {
      if (!message.session_id || message.session_id.length === 0) continue;
      const existing = messagesBySession.get(message.session_id) || [];
      existing.push(message);
      messagesBySession.set(message.session_id, existing);
    }

    if (messagesBySession.size === 0) {
      return {
        userId,
        marketDate,
        generated: 0,
        skippedExisting: 0,
        sourceCounts: {
          sessions: 0,
          messages: messages.length,
          detectedTrades: 0,
        },
        notified: 0,
      };
    }

    const existingDraftKeys = await loadExistingDraftKeys(userId, marketDate);

    const candidateRows: JournalDraftInsert[] = [];
    const dedupedByKey = new Map<string, JournalDraftInsert>();

    for (const [sessionId, sessionMessages] of messagesBySession.entries()) {
      const candidates = extractSessionDraftCandidates(sessionMessages, MAX_CANDIDATES_PER_SESSION);
      for (const candidate of candidates) {
        const dedupKey = buildDraftDedupKey(sessionId, candidate.symbol);
        if (existingDraftKeys.has(dedupKey)) continue;
        if (dedupedByKey.has(dedupKey)) continue;

        const draftRow = toDraftInsert({
          userId,
          marketDate,
          sessionId,
          candidate,
        });

        dedupedByKey.set(dedupKey, draftRow);
      }
    }

    for (const row of dedupedByKey.values()) {
      candidateRows.push(row);
      if (candidateRows.length >= MAX_INSERTS_PER_USER) break;
    }

    if (candidateRows.length > 0) {
      const { error: insertError } = await supabase
        .from('journal_entries')
        .insert(candidateRows);

      if (insertError) {
        throw new Error(`Failed to persist auto-generated journal drafts: ${insertError.message}`);
      }
    }

    const notified = await upsertAutoJournalNotification({
      userId,
      marketDate,
      createdCount: candidateRows.length,
      sessionsScanned: messagesBySession.size,
    });

    return {
      userId,
      marketDate,
      generated: candidateRows.length,
      skippedExisting: dedupedByKey.size - candidateRows.length,
      sourceCounts: {
        sessions: messagesBySession.size,
        messages: messages.length,
        detectedTrades: dedupedByKey.size,
      },
      notified: notified ? 1 : 0,
    };
  }

  async runForMarketDate(marketDate: string, userIds?: string[]): Promise<AutoPopulateBatchStats> {
    const candidates = userIds && userIds.length > 0
      ? userIds
      : await loadCandidateUserIdsForMarketDate(marketDate);

    let generated = 0;
    let skippedExisting = 0;
    let failed = 0;
    let notified = 0;

    for (const userId of candidates) {
      try {
        const stats = await this.generateDraftsForUser(userId, marketDate);
        generated += stats.generated;
        skippedExisting += stats.skippedExisting;
        notified += stats.notified;
      } catch (error) {
        failed += 1;
        logger.warn('Auto-populate: failed for user', {
          userId,
          marketDate,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      marketDate,
      candidates: candidates.length,
      generated,
      skippedExisting,
      failed,
      notified,
    };
  }
}

export const journalAutoPopulateService = new JournalAutoPopulateService();
