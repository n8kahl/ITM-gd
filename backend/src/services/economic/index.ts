/**
 * Economic Calendar Service
 *
 * Fetches real economic release dates from FRED (Federal Reserve Economic Data)
 * and maps them to the EconomicEvent interface used by macroContext.ts.
 *
 * Falls back to procedural calendar generation when FRED is unavailable.
 */

import {
  getUpcomingReleaseDates,
  getSeriesObservations,
  RELEASE_MAP,
} from '../../config/fred';
import type { FREDReleaseDate } from '../../config/fred';
import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import type { EconomicEvent } from '../macro/macroContext';

// ============================================
// CONSTANTS
// ============================================

const CACHE_KEY_PREFIX = 'economic:calendar';
const CACHE_TTL_SECONDS = 2 * 60 * 60; // 2 hours
const PREVIOUS_VALUE_CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours

const DEFAULT_DAYS_AHEAD = 14;
const MAX_DAYS_AHEAD = 60;

// ============================================
// HELPERS
// ============================================

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Fetch the latest "previous" value for a FRED series.
 * Cached independently since these values change infrequently (monthly).
 */
async function getPreviousValue(seriesId: string): Promise<string | null> {
  const cacheKey = `economic:previous:${seriesId}`;

  try {
    const cached = await cacheGet<string>(cacheKey);
    if (cached !== null) return cached;
  } catch {
    // Cache miss — proceed to fetch
  }

  try {
    const observations = await getSeriesObservations(seriesId, 1);
    if (observations.length > 0 && observations[0].value !== '.') {
      const value = observations[0].value;
      await cacheSet(cacheKey, value, PREVIOUS_VALUE_CACHE_TTL_SECONDS).catch(() => {});
      return value;
    }
  } catch (error: any) {
    logger.debug('Failed to fetch previous value for series', { seriesId, error: error?.message });
  }

  return null;
}

// ============================================
// MAIN SERVICE
// ============================================

/**
 * Get upcoming economic calendar events from FRED.
 *
 * Filters FRED's full release calendar to only HIGH/MEDIUM impact events
 * relevant to options traders. Enriches with "previous" values from FRED series.
 *
 * Falls back to empty array if FRED is unavailable (macroContext.ts handles its own fallback).
 */
export async function getEconomicCalendar(
  daysAhead: number = DEFAULT_DAYS_AHEAD,
  impactFilter?: 'HIGH' | 'MEDIUM' | 'ALL',
): Promise<EconomicEvent[]> {
  const effectiveDays = Math.max(1, Math.min(MAX_DAYS_AHEAD, Math.round(daysAhead)));
  const filter = impactFilter || 'ALL';

  // Check if FRED is enabled
  if (process.env.FRED_ENABLED !== 'true') {
    logger.debug('FRED economic calendar disabled (FRED_ENABLED !== true)');
    return [];
  }

  // Try cache first
  const cacheKey = `${CACHE_KEY_PREFIX}:${effectiveDays}:${filter}`;
  try {
    const cached = await cacheGet<EconomicEvent[]>(cacheKey);
    if (cached) {
      logger.debug('Economic calendar cache hit', { daysAhead: effectiveDays, count: cached.length });
      return cached;
    }
  } catch {
    // Cache miss — proceed
  }

  // Fetch from FRED
  const now = new Date();
  const from = formatDate(now);
  const to = formatDate(addDays(now, effectiveDays));

  const allReleaseDates = await getUpcomingReleaseDates(from, to);
  if (allReleaseDates.length === 0) {
    logger.warn('FRED returned zero release dates', { from, to });
    return [];
  }

  // Filter to curated high-impact releases
  const relevantReleases = allReleaseDates.filter((rd: FREDReleaseDate) =>
    RELEASE_MAP.has(rd.release_id),
  );

  // Deduplicate: one event per release per date
  const seen = new Set<string>();
  const dedupedReleases = relevantReleases.filter((rd: FREDReleaseDate) => {
    const key = `${rd.release_id}:${rd.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Build events with optional previous values
  const events: EconomicEvent[] = await Promise.all(
    dedupedReleases.map(async (rd: FREDReleaseDate) => {
      const mapping = RELEASE_MAP.get(rd.release_id)!;

      // Fetch previous value (non-blocking — if it fails, we just omit it)
      let previous: string | null = null;
      try {
        previous = await getPreviousValue(mapping.seriesId);
      } catch {
        // Non-critical
      }

      return {
        date: rd.date,
        event: mapping.name,
        expected: null,     // FRED doesn't provide consensus estimates
        previous,
        actual: null,       // Populated after release
        impact: mapping.impact,
        relevance: mapping.relevance,
      };
    }),
  );

  // Apply impact filter
  const filtered = filter === 'ALL'
    ? events
    : events.filter((e) => e.impact === filter);

  // Sort by date ascending
  filtered.sort((a, b) => a.date.localeCompare(b.date));

  // Cache result
  try {
    await cacheSet(cacheKey, filtered, CACHE_TTL_SECONDS);
  } catch {
    // Non-critical
  }

  logger.info('Economic calendar built from FRED', {
    daysAhead: effectiveDays,
    totalFredDates: allReleaseDates.length,
    relevantReleases: dedupedReleases.length,
    filteredEvents: filtered.length,
  });

  return filtered;
}

/**
 * Get the current Fed Funds Rate from FRED.
 * Returns formatted string like "3.64%" or null if unavailable.
 */
export async function getCurrentFedFundsRate(): Promise<string | null> {
  if (process.env.FRED_ENABLED !== 'true') return null;

  const cacheKey = 'economic:fedfunds:current';
  try {
    const cached = await cacheGet<string>(cacheKey);
    if (cached) return cached;
  } catch {
    // Cache miss
  }

  try {
    const observations = await getSeriesObservations('FEDFUNDS', 1);
    if (observations.length > 0 && observations[0].value !== '.') {
      const rate = `${observations[0].value}%`;
      await cacheSet(cacheKey, rate, 6 * 60 * 60).catch(() => {});
      return rate;
    }
  } catch (error: any) {
    logger.error('Failed to fetch Fed Funds rate from FRED', { error: error?.message });
  }

  return null;
}
