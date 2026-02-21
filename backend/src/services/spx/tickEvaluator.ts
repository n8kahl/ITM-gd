import type { Setup } from './types';
import type { NormalizedMarketTick } from '../tickCache';
import { nowIso } from './utils';

type TransitionPhase =
  | 'ready'
  | 'triggered'
  | 'target1_hit'
  | 'target2_hit'
  | 'invalidated'
  | 'expired';

const PHASE_RANK: Record<TransitionPhase, number> = {
  ready: 0,
  triggered: 1,
  target1_hit: 2,
  target2_hit: 3,
  invalidated: 4,
  expired: 5,
};

const TERMINAL_PHASES = new Set<TransitionPhase>(['target2_hit', 'invalidated', 'expired']);

export interface SetupTransitionEvent {
  id: string;
  setupId: string;
  symbol: string;
  direction: Setup['direction'];
  fromPhase: TransitionPhase;
  toPhase: TransitionPhase;
  price: number;
  timestamp: string;
  reason: 'entry' | 'stop' | 'target1' | 'target2';
  setup: Setup;
}

interface SetupRuntimeState {
  setupId: string;
  phase: TransitionPhase;
  setup: Setup;
  lastTransitionAtMs: number;
  stopBreachStreak: number;
  sequence: number;
}

const DEFAULT_MIN_TRANSITION_GAP_MS = 1000;
const DEFAULT_STOP_CONFIRMATION_TICKS = 2;
const DEFAULT_MOVE_STOP_TO_BREAKEVEN_AFTER_T1 = true;
const setupStateById = new Map<string, SetupRuntimeState>();

function parseIntEnv(value: string | undefined, fallback: number, minimum = 1): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(parsed, minimum);
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

function phaseFromSetupStatus(setup: Setup): TransitionPhase {
  if (setup.status === 'triggered') return 'triggered';
  if (setup.status === 'invalidated') return 'invalidated';
  if (setup.status === 'expired') return 'expired';
  return 'ready';
}

function toSetupStatus(phase: TransitionPhase): Setup['status'] {
  if (phase === 'triggered' || phase === 'target1_hit') return 'triggered';
  if (phase === 'invalidated') return 'invalidated';
  if (phase === 'target2_hit' || phase === 'expired') return 'expired';
  return 'ready';
}

function isInsideEntryZone(setup: Setup, price: number): boolean {
  return price >= setup.entryZone.low && price <= setup.entryZone.high;
}

function stopBreached(setup: Setup, price: number, phase: TransitionPhase): boolean {
  const moveStopToBreakeven = parseBooleanEnv(
    process.env.SPX_SETUP_MOVE_STOP_TO_BREAKEVEN_AFTER_T1,
    DEFAULT_MOVE_STOP_TO_BREAKEVEN_AFTER_T1,
  );
  const entryMid = (setup.entryZone.low + setup.entryZone.high) / 2;
  const stopPrice = phase === 'target1_hit' && moveStopToBreakeven
    ? entryMid
    : setup.stop;
  return setup.direction === 'bullish'
    ? price <= stopPrice
    : price >= stopPrice;
}

function target1Reached(setup: Setup, price: number): boolean {
  return setup.direction === 'bullish'
    ? price >= setup.target1.price
    : price <= setup.target1.price;
}

function target2Reached(setup: Setup, price: number): boolean {
  return setup.direction === 'bullish'
    ? price >= setup.target2.price
    : price <= setup.target2.price;
}

function applyPhaseToSetup(
  setup: Setup,
  phase: TransitionPhase,
  transitionTimestampIso: string,
  transitionReason?: SetupTransitionEvent['reason'],
): Setup {
  const status = toSetupStatus(phase);
  const nextTriggeredAt = (phase === 'triggered' || phase === 'target1_hit' || phase === 'target2_hit')
    ? (setup.triggeredAt || transitionTimestampIso)
    : setup.triggeredAt;

  const invalidationReason = status === 'invalidated'
    ? transitionReason === 'stop'
      ? 'stop_breach_confirmed'
      : setup.invalidationReason || 'unknown'
    : null;

  return {
    ...setup,
    status,
    statusUpdatedAt: transitionTimestampIso,
    ttlExpiresAt: null,
    invalidationReason,
    triggeredAt: nextTriggeredAt,
  };
}

