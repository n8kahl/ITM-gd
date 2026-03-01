import { createHash } from 'crypto';

const REPLAY_JOURNAL_ID_VERSION = 'replay-journal-v1';
const REPLAY_JOURNAL_IMPORT_VERSION = 'replay-journal-import-v1';
const MAX_TRANSCRIPT_LINES = 3;

export interface ReplaySessionMetadata {
  sessionId: string;
  sessionDate: string;
  symbol: string;
  channelId: string | null;
  channelName: string | null;
  caller: string | null;
  sessionStart: string | null;
  sessionEnd: string | null;
  sessionSummary: string | null;
}

export interface ReplaySessionTrade {
  id: string | null;
  tradeIndex: number;
  contract: {
    symbol: string | null;
    strike: number | null;
    type: string | null;
    expiry: string | null;
  };
  entry: {
    direction: string | null;
    price: number | null;
    timestamp: string | null;
    sizing: string | null;
  };
  stop?: {
    initial: number | null;
  };
  targets?: {
    target1: number | null;
    target2: number | null;
  };
  thesis?: {
    text: string | null;
    entryCondition?: string | null;
    messageRef?: string | null;
  };
  lifecycle?: {
    events?: Array<Record<string, unknown>>;
  };
  outcome: {
    finalPnlPct: number | null;
    isWinner: boolean | null;
    fullyExited: boolean | null;
    exitTimestamp: string | null;
  };
  entrySnapshotId?: string | null;
}

export interface ReplaySessionMessage {
  id: string | null;
  content: string | null;
  sentAt: string | null;
  signalType: string | null;
  parsedTradeId: string | null;
}

export type ReplaySessionSnapshot = Record<string, unknown>;

export interface ReplayJournalBuildInput {
  userId: string;
  session: ReplaySessionMetadata;
  trades: ReplaySessionTrade[];
  messages: ReplaySessionMessage[];
  snapshots: ReplaySessionSnapshot[];
}

export interface ReplayJournalInsertPayload {
  id: string;
  user_id: string;
  trade_date: string;
  symbol: string;
  direction: 'long' | 'short';
  contract_type: 'stock' | 'call' | 'put';
  entry_price: number | null;
  exit_price: number | null;
  position_size: number | null;
  pnl: number | null;
  pnl_percentage: number | null;
  is_open: boolean;
  entry_timestamp: string | null;
  exit_timestamp: string | null;
  stop_loss: number | null;
  initial_target: number | null;
  hold_duration_min: number | null;
  strike_price: number | null;
  expiration_date: string | null;
  dte_at_entry: number | null;
  iv_at_entry: number | null;
  delta_at_entry: number | null;
  theta_at_entry: number | null;
  gamma_at_entry: number | null;
  vega_at_entry: number | null;
  underlying_at_entry: number | null;
  underlying_at_exit: number | null;
  strategy: string | null;
  setup_notes: string | null;
  execution_notes: string | null;
  lessons_learned: string | null;
  tags: string[];
  market_context: Record<string, unknown>;
  import_id: string;
  setup_type: string | null;
  is_draft: boolean;
  draft_status: null;
  draft_expires_at: null;
}

export interface ReplayJournalBuiltEntry {
  payload: ReplayJournalInsertPayload;
  parsedTradeId: string | null;
  replayBacklink: string;
}

interface ResolvedSnapshotRow {
  id: string | null;
  symbol: string | null;
  capturedAt: string | null;
  capturedAtMs: number | null;
  row: ReplaySessionSnapshot;
}

interface ResolvedMessageRow extends ReplaySessionMessage {
  sentAtMs: number | null;
  normalizedSignalType: string;
}

interface ConfluenceSummary {
  capturedAt: string | null;
  rrRatio: number | null;
  evR: number | null;
  mtfComposite: number | null;
  mtfAligned: boolean | null;
  regime: string | null;
  regimeDirection: string | null;
  envGatePassed: boolean | null;
  vixValue: number | null;
  memorySetupType: string | null;
}

