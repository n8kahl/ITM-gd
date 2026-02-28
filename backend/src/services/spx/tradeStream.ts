import type {
  Setup,
  TradeStreamItem,
  TradeStreamLifecycleState,
  TradeStreamRecommendedAction,
  TradeStreamSnapshot,
} from './types';

export const TRADE_STREAM_LIFECYCLE_ORDER: ReadonlyArray<TradeStreamLifecycleState> = ['forming', 'triggered', 'past'];

export type TradeStreamFeedTrustMetadata = TradeStreamSnapshot['feedTrust'];

type TradeStreamTimingInput = Partial<TradeStreamItem['timing']>;
type TradeStreamReasonInput = Partial<TradeStreamItem['reason']>;
type TradeStreamFreshnessInput = Partial<TradeStreamItem['freshness']>;

export interface TradeStreamAssemblySetup extends Setup {
  momentPriority?: number;
  etaToTriggerMs?: number | null;
  resolvedAt?: string | null;
  recommendedAction?: TradeStreamRecommendedAction;
  actionBlockedReason?: string | null;
  freshness?: TradeStreamFreshnessInput;
  reason?: TradeStreamReasonInput;
  outcome?: TradeStreamItem['outcome'];
}

export interface TradeStreamPastResolutionRecord {
  id: string;
  stableIdHash: string;
  status: string;
  direction: Setup['direction'];
  setupType: Setup['type'];
  entryZone: TradeStreamItem['entryZone'];
  stop: number;
  target1: number;
  target2: number;
  probability?: number;
  confluenceScore?: number;
  evR?: number;
  alignmentScore?: number;
  momentPriority?: number;
  recommendedAction?: TradeStreamRecommendedAction;
  actionBlockedReason?: string | null;
  freshness?: TradeStreamFreshnessInput;
  timing?: TradeStreamTimingInput;
  reason?: TradeStreamReasonInput;
  outcome?: TradeStreamItem['outcome'];
}

export interface BuildTradeStreamSnapshotInput {
  setups: ReadonlyArray<TradeStreamAssemblySetup>;
  pastRecords?: ReadonlyArray<TradeStreamPastResolutionRecord>;
  resolutionRecords?: ReadonlyArray<TradeStreamPastResolutionRecord>;
  feedTrust: TradeStreamFeedTrustMetadata;
  generatedAt: string;
}

function lifecycleRank(lifecycle: TradeStreamLifecycleState): number {
  return TRADE_STREAM_LIFECYCLE_ORDER.indexOf(lifecycle);
}

