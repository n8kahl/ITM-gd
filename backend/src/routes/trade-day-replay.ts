import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDailyAggregates, getMinuteAggregates, getOptionsSnapshotAtDate, type MassiveAggregate, type OptionsSnapshot } from '../config/massive';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { logger } from '../lib/logger';
import { sendError, ErrorCode } from '../lib/errors';
import { hasBackendAdminAccess } from '../lib/adminAccess';
import { toEasternTime } from '../services/marketHours';
import { formatTradierOccSymbol, tradierOccToMassiveTicker } from '../services/broker/tradier/occFormatter';
import { parseTranscriptToTrades, TranscriptParserError } from '../services/trade-day-replay/transcript-parser';
import { scoreTrade } from '../services/trade-day-replay/trade-scorer';
import type {
  ChartBar,
  EnrichedTrade,
  OptionsContext,
  ParsedTrade,
  PriorDayBar,
  ReplayPayload,
  SessionStats,
} from '../services/trade-day-replay/types';

const router = Router();
const REPLAY_BUILD_DELAY_MS = 100;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TRANSCRIPT_CHARS = 120_000;
const MAX_PARSED_TRADES = 25;

router.use(authenticateToken);

async function requireAdmin(req: Request, res: Response, next: () => void): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    sendError(res, 401, ErrorCode.UNAUTHORIZED, 'Authentication required');
    return;
  }

  const isAdmin = await hasBackendAdminAccess(userId);
  if (!isAdmin) {
    sendError(res, 403, ErrorCode.FORBIDDEN, 'Admin access required');
    return;
  }

  next();
}

router.use(requireAdmin);

function isValidIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isValidCalendarDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

const buildRequestSchema = z.object({
  transcript: z
    .string()
    .trim()
    .min(1, 'Transcript is required')
    .max(MAX_TRANSCRIPT_CHARS, `Transcript must be at most ${MAX_TRANSCRIPT_CHARS} characters.`),
  inputTimezone: z
    .string()
    .trim()
    .min(1)
    .refine(isValidIanaTimezone, 'Input timezone must be a valid IANA timezone name.')
    .optional(),
  date: z
    .string()
    .regex(DATE_REGEX, 'Date must be YYYY-MM-DD')
    .refine(isValidCalendarDate, 'Date must be a valid calendar date.')
    .optional(),
});

