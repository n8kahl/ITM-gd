import { calculateRoll } from '../leaps/rollCalculator';
import { PositionAnalysis } from '../options/types';

export type PositionAdviceType = 'take_profit' | 'stop_loss' | 'time_decay' | 'spread_conversion' | 'roll';
export type PositionAdviceUrgency = 'low' | 'medium' | 'high';

export interface PositionAdvice {
  positionId: string;
  type: PositionAdviceType;
  urgency: PositionAdviceUrgency;
  message: string;
  suggestedAction: Record<string, unknown>;
}

export interface PositionAdviceInput {
  positionId: string;
  symbol: string;
  type: PositionAnalysis['position']['type'];
  quantity: number;
  strike?: number;
  expiry?: string;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  daysToExpiry?: number;
  breakeven?: number;
  maxLoss?: number | string;
  greeks?: PositionAnalysis['greeks'];
}

function toAdviceInput(analysis: PositionAnalysis): PositionAdviceInput {
  const multiplier = analysis.position.type === 'stock' ? 1 : 100;
  const quantity = Math.max(1, Math.abs(analysis.position.quantity));
  const inferredCurrentPrice = analysis.currentValue / (quantity * multiplier);

  return {
    positionId: analysis.position.id || `${analysis.position.symbol}-${analysis.position.type}-${analysis.position.entryDate}`,
    symbol: analysis.position.symbol,
    type: analysis.position.type,
    quantity: analysis.position.quantity,
    strike: analysis.position.strike,
    expiry: analysis.position.expiry,
    currentPrice: Number(inferredCurrentPrice.toFixed(4)),
    currentValue: analysis.currentValue,
    pnl: analysis.pnl,
    pnlPct: analysis.pnlPct,
    daysToExpiry: analysis.daysToExpiry,
    breakeven: analysis.breakeven,
    maxLoss: analysis.maxLoss,
    greeks: analysis.greeks,
  };
}

function buildAdvice(
  positionId: string,
  type: PositionAdviceType,
  urgency: PositionAdviceUrgency,
  message: string,
  suggestedAction: Record<string, unknown>,
): PositionAdvice {
  return {
    positionId,
    type,
    urgency,
    message,
    suggestedAction,
  };
}

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function strikeStepForSymbol(symbol: string): number {
  if (symbol === 'SPX') return 25;
  if (symbol === 'NDX') return 25;
  return 5;
}

function inferIv(greeks: PositionAdviceInput['greeks']): number {
  const vega = Math.abs(greeks?.vega || 0);
  if (vega > 80) return 0.4;
  if (vega > 40) return 0.3;
  if (vega > 10) return 0.25;
  return 0.2;
}

function getNextMonthIsoDate(expiry?: string): string | null {
  if (!expiry) return null;
  const date = new Date(expiry);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + 30);
  return date.toISOString().slice(0, 10);
}

export class ExitAdvisor {
  generateAdvice(analyses: PositionAnalysis[]): PositionAdvice[] {
    return this.generateAdviceFromInputs(analyses.map(toAdviceInput));
  }

  generateAdviceFromInputs(inputs: PositionAdviceInput[]): PositionAdvice[] {
    const allAdvice: PositionAdvice[] = [];

    for (const input of inputs) {
      allAdvice.push(...this.generateAdviceForInput(input));
    }

    return allAdvice;
  }