function buildDeterministicUuid(key: string): string {
  const hex = createHash('sha256').update(key).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toNullableBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

function parseIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function parseEpochMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeSignalType(value: string | null): string {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function isLikelyThesisMessage(message: ResolvedMessageRow): boolean {
  if (message.normalizedSignalType.includes('thesis')) return true;
  const content = toNullableString(message.content);
  if (!content || content.length < 20) return false;
  return /\b(thesis|plan|reason|because|looking for|entry condition|if .* then)\b/i.test(content);
}

function isEntrySignal(normalizedSignalType: string): boolean {
  return normalizedSignalType.startsWith('prep')
    || normalizedSignalType.includes('fill')
    || normalizedSignalType === 'ptf'
    || normalizedSignalType === 'pft'
    || normalizedSignalType === 'filled_avg';
}

function isManagementSignal(normalizedSignalType: string): boolean {
  return normalizedSignalType.includes('trim')
    || normalizedSignalType.includes('stop')
    || normalizedSignalType.includes('trail')
    || normalizedSignalType.includes('breakeven');
}

function isExitSignal(normalizedSignalType: string): boolean {
  return normalizedSignalType.includes('exit')
    || normalizedSignalType.includes('fully_out')
    || normalizedSignalType.includes('fully_sold')
    || normalizedSignalType.includes('close');
}

function formatTranscriptLine(message: ResolvedMessageRow): string {
  const timestamp = message.sentAt || 'n/a';
  const content = toNullableString(message.content) || '(empty)';
  return `[${timestamp}] ${content}`;
}

function buildTranscriptSection(title: string, messages: ResolvedMessageRow[]): string {
  if (messages.length === 0) {
    return `${title}: none captured`;
  }
  const lines = messages
    .slice(0, MAX_TRANSCRIPT_LINES)
    .map(formatTranscriptLine);
  return `${title}:\n${lines.map((line) => `- ${line}`).join('\n')}`;
}

function chooseNearestSnapshotAtOrBefore(
  snapshots: ResolvedSnapshotRow[],
  targetMs: number | null,
  symbol: string,
): ResolvedSnapshotRow | null {
  if (snapshots.length === 0) return null;
  const symbolSnapshots = snapshots.filter((snapshot) => {
    if (!snapshot.symbol) return true;
    return snapshot.symbol.toUpperCase() === symbol;
  });
  const eligible = symbolSnapshots.length > 0 ? symbolSnapshots : snapshots;
  if (targetMs == null) {
    return eligible[eligible.length - 1] ?? null;
  }

  let latestAtOrBefore: ResolvedSnapshotRow | null = null;
  for (const snapshot of eligible) {
    if (snapshot.capturedAtMs == null) continue;
    if (snapshot.capturedAtMs <= targetMs) {
      latestAtOrBefore = snapshot;
      continue;
    }
    break;
  }
  if (latestAtOrBefore) return latestAtOrBefore;
  return eligible[0] ?? null;
}

function selectSnapshotsForTrade(
  trade: ReplaySessionTrade,
  symbol: string,
  snapshots: ResolvedSnapshotRow[],
): { entry: ResolvedSnapshotRow | null; management: ResolvedSnapshotRow | null; exit: ResolvedSnapshotRow | null } {
  const entryMs = parseEpochMs(trade.entry.timestamp);
  const exitMs = parseEpochMs(trade.outcome.exitTimestamp);
  const lifecycleEvents = Array.isArray(trade.lifecycle?.events) ? trade.lifecycle?.events : [];
  const lifecycleTimes = lifecycleEvents
    .map((event) => parseEpochMs(
      toNullableString((event as { timestamp?: unknown }).timestamp)
      || toNullableString((event as { at?: unknown }).at),
    ))
    .filter((value): value is number => value != null)
    .sort((left, right) => left - right);

  let entrySnapshot = trade.entrySnapshotId
    ? snapshots.find((snapshot) => snapshot.id === trade.entrySnapshotId) ?? null
    : null;
  if (!entrySnapshot) {
    entrySnapshot = chooseNearestSnapshotAtOrBefore(snapshots, entryMs, symbol);
  }

  const managementMs = lifecycleTimes.length > 0
    ? lifecycleTimes[Math.floor(lifecycleTimes.length / 2)] ?? null
    : null;
  const managementSnapshot = chooseNearestSnapshotAtOrBefore(snapshots, managementMs, symbol);

  const fallbackExitMs = lifecycleTimes.length > 0
    ? lifecycleTimes[lifecycleTimes.length - 1] ?? null
    : null;
  const exitSnapshot = chooseNearestSnapshotAtOrBefore(
    snapshots,
    exitMs ?? fallbackExitMs,
    symbol,
  );

  return {
    entry: entrySnapshot,
    management: managementSnapshot,
    exit: exitSnapshot,
  };
}

function summarizeConfluence(snapshot: ResolvedSnapshotRow | null): ConfluenceSummary {
  if (!snapshot) {
    return {
      capturedAt: null,
      rrRatio: null,
      evR: null,
      mtfComposite: null,
      mtfAligned: null,
      regime: null,
      regimeDirection: null,
      envGatePassed: null,
      vixValue: null,
      memorySetupType: null,
    };
  }

  const row = snapshot.row;
  return {
    capturedAt: snapshot.capturedAt,
    rrRatio: toFiniteNumber(row.rr_ratio),
    evR: toFiniteNumber(row.ev_r),
    mtfComposite: toFiniteNumber(row.mtf_composite),
    mtfAligned: toNullableBoolean(row.mtf_aligned),
    regime: toNullableString(row.regime),
    regimeDirection: toNullableString(row.regime_direction),
    envGatePassed: toNullableBoolean(row.env_gate_passed),
    vixValue: toFiniteNumber(row.vix_value),
    memorySetupType: toNullableString(row.memory_setup_type),
  };
}

function confluenceValue(value: string | number | boolean | null, decimals = 2): string {
  if (value == null) return 'n/a';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toFixed(decimals) : 'n/a';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return value;
}

function formatConfluence(label: string, summary: ConfluenceSummary): string {
  return `${label}: capturedAt=${summary.capturedAt || 'n/a'}`
    + ` rr=${confluenceValue(summary.rrRatio)}`
    + ` evR=${confluenceValue(summary.evR)}`
    + ` mtfComposite=${confluenceValue(summary.mtfComposite)}`
    + ` mtfAligned=${confluenceValue(summary.mtfAligned, 0)}`
    + ` regime=${confluenceValue(summary.regime, 0)}`
    + ` direction=${confluenceValue(summary.regimeDirection, 0)}`
    + ` gatePassed=${confluenceValue(summary.envGatePassed, 0)}`
    + ` vix=${confluenceValue(summary.vixValue)}`
    + ` memorySetup=${confluenceValue(summary.memorySetupType, 0)}`;
}

function buildReplayBacklink(sessionId: string, parsedTradeId: string | null): string {
  if (!parsedTradeId) {
    return `/members/trade-day-replay?sessionId=${encodeURIComponent(sessionId)}`;
  }
  return `/members/trade-day-replay?sessionId=${encodeURIComponent(sessionId)}&parsedTradeId=${encodeURIComponent(parsedTradeId)}`;
}

function deriveExitPrice(
  direction: 'long' | 'short',
  entryPrice: number | null,
  finalPnlPct: number | null,
): number | null {
  if (entryPrice == null || finalPnlPct == null) return null;
  const multiplier = finalPnlPct / 100;
  const rawExit = direction === 'short'
    ? entryPrice * (1 - multiplier)
    : entryPrice * (1 + multiplier);
  return round(rawExit, 4);
}

function derivePnlPoints(entryPrice: number | null, finalPnlPct: number | null): number | null {
  if (entryPrice == null || finalPnlPct == null) return null;
  return round(entryPrice * (finalPnlPct / 100), 4);
}

function deriveTradeDate(entryTimestamp: string | null, session: ReplaySessionMetadata): string {
  const entry = parseIsoTimestamp(entryTimestamp);
  if (entry) return entry;
  const start = parseIsoTimestamp(session.sessionStart);
  if (start) return start;
  const fallback = parseIsoTimestamp(`${session.sessionDate}T00:00:00.000Z`);
  return fallback || new Date().toISOString();
}

function deriveHoldDurationMinutes(entryTimestamp: string | null, exitTimestamp: string | null): number | null {
  const entryMs = parseEpochMs(entryTimestamp);
  const exitMs = parseEpochMs(exitTimestamp);
  if (entryMs == null || exitMs == null || exitMs < entryMs) return null;
  return Math.max(0, Math.round((exitMs - entryMs) / 60_000));
}

function deriveDteAtEntry(expiry: string | null, entryTimestamp: string | null): number | null {
  if (!expiry) return null;
  const expiryMs = Date.parse(`${expiry}T00:00:00.000Z`);
  const entryMs = parseEpochMs(entryTimestamp);
  if (!Number.isFinite(expiryMs) || entryMs == null) return null;
  return Math.max(0, Math.ceil((expiryMs - entryMs) / 86_400_000));
}

function uniqueTags(values: Array<string | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const next = value.trim().toLowerCase();
    if (!next || next.length > 50 || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out.slice(0, 20);
}

function resolveContractType(value: string | null): 'stock' | 'call' | 'put' {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'call') return 'call';
  if (normalized === 'put') return 'put';
  return 'stock';
}

function resolveDirection(value: string | null): 'long' | 'short' {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'short' ? 'short' : 'long';
}

export function buildReplayJournalEntries(input: ReplayJournalBuildInput): ReplayJournalBuiltEntry[] {
  const normalizedSnapshots: ResolvedSnapshotRow[] = input.snapshots
    .map((snapshot) => {
      const capturedAt = parseIsoTimestamp(snapshot.captured_at);
      return {
        id: toNullableString(snapshot.id),
        symbol: toNullableString(snapshot.symbol)?.toUpperCase() || null,
        capturedAt,
        capturedAtMs: parseEpochMs(capturedAt),
        row: snapshot,
      };
    })
    .sort((left, right) => {
      if (left.capturedAtMs != null && right.capturedAtMs != null && left.capturedAtMs !== right.capturedAtMs) {
        return left.capturedAtMs - right.capturedAtMs;
      }
      if (left.capturedAtMs != null && right.capturedAtMs == null) return -1;
      if (left.capturedAtMs == null && right.capturedAtMs != null) return 1;
      return (left.id || '').localeCompare(right.id || '');
    });

  const normalizedMessages: ResolvedMessageRow[] = input.messages
    .map((message) => ({
      ...message,
      sentAt: parseIsoTimestamp(message.sentAt),
      sentAtMs: parseEpochMs(parseIsoTimestamp(message.sentAt)),
      normalizedSignalType: normalizeSignalType(message.signalType),
    }))
    .sort((left, right) => {
      if (left.sentAtMs != null && right.sentAtMs != null && left.sentAtMs !== right.sentAtMs) {
        return left.sentAtMs - right.sentAtMs;
      }
      if (left.sentAtMs != null && right.sentAtMs == null) return -1;
      if (left.sentAtMs == null && right.sentAtMs != null) return 1;
      return (left.id || '').localeCompare(right.id || '');
    });

  const orderedTrades = [...input.trades].sort((left, right) => {
    if (left.tradeIndex !== right.tradeIndex) return left.tradeIndex - right.tradeIndex;
    return (left.id || '').localeCompare(right.id || '');
  });

  return orderedTrades.map((trade) => {
    const parsedTradeId = toNullableString(trade.id);
    const symbol = (toNullableString(trade.contract.symbol) || input.session.symbol || 'SPX').toUpperCase();
    const direction = resolveDirection(toNullableString(trade.entry.direction));
    const contractType = resolveContractType(toNullableString(trade.contract.type));
    const entryTimestamp = parseIsoTimestamp(trade.entry.timestamp);
    const exitTimestamp = parseIsoTimestamp(trade.outcome.exitTimestamp);
    const entryPrice = toFiniteNumber(trade.entry.price);
    const finalPnlPct = toFiniteNumber(trade.outcome.finalPnlPct);
    const exitPrice = deriveExitPrice(direction, entryPrice, finalPnlPct);
    const pnlPoints = derivePnlPoints(entryPrice, finalPnlPct);
    const holdDurationMin = deriveHoldDurationMinutes(entryTimestamp, exitTimestamp);
    const expiry = toNullableString(trade.contract.expiry);
    const dteAtEntry = deriveDteAtEntry(expiry, entryTimestamp);
    const replayBacklink = buildReplayBacklink(input.session.sessionId, parsedTradeId);

    const snapshots = selectSnapshotsForTrade(trade, symbol, normalizedSnapshots);
    const entryConfluence = summarizeConfluence(snapshots.entry);
    const managementConfluence = summarizeConfluence(snapshots.management);
    const exitConfluence = summarizeConfluence(snapshots.exit);

    const tradeMessages = parsedTradeId
      ? normalizedMessages.filter((message) => message.parsedTradeId === parsedTradeId)
      : [];
    const thesisMessages = tradeMessages.filter(isLikelyThesisMessage);
    const entryMessages = tradeMessages.filter((message) => isEntrySignal(message.normalizedSignalType));
    const managementMessages = tradeMessages.filter((message) => isManagementSignal(message.normalizedSignalType));
    const exitMessages = tradeMessages.filter((message) => isExitSignal(message.normalizedSignalType));

    const fallbackThesisMessages = thesisMessages.length > 0
      ? thesisMessages
      : normalizedMessages.filter((message) => isLikelyThesisMessage(message));
    const setupNotesSections = [
      trade.thesis?.text ? `Thesis: ${trade.thesis.text}` : null,
      trade.thesis?.entryCondition ? `Entry condition: ${trade.thesis.entryCondition}` : null,
      buildTranscriptSection('Transcript thesis context', fallbackThesisMessages),
      buildTranscriptSection('Transcript entry context', entryMessages),
    ].filter((value): value is string => Boolean(value));

    const executionNotesSections = [
      `Replay backlink: ${replayBacklink}`,
      `Replay source: session=${input.session.sessionId} trade=${parsedTradeId || `idx-${trade.tradeIndex}`}`,
      buildTranscriptSection('Transcript management context', managementMessages),
      buildTranscriptSection('Transcript exit context', exitMessages),
      formatConfluence('Entry confluence', entryConfluence),
      formatConfluence('Management confluence', managementConfluence),
      formatConfluence('Exit confluence', exitConfluence),
    ];

    const setupType = toNullableString((snapshots.entry?.row.memory_setup_type));
    const underlyingEntry = toFiniteNumber(snapshots.entry?.row.spx_price);
    const underlyingExit = toFiniteNumber(snapshots.exit?.row.spx_price);

    const deterministicSeed = parsedTradeId || `trade-index-${trade.tradeIndex}`;
    const journalEntryId = buildDeterministicUuid(
      `${REPLAY_JOURNAL_ID_VERSION}:${input.userId}:${input.session.sessionId}:${deterministicSeed}`,
    );
    const importId = buildDeterministicUuid(
      `${REPLAY_JOURNAL_IMPORT_VERSION}:${input.userId}:${input.session.sessionId}:${deterministicSeed}`,
    );

    const payload: ReplayJournalInsertPayload = {
      id: journalEntryId,
      user_id: input.userId,
      trade_date: deriveTradeDate(entryTimestamp, input.session),
      symbol,
      direction,
      contract_type: contractType,
      entry_price: entryPrice,
      exit_price: exitPrice,
      position_size: null,
      pnl: pnlPoints,
      pnl_percentage: finalPnlPct,
      is_open: !(trade.outcome.fullyExited === true || exitTimestamp != null),
      entry_timestamp: entryTimestamp,
      exit_timestamp: exitTimestamp,
      stop_loss: toFiniteNumber(trade.stop?.initial),
      initial_target: toFiniteNumber(trade.targets?.target1),
      hold_duration_min: holdDurationMin,
      strike_price: toFiniteNumber(trade.contract.strike),
      expiration_date: expiry,
      dte_at_entry: dteAtEntry,
      iv_at_entry: null,
      delta_at_entry: null,
      theta_at_entry: null,
      gamma_at_entry: null,
      vega_at_entry: null,
      underlying_at_entry: underlyingEntry,
      underlying_at_exit: underlyingExit,
      strategy: 'same_day_replay',
      setup_notes: setupNotesSections.length > 0 ? setupNotesSections.join('\n\n') : null,
      execution_notes: executionNotesSections.join('\n\n'),
      lessons_learned: input.session.sessionSummary || null,
      tags: uniqueTags([
        'replay',
        'spx-replay',
        'same-day-replay',
        `replay-session-${input.session.sessionDate}`,
        `replay-trade-${trade.tradeIndex}`,
      ]),
      market_context: {
        replay_session: {
          session_id: input.session.sessionId,
          session_date: input.session.sessionDate,
          channel_id: input.session.channelId,
          channel_name: input.session.channelName,
          caller: input.session.caller,
        },
        confluence: {
          entry: entryConfluence,
          management: managementConfluence,
          exit: exitConfluence,
        },
      },
      import_id: importId,
      setup_type: setupType,
      is_draft: false,
      draft_status: null,
      draft_expires_at: null,
    };

    return {
      payload,
      parsedTradeId,
      replayBacklink,
    };
  });
}
