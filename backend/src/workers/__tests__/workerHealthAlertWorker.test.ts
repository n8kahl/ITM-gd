const mockGetEnv = jest.fn() as jest.Mock<any, any>;
const mockSendDiscordWebhookMessage = jest.fn() as jest.Mock<any, any>;
const mockGetWorkerHealthSnapshot = jest.fn() as jest.Mock<any, any>;
const mockDetectWorkerHealthIssue = jest.fn() as jest.Mock<any, any>;
const mockFormatWorkerIssueDiscordMessage = jest.fn() as jest.Mock<any, any>;
const mockFormatWorkerRecoveryDiscordMessage = jest.fn() as jest.Mock<any, any>;

jest.mock('../../config/env', () => ({
  getEnv: (...args: any[]) => mockGetEnv(...args),
}));

jest.mock('../../services/discordNotifier', () => ({
  sendDiscordWebhookMessage: (...args: any[]) => mockSendDiscordWebhookMessage(...args),
}));

jest.mock('../../services/workerHealth', () => ({
  registerWorker: jest.fn(),
  markWorkerStarted: jest.fn(),
  markWorkerStopped: jest.fn(),
  markWorkerCycleStarted: jest.fn(() => Date.now()),
  markWorkerCycleSucceeded: jest.fn(),
  markWorkerCycleFailed: jest.fn(),
  markWorkerNextRun: jest.fn(),
  getWorkerHealthSnapshot: (...args: any[]) => mockGetWorkerHealthSnapshot(...args),
}));

jest.mock('../../services/workerHealthAlerting', () => ({
  detectWorkerHealthIssue: (...args: any[]) => mockDetectWorkerHealthIssue(...args),
  formatWorkerIssueDiscordMessage: (...args: any[]) => mockFormatWorkerIssueDiscordMessage(...args),
  formatWorkerRecoveryDiscordMessage: (...args: any[]) => mockFormatWorkerRecoveryDiscordMessage(...args),
}));

jest.mock('../../config/sentry', () => ({
  Sentry: {
    withScope: jest.fn((callback: any) => callback({
      setTag: jest.fn(),
      setLevel: jest.fn(),
      setExtra: jest.fn(),
    })),
    captureMessage: jest.fn(),
  },
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('workerHealthAlertWorker', () => {
  const baseEnv = {
    NODE_ENV: 'test',
    SENTRY_DSN: undefined,
    WORKER_ALERTS_ENABLED: true,
    WORKER_ALERTS_DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/test',
    WORKER_ALERTS_POLL_INTERVAL_MS: 1000,
    WORKER_ALERTS_STALE_THRESHOLD_MS: 1200000,
    WORKER_ALERTS_STARTUP_GRACE_MS: 300000,
    WORKER_ALERTS_COOLDOWN_MS: 60000,
    WORKER_ALERTS_SENTRY_ENABLED: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockGetEnv.mockReturnValue(baseEnv);

    mockGetWorkerHealthSnapshot.mockReturnValue([
      {
        name: 'alert_worker',
        isRunning: true,
      },
    ]);

    mockSendDiscordWebhookMessage.mockResolvedValue(undefined);
    mockFormatWorkerIssueDiscordMessage.mockReturnValue('issue-message');
    mockFormatWorkerRecoveryDiscordMessage.mockReturnValue('recovery-message');
  });

  afterEach(async () => {
    const workerModule = await import('../workerHealthAlertWorker');
    workerModule.stopWorkerHealthAlertWorker();
    jest.useRealTimers();
    jest.resetModules();
  });

  it('sends Discord alert when worker issue is detected', async () => {
    mockDetectWorkerHealthIssue.mockReturnValue({
      type: 'stale',
      workerName: 'alert_worker',
      summary: 'stale worker',
      detail: 'last cycle too old',
      issueKey: 'stale:last_cycle',
    });

    const workerModule = await import('../workerHealthAlertWorker');
    workerModule.startWorkerHealthAlertWorker();

    await jest.advanceTimersByTimeAsync(5005);

    expect(mockSendDiscordWebhookMessage).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/test',
      'issue-message',
    );
  });

  it('does not resend identical issue before cooldown expires', async () => {
    mockDetectWorkerHealthIssue.mockReturnValue({
      type: 'stale',
      workerName: 'alert_worker',
      summary: 'stale worker',
      detail: 'last cycle too old',
      issueKey: 'stale:last_cycle',
    });

    const workerModule = await import('../workerHealthAlertWorker');
    workerModule.startWorkerHealthAlertWorker();

    await jest.advanceTimersByTimeAsync(5005);
    await jest.advanceTimersByTimeAsync(1005);

    expect(mockSendDiscordWebhookMessage).toHaveBeenCalledTimes(1);
  });

  it('sends recovery notification after issue clears', async () => {
    mockDetectWorkerHealthIssue
      .mockReturnValueOnce({
        type: 'error',
        workerName: 'alert_worker',
        summary: 'worker error',
        detail: 'timeout',
        issueKey: 'error:timeout',
      })
      .mockReturnValueOnce(null);

    const workerModule = await import('../workerHealthAlertWorker');
    workerModule.startWorkerHealthAlertWorker();

    await jest.advanceTimersByTimeAsync(5005);
    await jest.advanceTimersByTimeAsync(1005);

    expect(mockSendDiscordWebhookMessage).toHaveBeenNthCalledWith(
      1,
      'https://discord.com/api/webhooks/test',
      'issue-message',
    );
    expect(mockSendDiscordWebhookMessage).toHaveBeenNthCalledWith(
      2,
      'https://discord.com/api/webhooks/test',
      'recovery-message',
    );
  });

  it('does not start when alerting is disabled', async () => {
    mockGetEnv.mockReturnValue({
      ...baseEnv,
      WORKER_ALERTS_ENABLED: false,
    });
    mockDetectWorkerHealthIssue.mockReturnValue({
      type: 'stale',
      workerName: 'alert_worker',
      summary: 'stale worker',
      detail: 'last cycle too old',
      issueKey: 'stale:last_cycle',
    });

    const workerModule = await import('../workerHealthAlertWorker');
    workerModule.startWorkerHealthAlertWorker();

    await jest.advanceTimersByTimeAsync(6000);

    expect(mockSendDiscordWebhookMessage).not.toHaveBeenCalled();
  });
});
