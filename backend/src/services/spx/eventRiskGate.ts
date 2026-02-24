import type { SPXNewsSentimentSnapshot } from './newsSentimentService';
import { round } from './utils';

interface MacroCalendarContext {
  passed: boolean;
  caution: boolean;
  reason?: string;
  nextEvent: {
    event: string;
    at: string;
    minutesUntil: number;
  } | null;
}

export interface SPXEventRiskGateDecision {
  passed: boolean;
  caution: boolean;
  blackout: boolean;
  riskScore: number;
  reason?: string;
  source: 'none' | 'macro' | 'news' | 'combined';
  nextEvent: {
    event: string;
    at: string;
    minutesUntil: number;
  } | null;
  newsSentimentScore: number | null;
  marketMovingArticleCount: number;
  recentHighImpactCount: number;
  latestArticleAt: string | null;
}

interface EvaluateEventRiskGateInput {
  evaluationDate: Date;
  macroCalendar: MacroCalendarContext;
  newsSentiment?: SPXNewsSentimentSnapshot | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toTimestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function evaluateEventRiskGate(input: EvaluateEventRiskGateInput): SPXEventRiskGateDecision {
  const nowMs = input.evaluationDate.getTime();
  const macro = input.macroCalendar;
  const news = input.newsSentiment;

  if (!macro.passed) {
    return {
      passed: false,
      caution: false,
      blackout: true,
      riskScore: 95,
      reason: macro.reason || 'Macro blackout window active',
      source: 'macro',
      nextEvent: macro.nextEvent,
      newsSentimentScore: news?.score ?? null,
      marketMovingArticleCount: news?.marketMovingCount ?? 0,
      recentHighImpactCount: news?.recentHighImpactCount ?? 0,
      latestArticleAt: news?.latestPublishedAt ?? null,
    };
  }

  let riskScore = macro.caution ? 35 : 0;
  let blackout = false;
  let caution = macro.caution;
  let source: SPXEventRiskGateDecision['source'] = macro.caution ? 'macro' : 'none';
  let reason: string | undefined;

  if (news) {
    const sentimentAbs = Math.abs(news.score);
    const latestArticleMs = toTimestampMs(news.latestPublishedAt);
    const latestAgeMinutes = latestArticleMs == null ? Number.POSITIVE_INFINITY : Math.max(0, (nowMs - latestArticleMs) / 60_000);

    if (news.marketMovingCount >= 2 && sentimentAbs >= 35) {
      riskScore += 18;
      caution = true;
      source = source === 'macro' ? 'combined' : 'news';
      reason = `Market-moving news flow elevated (${news.bias} ${round(news.score, 1)})`;
    }
    if (news.recentHighImpactCount >= 2 && sentimentAbs >= 50) {
      riskScore += 24;
      caution = true;
      source = source === 'macro' ? 'combined' : 'news';
      reason = `High-impact headlines active (${news.recentHighImpactCount} in last hour)`;
    }
    if (latestAgeMinutes <= 20 && news.marketMovingCount >= 3 && sentimentAbs >= 65) {
      riskScore += 38;
      blackout = true;
      source = source === 'macro' ? 'combined' : 'news';
      reason = `Breaking high-impact news flow (${news.bias} ${round(news.score, 1)})`;
    }
  }

  const boundedScore = round(clamp(riskScore, 0, 100), 2);
  if (!blackout && boundedScore >= 88) blackout = true;
  if (!caution && boundedScore >= 50) caution = true;

  return {
    passed: !blackout,
    caution,
    blackout,
    riskScore: boundedScore,
    reason,
    source,
    nextEvent: macro.nextEvent,
    newsSentimentScore: news?.score ?? null,
    marketMovingArticleCount: news?.marketMovingCount ?? 0,
    recentHighImpactCount: news?.recentHighImpactCount ?? 0,
    latestArticleAt: news?.latestPublishedAt ?? null,
  };
}
