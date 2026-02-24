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
  previousStatus: 'active' | 'triggered' | 'invalidated' | 'archived';
  status: 'active' | 'triggered' | 'invalidated' | 'archived';
  currentPrice: number | null;
  reason: 'target_reached' | 'stop_loss_hit' | 'manual_update' | 'stale_timeout' | 'superseded_by_newer_setup';
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

function broadcastToListeners(event: SetupPushEvent): void {
  const snapshot = Array.from(listeners);

  for (const listener of snapshot) {
    try {
      listener(event);
    } catch (error) {
      logger.warn('Setup push listener failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export function subscribeSetupPushEvents(listener: SetupPushListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishSetupPushHeartbeat(payload: SetupPushHeartbeat): void {
  if (listeners.size === 0) return;

  const event: SetupPushEvent = { type: 'heartbeat', payload };
  broadcastToListeners(event);
}

export function publishSetupStatusUpdate(payload: SetupStatusUpdate): void {
  if (listeners.size === 0) return;

  const event: SetupPushEvent = { type: 'setup_update', payload };
  broadcastToListeners(event);
}

export function publishSetupDetected(payload: SetupDetectedUpdate): void {
  if (listeners.size === 0) return;

  const event: SetupPushEvent = { type: 'setup_detected', payload };
  broadcastToListeners(event);
}
