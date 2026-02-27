import { z } from 'zod';
import { toEasternTime } from '../marketHours';
import type { ParsedTrade } from './types';

const MIN_SPX_STRIKE = 4000;
const MAX_SPX_STRIKE = 8000;
const REGULAR_SESSION_OPEN_MIN = 9 * 60 + 30;
const REGULAR_SESSION_CLOSE_MIN = 16 * 60;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP_WITH_ZONE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function trimString(value: string): string {
  return value.trim();
}

function normalizePath(path: Array<string | number>): string {
  if (path.length === 0) return 'trades';
  return `trades${path.map((part) => (typeof part === 'number' ? `[${part}]` : `.${part}`)).join('')}`;
}

function parseIsoTimestampWithTimezone(value: string): Date | null {
  if (!ISO_TIMESTAMP_WITH_ZONE_REGEX.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) return false;
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

function isWithinRegularSessionEt(value: Date): boolean {
  const et = toEasternTime(value);
  const minutes = et.hour * 60 + et.minute;
  const isWeekday = et.dayOfWeek >= 1 && et.dayOfWeek <= 5;
  return isWeekday && minutes >= REGULAR_SESSION_OPEN_MIN && minutes <= REGULAR_SESSION_CLOSE_MIN;
}

function normalizeTrade(trade: z.infer<typeof parsedTradeSchema>): ParsedTrade {
  const normalizedExitEvents = [...trade.exitEvents]
    .map((event) => ({
      ...event,
      timestamp: trimString(event.timestamp),
    }))
    .sort((a, b) => {
      const aTs = Date.parse(a.timestamp);
      const bTs = Date.parse(b.timestamp);
      if (Number.isNaN(aTs) || Number.isNaN(bTs)) return 0;
      return aTs - bTs;
    });

  const normalizedStopLevels = [...trade.stopLevels]
    .map((stopLevel) => ({
      ...stopLevel,
      timestamp: trimString(stopLevel.timestamp),
    }))
    .sort((a, b) => {
      const aTs = Date.parse(a.timestamp);
      const bTs = Date.parse(b.timestamp);
      if (Number.isNaN(aTs) || Number.isNaN(bTs)) return 0;
      return aTs - bTs;
    });

  const normalizedRawMessages = trade.rawMessages
    .map((message) => trimString(message))
    .filter((message) => message.length > 0);

  const normalizedSpxReferences = Array.from(
    new Set(trade.spxReferences.map((priceLevel) => Number(priceLevel)))
  ).sort((a, b) => a - b);

  return {
    tradeIndex: trade.tradeIndex,
    contract: {
      ...trade.contract,
      expiry: trimString(trade.contract.expiry),
    },
    direction: 'long',
    entryPrice: trade.entryPrice,
    entryTimestamp: trimString(trade.entryTimestamp),
    exitEvents: normalizedExitEvents,
    stopLevels: normalizedStopLevels,
    spxReferences: normalizedSpxReferences,
    sizing: trade.sizing ?? null,
    rawMessages: normalizedRawMessages,
  };
}

export interface TradeValidationIssue {
  path: string;
  message: string;
}

export class TradeValidationError extends Error {
  readonly issues: TradeValidationIssue[];

  constructor(message: string, issues: TradeValidationIssue[]) {
    super(message);
    this.name = 'TradeValidationError';
    this.issues = issues;
  }
}

export const parsedContractSchema = z.object({
  symbol: z.literal('SPX'),
  strike: z.number().finite(),
  type: z.enum(['call', 'put']),
  expiry: z.string().transform(trimString),
});

export const parsedExitEventSchema = z.object({
  type: z.enum(['trim', 'stop', 'trail_stop', 'breakeven_stop', 'full_exit']),
  percentage: z.number().finite().optional(),
  timestamp: z.string().transform(trimString),
});

export const parsedStopLevelSchema = z.object({
  spxLevel: z.number().finite(),
  timestamp: z.string().transform(trimString),
});

export const parsedTradeSchema = z.object({
  tradeIndex: z.number().int().min(1),
  contract: parsedContractSchema,
  direction: z.literal('long').default('long'),
  entryPrice: z.number().finite(),
  entryTimestamp: z.string().transform(trimString),
  exitEvents: z.array(parsedExitEventSchema),
  stopLevels: z.array(parsedStopLevelSchema).default([]),
  spxReferences: z.array(z.number().finite()).default([]),
  sizing: z.enum(['normal', 'light']).nullable().default(null),
  rawMessages: z.array(z.string().transform(trimString)).default([]),
});

export const parsedTradeArraySchema = z.array(parsedTradeSchema);

export function validateParsedTrades(input: unknown): ParsedTrade[] {
  const schemaResult = parsedTradeArraySchema.safeParse(input);
  if (!schemaResult.success) {
    const issues: TradeValidationIssue[] = schemaResult.error.issues.map((issue) => ({
      path: normalizePath(issue.path),
      message: issue.message,
    }));
    throw new TradeValidationError('Failed to parse trades from structured output.', issues);
  }

  const normalizedTrades = schemaResult.data
    .map((trade) => normalizeTrade(trade))
    .sort((a, b) => a.tradeIndex - b.tradeIndex);

  const issues: TradeValidationIssue[] = [];

  normalizedTrades.forEach((trade, index) => {
    if (trade.contract.strike < MIN_SPX_STRIKE || trade.contract.strike > MAX_SPX_STRIKE) {
      issues.push({
        path: `trades[${index}].contract.strike`,
        message: `Strike must be between ${MIN_SPX_STRIKE} and ${MAX_SPX_STRIKE} for SPX.`,
      });
    }

    if (trade.entryPrice <= 0) {
      issues.push({
        path: `trades[${index}].entryPrice`,
        message: 'Entry price must be a positive number.',
      });
    }

    if (!trade.exitEvents.length) {
      issues.push({
        path: `trades[${index}].exitEvents`,
        message: 'Each trade must include at least one exit event.',
      });
    }

    if (!isValidIsoDate(trade.contract.expiry)) {
      issues.push({
        path: `trades[${index}].contract.expiry`,
        message: 'Expiry must be a valid calendar date in YYYY-MM-DD format.',
      });
    }

    const entryDate = parseIsoTimestampWithTimezone(trade.entryTimestamp);
    if (!entryDate) {
      issues.push({
        path: `trades[${index}].entryTimestamp`,
        message: 'Entry timestamp must be ISO-8601 with timezone offset.',
      });
    } else {
      if (!isWithinRegularSessionEt(entryDate)) {
        issues.push({
          path: `trades[${index}].entryTimestamp`,
          message: 'Entry timestamp must be within regular market hours (09:30-16:00 ET).',
        });
      }

      if (isValidIsoDate(trade.contract.expiry)) {
        const entryTradeDateEt = toEasternTime(entryDate).dateStr;
        if (trade.contract.expiry < entryTradeDateEt) {
          issues.push({
            path: `trades[${index}].contract.expiry`,
            message: `Expiry ${trade.contract.expiry} must be on or after trade date ${entryTradeDateEt}.`,
          });
        }
      }
    }

    trade.exitEvents.forEach((exitEvent, exitIndex) => {
      const exitDate = parseIsoTimestampWithTimezone(exitEvent.timestamp);
      if (!exitDate) {
        issues.push({
          path: `trades[${index}].exitEvents[${exitIndex}].timestamp`,
          message: 'Exit timestamp must be ISO-8601 with timezone offset.',
        });
        return;
      }
      if (!isWithinRegularSessionEt(exitDate)) {
        issues.push({
          path: `trades[${index}].exitEvents[${exitIndex}].timestamp`,
          message: 'Exit timestamp must be within regular market hours (09:30-16:00 ET).',
        });
      }
    });

    trade.stopLevels.forEach((stopLevel, stopIndex) => {
      const stopDate = parseIsoTimestampWithTimezone(stopLevel.timestamp);
      if (!stopDate) {
        issues.push({
          path: `trades[${index}].stopLevels[${stopIndex}].timestamp`,
          message: 'Stop timestamp must be ISO-8601 with timezone offset.',
        });
        return;
      }
      if (!isWithinRegularSessionEt(stopDate)) {
        issues.push({
          path: `trades[${index}].stopLevels[${stopIndex}].timestamp`,
          message: 'Stop timestamp must be within regular market hours (09:30-16:00 ET).',
        });
      }
    });
  });

  if (issues.length > 0) {
    throw new TradeValidationError('Parsed trades failed replay validation checks.', issues);
  }

  return normalizedTrades;
}