function resolveTransition(
  phase: TransitionPhase,
  setup: Setup,
  price: number,
): { toPhase: TransitionPhase; reason: SetupTransitionEvent['reason'] } | null {
  if (phase === 'ready') {
    if (stopBreached(setup, price, phase)) {
      return { toPhase: 'invalidated', reason: 'stop' };
    }
    if (isInsideEntryZone(setup, price)) {
      return { toPhase: 'triggered', reason: 'entry' };
    }
    return null;
  }

  if (phase === 'triggered') {
    if (stopBreached(setup, price, phase)) {
      return { toPhase: 'invalidated', reason: 'stop' };
    }
    if (target2Reached(setup, price)) {
      return { toPhase: 'target2_hit', reason: 'target2' };
    }
    if (target1Reached(setup, price)) {
      return { toPhase: 'target1_hit', reason: 'target1' };
    }
    return null;
  }

  if (phase === 'target1_hit') {
    if (stopBreached(setup, price, phase)) {
      return { toPhase: 'invalidated', reason: 'stop' };
    }
    if (target2Reached(setup, price)) {
      return { toPhase: 'target2_hit', reason: 'target2' };
    }
    return null;
  }

  return null;
}

export function syncTickEvaluatorSetups(setups: Setup[]): void {
  const incomingIds = new Set(setups.map((setup) => setup.id));

  for (const setup of setups) {
    const incomingPhase = phaseFromSetupStatus(setup);
    const existing = setupStateById.get(setup.id);
    if (!existing) {
      setupStateById.set(setup.id, {
        setupId: setup.id,
        phase: incomingPhase,
        setup,
        lastTransitionAtMs: 0,
        stopBreachStreak: 0,
        sequence: 0,
      });
      continue;
    }

    const existingRank = PHASE_RANK[existing.phase];
    const incomingRank = PHASE_RANK[incomingPhase];
    const phase = incomingRank > existingRank ? incomingPhase : existing.phase;

    setupStateById.set(setup.id, {
      ...existing,
      setup: applyPhaseToSetup(setup, phase, setup.triggeredAt || nowIso()),
      phase,
      stopBreachStreak: 0,
    });
  }

  for (const setupId of setupStateById.keys()) {
    if (!incomingIds.has(setupId)) {
      setupStateById.delete(setupId);
    }
  }
}

export function applyTickStateToSetups(setups: Setup[]): Setup[] {
  return setups.map((setup) => {
    const state = setupStateById.get(setup.id);
    if (!state) return setup;

    const incomingPhase = phaseFromSetupStatus(setup);
    if (PHASE_RANK[incomingPhase] >= PHASE_RANK[state.phase]) {
      state.setup = applyPhaseToSetup(setup, incomingPhase, setup.triggeredAt || nowIso());
      state.phase = incomingPhase;
      return state.setup;
    }

    state.setup = applyPhaseToSetup(setup, state.phase, state.setup.triggeredAt || nowIso());
    return state.setup;
  });
}

export function evaluateTickSetupTransitions(
  tick: NormalizedMarketTick,
  options?: { minTransitionGapMs?: number; minStopBreachTicks?: number },
): SetupTransitionEvent[] {
  const minGapMs = Math.max(0, options?.minTransitionGapMs ?? DEFAULT_MIN_TRANSITION_GAP_MS);
  const minStopBreachTicks = Math.max(
    1,
    options?.minStopBreachTicks
      ?? parseIntEnv(process.env.SPX_SETUP_STOP_CONFIRMATION_TICKS, DEFAULT_STOP_CONFIRMATION_TICKS, 1),
  );
  const events: SetupTransitionEvent[] = [];
  const transitionTimestampIso = new Date(tick.timestamp).toISOString();

  for (const state of setupStateById.values()) {
    if (TERMINAL_PHASES.has(state.phase)) continue;
    if (tick.symbol !== 'SPX') continue;

    if (stopBreached(state.setup, tick.price, state.phase)) {
      state.stopBreachStreak += 1;
    } else {
      state.stopBreachStreak = 0;
    }

    const transition = resolveTransition(state.phase, state.setup, tick.price);
    if (!transition) continue;
    if (transition.toPhase === 'invalidated' && transition.reason === 'stop' && state.stopBreachStreak < minStopBreachTicks) {
      continue;
    }
    if (tick.timestamp - state.lastTransitionAtMs < minGapMs) continue;
    if (PHASE_RANK[transition.toPhase] <= PHASE_RANK[state.phase]) continue;

    const previousPhase = state.phase;
    state.phase = transition.toPhase;
    state.lastTransitionAtMs = tick.timestamp;
    state.stopBreachStreak = 0;
    state.sequence += 1;
    state.setup = applyPhaseToSetup(state.setup, transition.toPhase, transitionTimestampIso, transition.reason);

    events.push({
      id: `${state.setupId}:${state.sequence}:${transition.toPhase}:${tick.timestamp}`,
      setupId: state.setupId,
      symbol: tick.symbol,
      direction: state.setup.direction,
      fromPhase: previousPhase,
      toPhase: transition.toPhase,
      price: tick.price,
      timestamp: transitionTimestampIso,
      reason: transition.reason,
      setup: state.setup,
    });
  }

  return events;
}

export function resetTickEvaluatorState(): void {
  setupStateById.clear();
}
