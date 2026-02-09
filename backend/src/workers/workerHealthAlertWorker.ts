import { getEnv } from '../config/env';
import { Sentry } from '../config/sentry';
import { logger } from '../lib/logger';
import { sendDiscordWebhookMessage } from '../services/discordNotifier';
import {
  detectWorkerHealthIssue,
  formatWorkerIssueDiscordMessage,
  formatWorkerRecoveryDiscordMessage,
  type WorkerHealthIssueType,
} from '../services/workerHealthAlerting';
import {
  getWorkerHealthSnapshot,
  markWorkerCycleFailed,
  markWorkerCycleStarted,
  markWorkerCycleSucceeded,
  markWorkerNextRun,
  markWorkerStarted,
  markWorkerStopped,
  registerWorker,
} from '../services/workerHealth';

const WORKER_NAME = 'worker_health_alert_worker';

export const WORKER_ALERT_DEFAULT_POLL_INTERVAL_MS = 60_000;
export const WORKER_ALERT_DEFAULT_STALE_THRESHOLD_MS = 20 * 60 * 1000;
export const WORKER_ALERT_DEFAULT_STARTUP_GRACE_MS = 5 * 60 * 1000;
export const WORKER_ALERT_DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;

interface WorkerIncidentState {
  activeIssueKey: string | null;
  activeIssueType: WorkerHealthIssueType | null;
  lastNotificationAt: number | null;
}

const incidentStateByWorker = new Map<string, WorkerIncidentState>();

let pollingTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

registerWorker(WORKER_NAME);

function buildWorkerState(workerName: string): WorkerIncidentState {
  const existing = incidentStateByWorker.get(workerName);
  if (existing) return existing;

  const state: WorkerIncidentState = {
    activeIssueKey: null,
    activeIssueType: null,
    lastNotificationAt: null,
  };
  incidentStateByWorker.set(workerName, state);
  return state;
}

function clearRetiredWorkerState(activeWorkers: Set<string>): void {
  for (const workerName of incidentStateByWorker.keys()) {
    if (!activeWorkers.has(workerName)) {
      incidentStateByWorker.delete(workerName);
    }
  }
}

function captureIssueInSentry(
  issueType: WorkerHealthIssueType,
  workerName: string,
  summary: string,
  detail: string,
): void {
  Sentry.withScope((scope: any) => {
    scope.setTag('worker_name', workerName);
    scope.setTag('worker_alert_type', issueType);
    scope.setLevel(issueType === 'error' ? 'error' : 'warning');
    scope.setExtra('worker_alert_detail', detail);
    Sentry.captureMessage(summary, issueType === 'error' ? 'error' : 'warning');
  });
}

function captureRecoveryInSentry(
  workerName: string,
  issueType: WorkerHealthIssueType,
): void {
  Sentry.withScope((scope: any) => {
    scope.setTag('worker_name', workerName);
    scope.setTag('worker_recovery_from', issueType);
    scope.setLevel('info');
    Sentry.captureMessage(`Worker ${workerName} recovered from ${issueType}`, 'info');
  });
}

async function notifyIssue(
  webhookUrl: string | undefined,
  message: string,
): Promise<void> {
  if (!webhookUrl) return;
  await sendDiscordWebhookMessage(webhookUrl, message);
}

