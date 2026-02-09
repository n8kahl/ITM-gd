import { logger } from '../lib/logger';

export interface SetupPushHeartbeat {
  generatedAt: string;
  activeSetupCount: number;
  uniqueUsers: number;
}

export interface SetupStatusUpdate {
  setupId: string;
  userId: string;
  symbol: string;
  setupType: string;
  previousStatus: 'active';
  status: 'triggered' | 'invalidated';
  currentPrice: number;
  reason: 'target_reached' | 'stop_loss_hit';
  evaluatedAt: string;
}

export interface SetupDetectedUpdate {
  trackedSetupId: string;
  detectedSetupId: string;
  userId: string;
  symbol: string;
  setupType: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number | null;
  currentPrice: number | null;
  detectedAt: string;
}

export type SetupPushEvent =
  | {
      type: 'heartbeat';
      payload: SetupPushHeartbeat;
    }
  | {
      type: 'setup_update';
      payload: SetupStatusUpdate;
    }
  | {
      type: 'setup_detected';
      payload: SetupDetectedUpdate;
    };

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

export function publishSetupStatusUpdate(payload: SetupStatusUpdate): void {
  if (listeners.size === 0) return;

  const event: SetupPushEvent = { type: 'setup_update', payload };

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

export function publishSetupDetected(payload: SetupDetectedUpdate): void {
  if (listeners.size === 0) return;

  const event: SetupPushEvent = { type: 'setup_detected', payload };

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
