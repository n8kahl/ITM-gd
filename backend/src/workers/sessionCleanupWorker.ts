import { supabase } from '../config/database';
import { logger } from '../lib/logger';
import {
  markWorkerCycleFailed,
  markWorkerCycleStarted,
  markWorkerCycleSucceeded,
  markWorkerNextRun,
  markWorkerStarted,
  markWorkerStopped,
  registerWorker,
} from '../services/workerHealth';

const SESSION_CLEANUP_TARGET_HOUR_UTC = 2; // 2:00 AM UTC daily
const SESSION_CLEANUP_CHECK_INTERVAL_MS = 60_000;
const WORKER_NAME = 'session_cleanup_worker';

let workerTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let lastCleanupDate: string | null = null;
registerWorker(WORKER_NAME);

interface SessionCleanupStats {
  foundExpired: number;
  archivedSessions: number;
  archivedMessages: number;
  deletedMessages: number;
  failedSessions: number;
}

interface ExpiredSessionRow {
  id: string;
}

interface SessionMessageRow {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  function_call: unknown;
  function_response: unknown;
  tokens_used: number | null;
  created_at: string;
}

function getUtcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Determines if the daily cleanup cycle should run based on UTC date/hour.
 */
export function shouldRunSessionCleanup(
  now: Date,
  lastRunDate: string | null,
): { shouldRun: boolean; dateKey: string } {
  const dateKey = getUtcDateKey(now);

  if (lastRunDate === dateKey) {
    return { shouldRun: false, dateKey };
  }

  if (now.getUTCHours() < SESSION_CLEANUP_TARGET_HOUR_UTC) {
    return { shouldRun: false, dateKey };
  }

  return { shouldRun: true, dateKey };
}

/**
 * Archives expired AI coach sessions and moves their messages into the archive table.
 */
export async function archiveExpiredSessions(now: Date = new Date()): Promise<SessionCleanupStats> {
  const nowIso = now.toISOString();

  const stats: SessionCleanupStats = {
    foundExpired: 0,
    archivedSessions: 0,
    archivedMessages: 0,
    deletedMessages: 0,
    failedSessions: 0,
  };

  const { data: expiredSessions, error: expiredSessionsError } = await supabase
    .from('ai_coach_sessions')
    .select('id')
    .lt('expires_at', nowIso)
    .is('archived_at', null)
    .limit(500);

  if (expiredSessionsError) {
    throw new Error(`Failed to load expired sessions: ${expiredSessionsError.message}`);
  }

  const sessions = (expiredSessions || []) as ExpiredSessionRow[];
  stats.foundExpired = sessions.length;

  for (const session of sessions) {
    try {
      const { data: messages, error: messagesError } = await supabase
        .from('ai_coach_messages')
        .select('id, session_id, user_id, role, content, function_call, function_response, tokens_used, created_at')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });

      if (messagesError) {
        throw new Error(`Failed to load session messages: ${messagesError.message}`);
      }

      const sessionMessages = (messages || []) as SessionMessageRow[];

      if (sessionMessages.length > 0) {
        const archiveRows = sessionMessages.map((message) => ({
          original_message_id: message.id,
          session_id: message.session_id,
          user_id: message.user_id,
          role: message.role,
          content: message.content,
          function_call: message.function_call,
          function_response: message.function_response,
          tokens_used: message.tokens_used,
          created_at: message.created_at,
          archived_at: nowIso,
        }));

        const { error: archiveMessagesError } = await supabase
          .from('ai_coach_messages_archive')
          .upsert(archiveRows, { onConflict: 'original_message_id', ignoreDuplicates: true });

        if (archiveMessagesError) {
          throw new Error(`Failed to archive messages: ${archiveMessagesError.message}`);
        }

        stats.archivedMessages += sessionMessages.length;

        const { error: deleteMessagesError } = await supabase
          .from('ai_coach_messages')
          .delete()
          .eq('session_id', session.id);

        if (deleteMessagesError) {
          throw new Error(`Failed to delete active messages: ${deleteMessagesError.message}`);
        }

        stats.deletedMessages += sessionMessages.length;
      }

      const { error: archiveSessionError } = await supabase
        .from('ai_coach_sessions')
        .update({
          archived_at: nowIso,
          ended_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', session.id)
        .is('archived_at', null);

      if (archiveSessionError) {
        throw new Error(`Failed to archive session: ${archiveSessionError.message}`);
      }

      stats.archivedSessions += 1;
    } catch (error) {
      stats.failedSessions += 1;
      logger.warn('Session cleanup worker failed to archive session', {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return stats;
}

async function runCycle(): Promise<void> {
  if (!isRunning) return;

  const cycleStartedAt = markWorkerCycleStarted(WORKER_NAME);
  try {
    const schedule = shouldRunSessionCleanup(new Date(), lastCleanupDate);

    if (schedule.shouldRun) {
      const stats = await archiveExpiredSessions();
      lastCleanupDate = schedule.dateKey;

      logger.info('Session cleanup worker run complete', {
        dateKey: schedule.dateKey,
        ...stats,
      });
    }

    markWorkerCycleSucceeded(WORKER_NAME, cycleStartedAt);
  } catch (error) {
    markWorkerCycleFailed(WORKER_NAME, cycleStartedAt, error);
    logger.error('Session cleanup worker cycle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    markWorkerNextRun(WORKER_NAME, SESSION_CLEANUP_CHECK_INTERVAL_MS);
    workerTimer = setTimeout(runCycle, SESSION_CLEANUP_CHECK_INTERVAL_MS);
  }
}

/**
 * Starts the AI coach session cleanup worker.
 */
export function startSessionCleanupWorker(): void {
  if (isRunning) {
    logger.warn('Session cleanup worker is already running');
    return;
  }

  isRunning = true;
  markWorkerStarted(WORKER_NAME);
  logger.info('Session cleanup worker started');

  markWorkerNextRun(WORKER_NAME, SESSION_CLEANUP_CHECK_INTERVAL_MS);
  workerTimer = setTimeout(runCycle, SESSION_CLEANUP_CHECK_INTERVAL_MS);
}

/**
 * Stops the AI coach session cleanup worker.
 */
export function stopSessionCleanupWorker(): void {
  isRunning = false;
  markWorkerStopped(WORKER_NAME);

  if (workerTimer) {
    clearTimeout(workerTimer);
    workerTimer = null;
  }

  logger.info('Session cleanup worker stopped');
}
