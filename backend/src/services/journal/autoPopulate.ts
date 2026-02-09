import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { isUSEasternDST } from '../marketHours';

interface TrackedSetupRow {
  id: string;
  symbol: string;
  setup_type: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  status: 'active' | 'triggered' | 'invalidated' | 'archived';
  tracked_at: string;
  opportunity_data: Record<string, unknown> | null;
}

interface TriggeredAlertRow {
  id: string;
  symbol: string;
  alert_type: string;
  target_value: number;
  triggered_at: string;
  notes: string | null;
}

interface PositionSessionRow {
  id: string;
  symbol: string;
  position_type: string;
  entry_price: number;
  entry_date: string;
  quantity: number;
  status: string;
  close_date: string | null;
  close_price: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  current_price: number | null;
  created_at: string;
  updated_at: string;
  tags: string[] | null;
}

interface MessageRow {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

interface ExistingDraftRow {
  id: string;
  session_context: Record<string, unknown> | null;
}

interface DraftTradeInsert {
  user_id: string;
  symbol: string;
  position_type: 'call' | 'put' | 'call_spread' | 'put_spread' | 'iron_condor' | 'stock';
  strategy: string;
  entry_date: string;
  entry_price: number;
  exit_date: string;
  exit_price: number;
  quantity: number;
  pnl: number;
  pnl_pct: number;
  hold_time_days: number;
  trade_outcome: 'win' | 'loss' | 'breakeven';
  exit_reason: string;
  lessons_learned: string;
  tags: string[];
  draft_status: 'draft';
  auto_generated: true;
  session_context: Record<string, unknown>;
}

export interface AutoPopulateRunStats {
  userId: string;
  marketDate: string;
  generated: number;
  skippedExisting: number;
  sourceCounts: {
    trackedSetups: number;
    triggeredAlerts: number;
    positions: number;
    conversations: number;
  };
}

export interface AutoPopulateBatchStats {
  marketDate: string;
  candidates: number;
  generated: number;
  skippedExisting: number;
  failed: number;
}

const SUPPORTED_POSITION_TYPES = new Set<DraftTradeInsert['position_type']>([
  'call',
  'put',
  'call_spread',
  'put_spread',
  'iron_condor',
  'stock',
]);

function parseFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function toPositiveNumber(value: unknown, fallback: number): number {
  const parsed = parseFiniteNumber(value);
  if (parsed === null) return fallback;
  if (parsed <= 0) return fallback;
  return Number(parsed.toFixed(2));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

function calculateOutcome(pnl: number): 'win' | 'loss' | 'breakeven' {
  if (pnl > 0) return 'win';
  if (pnl < 0) return 'loss';
  return 'breakeven';
}

function etDateToUtcRange(marketDate: string): { startIso: string; endIso: string } {
  const [year, month, day] = marketDate.split('-').map((part) => Number(part));
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offset = isUSEasternDST(noonUtc) ? -4 : -5;

  const startUtcMs = Date.UTC(year, month - 1, day, 0 - offset, 0, 0);
  const endUtcMs = startUtcMs + (24 * 60 * 60 * 1000);

  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
  };
}

function mapDirectionToPositionType(direction: TrackedSetupRow['direction']): DraftTradeInsert['position_type'] {
  if (direction === 'bearish') return 'put';
  if (direction === 'bullish') return 'call';
  return 'stock';
}

function normalizePositionType(type: string): DraftTradeInsert['position_type'] {
  const normalized = type.toLowerCase() as DraftTradeInsert['position_type'];
  if (SUPPORTED_POSITION_TYPES.has(normalized)) return normalized;
  return 'stock';
}

function buildLessons(sourceType: string, symbol: string): string {
  if (sourceType === 'tracked_setup') {
    return `Review whether ${symbol} setup rules were followed at entry, stop, and target.`;
  }
  if (sourceType === 'triggered_alert') {
    return `Document whether the ${symbol} alert translated into a valid trade setup or a false signal.`;
  }
  if (sourceType === 'position_event') {
    return `Capture what worked or failed in risk management for ${symbol}, including sizing and stop discipline.`;
  }
  return `Summarize the trading thesis discussed for ${symbol} and define the next execution improvement.`;
}

function extractConversationSymbols(messages: MessageRow[]): Map<string, string[]> {
  const symbolMap = new Map<string, string[]>();
  const symbolPattern = /\b[A-Z]{2,5}\b/g;

  for (const message of messages) {
    const matches = message.content.toUpperCase().match(symbolPattern) || [];
    for (const symbol of matches) {
      if (symbol.length < 2 || symbol.length > 5) continue;
      const existing = symbolMap.get(symbol) || [];
      if (existing.length < 3) {
        existing.push(message.content.slice(0, 240));
      }
      symbolMap.set(symbol, existing);
    }
  }

  return symbolMap;
}

async function loadCandidateUserIds(): Promise<string[]> {
  const userIds = new Set<string>();

  const tables: Array<{ table: string; column: string }> = [
    { table: 'ai_coach_users', column: 'user_id' },
    { table: 'ai_coach_watchlists', column: 'user_id' },
    { table: 'ai_coach_tracked_setups', column: 'user_id' },
  ];

  for (const source of tables) {
    const { data, error } = await supabase
      .from(source.table)
      .select(source.column)
      .limit(5000);

    if (error) {
      logger.warn('Auto-populate: failed to load candidate users from table', {
        table: source.table,
        error: error.message,
        code: (error as { code?: string }).code,
      });
      continue;
    }

    for (const row of data || []) {
      const record = row as unknown as { [key: string]: unknown };
      const value = record[source.column];
      if (typeof value === 'string' && value.length > 0) {
        userIds.add(value);
      }
    }
  }

  return Array.from(userIds);
}

function baseDraftTrade(input: {
  userId: string;
  symbol: string;
  positionType: DraftTradeInsert['position_type'];
  strategy: string;
  entryPrice: number;
  quantity: number;
  marketDate: string;
  autoDraftKey: string;
  sourceType: 'tracked_setup' | 'triggered_alert' | 'position_event' | 'conversation';
  sourceId: string;
  entryContext: Record<string, unknown>;
  marketConditions: Record<string, unknown>;
  aiConversationSummary: string;
  suggestedLessons: string;
  tags: string[];
  pnl?: number;
  exitPrice?: number;
  exitReason?: string;
}): DraftTradeInsert {
  const quantity = Math.max(1, Math.trunc(Math.abs(input.quantity)));
  const entryPrice = toPositiveNumber(input.entryPrice, 1);
  const exitPrice = toPositiveNumber(input.exitPrice ?? entryPrice, entryPrice);
  const pnl = Number((input.pnl ?? ((exitPrice - entryPrice) * quantity * (input.positionType === 'stock' ? 1 : 100))).toFixed(2));
  const costBasis = entryPrice * quantity * (input.positionType === 'stock' ? 1 : 100);
  const pnlPct = costBasis > 0
    ? Number(((pnl / costBasis) * 100).toFixed(2))
    : 0;

  return {
    user_id: input.userId,
    symbol: input.symbol.toUpperCase(),
    position_type: input.positionType,
    strategy: input.strategy,
    entry_date: input.marketDate,
    entry_price: entryPrice,
    exit_date: input.marketDate,
    exit_price: exitPrice,
    quantity,
    pnl,
    pnl_pct: pnlPct,
    hold_time_days: 0,
    trade_outcome: calculateOutcome(pnl),
    exit_reason: input.exitReason || 'Auto-generated draft for review',
    lessons_learned: input.suggestedLessons,
    tags: Array.from(new Set(input.tags)).slice(0, 20),
    draft_status: 'draft',
    auto_generated: true,
    session_context: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      autoDraftKey: input.autoDraftKey,
      generatedAt: new Date().toISOString(),
      entryContext: input.entryContext,
      marketConditions: input.marketConditions,
      aiConversationSummary: input.aiConversationSummary,
      suggestedLessons: input.suggestedLessons,
    },
  };
}

