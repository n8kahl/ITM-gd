import { logger } from '../lib/logger';
import { executeFunctionCall } from './functionHandlers';
import type { IntentRoutingPlan } from './intentRouter';

export interface FunctionCallRecord {
  function: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

interface BackfillArgs {
  routingPlan: IntentRoutingPlan;
  userId: string;
  functionCalls: FunctionCallRecord[];
}

function hasSuccessfulCall(functionCalls: FunctionCallRecord[], functionName: string): boolean {
  return functionCalls.some((call) => {
    if (call.function !== functionName) return false;
    if (!call.result || typeof call.result !== 'object') return true;
    return !(call.result as { error?: unknown }).error;
  });
}

function buildBackfillArgs(functionName: string, plan: IntentRoutingPlan): Record<string, unknown> | null {
  const symbol = plan.primarySymbol || plan.symbols[0] || null;
  const chartSymbol = symbol || 'SPX';

  switch (functionName) {
    case 'show_chart':
      return {
        symbol: chartSymbol,
        timeframe: plan.preferredChartTimeframe,
      };
    case 'get_current_price':
    case 'get_key_levels':
    case 'get_options_chain':
    case 'get_iv_analysis':
    case 'get_earnings_analysis':
    case 'get_gamma_exposure':
    case 'get_zero_dte_analysis':
    case 'get_ticker_news':
    case 'get_company_profile':
    case 'get_dividend_info':
    case 'get_unusual_activity':
      if (!symbol) return null;
      return { symbol };
    case 'get_market_status':
    case 'get_market_breadth':
      return {};
    case 'scan_opportunities':
      return symbol
        ? {
            symbols: [symbol],
            include_options: true,
          }
        : {
            include_options: true,
          };
    case 'get_economic_calendar':
      return {
        days_ahead: 7,
        impact_filter: 'HIGH',
      };
    default:
      return null;
  }
}

const BACKFILL_ALLOWED_FUNCTIONS = new Set([
  'show_chart',
  'get_current_price',
  'get_key_levels',
  'get_market_status',
  'get_options_chain',
  'get_iv_analysis',
  'get_earnings_analysis',
  'get_gamma_exposure',
  'get_zero_dte_analysis',
  'get_ticker_news',
  'get_company_profile',
  'get_market_breadth',
  'get_economic_calendar',
  'get_dividend_info',
  'get_unusual_activity',
  'scan_opportunities',
]);

export async function backfillRequiredFunctionCalls({
  routingPlan,
  userId,
  functionCalls,
}: BackfillArgs): Promise<void> {
  if (!routingPlan.requiredFunctions.length) return;

  const missingRequired = routingPlan.requiredFunctions
    .filter((functionName) => BACKFILL_ALLOWED_FUNCTIONS.has(functionName))
    .filter((functionName) => !hasSuccessfulCall(functionCalls, functionName))
    .slice(0, 5);

  for (const functionName of missingRequired) {
    const args = buildBackfillArgs(functionName, routingPlan);
    if (!args) continue;

    try {
      const result = await executeFunctionCall(
        {
          name: functionName,
          arguments: JSON.stringify(args),
        },
        { userId },
      );

      functionCalls.push({
        function: functionName,
        arguments: args,
        result,
      });

      logger.info('Backfilled required function call', {
        functionName,
        userId,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn('Backfill function call failed', {
        functionName,
        userId,
        error: errMsg,
      });
    }
  }
}
