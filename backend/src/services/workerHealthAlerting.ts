import type { WorkerHealthRecord } from './workerHealth';

export type WorkerHealthIssueType = 'stale' | 'error';

export interface WorkerHealthIssue {
  type: WorkerHealthIssueType;
  workerName: string;
  summary: string;
  detail: string;
  issueKey: string;
}

export interface WorkerHealthIssueOptions {
  nowMs: number;
  staleThresholdMs: number;
  startupGraceMs: number;
}

function parseIsoToMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0s';

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

function hasUnresolvedError(worker: WorkerHealthRecord): boolean {
  const lastErrorMs = parseIsoToMs(worker.lastErrorAt);
  if (lastErrorMs === null) return false;

  const lastSuccessMs = parseIsoToMs(worker.lastSuccessAt);
  if (lastSuccessMs === null) return true;

  return lastErrorMs > lastSuccessMs;
}

export function detectWorkerHealthIssue(
  worker: WorkerHealthRecord,
  options: WorkerHealthIssueOptions,
): WorkerHealthIssue | null {
  const { nowMs, staleThresholdMs, startupGraceMs } = options;

  if (hasUnresolvedError(worker)) {
    const errorMessage = worker.lastErrorMessage?.trim() || 'Unknown error';
    return {
      type: 'error',
      workerName: worker.name,
      summary: `Worker ${worker.name} has unresolved errors`,
      detail: `Last error: ${errorMessage}`,
      issueKey: `error:${errorMessage}`,
    };
  }

  if (!worker.isRunning) return null;

  const startedAtMs = parseIsoToMs(worker.startedAt);
  const lastCycleCompletedAtMs = parseIsoToMs(worker.lastCycleCompletedAt);

  if (lastCycleCompletedAtMs !== null) {
    const staleForMs = nowMs - lastCycleCompletedAtMs;
    if (staleForMs > staleThresholdMs) {
      return {
        type: 'stale',
        workerName: worker.name,
        summary: `Worker ${worker.name} appears stale`,
        detail: `Last completed cycle was ${formatDuration(staleForMs)} ago`,
        issueKey: 'stale:last_cycle',
      };
    }
    return null;
  }

  if (startedAtMs !== null) {
    const runningForMs = nowMs - startedAtMs;
    if (runningForMs > startupGraceMs) {
      return {
        type: 'stale',
        workerName: worker.name,
        summary: `Worker ${worker.name} has not completed an initial cycle`,
        detail: `Worker has been running for ${formatDuration(runningForMs)} without a completed cycle`,
        issueKey: 'stale:no_initial_cycle',
      };
    }
  }

  return null;
}

export function formatWorkerIssueDiscordMessage(
  environment: string,
  issue: WorkerHealthIssue,
): string {
  return [
    `:rotating_light: AI Coach Worker Alert (${environment})`,
    `Worker: ${issue.workerName}`,
    `Type: ${issue.type.toUpperCase()}`,
    `Summary: ${issue.summary}`,
    `Detail: ${issue.detail}`,
  ].join('\n');
}

export function formatWorkerRecoveryDiscordMessage(
  environment: string,
  workerName: string,
  previousIssueType: WorkerHealthIssueType,
): string {
  return [
    `:white_check_mark: AI Coach Worker Recovery (${environment})`,
    `Worker: ${workerName}`,
    `Recovered from: ${previousIssueType.toUpperCase()}`,
    'Status: healthy',
  ].join('\n');
}
