import type { SetupTransitionEvent } from './tickEvaluator';
import type { CoachMessage } from './types';

type ExecutionCommand =
  | 'ENTER'
  | 'TAKE_PARTIAL_T1'
  | 'MOVE_STOP_TO_BREAKEVEN'
  | 'EXIT_T2'
  | 'EXIT_STOP';

interface ExecutionDirective {
  command: ExecutionCommand;
  actionId: 'ENTER_TRADE_FOCUS' | 'EXIT_TRADE_FOCUS';
  phase: SetupTransitionEvent['toPhase'];
  transitionId: string;
  transitionTimestamp: string;
  reason: SetupTransitionEvent['reason'];
  fromPhase: SetupTransitionEvent['fromPhase'];
  toPhase: SetupTransitionEvent['toPhase'];
  setupStatus: SetupTransitionEvent['setup']['status'];
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function humanizeSetupType(type: string): string {
  return type
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function buildTriggeredDirective(event: SetupTransitionEvent): {
  content: string;
  directive: ExecutionDirective;
  type: CoachMessage['type'];
  priority: CoachMessage['priority'];
} {
  const setup = event.setup;
  const entryMid = round((setup.entryZone.low + setup.entryZone.high) / 2, 2);
  const confluenceDescriptor = Number.isFinite(setup.confluenceScore)
    ? `confluence ${setup.confluenceScore}/5`
    : 'multi-factor';

  return {
    content: `Observation: SPX ${setup.direction === 'bullish' ? 'testing support at' : 'approaching resistance at'} ${humanizeSetupType(setup.type)} zone. ${setup.direction.charAt(0).toUpperCase() + setup.direction.slice(1)} setup, ${confluenceDescriptor}. Entry ${setup.entryZone.low.toFixed(2)}-${setup.entryZone.high.toFixed(2)} (ref ${entryMid.toFixed(2)}), stop ${setup.stop.toFixed(2)}, T1 ${setup.target1.price.toFixed(2)}, T2 ${setup.target2.price.toFixed(2)}.`,
    directive: {
      command: 'ENTER',
      actionId: 'ENTER_TRADE_FOCUS',
      phase: event.toPhase,
      transitionId: event.id,
      transitionTimestamp: event.timestamp,
      reason: event.reason,
      fromPhase: event.fromPhase,
      toPhase: event.toPhase,
      setupStatus: setup.status,
    },
    type: 'pre_trade',
    priority: 'setup',
  };
}

function buildTarget1Directive(event: SetupTransitionEvent): {
  content: string;
  directive: ExecutionDirective;
  type: CoachMessage['type'];
  priority: CoachMessage['priority'];
} {
  const setup = event.setup;
  const partialPct = Math.max(0, Math.min(1, setup.tradeManagement?.partialAtT1Pct ?? 0.55));
  const moveStop = setup.tradeManagement?.moveStopToBreakeven !== false;
  const entryMid = round((setup.entryZone.low + setup.entryZone.high) / 2, 2);
  const command: ExecutionCommand = moveStop ? 'MOVE_STOP_TO_BREAKEVEN' : 'TAKE_PARTIAL_T1';

  return {
    content: moveStop
      ? `Execution command: TAKE ${Math.round(partialPct * 100)}% at T1 ${setup.target1.price.toFixed(2)} and move stop to breakeven ${entryMid.toFixed(2)}.`
      : `Execution command: TAKE ${Math.round(partialPct * 100)}% at T1 ${setup.target1.price.toFixed(2)} and keep stop discipline at ${setup.stop.toFixed(2)}.`,
    directive: {
      command,
      actionId: 'EXIT_TRADE_FOCUS',
      phase: event.toPhase,
      transitionId: event.id,
      transitionTimestamp: event.timestamp,
      reason: event.reason,
      fromPhase: event.fromPhase,
      toPhase: event.toPhase,
      setupStatus: setup.status,
    },
    type: 'in_trade',
    priority: 'setup',
  };
}

function buildTarget2Directive(event: SetupTransitionEvent): {
  content: string;
  directive: ExecutionDirective;
  type: CoachMessage['type'];
  priority: CoachMessage['priority'];
} {
  const setup = event.setup;

  return {
    content: `Action: EXIT remainder at T2 ${setup.target2.price.toFixed(2)}. Full objective reached.`,
    directive: {
      command: 'EXIT_T2',
      actionId: 'EXIT_TRADE_FOCUS',
      phase: event.toPhase,
      transitionId: event.id,
      transitionTimestamp: event.timestamp,
      reason: event.reason,
      fromPhase: event.fromPhase,
      toPhase: event.toPhase,
      setupStatus: setup.status,
    },
    type: 'post_trade',
    priority: 'setup',
  };
}

function buildStopDirective(event: SetupTransitionEvent): {
  content: string;
  directive: ExecutionDirective;
  type: CoachMessage['type'];
  priority: CoachMessage['priority'];
} {
  const setup = event.setup;

  return {
    content: `Risk protocol: Stop ${setup.stop.toFixed(2)} confirmed. Exit and preserve capital. Discipline held.`,
    directive: {
      command: 'EXIT_STOP',
      actionId: 'EXIT_TRADE_FOCUS',
      phase: event.toPhase,
      transitionId: event.id,
      transitionTimestamp: event.timestamp,
      reason: event.reason,
      fromPhase: event.fromPhase,
      toPhase: event.toPhase,
      setupStatus: setup.status,
    },
    type: 'alert',
    priority: 'alert',
  };
}

function buildReflectiveDirective(event: SetupTransitionEvent): {
  content: string;
  directive: ExecutionDirective;
  type: CoachMessage['type'];
  priority: CoachMessage['priority'];
} | null {
  const setup = event.setup;
  let content: string | null = null;

  if (event.reason === 'target2') {
    content = `Review: Trade captured T2 at ${setup.target2.price.toFixed(2)}. ${humanizeSetupType(setup.type)} in ${setup.regime} regime — note conditions for future setups.`;
  } else if (event.reason === 'stop') {
    content = `Review: Stop hit at ${setup.stop.toFixed(2)}. ${humanizeSetupType(setup.type)} in ${setup.regime} — review entry timing post-session.`;
  } else if (event.reason === 'target1') {
    content = `Review: Partial taken at T1 ${setup.target1.price.toFixed(2)}. Runner still active.`;
  }

  if (!content) return null;

  return {
    content,
    directive: {
      command: event.reason === 'stop' ? 'EXIT_STOP' : 'EXIT_T2',
      actionId: 'EXIT_TRADE_FOCUS',
      phase: event.toPhase,
      transitionId: event.id,
      transitionTimestamp: event.timestamp,
      reason: event.reason,
      fromPhase: event.fromPhase,
      toPhase: event.toPhase,
      setupStatus: setup.status,
    },
    type: 'post_trade',
    priority: 'guidance',
  };
}

export function buildExecutionCoachMessageFromTransition(
  event: SetupTransitionEvent,
  options?: {
    onReflectiveMessage?: (message: CoachMessage) => void;
    reflectionDelayMs?: number;
  },
): CoachMessage | null {
  let descriptor: {
    content: string;
    directive: ExecutionDirective;
    type: CoachMessage['type'];
    priority: CoachMessage['priority'];
  } | null = null;

  if (event.toPhase === 'triggered') {
    descriptor = buildTriggeredDirective(event);
  } else if (event.toPhase === 'target1_hit') {
    descriptor = buildTarget1Directive(event);
  } else if (event.toPhase === 'target2_hit') {
    descriptor = buildTarget2Directive(event);
  } else if (event.toPhase === 'invalidated' && event.reason === 'stop') {
    descriptor = buildStopDirective(event);
  }

  if (!descriptor) return null;

  const primaryMessage: CoachMessage = {
    id: `coach_execution_${event.id}`,
    type: descriptor.type,
    priority: descriptor.priority,
    setupId: event.setupId,
    content: descriptor.content,
    structuredData: {
      source: 'setup_transition',
      directiveVersion: 'v1',
      executionDirective: descriptor.directive,
      transition: {
        id: event.id,
        setupId: event.setupId,
        symbol: event.symbol,
        direction: event.direction,
        fromPhase: event.fromPhase,
        toPhase: event.toPhase,
        reason: event.reason,
        price: event.price,
        timestamp: event.timestamp,
      },
      setup: {
        type: event.setup.type,
        entryZone: event.setup.entryZone,
        stop: event.setup.stop,
        target1: event.setup.target1,
        target2: event.setup.target2,
      },
    },
    timestamp: event.timestamp,
  };
  const terminalPhase = event.toPhase === 'target2_hit' || (event.toPhase === 'invalidated' && event.reason === 'stop');
  if (terminalPhase) {
    const reflection = buildReflectiveDirective(event);
    if (reflection && options?.onReflectiveMessage) {
      const reflectionDelayMs = Math.max(0, options.reflectionDelayMs ?? 5000);
      setTimeout(() => {
        options.onReflectiveMessage?.({
          id: `coach_execution_reflective_${event.id}`,
          type: reflection.type,
          priority: reflection.priority,
          setupId: event.setupId,
          content: reflection.content,
          structuredData: {
            source: 'setup_transition',
            directiveVersion: 'v1',
            executionDirective: reflection.directive,
            transition: {
              id: event.id,
              setupId: event.setupId,
              symbol: event.symbol,
              direction: event.direction,
              fromPhase: event.fromPhase,
              toPhase: event.toPhase,
              reason: event.reason,
              price: event.price,
              timestamp: event.timestamp,
            },
            setup: {
              type: event.setup.type,
              entryZone: event.setup.entryZone,
              stop: event.setup.stop,
              target1: event.setup.target1,
              target2: event.setup.target2,
            },
          },
          timestamp: event.timestamp,
        });
      }, reflectionDelayMs);
    }
  }

  return primaryMessage;
}
