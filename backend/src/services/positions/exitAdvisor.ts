import { PositionAnalysis } from '../options/types';

export type PositionAdviceType = 'take_profit' | 'stop_loss' | 'time_decay';
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
        `Strong gain (${input.pnlPct.toFixed(1)}%). Consider closing or trimming size to lock profits.`,
        {
          action: 'take_profit',
          closePct: 75,
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
      if (lossPctOfMax >= 0.8) {
        advice.push(buildAdvice(
          input.positionId,
          'stop_loss',
          'high',
          'Position is near max planned loss. Consider closing to preserve capital.',
          {
            action: 'close_position',
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
        'Aggressive theta decay detected. Consider closing now or reducing exposure.',
        {
          action: 'close_or_reduce',
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

    if (input.pnlPct >= 30 && input.type !== 'stock') {
      const protectiveStop = input.breakeven ?? input.currentPrice * (input.quantity > 0 ? 0.92 : 1.08);

      advice.push(buildAdvice(
        input.positionId,
        'stop_loss',
        'medium',
        `Position is up ${input.pnlPct.toFixed(1)}%. Raise your stop to protect gains.`,
        {
          action: 'tighten_stop',
          suggestedStop: Number(protectiveStop.toFixed(2)),
        },
      ));
    }

    return advice;
  }
}
