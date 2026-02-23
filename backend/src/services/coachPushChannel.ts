import { logger } from '../lib/logger';
import type { CoachMessage } from './spx/types';

export interface CoachPushMessage {
  userId: string;
  message: CoachMessage;
  generatedAt: string;
  source: 'portfolio_sync' | 'broker_execution' | 'system';
}

export type CoachPushEvent =
  | {
      type: 'coach_message';
      payload: CoachPushMessage;
    };

type CoachPushListener = (event: CoachPushEvent) => void;

const listeners = new Set<CoachPushListener>();

export function subscribeCoachPushEvents(listener: CoachPushListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishCoachMessage(payload: CoachPushMessage): void {
  if (listeners.size === 0) return;
  const event: CoachPushEvent = {
    type: 'coach_message',
    payload,
  };

  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      logger.warn('Coach push listener failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
