import { logger } from '../lib/logger';
import { PositionAdvice } from './positions/exitAdvisor';
import { LivePositionSnapshot } from './positions/liveTracker';

export interface PositionPushHeartbeat {
  generatedAt: string;
  activePositionCount: number;
  uniqueUsers: number;
}

export interface PositionLiveUpdate {
  userId: string;
  snapshot: LivePositionSnapshot;
  updatedAt: string;
}

export interface PositionAdviceUpdate {
  userId: string;
  advice: PositionAdvice;
  generatedAt: string;
}

export type PositionPushEvent =
  | {
      type: 'heartbeat';
      payload: PositionPushHeartbeat;
    }
  | {
      type: 'position_update';
      payload: PositionLiveUpdate;
    }
  | {
      type: 'position_advice';
      payload: PositionAdviceUpdate;
    };

type PositionPushListener = (event: PositionPushEvent) => void;

const listeners = new Set<PositionPushListener>();

export function subscribePositionPushEvents(listener: PositionPushListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publishEvent(event: PositionPushEvent): void {
  if (listeners.size === 0) return;

  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      logger.warn('Position push listener failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export function publishPositionPushHeartbeat(payload: PositionPushHeartbeat): void {
  publishEvent({ type: 'heartbeat', payload });
}

export function publishPositionLiveUpdate(payload: PositionLiveUpdate): void {
  publishEvent({ type: 'position_update', payload });
}

export function publishPositionAdvice(payload: PositionAdviceUpdate): void {
  publishEvent({ type: 'position_advice', payload });
}