function toSafeNumber(value: unknown, fallback: number = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function parseEpochMs(timestamp: string): number | null {
  const epochMs = Date.parse(timestamp);
  return Number.isFinite(epochMs) ? epochMs : null;
}

function getPriorTradingDay(dateStr: string): string {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const date = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr)));
  // Go back one day, skip weekends
  date.setUTCDate(date.getUTCDate() - 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function fetchPriorDayBar(replayDate: string): Promise<PriorDayBar | undefined> {
  try {
    const priorDate = getPriorTradingDay(replayDate);
    const dailyBars = await getDailyAggregates('I:SPX', priorDate, priorDate);
    if (dailyBars.length > 0) {
      const bar = dailyBars[0];
      const high = typeof bar.h === 'number' && Number.isFinite(bar.h) ? bar.h : null;
      const low = typeof bar.l === 'number' && Number.isFinite(bar.l) ? bar.l : null;
      if (high != null && low != null) {
        return { high, low };
      }
    }
  } catch (error) {
    logger.warn('Trade Day Replay prior day bar fetch failed', {
      replayDate,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return undefined;
}

function mapAggregatesToChartBars(aggregates: MassiveAggregate[]): ChartBar[] {
  return (aggregates || [])
    .map((bar) => ({
      time: Math.floor(toSafeNumber(bar.t) / 1000),
      open: toSafeNumber(bar.o),
      high: toSafeNumber(bar.h),
      low: toSafeNumber(bar.l),
      close: toSafeNumber(bar.c),
      volume: toSafeNumber(bar.v),
    }))
    .filter((bar) => bar.time > 0 && bar.open > 0 && bar.high > 0 && bar.low > 0 && bar.close > 0)
    .sort((a, b) => a.time - b.time);
}

function deriveReplayDate(requestedDate: string | undefined, trades: ParsedTrade[]): string {
  if (requestedDate) return requestedDate;
  const firstEntryEpochMs = trades
    .map((trade) => parseEpochMs(trade.entryTimestamp))
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b)[0];

  if (!firstEntryEpochMs) {
    return toEasternTime(new Date()).dateStr;
  }

  return toEasternTime(new Date(firstEntryEpochMs)).dateStr;
}

function getTradeFinalTimestampMs(trade: ParsedTrade): number {
  const entryMs = parseEpochMs(trade.entryTimestamp);
  const exitMs = trade.exitEvents
    .map((event) => parseEpochMs(event.timestamp))
    .filter((value): value is number => value != null)
    .sort((a, b) => b - a)[0];

  return exitMs ?? entryMs ?? Date.now();
}

function deriveSessionWindow(trades: ParsedTrade[]): { startMs: number; endMs: number } {
  const allEntries = trades
    .map((trade) => parseEpochMs(trade.entryTimestamp))
    .filter((value): value is number => value != null);
  const allTradeEnds = trades.map((trade) => getTradeFinalTimestampMs(trade));

  const startMs = (allEntries.length ? Math.min(...allEntries) : Date.now());
  const endMs = (allTradeEnds.length ? Math.max(...allTradeEnds) : startMs);

  return { startMs, endMs: Math.max(startMs, endMs) };
}

function extractOptionsContext(snapshot: OptionsSnapshot | undefined): OptionsContext | null {
  if (!snapshot) return null;
  return {
    delta: snapshot.greeks?.delta ?? null,
    gamma: snapshot.greeks?.gamma ?? null,
    theta: snapshot.greeks?.theta ?? null,
    vega: snapshot.greeks?.vega ?? null,
    iv: snapshot.implied_volatility ?? null,
    bid: snapshot.last_quote?.bid ?? null,
    ask: snapshot.last_quote?.ask ?? null,
  };
}

function computePnlPercent(trade: ParsedTrade): number | null {
  const percentages = trade.exitEvents
    .map((event) => (typeof event.percentage === 'number' ? event.percentage : null))
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (!percentages.length) return null;
  const average = percentages.reduce((sum, value) => sum + value, 0) / percentages.length;
  return round(average, 2);
}

function computeHoldDurationMinutes(trade: ParsedTrade): number | null {
  const entryMs = parseEpochMs(trade.entryTimestamp);
  if (entryMs == null) return null;
  const endMs = getTradeFinalTimestampMs(trade);
  if (!Number.isFinite(endMs) || endMs < entryMs) return null;
  return round((endMs - entryMs) / 60000, 1);
}

function formatEtLabel(date: Date): string {
  const et = toEasternTime(date);
  const hour = String(et.hour).padStart(2, '0');
  const minute = String(et.minute).padStart(2, '0');
  return `${et.dateStr} ${hour}:${minute} ET`;
}

function computeSessionStats(
  trades: EnrichedTrade[],
  sessionWindow: { startMs: number; endMs: number },
): SessionStats {
  const winners = trades.filter((trade) => trade.isWinner === true).length;
  const losers = trades.filter((trade) => trade.isWinner === false).length;
  const gradedCount = winners + losers;
  const winRate = gradedCount > 0 ? round((winners / gradedCount) * 100, 2) : 0;

  const pnlTrades = trades
    .filter((trade): trade is EnrichedTrade & { pnlPercent: number } => trade.pnlPercent != null && Number.isFinite(trade.pnlPercent))
    .map((trade) => ({ index: trade.tradeIndex, pctReturn: trade.pnlPercent }));

  const bestTrade = pnlTrades.length
    ? pnlTrades.reduce((best, current) => (current.pctReturn > best.pctReturn ? current : best))
    : null;
  const worstTrade = pnlTrades.length
    ? pnlTrades.reduce((worst, current) => (current.pctReturn < worst.pctReturn ? current : worst))
    : null;

  return {
    totalTrades: trades.length,
    winners,
    losers,
    winRate,
    bestTrade,
    worstTrade,
    sessionStartET: formatEtLabel(new Date(sessionWindow.startMs)),
    sessionEndET: formatEtLabel(new Date(sessionWindow.endMs)),
    sessionDurationMin: Math.max(0, Math.round((sessionWindow.endMs - sessionWindow.startMs) / 60000)),
  };
}

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    limits: {
      maxTranscriptChars: MAX_TRANSCRIPT_CHARS,
      maxParsedTrades: MAX_PARSED_TRADES,
    },
  });
});