async function evaluateAndAlertWorkers(): Promise<void> {
  const env = getEnv();
  if (!env.WORKER_ALERTS_ENABLED) return;

  const nowMs = Date.now();
  const pollCooldownMs = env.WORKER_ALERTS_COOLDOWN_MS || WORKER_ALERT_DEFAULT_COOLDOWN_MS;
  const staleThresholdMs = env.WORKER_ALERTS_STALE_THRESHOLD_MS || WORKER_ALERT_DEFAULT_STALE_THRESHOLD_MS;
  const startupGraceMs = env.WORKER_ALERTS_STARTUP_GRACE_MS || WORKER_ALERT_DEFAULT_STARTUP_GRACE_MS;

  const workers = getWorkerHealthSnapshot().filter((worker) => worker.name !== WORKER_NAME);
  const activeWorkerNames = new Set(workers.map((worker) => worker.name));
  clearRetiredWorkerState(activeWorkerNames);

  for (const worker of workers) {
    const state = buildWorkerState(worker.name);

    const issue = detectWorkerHealthIssue(worker, {
      nowMs,
      staleThresholdMs,
      startupGraceMs,
    });

    if (!issue) {
      if (state.activeIssueKey && state.activeIssueType) {
        const recoveryMessage = formatWorkerRecoveryDiscordMessage(
          env.NODE_ENV,
          worker.name,
          state.activeIssueType,
        );

        try {
          await notifyIssue(env.WORKER_ALERTS_DISCORD_WEBHOOK_URL, recoveryMessage);
          if (env.WORKER_ALERTS_SENTRY_ENABLED && env.SENTRY_DSN) {
            captureRecoveryInSentry(worker.name, state.activeIssueType);
          }
        } catch (error) {
          logger.error('Worker health alert: failed to send Discord recovery alert', {
            worker: worker.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        logger.info('Worker health alert: worker recovered', {
          worker: worker.name,
          recoveredFrom: state.activeIssueType,
        });
      }

      state.activeIssueKey = null;
      state.activeIssueType = null;
      state.lastNotificationAt = null;
      continue;
    }

    const sameIssueActive = state.activeIssueKey === issue.issueKey;
    const cooldownElapsed = state.lastNotificationAt === null
      || nowMs - state.lastNotificationAt >= pollCooldownMs;
    const shouldSendAlert = !sameIssueActive || cooldownElapsed;

    if (shouldSendAlert) {
      const alertMessage = formatWorkerIssueDiscordMessage(env.NODE_ENV, issue);

      try {
        await notifyIssue(env.WORKER_ALERTS_DISCORD_WEBHOOK_URL, alertMessage);
        if (env.WORKER_ALERTS_SENTRY_ENABLED && env.SENTRY_DSN) {
          captureIssueInSentry(issue.type, issue.workerName, issue.summary, issue.detail);
        }
      } catch (error) {
        logger.error('Worker health alert: failed to send Discord issue alert', {
          worker: worker.name,
          issueType: issue.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      logger.warn('Worker health alert: incident detected', {
        worker: issue.workerName,
        issueType: issue.type,
        summary: issue.summary,
        detail: issue.detail,
      });
      state.lastNotificationAt = nowMs;
    }

    state.activeIssueKey = issue.issueKey;
    state.activeIssueType = issue.type;
  }
}

async function runCycle(): Promise<void> {
  if (!isRunning) return;

  const env = getEnv();
  const interval = env.WORKER_ALERTS_POLL_INTERVAL_MS || WORKER_ALERT_DEFAULT_POLL_INTERVAL_MS;
  const cycleStartedAt = markWorkerCycleStarted(WORKER_NAME);

  try {
    await evaluateAndAlertWorkers();
    markWorkerCycleSucceeded(WORKER_NAME, cycleStartedAt);
  } catch (error) {
    markWorkerCycleFailed(WORKER_NAME, cycleStartedAt, error);
    logger.error('Worker health alert worker: cycle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    markWorkerNextRun(WORKER_NAME, interval);
    pollingTimer = setTimeout(runCycle, interval);
  }
}

export function startWorkerHealthAlertWorker(): void {
  if (isRunning) {
    logger.warn('Worker health alert worker is already running');
    return;
  }

  const env = getEnv();
  if (!env.WORKER_ALERTS_ENABLED) {
    logger.info('Worker health alert worker disabled by configuration');
    return;
  }

  isRunning = true;
  markWorkerStarted(WORKER_NAME);
  logger.info('Worker health alert worker started');

  const initialDelayMs = 5_000;
  markWorkerNextRun(WORKER_NAME, initialDelayMs);
  pollingTimer = setTimeout(runCycle, initialDelayMs);
}

export function stopWorkerHealthAlertWorker(): void {
  isRunning = false;
  markWorkerStopped(WORKER_NAME);

  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
  }

  logger.info('Worker health alert worker stopped');
}