async function loadExistingDraftKeys(userId: string, marketDate: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('ai_coach_trades')
    .select('id, session_context')
    .eq('user_id', userId)
    .eq('entry_date', marketDate)
    .eq('auto_generated', true)
    .eq('draft_status', 'draft');

  if (error) {
    logger.warn('Auto-populate: failed to load existing drafts', {
      userId,
      marketDate,
      error: error.message,
      code: (error as { code?: string }).code,
    });
    return new Set();
  }

  const keys = new Set<string>();
  for (const row of (data || []) as ExistingDraftRow[]) {
    const context = asRecord(row.session_context);
    const key = context.autoDraftKey;
    if (typeof key === 'string' && key.length > 0) {
      keys.add(key);
    }
  }

  return keys;
}

export class JournalAutoPopulateService {
  async generateDraftsForUser(userId: string, marketDate: string): Promise<AutoPopulateRunStats> {
    const { startIso, endIso } = etDateToUtcRange(marketDate);

    const [trackedSetupsRes, triggeredAlertsRes, positionsRes, messagesRes] = await Promise.all([
      supabase
        .from('ai_coach_tracked_setups')
        .select('id, symbol, setup_type, direction, status, tracked_at, opportunity_data')
        .eq('user_id', userId)
        .gte('tracked_at', startIso)
        .lt('tracked_at', endIso)
        .order('tracked_at', { ascending: false })
        .limit(200),
      supabase
        .from('ai_coach_alerts')
        .select('id, symbol, alert_type, target_value, triggered_at, notes')
        .eq('user_id', userId)
        .eq('status', 'triggered')
        .gte('triggered_at', startIso)
        .lt('triggered_at', endIso)
        .order('triggered_at', { ascending: false })
        .limit(200),
      supabase
        .from('ai_coach_positions')
        .select('id, symbol, position_type, entry_price, entry_date, quantity, status, close_date, close_price, pnl, pnl_pct, current_price, created_at, updated_at, tags')
        .eq('user_id', userId)
        .or(`and(created_at.gte.${startIso},created_at.lt.${endIso}),and(updated_at.gte.${startIso},updated_at.lt.${endIso})`)
        .order('updated_at', { ascending: false })
        .limit(300),
      supabase
        .from('ai_coach_messages')
        .select('id, role, content, created_at')
        .eq('user_id', userId)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: false })
        .limit(400),
    ]);

    if (trackedSetupsRes.error) {
      throw new Error(`Failed to load tracked setups: ${trackedSetupsRes.error.message}`);
    }
    if (triggeredAlertsRes.error) {
      throw new Error(`Failed to load triggered alerts: ${triggeredAlertsRes.error.message}`);
    }
    if (positionsRes.error) {
      throw new Error(`Failed to load position events: ${positionsRes.error.message}`);
    }
    if (messagesRes.error) {
      throw new Error(`Failed to load ai conversation events: ${messagesRes.error.message}`);
    }

    const trackedSetups = (trackedSetupsRes.data || []) as TrackedSetupRow[];
    const triggeredAlerts = (triggeredAlertsRes.data || []) as TriggeredAlertRow[];
    const positions = (positionsRes.data || []) as PositionSessionRow[];
    const messages = (messagesRes.data || []) as MessageRow[];

    const conversationSymbols = extractConversationSymbols(messages);

    const drafts: DraftTradeInsert[] = [];

    for (const setup of trackedSetups) {
      const data = asRecord(setup.opportunity_data);
      const suggestedTrade = asRecord(data.suggestedTrade);
      const metadata = asRecord(data.metadata);
      const autoDraftKey = `setup:${setup.id}:${marketDate}`;
      const symbol = setup.symbol.toUpperCase();

      drafts.push(baseDraftTrade({
        userId,
        symbol,
        positionType: mapDirectionToPositionType(setup.direction),
        strategy: setup.setup_type,
        entryPrice: toPositiveNumber(suggestedTrade.entry ?? data.currentPrice, 1),
        quantity: 1,
        marketDate,
        autoDraftKey,
        sourceType: 'tracked_setup',
        sourceId: setup.id,
        entryContext: {
          setupType: setup.setup_type,
          direction: setup.direction,
          status: setup.status,
          levels: metadata.levels || null,
          vwap: metadata.vwap || null,
          orb: metadata.orb || null,
        },
        marketConditions: {
          trend: metadata.trend || 'unknown',
          volatilityRegime: metadata.volatilityRegime || metadata.volatility || 'unknown',
          volume: metadata.volume || 'unknown',
        },
        aiConversationSummary: (conversationSymbols.get(symbol) || []).join(' | ') || `Setup tracked for ${symbol}.`,
        suggestedLessons: buildLessons('tracked_setup', symbol),
        tags: ['auto-draft', 'setup', setup.setup_type],
      }));
    }

    for (const alert of triggeredAlerts) {
      const autoDraftKey = `alert:${alert.id}:${marketDate}`;
      const symbol = alert.symbol.toUpperCase();

      drafts.push(baseDraftTrade({
        userId,
        symbol,
        positionType: 'stock',
        strategy: `alert_${alert.alert_type}`,
        entryPrice: toPositiveNumber(alert.target_value, 1),
        quantity: 1,
        marketDate,
        autoDraftKey,
        sourceType: 'triggered_alert',
        sourceId: alert.id,
        entryContext: {
          alertType: alert.alert_type,
          targetValue: alert.target_value,
        },
        marketConditions: {
          trend: 'unknown',
          volatilityRegime: 'unknown',
          volume: 'unknown',
        },
        aiConversationSummary: (conversationSymbols.get(symbol) || []).join(' | ') || `Alert triggered for ${symbol}.`,
        suggestedLessons: buildLessons('triggered_alert', symbol),
        tags: ['auto-draft', 'alert', alert.alert_type],
        exitReason: alert.notes || 'Alert triggered during session',
      }));
    }

    for (const position of positions) {
      const autoDraftKey = `position:${position.id}:${marketDate}`;
      const symbol = position.symbol.toUpperCase();
      const closePrice = parseFiniteNumber(position.close_price);
      const currentPrice = parseFiniteNumber(position.current_price);
      const pnl = parseFiniteNumber(position.pnl);

      drafts.push(baseDraftTrade({
        userId,
        symbol,
        positionType: normalizePositionType(position.position_type),
        strategy: `${position.status}_position_event`,
        entryPrice: toPositiveNumber(position.entry_price, 1),
        quantity: Math.max(1, Math.abs(Math.trunc(position.quantity))),
        marketDate,
        autoDraftKey,
        sourceType: 'position_event',
        sourceId: position.id,
        entryContext: {
          positionStatus: position.status,
          entryDate: position.entry_date,
          closeDate: position.close_date,
        },
        marketConditions: {
          trend: 'unknown',
          volatilityRegime: 'unknown',
          volume: 'unknown',
        },
        aiConversationSummary: (conversationSymbols.get(symbol) || []).join(' | ') || `Position event captured for ${symbol}.`,
        suggestedLessons: buildLessons('position_event', symbol),
        tags: ['auto-draft', 'position', ...(position.tags || [])],
        pnl: pnl ?? undefined,
        exitPrice: closePrice ?? currentPrice ?? undefined,
        exitReason: position.status === 'closed'
          ? 'Position closed during session'
          : 'Position state changed during session',
      }));
    }

    for (const [symbol, excerpts] of conversationSymbols.entries()) {
      const autoDraftKey = `conversation:${symbol}:${marketDate}`;
      drafts.push(baseDraftTrade({
        userId,
        symbol,
        positionType: 'stock',
        strategy: 'ai_conversation',
        entryPrice: 1,
        quantity: 1,
        marketDate,
        autoDraftKey,
        sourceType: 'conversation',
        sourceId: symbol,
        entryContext: {
          source: 'ai_coach_messages',
        },
        marketConditions: {
          trend: 'unknown',
          volatilityRegime: 'unknown',
          volume: 'unknown',
        },
        aiConversationSummary: excerpts.join(' | '),
        suggestedLessons: buildLessons('conversation', symbol),
        tags: ['auto-draft', 'conversation'],
        exitReason: 'Draft from AI Coach trade conversation',
      }));
    }

    const existingDraftKeys = await loadExistingDraftKeys(userId, marketDate);

    const uniqueByKey = new Map<string, DraftTradeInsert>();
    for (const draft of drafts) {
      const autoDraftKey = String(asRecord(draft.session_context).autoDraftKey || '');
      if (!autoDraftKey) continue;
      if (!uniqueByKey.has(autoDraftKey)) {
        uniqueByKey.set(autoDraftKey, draft);
      }
    }

    const inserts = Array.from(uniqueByKey.values())
      .filter((draft) => !existingDraftKeys.has(String(asRecord(draft.session_context).autoDraftKey || '')));

    if (inserts.length > 0) {
      const { error } = await supabase
        .from('ai_coach_trades')
        .insert(inserts);

      if (error) {
        throw new Error(`Failed to persist auto-generated drafts: ${error.message}`);
      }
    }

    return {
      userId,
      marketDate,
      generated: inserts.length,
      skippedExisting: uniqueByKey.size - inserts.length,
      sourceCounts: {
        trackedSetups: trackedSetups.length,
        triggeredAlerts: triggeredAlerts.length,
        positions: positions.length,
        conversations: conversationSymbols.size,
      },
    };
  }

  async runForMarketDate(marketDate: string, userIds?: string[]): Promise<AutoPopulateBatchStats> {
    const candidates = userIds && userIds.length > 0
      ? userIds
      : await loadCandidateUserIds();

    let generated = 0;
    let skippedExisting = 0;
    let failed = 0;

    for (const userId of candidates) {
      try {
        const stats = await this.generateDraftsForUser(userId, marketDate);
        generated += stats.generated;
        skippedExisting += stats.skippedExisting;
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
    };
  }
}

export const journalAutoPopulateService = new JournalAutoPopulateService();
