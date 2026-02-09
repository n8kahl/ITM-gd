import { logger } from '../lib/logger';

export interface WorkerHealthRecord {
  name: string;
  isRunning: boolean;
  startedAt: string | null;
  stoppedAt: string | null;
  lastCycleStartedAt: string | null;
  lastCycleCompletedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  cycleCount: number;
  successCount: number;
  errorCount: number;
  lastDurationMs: number | null;
  pollIntervalMs: number | null;
  nextRunAt: string | null;
}

const workerState = new Map<string, WorkerHealthRecord>();

function nowIso(): string {
  return new Date().toISOString();
}

function ensureWorker(name: string): WorkerHealthRecord {
  const existing = workerState.get(name);
  if (existing) return existing;

  const record: WorkerHealthRecord = {
    name,
    isRunning: false,
    startedAt: null,
    stoppedAt: null,
    lastCycleStartedAt: null,
    lastCycleCompletedAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    cycleCount: 0,
    successCount: 0,
    errorCount: 0,
    lastDurationMs: null,
    pollIntervalMs: null,
    nextRunAt: null,
  };

  workerState.set(name, record);
  return record;
}

export function registerWorker(name: string): void {
  ensureWorker(name);
}

export function markWorkerStarted(name: string): void {
  const record = ensureWorker(name);
  record.isRunning = true;
  record.startedAt = nowIso();
  record.stoppedAt = null;
}

export function markWorkerStopped(name: string): void {
  const record = ensureWorker(name);
  record.isRunning = false;
  record.stoppedAt = nowIso();
  record.nextRunAt = null;
}

export function markWorkerCycleStarted(name: string): number {
  const record = ensureWorker(name);
  const startedAt = Date.now();
  record.lastCycleStartedAt = new Date(startedAt).toISOString();
  record.cycleCount += 1;
  return startedAt;
}

export function markWorkerCycleSucceeded(
  name: string,
  startedAtMs: number,
): void {
  const record = ensureWorker(name);
  const completedAt = Date.now();

  record.lastCycleCompletedAt = new Date(completedAt).toISOString();
  record.lastSuccessAt = record.lastCycleCompletedAt;
  record.successCount += 1;
  record.lastDurationMs = Math.max(0, completedAt - startedAtMs);
}

export function markWorkerCycleFailed(
  name: string,
  startedAtMs: number,
  error: unknown,
): void {
  const record = ensureWorker(name);
  const completedAt = Date.now();

  record.lastCycleCompletedAt = new Date(completedAt).toISOString();
  record.lastErrorAt = record.lastCycleCompletedAt;
  record.errorCount += 1;
  record.lastDurationMs = Math.max(0, completedAt - startedAtMs);

  const errorMessage = error instanceof Error ? error.message : String(error);
  record.lastErrorMessage = errorMessage;

  logger.warn('Worker cycle failed', {
    worker: name,
    error: errorMessage,
  });
}

export function markWorkerNextRun(
  name: string,
  intervalMs: number,
): void {
  const record = ensureWorker(name);
  record.pollIntervalMs = intervalMs;
  record.nextRunAt = new Date(Date.now() + intervalMs).toISOString();
}

export function getWorkerHealthSnapshot(): WorkerHealthRecord[] {
  return Array.from(workerState.values()).map((record) => ({ ...record }));
}

export function getWorkerHealthByName(name: string): WorkerHealthRecord | null {
  const record = workerState.get(name);
  return record ? { ...record } : null;
}
