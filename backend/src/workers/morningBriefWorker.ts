/**
 * Morning Brief Worker
 *
 * Schedules and generates morning briefs at/after 7:00 AM ET on trading days.
 * Uses idempotent inserts per (user_id, market_date) to avoid duplicate generation.
 */

import { supabase } from '../config/database';
import { logger } from '../lib/logger';
import { isTradingDay, toEasternTime } from '../services/marketHours';
import { morningBriefService } from '../services/morningBrief';

const MORNING_BRIEF_TARGET_MINUTES_ET = 7 * 60; // 7:00 AM ET
const MORNING_BRIEF_CHECK_INTERVAL_MS = 60_000; // 1 minute

let workerTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let lastGeneratedMarketDate: string | null = null;

export function shouldGenerateMorningBriefs(
  now: Date,
  lastGeneratedDate: string | null,
): { shouldRun: boolean; marketDate: string } {
  const et = toEasternTime(now);
  const marketDate = et.dateStr;
  const minutes = et.hour * 60 + et.minute;

  if (!isTradingDay(now)) {
    return { shouldRun: false, marketDate };
  }

  if (lastGeneratedDate === marketDate) {
    return { shouldRun: false, marketDate };
  }

  if (minutes < MORNING_BRIEF_TARGET_MINUTES_ET) {
    return { shouldRun: false, marketDate };
  }

  return { shouldRun: true, marketDate };
}

async function loadCandidateUserIds(): Promise<string[]> {
  const userIds = new Set<string>();

  const { data: watchlistRows, error: watchlistError } = await supabase
    .from('ai_coach_watchlists')
    .select('user_id')
    .limit(5000);

  if (watchlistError) {
    logger.warn('Morning brief worker: failed to load watchlist users', {
      error: watchlistError.message,
      code: (watchlistError as any).code,
    });
  } else {
    for (const row of watchlistRows || []) {
      if (row?.user_id) userIds.add(String(row.user_id));
    }
  }

  const { data: coachUserRows, error: coachUserError } = await supabase
    .from('ai_coach_users')
    .select('user_id')
    .limit(5000);

  if (coachUserError) {
    logger.warn('Morning brief worker: failed to load ai_coach_users', {
      error: coachUserError.message,
      code: (coachUserError as any).code,
    });
  } else {
    for (const row of coachUserRows || []) {
      if (row?.user_id) userIds.add(String(row.user_id));
    }
  }

  return Array.from(userIds);
}

async function loadExistingBriefUserIds(marketDate: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('ai_coach_morning_briefs')
    .select('user_id')
    .eq('market_date', marketDate);

  if (error) {
    logger.warn('Morning brief worker: failed to load existing briefs', {
      marketDate,
      error: error.message,
      code: (error as any).code,
    });
    return new Set<string>();
  }

  return new Set((data || []).map((row: any) => String(row.user_id)));
}

export async function generateMorningBriefsForMarketDate(marketDate: string): Promise<{
  candidates: number;
  generated: number;
  skippedExisting: number;
  failed: number;
}> {
  const candidateUserIds = await loadCandidateUserIds();
  const existingBriefUserIds = await loadExistingBriefUserIds(marketDate);

  let generated = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (const userId of candidateUserIds) {
    if (existingBriefUserIds.has(userId)) {
      skippedExisting += 1;
      continue;
    }

    try {
      const brief = await morningBriefService.generateBrief(userId);
      const { error } = await supabase
        .from('ai_coach_morning_briefs')
        .insert({
          user_id: userId,
          market_date: marketDate,
          brief_data: brief,
          viewed: false,
        });

      if (error) {
        if ((error as any).code === '23505') {
          skippedExisting += 1;
          continue;
        }

        failed += 1;
        logger.warn('Morning brief worker: failed to save brief', {
          userId,
          marketDate,
          error: error.message,
          code: (error as any).code,
        });
        continue;
      }

      generated += 1;
    } catch (error) {
      failed += 1;
      logger.warn('Morning brief worker: failed to generate brief', {
        userId,
        marketDate,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    candidates: candidateUserIds.length,
    generated,
    skippedExisting,
    failed,
  };
}

async function runCycle(): Promise<void> {
  if (!isRunning) return;

  try {
    const now = new Date();
    const schedule = shouldGenerateMorningBriefs(now, lastGeneratedMarketDate);

    if (schedule.shouldRun) {
      const stats = await generateMorningBriefsForMarketDate(schedule.marketDate);
      lastGeneratedMarketDate = schedule.marketDate;

      logger.info('Morning brief worker run complete', {
        marketDate: schedule.marketDate,
        ...stats,
      });
    }
  } catch (error) {
    logger.error('Morning brief worker cycle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    workerTimer = setTimeout(runCycle, MORNING_BRIEF_CHECK_INTERVAL_MS);
  }
}

export function startMorningBriefWorker(): void {
  if (isRunning) {
    logger.warn('Morning brief worker is already running');
    return;
  }

  isRunning = true;
  logger.info('Morning brief worker started');
  workerTimer = setTimeout(runCycle, MORNING_BRIEF_CHECK_INTERVAL_MS);
}

export function stopMorningBriefWorker(): void {
  isRunning = false;

  if (workerTimer) {
    clearTimeout(workerTimer);
    workerTimer = null;
  }

  logger.info('Morning brief worker stopped');
}