  private generateAdviceForInput(input: PositionAdviceInput): PositionAdvice[] {
    const advice: PositionAdvice[] = [];

    if (input.pnlPct >= 100) {
      advice.push(buildAdvice(
        input.positionId,
        'take_profit',
        'high',
        `Strong gain (${input.pnlPct.toFixed(1)}%). Consider closing or converting to a spread to lock profits.`,
        {
          action: 'close_or_convert',
          closePct: 100,
        },
      ));
    } else if (input.pnlPct >= 50) {
      advice.push(buildAdvice(
        input.positionId,
        'take_profit',
        'medium',
        `Position is up ${input.pnlPct.toFixed(1)}%. Consider taking partial profits (sell half).`,
        {
          action: 'take_partial_profit',
          closePct: 50,
        },
      ));
    }

    if (input.pnlPct <= -50) {
      advice.push(buildAdvice(
        input.positionId,
        'stop_loss',
        'high',
        `Position has lost ${Math.abs(input.pnlPct).toFixed(1)}%. Reassess the thesis and reduce risk.`,
        {
          action: 'reassess_or_close',
          trigger: 'loss_threshold',
        },
      ));
    }

    if (typeof input.maxLoss === 'number' && input.maxLoss > 0 && input.pnl < 0) {
      const lossPctOfMax = Math.abs(input.pnl) / input.maxLoss;
      if (lossPctOfMax >= 0.8 && (input.type === 'call_spread' || input.type === 'put_spread' || input.type === 'iron_condor')) {
        advice.push(buildAdvice(
          input.positionId,
          'stop_loss',
          'high',
          'Spread is near max loss. Consider closing to preserve remaining value.',
          {
            action: 'close_spread',
            lossPctOfMax: Number((lossPctOfMax * 100).toFixed(1)),
          },
        ));
      }
    }

    const thetaBurn = Math.abs(input.greeks?.theta || 0);
    if ((input.daysToExpiry ?? 999) < 5 && input.currentValue > 0 && (thetaBurn / input.currentValue) > 0.1) {
      advice.push(buildAdvice(
        input.positionId,
        'time_decay',
        'high',
        'Aggressive theta decay detected. Consider closing or rolling now.',
        {
          action: 'close_or_roll',
          thetaPerDay: Number(thetaBurn.toFixed(2)),
          thetaBurnPctOfValue: Number(((thetaBurn / input.currentValue) * 100).toFixed(1)),
        },
      ));
    }

    if ((input.daysToExpiry ?? 999) === 0 && input.currentPrice <= 0.1) {
      advice.push(buildAdvice(
        input.positionId,
        'time_decay',
        'high',
        '0DTE contract appears near worthless. Close now to salvage any remaining premium.',
        {
          action: 'close_immediately',
          reason: '0dte_near_worthless',
        },
      ));
    }

    if (input.type === 'call' && input.quantity > 0 && input.pnlPct >= 30 && input.strike) {
      const strikeStep = strikeStepForSymbol(input.symbol);
      const targetShortStrike = roundToNearest(input.strike + (strikeStep * 2), strikeStep);
      const estimatedCredit = Math.max(0.05, input.currentPrice * 0.35) * Math.abs(input.quantity) * 100;

      advice.push(buildAdvice(
        input.positionId,
        'spread_conversion',
        'medium',
        `Consider selling the ${targetShortStrike}C to convert to a call spread and lock gains.`,
        {
          action: 'sell_call_against_long',
          shortStrike: targetShortStrike,
          estimatedCredit: Number(estimatedCredit.toFixed(2)),
        },
      ));
    }

    if ((input.daysToExpiry ?? 999) < 14 && input.pnl > 0 && input.type !== 'stock' && input.strike && input.expiry) {
      const newExpiry = getNextMonthIsoDate(input.expiry);
      if (newExpiry) {
        const strikeStep = strikeStepForSymbol(input.symbol);
        const newStrike = input.type === 'put'
          ? roundToNearest(Math.max(strikeStep, input.strike - strikeStep), strikeStep)
          : roundToNearest(input.strike + strikeStep, strikeStep);

        const optionType = input.type === 'put' ? 'put' : 'call';
        const proxyUnderlying = input.breakeven ?? input.strike;

        const roll = calculateRoll({
          currentStrike: input.strike,
          currentExpiry: input.expiry,
          newStrike,
          newExpiry,
          optionType,
          currentPrice: proxyUnderlying,
          impliedVolatility: inferIv(input.greeks),
          quantity: Math.abs(input.quantity),
        });

        advice.push(buildAdvice(
          input.positionId,
          'roll',
          'medium',
          'Position is nearing expiry with a gain. Consider rolling to maintain exposure.',
          {
            action: 'roll_position',
            newStrike,
            newExpiry,
            netCreditDebit: roll.rollAnalysis.netCreditDebit,
            recommendation: roll.rollAnalysis.recommendation,
          },
        ));
      }
    }

    return advice;
  }
}
