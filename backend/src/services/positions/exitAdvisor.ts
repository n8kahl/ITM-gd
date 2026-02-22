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
  entryPrice?: number;
  strike?: number;
  expiry?: string;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  daysToExpiry?: number;
  breakeven?: number;
  pivotSupport?: number;
  pivotResistance?: number;
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
    entryPrice: analysis.position.entryPrice,
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

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function contractMultiplier(input: PositionAdviceInput): number {
  return input.type === 'stock' ? 1 : 100;
}

function positionUnitCount(input: PositionAdviceInput): number {
  return Math.max(1, Math.abs(input.quantity));
}

function estimateRiskUnit(input: PositionAdviceInput): number {
  const maxLoss = toFiniteNumber(input.maxLoss);
  if (maxLoss && maxLoss > 0) return maxLoss;

  const entryPrice = toFiniteNumber(input.entryPrice);
  const breakeven = toFiniteNumber(input.breakeven);
  if (entryPrice != null && breakeven != null && Math.abs(entryPrice - breakeven) >= 0.01) {
    const structureRisk = Math.abs(entryPrice - breakeven) * positionUnitCount(input) * contractMultiplier(input);
    return Math.max(150, structureRisk);
  }

  const impliedCostBasis = Math.max(1, input.currentValue - input.pnl);
  return Math.max(250, impliedCostBasis * 0.4);
}

function inferDirection(input: PositionAdviceInput): 'long' | 'short' {
  return input.quantity >= 0 ? 'long' : 'short';
}

function suggestedPivotTrailStop(input: PositionAdviceInput, rMultiple: number): number {
  const direction = inferDirection(input);
  const breakeven = toFiniteNumber(input.breakeven);
  const riskUnit = estimateRiskUnit(input);
  const riskPerContract = Math.max(
    0.05,
    riskUnit / (positionUnitCount(input) * contractMultiplier(input)),
  );
  const trailRiskMultiplier = rMultiple >= 2 ? 0.45 : 0.7;
  const fallbackPivot = direction === 'long'
    ? input.currentPrice - (riskPerContract * trailRiskMultiplier)
    : input.currentPrice + (riskPerContract * trailRiskMultiplier);
  const structuralPivot = direction === 'long'
    ? toFiniteNumber(input.pivotSupport)
    : toFiniteNumber(input.pivotResistance);
  const pivotAnchor = structuralPivot ?? fallbackPivot;

  if (direction === 'long') {
    return Number(Math.max(breakeven ?? 0, pivotAnchor).toFixed(2));
  }
  return Number(Math.min(breakeven ?? pivotAnchor, pivotAnchor).toFixed(2));
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
    const riskUnit = estimateRiskUnit(input);
    const rMultiple = riskUnit > 0 ? input.pnl / riskUnit : 0;

    if (rMultiple >= 2) {
      advice.push(buildAdvice(
        input.positionId,
        'take_profit',
        'high',
        `Position has reached ${rMultiple.toFixed(2)}R. Execute the 2R scale: take additional size off and protect the runner behind pivots.`,
        {
          action: 'scale_out',
          closePct: 25,
          milestone: '2R',
          priorMilestone: '1R',
          retainedRunnerPct: 10,
          rMultiple: Number(rMultiple.toFixed(2)),
        },
      ));
    } else if (rMultiple >= 1) {
      advice.push(buildAdvice(
        input.positionId,
        'take_profit',
        'high',
        `Position has reached ${rMultiple.toFixed(2)}R. Execute first scale at 1R and move stop to breakeven.`,
        {
          action: 'scale_out',
          closePct: 65,
          milestone: '1R',
          moveStopToBreakeven: true,
          rMultiple: Number(rMultiple.toFixed(2)),
        },
      ));
    }

    if (rMultiple < 1 && input.pnlPct >= 100) {
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
    } else if (rMultiple < 1 && input.pnlPct >= 50) {
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

    if (input.pnlPct <= -50 || rMultiple <= -0.75) {
      advice.push(buildAdvice(
        input.positionId,
        'stop_loss',
        'high',
        `Position has lost ${Math.abs(input.pnlPct).toFixed(1)}%. Reassess the thesis and reduce risk.`,
        {
          action: 'reassess_or_close',
          trigger: 'loss_threshold',
          rMultiple: Number(rMultiple.toFixed(2)),
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

    if (rMultiple >= 1 && input.type !== 'stock') {
      const protectiveStop = suggestedPivotTrailStop(input, rMultiple);
      advice.push(buildAdvice(
        input.positionId,
        'stop_loss',
        'medium',
        `Position is at ${rMultiple.toFixed(2)}R. Trail stop using pivot structure to protect the runner.`,
        {
          action: 'trail_stop',
          suggestedStop: protectiveStop,
          trailModel: rMultiple >= 2 ? 'pivot_runner_tight' : 'pivot_runner',
          anchor: input.pivotSupport != null || input.pivotResistance != null
            ? 'explicit_pivot'
            : 'risk_proxy_pivot',
          rMultiple: Number(rMultiple.toFixed(2)),
        },
      ));
    }

    if (rMultiple < 1 && input.pnlPct >= 30 && input.type !== 'stock') {
      const breakeven = toFiniteNumber(input.breakeven);
      const fallbackStop = input.currentPrice * (inferDirection(input) === 'long' ? 0.9 : 1.1);
      const suggestedStop = Number((breakeven ?? fallbackStop).toFixed(2));

      advice.push(buildAdvice(
        input.positionId,
        'stop_loss',
        'medium',
        `Position is up ${input.pnlPct.toFixed(1)}%. Raise stop toward breakeven to reduce giveback.`,
        {
          action: 'tighten_stop',
          suggestedStop,
        },
      ));
    }

    return advice;
  }
}