function parseIsoTimestamp(iso: string | null | undefined): number {
  if (!iso) return Number.NaN;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Number.NaN;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function pickPreferredString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

function normalizeStableIdHash(stableIdHash: string | undefined, id: string): string {
  if (typeof stableIdHash === 'string' && stableIdHash.length > 0) return stableIdHash;
  return id;
}

function deriveMomentPriorityFromSetup(setup: TradeStreamAssemblySetup): number {
  if (typeof setup.momentPriority === 'number') return setup.momentPriority;

  const probabilityComponent = setup.probability * 0.55;
  const confluenceComponent = setup.confluenceScore * 10 * 0.25;
  const evComponent = (setup.evR ?? 0) * 10 * 0.2;
  return Number((probabilityComponent + confluenceComponent + evComponent).toFixed(4));
}

function compareEta(lhs: TradeStreamItem, rhs: TradeStreamItem): number {
  const lhsEta = typeof lhs.timing.etaToTriggerMs === 'number' ? lhs.timing.etaToTriggerMs : Number.POSITIVE_INFINITY;
  const rhsEta = typeof rhs.timing.etaToTriggerMs === 'number' ? rhs.timing.etaToTriggerMs : Number.POSITIVE_INFINITY;
  return lhsEta - rhsEta;
}

function compareTriggeredRecency(lhs: TradeStreamItem, rhs: TradeStreamItem): number {
  const lhsMs = parseIsoTimestamp(lhs.timing.triggeredAt);
  const rhsMs = parseIsoTimestamp(rhs.timing.triggeredAt);
  const lhsSafe = Number.isFinite(lhsMs) ? lhsMs : Number.NEGATIVE_INFINITY;
  const rhsSafe = Number.isFinite(rhsMs) ? rhsMs : Number.NEGATIVE_INFINITY;
  return rhsSafe - lhsSafe;
}

function compareResolvedRecency(lhs: TradeStreamItem, rhs: TradeStreamItem): number {
  const lhsMs = parseIsoTimestamp(lhs.timing.resolvedAt);
  const rhsMs = parseIsoTimestamp(rhs.timing.resolvedAt);
  const lhsSafe = Number.isFinite(lhsMs) ? lhsMs : Number.NEGATIVE_INFINITY;
  const rhsSafe = Number.isFinite(rhsMs) ? rhsMs : Number.NEGATIVE_INFINITY;
  return rhsSafe - lhsSafe;
}

function compareWithinLifecycle(lhs: TradeStreamItem, rhs: TradeStreamItem): number {
  if (lhs.momentPriority !== rhs.momentPriority) {
    return rhs.momentPriority - lhs.momentPriority;
  }

  if (lhs.lifecycleState === 'forming') {
    const etaComparison = compareEta(lhs, rhs);
    if (etaComparison !== 0) return etaComparison;
  }

  if (lhs.lifecycleState === 'triggered') {
    const triggeredComparison = compareTriggeredRecency(lhs, rhs);
    if (triggeredComparison !== 0) return triggeredComparison;
  }

  if (lhs.lifecycleState === 'past') {
    const resolvedComparison = compareResolvedRecency(lhs, rhs);
    if (resolvedComparison !== 0) return resolvedComparison;
  }

  const stableHashComparison = lhs.stableIdHash.localeCompare(rhs.stableIdHash);
  if (stableHashComparison !== 0) return stableHashComparison;
  return lhs.id.localeCompare(rhs.id);
}

function compareNowFocus(lhs: TradeStreamItem, rhs: TradeStreamItem): number {
  if (lhs.momentPriority !== rhs.momentPriority) {
    return rhs.momentPriority - lhs.momentPriority;
  }

  const lhsReferenceMs = parseIsoTimestamp(lhs.timing.triggeredAt || lhs.timing.resolvedAt || lhs.timing.createdAt);
  const rhsReferenceMs = parseIsoTimestamp(rhs.timing.triggeredAt || rhs.timing.resolvedAt || rhs.timing.createdAt);
  const lhsSafeMs = Number.isFinite(lhsReferenceMs) ? lhsReferenceMs : Number.NEGATIVE_INFINITY;
  const rhsSafeMs = Number.isFinite(rhsReferenceMs) ? rhsReferenceMs : Number.NEGATIVE_INFINITY;
  if (lhsSafeMs !== rhsSafeMs) {
    return rhsSafeMs - lhsSafeMs;
  }

  const stableHashComparison = lhs.stableIdHash.localeCompare(rhs.stableIdHash);
  if (stableHashComparison !== 0) return stableHashComparison;
  return lhs.id.localeCompare(rhs.id);
}

function defaultRecommendedAction(
  lifecycleState: TradeStreamLifecycleState,
  status: Setup['status'],
): TradeStreamRecommendedAction {
  if (lifecycleState === 'past') return 'REVIEW';
  if (lifecycleState === 'triggered') return 'MANAGE';
  if (status === 'ready') return 'STAGE';
  return 'WAIT';
}

function defaultActionBlockedReason(
  setup: TradeStreamAssemblySetup,
  lifecycleState: TradeStreamLifecycleState,
): string | null {
  if (typeof setup.actionBlockedReason === 'string') return setup.actionBlockedReason;

  if (lifecycleState === 'past') {
    return setup.invalidationReason || 'resolved';
  }
  if (lifecycleState === 'forming' && setup.status === 'forming') {
    return 'waiting_for_trigger';
  }
  return null;
}

function defaultTriggerContext(setup: TradeStreamAssemblySetup, lifecycleState: TradeStreamLifecycleState): string {
  const explicit = setup.reason?.triggerContext;
  if (typeof explicit === 'string' && explicit.length > 0) return explicit;

  if (setup.triggerContext) {
    return `${setup.triggerContext.triggerBarPatternType} @ ${setup.triggerContext.triggerBarTimestamp}`;
  }
  if (lifecycleState === 'forming') return 'Awaiting trigger confirmation.';
  if (lifecycleState === 'triggered') return 'Triggered and awaiting management.';
  return 'Resolved lifecycle record.';
}

function normalizeFreshness(
  freshness: TradeStreamFreshnessInput | undefined,
  feedTrust: TradeStreamFeedTrustMetadata,
): TradeStreamItem['freshness'] {
  return {
    source: pickPreferredString(freshness?.source, feedTrust.source, 'unknown') as string,
    generatedAt: pickPreferredString(freshness?.generatedAt, feedTrust.generatedAt) as string,
    ageMs: typeof freshness?.ageMs === 'number' ? freshness.ageMs : feedTrust.ageMs,
    degraded: typeof freshness?.degraded === 'boolean' ? freshness.degraded : feedTrust.degraded,
  };
}

export function resolveTradeStreamLifecycle(setup: TradeStreamAssemblySetup): TradeStreamLifecycleState {
  const hasResolution = Boolean(setup.outcome) || Boolean(setup.resolvedAt);
  if (hasResolution) return 'past';

  if (setup.status === 'invalidated' || setup.status === 'expired') {
    return 'past';
  }
  if (setup.status === 'triggered') {
    return 'triggered';
  }
  return 'forming';
}

function resolveTimingForSetup(
  setup: TradeStreamAssemblySetup,
  lifecycleState: TradeStreamLifecycleState,
): TradeStreamItem['timing'] {
  const resolvedAt = lifecycleState === 'past'
    ? pickPreferredString(setup.resolvedAt, setup.statusUpdatedAt, setup.triggeredAt, setup.createdAt)
    : null;

  return {
    createdAt: setup.createdAt,
    triggeredAt: setup.triggeredAt ?? null,
    resolvedAt,
    etaToTriggerMs: lifecycleState === 'forming' && typeof setup.etaToTriggerMs === 'number'
      ? setup.etaToTriggerMs
      : null,
  };
}

function resolveOutcomeForSetup(
  setup: TradeStreamAssemblySetup,
  lifecycleState: TradeStreamLifecycleState,
): TradeStreamItem['outcome'] {
  if (lifecycleState !== 'past') return null;
  if (setup.outcome) return setup.outcome;

  if (setup.status === 'invalidated') {
    return {
      result: 'invalidated',
      rMultiple: -1,
      resolvedBy: setup.invalidationReason || 'invalidated',
    };
  }
  if (setup.status === 'expired') {
    return {
      result: 'expired',
      rMultiple: 0,
      resolvedBy: setup.invalidationReason || 'expired',
    };
  }
  return null;
}

function toTradeStreamItemFromSetup(
  setup: TradeStreamAssemblySetup,
  feedTrust: TradeStreamFeedTrustMetadata,
): TradeStreamItem {
  const lifecycleState = resolveTradeStreamLifecycle(setup);
  const stableIdHash = normalizeStableIdHash(setup.stableIdHash, setup.id);

  return {
    id: setup.id,
    stableIdHash,
    lifecycleState,
    status: setup.status,
    direction: setup.direction,
    setupType: setup.type,
    entryZone: {
      low: setup.entryZone.low,
      high: setup.entryZone.high,
    },
    stop: setup.stop,
    target1: setup.target1.price,
    target2: setup.target2.price,
    probability: setup.probability,
    confluenceScore: setup.confluenceScore,
    evR: setup.evR ?? 0,
    alignmentScore: setup.alignmentScore ?? 0,
    momentPriority: deriveMomentPriorityFromSetup(setup),
    recommendedAction: setup.recommendedAction ?? defaultRecommendedAction(lifecycleState, setup.status),
    actionBlockedReason: defaultActionBlockedReason(setup, lifecycleState),
    freshness: normalizeFreshness(setup.freshness, feedTrust),
    timing: resolveTimingForSetup(setup, lifecycleState),
    reason: {
      triggerContext: defaultTriggerContext(setup, lifecycleState),
      gateReasons: asStringArray(setup.reason?.gateReasons).length > 0
        ? asStringArray(setup.reason?.gateReasons)
        : asStringArray(setup.gateReasons),
      decisionDrivers: asStringArray(setup.reason?.decisionDrivers).length > 0
        ? asStringArray(setup.reason?.decisionDrivers)
        : asStringArray(setup.decisionDrivers),
      decisionRisks: asStringArray(setup.reason?.decisionRisks).length > 0
        ? asStringArray(setup.reason?.decisionRisks)
        : asStringArray(setup.decisionRisks),
    },
    outcome: resolveOutcomeForSetup(setup, lifecycleState),
  };
}

function toTradeStreamItemFromRecord(
  record: TradeStreamPastResolutionRecord,
  feedTrust: TradeStreamFeedTrustMetadata,
): TradeStreamItem {
  const stableIdHash = normalizeStableIdHash(record.stableIdHash, record.id);
  const createdAt = pickPreferredString(record.timing?.createdAt, record.timing?.triggeredAt, feedTrust.generatedAt) as string;
  const resolvedAt = pickPreferredString(
    record.timing?.resolvedAt,
    record.timing?.triggeredAt,
    createdAt,
  );

  return {
    id: record.id,
    stableIdHash,
    lifecycleState: 'past',
    status: record.status,
    direction: record.direction,
    setupType: record.setupType,
    entryZone: {
      low: record.entryZone.low,
      high: record.entryZone.high,
    },
    stop: record.stop,
    target1: record.target1,
    target2: record.target2,
    probability: typeof record.probability === 'number' ? record.probability : 0,
    confluenceScore: typeof record.confluenceScore === 'number' ? record.confluenceScore : 0,
    evR: typeof record.evR === 'number' ? record.evR : 0,
    alignmentScore: typeof record.alignmentScore === 'number' ? record.alignmentScore : 0,
    momentPriority: typeof record.momentPriority === 'number' ? record.momentPriority : 0,
    recommendedAction: record.recommendedAction ?? 'REVIEW',
    actionBlockedReason: record.actionBlockedReason ?? 'resolved',
    freshness: normalizeFreshness(record.freshness, feedTrust),
    timing: {
      createdAt,
      triggeredAt: pickPreferredString(record.timing?.triggeredAt) ?? null,
      resolvedAt,
      etaToTriggerMs: null,
    },
    reason: {
      triggerContext: pickPreferredString(record.reason?.triggerContext, 'Resolved lifecycle record.') as string,
      gateReasons: asStringArray(record.reason?.gateReasons),
      decisionDrivers: asStringArray(record.reason?.decisionDrivers),
      decisionRisks: asStringArray(record.reason?.decisionRisks),
    },
    outcome: record.outcome ?? null,
  };
}

export function compareTradeStreamItems(lhs: TradeStreamItem, rhs: TradeStreamItem): number {
  const lifecycleComparison = lifecycleRank(lhs.lifecycleState) - lifecycleRank(rhs.lifecycleState);
  if (lifecycleComparison !== 0) return lifecycleComparison;
  return compareWithinLifecycle(lhs, rhs);
}

export function sortTradeStreamItems(items: ReadonlyArray<TradeStreamItem>): TradeStreamItem[] {
  return [...items].sort(compareTradeStreamItems);
}

export function selectNowFocusItemId(items: ReadonlyArray<TradeStreamItem>): string | null {
  if (items.length === 0) return null;
  return [...items].sort(compareNowFocus)[0]?.id ?? null;
}

export function deriveCountsByLifecycle(
  items: ReadonlyArray<TradeStreamItem>,
): Record<TradeStreamLifecycleState, number> {
  const counts: Record<TradeStreamLifecycleState, number> = {
    forming: 0,
    triggered: 0,
    past: 0,
  };

  for (const item of items) {
    counts[item.lifecycleState] += 1;
  }

  return counts;
}

export function buildTradeStreamSnapshot(input: BuildTradeStreamSnapshotInput): TradeStreamSnapshot {
  const itemsByStableHash = new Map<string, TradeStreamItem>();

  for (const setup of input.setups) {
    const item = toTradeStreamItemFromSetup(setup, input.feedTrust);
    itemsByStableHash.set(item.stableIdHash, item);
  }

  for (const record of input.pastRecords ?? []) {
    const item = toTradeStreamItemFromRecord(record, input.feedTrust);
    itemsByStableHash.set(item.stableIdHash, item);
  }

  for (const record of input.resolutionRecords ?? []) {
    const item = toTradeStreamItemFromRecord(record, input.feedTrust);
    itemsByStableHash.set(item.stableIdHash, item);
  }

  const items = sortTradeStreamItems(Array.from(itemsByStableHash.values()));
  return {
    items,
    nowFocusItemId: selectNowFocusItemId(items),
    countsByLifecycle: deriveCountsByLifecycle(items),
    feedTrust: {
      source: input.feedTrust.source,
      generatedAt: input.feedTrust.generatedAt,
      ageMs: input.feedTrust.ageMs,
      degraded: input.feedTrust.degraded,
      stale: input.feedTrust.stale,
      reason: input.feedTrust.reason,
    },
    generatedAt: input.generatedAt,
  };
}
