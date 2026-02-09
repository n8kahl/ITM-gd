import {
  detectWorkerHealthIssue,
  formatWorkerIssueDiscordMessage,
  formatWorkerRecoveryDiscordMessage,
} from '../workerHealthAlerting';
import type { WorkerHealthRecord } from '../workerHealth';

function buildWorker(overrides: Partial<WorkerHealthRecord>): WorkerHealthRecord {
  return {
    name: 'test_worker',
    isRunning: true,
    startedAt: '2026-02-09T14:00:00.000Z',
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
    pollIntervalMs: 60_000,
    nextRunAt: null,
    ...overrides,
  };
}

describe('workerHealthAlerting', () => {
  const nowMs = Date.parse('2026-02-09T15:00:00.000Z');
  const baseOptions = {
    nowMs,
    staleThresholdMs: 20 * 60 * 1000,
    startupGraceMs: 5 * 60 * 1000,
  };

  it('flags unresolved worker errors', () => {
    const worker = buildWorker({
      lastErrorAt: '2026-02-09T14:58:00.000Z',
      lastErrorMessage: 'Massive API timeout',
      lastSuccessAt: '2026-02-09T14:56:00.000Z',
      errorCount: 1,
    });

    const issue = detectWorkerHealthIssue(worker, baseOptions);

    expect(issue?.type).toBe('error');
    expect(issue?.issueKey).toContain('Massive API timeout');
  });

  it('does not flag resolved error when success is newer', () => {
    const worker = buildWorker({
      lastErrorAt: '2026-02-09T14:50:00.000Z',
      lastErrorMessage: 'Transient error',
      lastSuccessAt: '2026-02-09T14:55:00.000Z',
      lastCycleCompletedAt: '2026-02-09T14:59:30.000Z',
      cycleCount: 10,
      successCount: 10,
      errorCount: 1,
    });

    const issue = detectWorkerHealthIssue(worker, baseOptions);
    expect(issue).toBeNull();
  });

  it('flags stale worker when last cycle exceeds stale threshold', () => {
    const worker = buildWorker({
      cycleCount: 2,
      successCount: 2,
      lastCycleCompletedAt: '2026-02-09T14:35:00.000Z',
      lastSuccessAt: '2026-02-09T14:35:00.000Z',
    });

    const issue = detectWorkerHealthIssue(worker, baseOptions);

    expect(issue?.type).toBe('stale');
    expect(issue?.issueKey).toBe('stale:last_cycle');
  });

  it('flags running worker with no initial cycle after startup grace', () => {
    const worker = buildWorker({
      startedAt: '2026-02-09T14:40:00.000Z',
      cycleCount: 0,
      lastCycleCompletedAt: null,
    });

    const issue = detectWorkerHealthIssue(worker, baseOptions);

    expect(issue?.type).toBe('stale');
    expect(issue?.issueKey).toBe('stale:no_initial_cycle');
  });

  it('ignores non-running workers', () => {
    const worker = buildWorker({
      isRunning: false,
      stoppedAt: '2026-02-09T14:59:00.000Z',
      lastCycleCompletedAt: '2026-02-09T14:58:00.000Z',
    });

    const issue = detectWorkerHealthIssue(worker, baseOptions);
    expect(issue).toBeNull();
  });

  it('formats Discord issue and recovery messages', () => {
    const worker = buildWorker({
      lastErrorAt: '2026-02-09T14:58:00.000Z',
      lastErrorMessage: 'Test failure',
    });
    const issue = detectWorkerHealthIssue(worker, baseOptions);
    expect(issue).toBeTruthy();

    const issueMessage = formatWorkerIssueDiscordMessage('production', issue!);
    expect(issueMessage).toContain('AI Coach Worker Alert (production)');
    expect(issueMessage).toContain('test_worker');

    const recoveryMessage = formatWorkerRecoveryDiscordMessage('production', 'test_worker', 'error');
    expect(recoveryMessage).toContain('AI Coach Worker Recovery (production)');
    expect(recoveryMessage).toContain('Recovered from: ERROR');
  });
});
