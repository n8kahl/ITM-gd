import { logger } from '../lib/logger';

export interface SetupPushHeartbeat {
  generatedAt: string;
  activeSetupCount: number;
  uniqueUsers: number;
}

export interface SetupPushEvent {
  type: 'heartbeat';
  payload: SetupPushHeartbeat;
}

type SetupPushListener = (event: SetupPushEvent) => void;

const listeners = new Set<SetupPushListener>();

export function subscribeSetupPushEvents(listener: SetupPushListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishSetupPushHeartbeat(payload: SetupPushHeartbeat): void {
  if (listeners.size === 0) return;

  const event: SetupPushEvent = { type: 'heartbeat', payload };

  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      logger.warn('Setup push listener failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
