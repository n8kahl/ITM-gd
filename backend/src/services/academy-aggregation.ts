/**
 * Academy Aggregation Service
 *
 * Provides daily aggregation functions for:
 * - academy_lesson_analytics_daily: lesson-level usage metrics
 * - academy_cohort_metrics_daily: platform-wide cohort stats
 * - academy_user_competency_mastery_history: point-in-time mastery snapshots
 *
 * Designed to be invoked by a cron/scheduler (e.g., from an Edge Function
 * or a scheduled backend job).
 */

import { supabase } from '../config/database';
import { logger } from '../lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LessonAnalyticsRow {
  lesson_id: string;
  date: string;
  started_count: number;
  completed_count: number;
  avg_time_seconds: number;
  median_time_seconds: number;
  drop_off_rate: number;
}

interface CohortMetricsRow {
  date: string;
  active_users: number;
  lessons_started: number;
  lessons_completed: number;
  avg_session_minutes: number;
}

// ---------------------------------------------------------------------------
// 1. Lesson Analytics Daily Aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregate lesson-level analytics for a given date (defaults to yesterday).
 * Computes started_count, completed_count, avg/median time, and drop-off rate.
 */
export async function aggregateLessonAnalyticsDaily(
  date?: string
): Promise<{ rowsUpserted: number; errors: string[] }> {
  const targetDate = date ?? getYesterdayISO();
  const dayStart = `${targetDate}T00:00:00.000Z`;
  const dayEnd = `${targetDate}T23:59:59.999Z`;
  const errors: string[] = [];

  logger.info('Starting lesson analytics aggregation', { targetDate });

  // Fetch all learning events for the day
  const { data: events, error: eventsError } = await supabase
    .from('academy_learning_events')
    .select('entity_id, event_type, metadata, created_at')
    .in('event_type', ['lesson_started', 'lesson_completion', 'block_completed'])
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  if (eventsError) {
    errors.push(`Failed to fetch events: ${eventsError.message}`);
    return { rowsUpserted: 0, errors };
  }

  if (!events || events.length === 0) {
    logger.info('No events found for lesson analytics aggregation', { targetDate });
    return { rowsUpserted: 0, errors };
  }

  // Group events by lesson_id
  const lessonMap = new Map<string, {
    starts: number;
    completions: number;
    timesSeconds: number[];
  }>();

  for (const event of events) {
    const lessonId = event.entity_id as string;
    if (!lessonId) continue;

    if (!lessonMap.has(lessonId)) {
      lessonMap.set(lessonId, { starts: 0, completions: 0, timesSeconds: [] });
    }

    const entry = lessonMap.get(lessonId)!;

    if (event.event_type === 'lesson_started') {
      entry.starts++;
    } else if (event.event_type === 'lesson_completion') {
      entry.completions++;
      const meta = event.metadata as Record<string, unknown> | null;
      const timeMs = typeof meta?.['timeSpentMs'] === 'number' ? meta['timeSpentMs'] : 0;
      if (timeMs > 0) {
        entry.timesSeconds.push(timeMs / 1000);
      }
    }
  }

  // Build upsert rows
  const rows: LessonAnalyticsRow[] = [];

  for (const [lessonId, data] of lessonMap) {
    const avg = data.timesSeconds.length > 0
      ? data.timesSeconds.reduce((a, b) => a + b, 0) / data.timesSeconds.length
      : 0;

    const sorted = [...data.timesSeconds].sort((a, b) => a - b);
    const median = sorted.length > 0
      ? sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]
      : 0;

    const dropOff = data.starts > 0
      ? Math.max(0, 1 - data.completions / data.starts)
      : 0;

    rows.push({
      lesson_id: lessonId,
      date: targetDate,
      started_count: data.starts,
      completed_count: data.completions,
      avg_time_seconds: Math.round(avg),
      median_time_seconds: Math.round(median),
      drop_off_rate: Math.round(dropOff * 1000) / 1000,
    });
  }

  // Upsert into academy_lesson_analytics_daily
  const { error: upsertError } = await supabase
    .from('academy_lesson_analytics_daily')
    .upsert(rows, { onConflict: 'lesson_id,date' });

  if (upsertError) {
    errors.push(`Upsert failed: ${upsertError.message}`);
  }

  logger.info('Lesson analytics aggregation complete', {
    targetDate,
    rowsUpserted: rows.length,
    errors: errors.length,
  });

  return { rowsUpserted: rows.length, errors };
}

// ---------------------------------------------------------------------------
// 2. Cohort Metrics Daily Aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregate cohort-wide metrics for a given date (defaults to yesterday).
 */