router.post(
  '/build',
  validateBody(buildRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    const body = (req as Request & { validatedBody: z.infer<typeof buildRequestSchema> }).validatedBody;

    try {
      const parsedTrades = await parseTranscriptToTrades({
        transcript: body.transcript,
        inputTimezone: body.inputTimezone,
        dateHint: body.date,
      });

      if (parsedTrades.length === 0) {
        sendError(res, 422, ErrorCode.VALIDATION_ERROR, 'No actionable trades were parsed from the transcript.');
        return;
      }

      if (parsedTrades.length > MAX_PARSED_TRADES) {
        sendError(
          res,
          422,
          ErrorCode.VALIDATION_ERROR,
          `Parsed ${parsedTrades.length} trades, max supported is ${MAX_PARSED_TRADES}. Split transcript into smaller chunks.`,
        );
        return;
      }

      const replayDate = deriveReplayDate(body.date, parsedTrades);
      const dayBars = mapAggregatesToChartBars(await getMinuteAggregates('I:SPX', replayDate));
      if (!dayBars.length) {
        sendError(res, 422, ErrorCode.VALIDATION_ERROR, `No SPX minute bars available for replay date ${replayDate}.`);
        return;
      }

      const sessionWindow = deriveSessionWindow(parsedTrades);
      const sessionStartSec = Math.floor(sessionWindow.startMs / 1000);
      const sessionEndSec = Math.ceil(sessionWindow.endMs / 1000);
      const windowBars = dayBars.filter((bar) => bar.time >= sessionStartSec && bar.time <= sessionEndSec);
      const replayBars = windowBars.length ? windowBars : dayBars;

      const enrichedTrades: EnrichedTrade[] = [];

      for (let index = 0; index < parsedTrades.length; index += 1) {
        const trade = parsedTrades[index];
        let optionsAtEntry: OptionsContext | null = null;

        try {
          const occSymbol = formatTradierOccSymbol({
            underlying: trade.contract.symbol,
            expiry: trade.contract.expiry,
            optionType: trade.contract.type,
            strike: trade.contract.strike,
          });
          const optionTicker = tradierOccToMassiveTicker(occSymbol);
          const snapshots = await getOptionsSnapshotAtDate('SPX', replayDate, optionTicker);
          optionsAtEntry = extractOptionsContext(snapshots[0]);
        } catch (snapshotError) {
          logger.warn('Trade Day Replay option snapshot lookup failed', {
            tradeIndex: trade.tradeIndex,
            replayDate,
            error: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
          });
        }

        const pnlPercent = computePnlPercent(trade);
        const holdDurationMin = computeHoldDurationMinutes(trade);
        const isWinner = pnlPercent == null ? null : pnlPercent > 0;

        enrichedTrades.push({
          ...trade,
          optionsAtEntry,
          evaluation: scoreTrade(trade, replayBars, pnlPercent),
          pnlPercent,
          isWinner,
          holdDurationMin,
        });

        if (index < parsedTrades.length - 1) {
          await sleep(REPLAY_BUILD_DELAY_MS);
        }
      }

      const priorDayBar = await fetchPriorDayBar(replayDate);

      const payload: ReplayPayload = {
        bars: replayBars,
        trades: enrichedTrades,
        stats: computeSessionStats(enrichedTrades, sessionWindow),
        ...(priorDayBar ? { priorDayBar } : {}),
      };

      res.json(payload);
    } catch (error) {
      if (error instanceof TranscriptParserError) {
        const isExternalServiceFailure = error.code === 'OPENAI_REQUEST_FAILED';
        sendError(
          res,
          isExternalServiceFailure ? 502 : 422,
          isExternalServiceFailure ? ErrorCode.EXTERNAL_SERVICE_ERROR : ErrorCode.VALIDATION_ERROR,
          `Transcript parsing failed: ${error.message}`,
          error.details,
        );
        return;
      }

      logger.error('Trade Day Replay build failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to build trade day replay payload.');
    }
  }
);

export default router;
