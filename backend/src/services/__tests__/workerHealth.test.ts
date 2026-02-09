import {
  getWorkerHealthByName,
  markWorkerCycleFailed,
  markWorkerCycleStarted,
  markWorkerCycleSucceeded,
  markWorkerNextRun,
  markWorkerStarted,
  markWorkerStopped,
  registerWorker,
} from '../workerHealth';

describe('workerHealth', () => {
  it('tracks worker lifecycle and scheduling metadata', () => {
    const workerName = `test_worker_${Date.now()}_lifecycle`;

    registerWorker(workerName);
    markWorkerStarted(workerName);
    markWorkerNextRun(workerName, 15000);

    const record = getWorkerHealthByName(workerName);

    expect(record).toBeTruthy();
    expect(record?.isRunning).toBe(true);
    expect(record?.startedAt).toEqual(expect.any(String));
    expect(record?.pollIntervalMs).toBe(15000);
    expect(record?.nextRunAt).toEqual(expect.any(String));

    markWorkerStopped(workerName);

    const stopped = getWorkerHealthByName(workerName);
    expect(stopped?.isRunning).toBe(false);
    expect(stopped?.stoppedAt).toEqual(expect.any(String));
    expect(stopped?.nextRunAt).toBeNull();
  });

  it('tracks successful and failed cycles', () => {
    const workerName = `test_worker_${Date.now()}_cycles`;

    registerWorker(workerName);
    markWorkerStarted(workerName);

    const successStartedAt = markWorkerCycleStarted(workerName);
    markWorkerCycleSucceeded(workerName, successStartedAt);

    const failureStartedAt = markWorkerCycleStarted(workerName);
    markWorkerCycleFailed(workerName, failureStartedAt, new Error('boom'));

    const record = getWorkerHealthByName(workerName);

    expect(record).toBeTruthy();
    expect(record?.cycleCount).toBe(2);
    expect(record?.successCount).toBe(1);
    expect(record?.errorCount).toBe(1);
    expect(record?.lastErrorMessage).toBe('boom');
    expect(record?.lastDurationMs).not.toBeNull();
    expect(record?.lastCycleCompletedAt).toEqual(expect.any(String));
  });
});