export async function aggregateCohortMetricsDaily(
  date?: string
): Promise<{ success: boolean; errors: string[] }> {
  const targetDate = date ?? getYesterdayISO();
  const dayStart = `${targetDate}T00:00:00.000Z`;
  const dayEnd = `${targetDate}T23:59:59.999Z`;
  const errors: string[] = [];

  logger.info('Starting cohort metrics aggregation', { targetDate });

  const { data: events, error: eventsError } = await supabase
    .from('academy_learning_events')
    .select('user_id, event_type, metadata, created_at')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  if (eventsError) {
    errors.push(`Failed to fetch events: ${eventsError.message}`);
    return { success: false, errors };
  }

  if (!events || events.length === 0) {
    logger.info('No events found for cohort aggregation', { targetDate });
    // Still upsert a zero row
    const { error: upsertError } = await supabase
      .from('academy_cohort_metrics_daily')
      .upsert(
        { date: targetDate, active_users: 0, lessons_started: 0, lessons_completed: 0, avg_session_minutes: 0 },
        { onConflict: 'date' }
      );
    if (upsertError) errors.push(`Zero-row upsert failed: ${upsertError.message}`);
    return { success: errors.length === 0, errors };
  }

  const uniqueUsers = new Set<string>();
  let lessonsStarted = 0;
  let lessonsCompleted = 0;
  let totalTimeMs = 0;
  let timeEntries = 0;

  for (const event of events) {
    uniqueUsers.add(event.user_id as string);

    if (event.event_type === 'lesson_started') {
      lessonsStarted++;
    } else if (event.event_type === 'lesson_completion') {
      lessonsCompleted++;
    }

    const meta = event.metadata as Record<string, unknown> | null;
    const timeMs = typeof meta?.['timeSpentMs'] === 'number' ? meta['timeSpentMs'] : 0;
    if (timeMs > 0) {
      totalTimeMs += timeMs;
      timeEntries++;
    }
  }

  const avgSessionMinutes = timeEntries > 0
    ? Math.round((totalTimeMs / timeEntries / 60000) * 10) / 10
    : 0;

  const row: CohortMetricsRow = {
    date: targetDate,
    active_users: uniqueUsers.size,
    lessons_started: lessonsStarted,
    lessons_completed: lessonsCompleted,
    avg_session_minutes: avgSessionMinutes,
  };

  const { error: upsertError } = await supabase
    .from('academy_cohort_metrics_daily')
    .upsert(row, { onConflict: 'date' });

  if (upsertError) {
    errors.push(`Upsert failed: ${upsertError.message}`);
  }

  logger.info('Cohort metrics aggregation complete', {
    targetDate,
    activeUsers: uniqueUsers.size,
    lessonsStarted,
    lessonsCompleted,
    errors: errors.length,
  });

  return { success: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// 3. Competency Mastery History Snapshots
// ---------------------------------------------------------------------------

/**
 * Snapshot current competency mastery scores for all users into the history table.
 */
export async function snapshotCompetencyMasteryHistory(): Promise<{
  rowsInserted: number;
  errors: string[];
}> {
  const errors: string[] = [];

  logger.info('Starting competency mastery history snapshot');

  const { data: masteryRows, error: fetchError } = await supabase
    .from('academy_competency_mastery')
    .select('user_id, competency_id, score');

  if (fetchError) {
    errors.push(`Failed to fetch mastery: ${fetchError.message}`);
    return { rowsInserted: 0, errors };
  }

  if (!masteryRows || masteryRows.length === 0) {
    logger.info('No mastery records to snapshot');
    return { rowsInserted: 0, errors };
  }

  const now = new Date().toISOString();
  const historyRows = masteryRows.map((row) => ({
    user_id: row.user_id,
    competency_id: row.competency_id,
    score_snapshot: row.score,
    evaluated_at: now,
  }));

  const { error: insertError } = await supabase
    .from('academy_user_competency_mastery_history')
    .insert(historyRows);

  if (insertError) {
    errors.push(`Insert failed: ${insertError.message}`);
  }

  logger.info('Competency mastery history snapshot complete', {
    rowsInserted: historyRows.length,
    errors: errors.length,
  });

  return { rowsInserted: historyRows.length, errors };
}

// ---------------------------------------------------------------------------
// 4. Run All Aggregations (convenience)
// ---------------------------------------------------------------------------

/**
 * Run all daily aggregation tasks. Designed for a single cron invocation.
 */
export async function runDailyAggregation(date?: string): Promise<{
  lessons: { rowsUpserted: number; errors: string[] };
  cohort: { success: boolean; errors: string[] };
  mastery: { rowsInserted: number; errors: string[] };
}> {
  const [lessons, cohort, mastery] = await Promise.all([
    aggregateLessonAnalyticsDaily(date),
    aggregateCohortMetricsDaily(date),
    snapshotCompetencyMasteryHistory(),
  ]);

  return { lessons, cohort, mastery };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
