/**
 * Spaced Repetition Service
 *
 * Manages retry scheduling for failed academy activities.
 * Uses increasing intervals (1d, 3d, 7d) to re-queue activities
 * the learner struggled with.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Retry intervals in days, indexed by attempt number (0-based after first failure) */
const RETRY_INTERVALS_DAYS = [1, 3, 7] as const

/** Maximum retry attempts before the activity is dropped from the queue */
const MAX_RETRIES = RETRY_INTERVALS_DAYS.length

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetryQueueItem {
  blockId: string
  blockType: string
  lessonId: string
  userId: string
  attemptCount: number
  lastScore: number
  maxScore: number
  scheduledFor: string // ISO date string
  createdAt: string
}

export interface ScheduleRetryInput {
  blockId: string
  blockType: string
  lessonId: string
  userId: string
  score: number
  maxScore: number
  attemptCount: number
}

export interface RetryScheduleResult {
  scheduled: boolean
  nextRetryDate: string | null
  attemptCount: number
  maxRetriesReached: boolean
}

// ---------------------------------------------------------------------------
// Core Logic (pure functions — no DB dependency)
// ---------------------------------------------------------------------------

/**
 * Determines if an activity should be retried based on the score.
 * Activities with < 70% score are eligible for retry.
 */
export function shouldRetry(score: number, maxScore: number): boolean {
  if (maxScore <= 0) return false
  return score / maxScore < 0.7
}

/**
 * Calculates the next retry date based on the attempt count.
 * Returns null if max retries have been reached.
 */
export function calculateNextRetryDate(
  attemptCount: number,
  fromDate: Date = new Date()
): Date | null {
  if (attemptCount >= MAX_RETRIES) return null
  const intervalDays = RETRY_INTERVALS_DAYS[attemptCount] ?? RETRY_INTERVALS_DAYS[MAX_RETRIES - 1]
  const next = new Date(fromDate)
  next.setDate(next.getDate() + intervalDays)
  return next
}

/**
 * Builds a retry schedule result for a given activity submission.
 */
export function buildRetrySchedule(input: ScheduleRetryInput): RetryScheduleResult {
  if (!shouldRetry(input.score, input.maxScore)) {
    return {
      scheduled: false,
      nextRetryDate: null,
      attemptCount: input.attemptCount,
      maxRetriesReached: false,
    }
  }

  const nextDate = calculateNextRetryDate(input.attemptCount)

  if (!nextDate) {
    return {
      scheduled: false,
      nextRetryDate: null,
      attemptCount: input.attemptCount,
      maxRetriesReached: true,
    }
  }

  return {
    scheduled: true,
    nextRetryDate: nextDate.toISOString(),
    attemptCount: input.attemptCount + 1,
    maxRetriesReached: false,
  }
}

/**
 * Returns all retry interval values (useful for UI display).
 */
export function getRetryIntervals(): readonly number[] {
  return RETRY_INTERVALS_DAYS
}

/**
 * Returns the maximum number of retries allowed.
 */
export function getMaxRetries(): number {
  return MAX_RETRIES
}

/**
 * Filters a list of retry queue items to only those due now or in the past.
 */
export function getDueRetries(items: RetryQueueItem[], asOf: Date = new Date()): RetryQueueItem[] {
  const now = asOf.getTime()
  return items.filter((item) => new Date(item.scheduledFor).getTime() <= now)
}
