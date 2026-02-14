type ChartTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D';

export type CoachIntentId =
  | 'setup_help'
  | 'spx_game_plan'
  | 'key_levels'
  | 'market_status'
  | 'price_check'
  | 'options_chain'
  | 'gamma_exposure'
  | 'zero_dte'
  | 'iv_analysis'
  | 'strategy_selection'
  | 'scan_opportunities'
  | 'earnings_calendar'
  | 'earnings_analysis'
  | 'macro_context'
  | 'journal_insights'
  | 'trade_history'
  | 'alerts'
  | 'ticker_news'
  | 'company_profile'
  | 'market_breadth'
  | 'dividend_info'
  | 'unusual_activity';

interface IntentSpec {
  id: CoachIntentId;
  phrases: string[];
  requiredFunctions: string[];
  recommendedFunctions?: string[];
  requiresChart?: boolean;
  preferredChartTimeframe?: ChartTimeframe;
  requiresBullBear?: boolean;
  requiresPriceNumbers?: boolean;
  requiresDisclaimer?: boolean;
  requiresScenarioProbabilities?: boolean;
  requiresLiquidityWatchouts?: boolean;
}

const STOPWORDS = new Set([
  'A', 'AI', 'ALL', 'AM', 'AN', 'AND', 'ARE', 'AS', 'AT', 'BE', 'BEST', 'BULL', 'BEAR', 'BY', 'CAN', 'CLOSE',
  'DAY', 'ET', 'FOR', 'FROM', 'GAME', 'GIVE', 'GO', 'HOUR', 'HOW', 'I', 'IF', 'IN', 'IS', 'IT', 'KEY', 'LEVEL',
  'LEVELS', 'LOOK', 'MARKET', 'ME', 'MY', 'NOW', 'OF', 'ON', 'OR', 'PLAN', 'PRICE', 'RISK', 'SCAN', 'SETUP',
  'SHOW', 'SPOT', 'THAT', 'THE', 'THIS', 'TO', 'TODAY', 'TRADE', 'WHAT', 'WHEN', 'WHERE', 'WITH', 'YOU', 'YOUR',
  'VWAP', 'GEX', 'PDH', 'PDL', 'PDC', 'ATR', 'IV', 'DTE', 'EMA', 'RSI', 'MACD', 'OI',
]);

const SYMBOL_PRIORITY = ['SPX', 'NDX', 'QQQ', 'SPY'];

const INTENT_SPECS: IntentSpec[] = [
  {
    id: 'spx_game_plan',
    phrases: ['spx game plan', 'spx levels', 'spx analysis', 'what to watch in spx', 'spx today'],
    requiredFunctions: ['get_spx_game_plan', 'show_chart'],
    recommendedFunctions: ['get_market_status'],
    requiresChart: true,
    preferredChartTimeframe: '15m',
    requiresBullBear: true,
    requiresPriceNumbers: true,
    requiresDisclaimer: true,
    requiresScenarioProbabilities: true,
    requiresLiquidityWatchouts: true,
  },
  {
    id: 'setup_help',
    phrases: ['help with setup', 'trade setup', 'entry stop', 'invalidation', 'scanner idea', 'tracked setup', 'trigger plan', 'setup found'],
    requiredFunctions: ['get_key_levels', 'show_chart'],
    recommendedFunctions: ['get_current_price'],
    requiresChart: true,
    preferredChartTimeframe: '15m',
    requiresBullBear: true,
    requiresPriceNumbers: true,
    requiresDisclaimer: true,
    requiresScenarioProbabilities: true,
    requiresLiquidityWatchouts: true,
  },
  {
    id: 'key_levels',
    phrases: ['key levels', 'support and resistance', 'support resistance', 'pdh', 'pdl', 'pivot', 'vwap', 'confluence levels'],
    requiredFunctions: ['get_key_levels', 'show_chart'],
    requiresChart: true,
    preferredChartTimeframe: '1D',
    requiresPriceNumbers: true,
  },
  {
    id: 'market_status',
    phrases: ['market open', 'markets open', 'market closed', 'markets closed', 'pre-market', 'premarket', 'after-hours', 'after hours', 'session open'],
    requiredFunctions: ['get_market_status'],
  },
  {
    id: 'price_check',
    phrases: ['current price', 'right now', 'where is', 'spot price', 'high and low'],
    requiredFunctions: ['get_current_price'],
    recommendedFunctions: ['show_chart'],
    requiresPriceNumbers: true,
  },
  {
    id: 'options_chain',
    phrases: ['options chain', 'calls and puts', 'strike selection', 'greeks for', 'options flow'],
    requiredFunctions: ['get_options_chain'],
    recommendedFunctions: ['get_current_price'],
    requiresPriceNumbers: true,
  },
  {
    id: 'gamma_exposure',
    phrases: ['gamma exposure', 'gex', 'gamma flip', 'max gex', 'gamma profile'],
    requiredFunctions: ['get_gamma_exposure', 'show_chart'],
    requiresChart: true,
    preferredChartTimeframe: '15m',
    requiresPriceNumbers: true,
  },
  {
    id: 'zero_dte',
    phrases: ['0dte', 'zero dte', 'same day expiry', 'intraday theta'],
    requiredFunctions: ['get_zero_dte_analysis'],
    recommendedFunctions: ['show_chart'],
    requiresPriceNumbers: true,
    requiresDisclaimer: true,
    requiresScenarioProbabilities: true,
    requiresLiquidityWatchouts: true,
  },
  {
    id: 'iv_analysis',
    phrases: ['iv rank', 'implied volatility', 'volatility skew', 'term structure', 'vol structure'],
    requiredFunctions: ['get_iv_analysis'],
    recommendedFunctions: ['get_options_chain'],
    requiresPriceNumbers: true,
  },
  {
    id: 'strategy_selection',
    phrases: ['strategy', 'credit spread', 'debit spread', 'iron condor', 'calendar spread', 'straddle', 'strangle', 'covered call', 'cash secured put'],
    requiredFunctions: ['get_iv_analysis', 'get_options_chain'],
    recommendedFunctions: ['get_current_price', 'show_chart'],
    requiresBullBear: true,
    requiresPriceNumbers: true,
    requiresDisclaimer: true,
    requiresScenarioProbabilities: true,
    requiresLiquidityWatchouts: true,
  },
  {
    id: 'scan_opportunities',
    phrases: ['scan opportunities', 'scan for setups', 'find setups', 'rank setups', 'best setup today'],
    requiredFunctions: ['scan_opportunities'],
    recommendedFunctions: ['show_chart'],
    requiresBullBear: true,
    requiresPriceNumbers: true,
    requiresDisclaimer: true,
    requiresScenarioProbabilities: true,
    requiresLiquidityWatchouts: true,
  },
  {
    id: 'earnings_calendar',
    phrases: ['earnings calendar', 'upcoming earnings', 'who reports this week'],
    requiredFunctions: ['get_earnings_calendar'],
  },
  {
    id: 'earnings_analysis',
    phrases: ['into earnings', 'earnings analysis', 'post-earnings', 'iv crush'],
    requiredFunctions: ['get_earnings_analysis'],
    recommendedFunctions: ['get_iv_analysis', 'get_options_chain'],
    requiresBullBear: true,
    requiresPriceNumbers: true,
    requiresDisclaimer: true,
    requiresScenarioProbabilities: true,
    requiresLiquidityWatchouts: true,
  },
  {
    id: 'macro_context',
    phrases: ['macro', 'fomc', 'fed', 'cpi', 'jobs report', 'economic calendar', 'sector rotation'],
    requiredFunctions: ['get_macro_context'],
  },
  {
    id: 'journal_insights',
    phrases: ['journal insights', 'review my journal', 'recurring mistakes', 'consistency issues', 'my performance'],
    requiredFunctions: ['get_journal_insights'],
  },
  {
    id: 'trade_history',
    phrases: ['trade history', 'win rate on', 'expectancy on', 'how did i trade'],
    requiredFunctions: ['get_trade_history_for_symbol'],
  },
  {
    id: 'alerts',
    phrases: ['set alert', 'price alert', 'notify me', 'alert me', 'what alerts do i have'],
    requiredFunctions: ['set_alert'],
    recommendedFunctions: ['get_alerts'],
  },
  {
    id: 'ticker_news',
    phrases: ['news', 'headline', 'why is it up', 'why is it down', 'what happened', 'catalyst', 'announcement'],
    requiredFunctions: ['get_ticker_news'],
    recommendedFunctions: ['get_current_price'],
  },
  {
    id: 'company_profile',
    phrases: ['what does', 'what is', 'company info', 'about the company', 'sector', 'market cap', 'fundamentals'],
    requiredFunctions: ['get_company_profile'],
  },
  {
    id: 'market_breadth',
    phrases: ['market breadth', 'advance decline', 'new highs', 'new lows', 'broad market', 'breadth', 'how many stocks'],
    requiredFunctions: ['get_market_breadth'],
    recommendedFunctions: ['get_market_status'],
  },
  {
    id: 'dividend_info',
    phrases: ['dividend', 'ex-date', 'ex date', 'yield', 'early assignment', 'dividend risk'],
    requiredFunctions: ['get_dividend_info'],
    recommendedFunctions: ['get_current_price'],
  },
  {
    id: 'unusual_activity',
    phrases: ['unusual activity', 'unusual options', 'smart money', 'big volume', 'institutional', 'dark pool', 'options flow'],
    requiredFunctions: ['get_unusual_activity'],
    recommendedFunctions: ['get_options_chain'],
  },
];

const SYMBOL_SPECIFIC_FUNCTIONS = new Set([
  'get_key_levels',
  'get_current_price',
  'get_options_chain',
  'get_gamma_exposure',
  'get_zero_dte_analysis',
  'get_iv_analysis',
  'get_earnings_analysis',
  'show_chart',
  'get_ticker_news',
  'get_company_profile',
  'get_dividend_info',
  'get_unusual_activity',
]);

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function countPhraseHits(haystack: string, phrases: string[]): number {
  return phrases.reduce((hits, phrase) => (haystack.includes(phrase) ? hits + 1 : hits), 0);
}

function hasAnyDigits(text: string): boolean {
  return /\$?\d{2,5}(?:\.\d{1,2})?/.test(text);
}

function hasBullAndBear(text: string): boolean {
  const hasBull = /\bbull(?:ish)?\b/i.test(text);
  const hasBear = /\bbear(?:ish)?\b/i.test(text);
  return hasBull && hasBear;
}

function hasFinancialAdviceDisclaimer(text: string): boolean {
  return /(not financial advice|educational purposes|for informational purposes)/i.test(text);
}

function hasScenarioProbabilityStructure(text: string): boolean {
  const hasScenarioWords = /(scenario|case)\b/i.test(text);
  const hasProbabilityWords = /(probability|odds|chance|likely|likelihood|base case)/i.test(text);
  const hasPercentages = /\b\d{1,3}\s?%/.test(text);
  return hasScenarioWords && hasProbabilityWords && hasPercentages;
}

function hasLiquidityWatchouts(text: string): boolean {
  return /(liquidity|slippage|wide spread|bid-ask|bid\/ask|depth|volume dries up|thin market)/i.test(text);
}

function isSetAlertCreationPrompt(message: string): boolean {
  const lowered = message.toLowerCase();
  const hasSetAlertLanguage = lowered.includes('set alert') || lowered.includes('alert me') || lowered.includes('notify me');
  const hasTargetNumber = /\d+(?:\.\d+)?/.test(lowered);
  return hasSetAlertLanguage && hasTargetNumber;
}

function extractSymbols(message: string): string[] {
  const matches = message.match(/\b\$?[A-Za-z]{1,5}\b/g) || [];
  const lowercaseKnownSymbols = new Set([
    'spx', 'ndx', 'spy', 'qqq', 'iwm', 'dia', 'vix', 'xlf', 'xle', 'xlk', 'smh', 'tlt', 'gld', 'slv',
    'aapl', 'msft', 'nvda', 'tsla', 'amzn', 'meta', 'googl', 'amd',
  ]);

  const symbols = matches
    .map((rawToken) => {
      const hasDollarPrefix = rawToken.startsWith('$');
      const token = rawToken.replace(/^\$/, '');
      const lower = token.toLowerCase();
      const isAllUpper = token === token.toUpperCase();
      if (!hasDollarPrefix && !isAllUpper && !lowercaseKnownSymbols.has(lower)) return null;
      return token.toUpperCase();
    })
    .filter((token): token is string => typeof token === 'string')
    .filter((token) => token.length >= 1 && token.length <= 5)
    .filter((token) => !STOPWORDS.has(token));

  return dedupe(symbols);
}

function selectPrimarySymbol(symbols: string[], intents: CoachIntentId[], loweredMessage: string): string | null {
  if (intents.includes('spx_game_plan') || loweredMessage.includes('spx')) return 'SPX';

  for (const prioritized of SYMBOL_PRIORITY) {
    if (symbols.includes(prioritized)) return prioritized;
  }

  return symbols[0] || null;
}

function intentScore(spec: IntentSpec, loweredMessage: string): number {
  let score = countPhraseHits(loweredMessage, spec.phrases);

  if (spec.id === 'price_check' && /\b([A-Za-z]{1,5})\b\s+right now/.test(loweredMessage)) {
    score += 1;
  }

  if (spec.id === 'key_levels' && loweredMessage.includes('setup')) {
    score += 1;
  }

  const hasSetupAnchor = loweredMessage.includes('setup')
    || loweredMessage.includes('entry')
    || loweredMessage.includes('invalidation')
    || loweredMessage.includes('trigger');

  if (spec.id === 'setup_help' && score > 0 && hasSetupAnchor) {
    score += 2;
  }

  return score;
}

function shouldAddImpliedKeyLevelsIntent(loweredMessage: string, selectedIntentIds: Set<CoachIntentId>): boolean {
  if (selectedIntentIds.has('key_levels') || selectedIntentIds.has('setup_help') || selectedIntentIds.has('spx_game_plan')) {
    return false;
  }

  return loweredMessage.includes('support')
    || loweredMessage.includes('resistance')
    || loweredMessage.includes('vwap')
    || loweredMessage.includes('levels');
}

export interface IntentRoutingPlan {
  intents: CoachIntentId[];
  symbols: string[];
  primarySymbol: string | null;
  requiredFunctions: string[];
  recommendedFunctions: string[];
  requiresChart: boolean;
  preferredChartTimeframe: ChartTimeframe;
  requiresBullBear: boolean;
  requiresPriceNumbers: boolean;
  requiresDisclaimer: boolean;
  requiresScenarioProbabilities: boolean;
  requiresLiquidityWatchouts: boolean;
}

export interface ContractViolationAudit {
  passed: boolean;
  intents: CoachIntentId[];
  symbols: string[];
  requiredFunctions: string[];
  calledFunctions: string[];
  blockingViolations: string[];
  warnings: string[];
}

interface FunctionCallLike {
  function?: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
}

function coerceSymbol(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length >= 1 && trimmed.length <= 8 ? trimmed : null;
}

function extractCalledSymbols(functionCalls: FunctionCallLike[]): string[] {
  const symbols: string[] = [];

  for (const call of functionCalls) {
    const argSymbol = coerceSymbol(call.arguments?.symbol);
    if (argSymbol) symbols.push(argSymbol);

    if (call.result && typeof call.result === 'object') {
      const resultSymbol = coerceSymbol((call.result as { symbol?: unknown }).symbol);
      if (resultSymbol) symbols.push(resultSymbol);
    }
  }

  return dedupe(symbols);
}

export function buildIntentRoutingPlan(message: string): IntentRoutingPlan {
  const loweredMessage = message.toLowerCase();
  const symbols = extractSymbols(message);
  const hasExplicitEarningsLanguage = /\bearnings?\b/.test(loweredMessage);
  const isEducationalNoSymbolPrompt = symbols.length === 0
    && /(beginner|plain language|explain|checklist|small account|risk per trade|stop trading|safe|safer|what not to do)/.test(loweredMessage);

  const scoredIntents = INTENT_SPECS
    .map((spec) => ({ spec, score: intentScore(spec, loweredMessage) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const selectedIntentIds = new Set<CoachIntentId>();
  for (const entry of scoredIntents) {
    selectedIntentIds.add(entry.spec.id);
    if (selectedIntentIds.size >= 3) break;
  }

  if (symbols.length > 0 && selectedIntentIds.size === 0) {
    selectedIntentIds.add('price_check');
  }

  if (shouldAddImpliedKeyLevelsIntent(loweredMessage, selectedIntentIds)) {
    selectedIntentIds.add('key_levels');
  }

  if (selectedIntentIds.has('alerts') && !isSetAlertCreationPrompt(message)) {
    selectedIntentIds.delete('alerts');
  }

  if (selectedIntentIds.has('spx_game_plan')) {
    // SPX game plan is a composite workflow and should not stack strict requirements from overlapping intents.
    selectedIntentIds.delete('setup_help');
    selectedIntentIds.delete('key_levels');
    selectedIntentIds.delete('price_check');
    selectedIntentIds.delete('gamma_exposure');
    if (!hasExplicitEarningsLanguage) {
      selectedIntentIds.delete('earnings_analysis');
    }
  }

  if (selectedIntentIds.has('zero_dte') && !loweredMessage.includes('earnings')) {
    // Avoid over-triggering earnings workflow from phrases like "expected move".
    selectedIntentIds.delete('earnings_analysis');
  }

  if (selectedIntentIds.has('market_status') && symbols.length === 0) {
    // "Are markets open right now?" should not force an unrelated symbol price check.
    selectedIntentIds.delete('price_check');
  }

  if (isEducationalNoSymbolPrompt) {
    // Keep educational prompts lightweight and avoid forcing market-tool calls without a ticker context.
    selectedIntentIds.delete('setup_help');
    selectedIntentIds.delete('key_levels');
    selectedIntentIds.delete('price_check');
  }

  const intents = Array.from(selectedIntentIds);
  const selectedSpecs = INTENT_SPECS.filter((spec) => selectedIntentIds.has(spec.id));

  let requiredFunctions = dedupe(selectedSpecs.flatMap((spec) => spec.requiredFunctions));
  let recommendedFunctions = dedupe(selectedSpecs.flatMap((spec) => spec.recommendedFunctions || []));

  const symbolBoundFunctions = new Set([
    'get_key_levels',
    'get_current_price',
    'get_options_chain',
    'get_gamma_exposure',
    'get_zero_dte_analysis',
    'get_iv_analysis',
    'get_earnings_analysis',
    'show_chart',
  ]);

  if (symbols.length === 0) {
    const symbolBoundRequired = requiredFunctions.filter((fn) => symbolBoundFunctions.has(fn));
    if (symbolBoundRequired.length > 0) {
      recommendedFunctions = dedupe([...recommendedFunctions, ...symbolBoundRequired]);
      requiredFunctions = requiredFunctions.filter((fn) => !symbolBoundFunctions.has(fn));
    }
  }

  const requiresChart = selectedSpecs.some((spec) => spec.requiresChart === true);
  const preferredChartTimeframe = selectedSpecs.find((spec) => spec.preferredChartTimeframe)?.preferredChartTimeframe || '1D';
  const requiresBullBear = selectedSpecs.some((spec) => spec.requiresBullBear === true);
  const requiresPriceNumbers = selectedSpecs.some((spec) => spec.requiresPriceNumbers === true);
  const requiresDisclaimer = selectedSpecs.some((spec) => spec.requiresDisclaimer === true);
  const requiresScenarioProbabilities = selectedSpecs.some((spec) => spec.requiresScenarioProbabilities === true);
  const requiresLiquidityWatchouts = selectedSpecs.some((spec) => spec.requiresLiquidityWatchouts === true);
  const primarySymbol = selectPrimarySymbol(symbols, intents, loweredMessage);

  return {
    intents,
    symbols,
    primarySymbol,
    requiredFunctions,
    recommendedFunctions,
    requiresChart,
    preferredChartTimeframe,
    requiresBullBear,
    requiresPriceNumbers,
    requiresDisclaimer,
    requiresScenarioProbabilities,
    requiresLiquidityWatchouts,
  };
}

export function buildIntentRoutingDirective(plan: IntentRoutingPlan): string | null {
  if (plan.intents.length === 0) return null;

  const requiredList = plan.requiredFunctions.length > 0
    ? plan.requiredFunctions.join(', ')
    : 'none';

  const recommendedList = plan.recommendedFunctions.length > 0
    ? plan.recommendedFunctions.join(', ')
    : 'none';

  const symbolScope = plan.symbols.length > 0 ? plan.symbols.join(', ') : 'none specified';
  const chartInstruction = plan.requiresChart
    ? `- Chart sync is required: call show_chart for ${plan.primarySymbol || 'SPX'} on ${plan.preferredChartTimeframe}.`
    : '- Chart sync is optional for this request.';

  const multiSymbolInstruction = plan.symbols.length > 1
    ? '- Multiple symbols detected: where relevant, call symbol-specific tools for each listed symbol (max 3 symbols).'
    : '- Single-symbol flow is acceptable unless user asks for comparison.';

  return [
    'REQUEST ROUTING CONTEXT (internal):',
    `- Detected intents: ${plan.intents.join(', ')}`,
    `- Symbol scope: ${symbolScope}`,
    `- Required tool calls: ${requiredList}`,
    `- Recommended tool calls: ${recommendedList}`,
    chartInstruction,
    multiSymbolInstruction,
    plan.requiresBullBear ? '- Response must include both bull and bear scenarios with explicit invalidation.' : '- Bull/bear dual-scenario language is optional.',
    plan.requiresPriceNumbers ? '- Response must include explicit numeric prices/levels.' : '- Numeric price levels are optional unless data is requested.',
    plan.requiresDisclaimer ? '- Include a clear "not financial advice" style disclaimer.' : '- Financial-advice disclaimer is optional.',
    plan.requiresScenarioProbabilities
      ? '- Include a scenario matrix with explicit probabilities (e.g., bull/base/bear with percentages).'
      : '- Scenario probabilities are optional.',
    plan.requiresLiquidityWatchouts
      ? '- Include liquidity watchouts (bid/ask spread, slippage, thin liquidity windows).'
      : '- Liquidity watchouts are optional.',
  ].join('\n');
}

export function evaluateResponseContract(
  plan: IntentRoutingPlan,
  functionCallsRaw: FunctionCallLike[] | undefined,
  content: string,
): ContractViolationAudit {
  const functionCalls = Array.isArray(functionCallsRaw) ? functionCallsRaw : [];
  const calledFunctions = dedupe(functionCalls.map((call) => call.function || '').filter(Boolean));

  const blockingViolations: string[] = [];
  const warnings: string[] = [];

  const missingRequiredFunctions = plan.requiredFunctions.filter((fn) => !calledFunctions.includes(fn));
  if (missingRequiredFunctions.length > 0) {
    blockingViolations.push(`missing_required_functions:${missingRequiredFunctions.join(',')}`);
  }

  const missingRecommendedFunctions = plan.recommendedFunctions.filter((fn) => !calledFunctions.includes(fn));
  if (missingRecommendedFunctions.length > 0) {
    warnings.push(`missing_recommended_functions:${missingRecommendedFunctions.join(',')}`);
  }

  if (plan.requiresChart && !calledFunctions.includes('show_chart')) {
    blockingViolations.push('missing_chart_sync:show_chart_not_called');
  }

  if (plan.requiresBullBear && !hasBullAndBear(content)) {
    warnings.push('missing_bull_bear_duality');
  }

  if (plan.requiresPriceNumbers && !hasAnyDigits(content)) {
    warnings.push('missing_numeric_prices');
  }

  if (plan.requiresDisclaimer && !hasFinancialAdviceDisclaimer(content)) {
    blockingViolations.push('missing_financial_disclaimer');
  }

  if (plan.requiresScenarioProbabilities && !hasScenarioProbabilityStructure(content)) {
    blockingViolations.push('missing_scenario_probabilities');
  }

  if (plan.requiresLiquidityWatchouts && !hasLiquidityWatchouts(content)) {
    blockingViolations.push('missing_liquidity_watchouts');
  }

  if (!content || content.trim().length < 10) {
    blockingViolations.push('empty_or_too_short_response');
  }

  const requestedSymbols = plan.symbols;
  const calledSymbols = extractCalledSymbols(functionCalls);

  if (requestedSymbols.length > 1) {
    const usesSymbolSpecificTools = plan.requiredFunctions.some((fn) => SYMBOL_SPECIFIC_FUNCTIONS.has(fn));
    if (usesSymbolSpecificTools) {
      const uncovered = requestedSymbols.filter((symbol) => !calledSymbols.includes(symbol));
      if (uncovered.length > 0) {
        warnings.push(`missing_symbol_coverage:${uncovered.join(',')}`);
      }
    }
  }

  return {
    passed: blockingViolations.length === 0,
    intents: plan.intents,
    symbols: plan.symbols,
    requiredFunctions: plan.requiredFunctions,
    calledFunctions,
    blockingViolations,
    warnings,
  };
}

export function shouldAttemptContractRewrite(audit: ContractViolationAudit): boolean {
  if (audit.blockingViolations.length > 0) return true;
  return audit.warnings.some((warning) => warning === 'missing_bull_bear_duality');
}

export function buildContractRepairDirective(plan: IntentRoutingPlan): string {
  const checklist: string[] = [];

  if (plan.requiresDisclaimer) checklist.push('Start with: "This is not financial advice; this is educational market analysis."');
  if (plan.requiresScenarioProbabilities) checklist.push('Provide a bull/base/bear scenario matrix with explicit percentages that sum to 100%.');
  if (plan.requiresBullBear) checklist.push('Include both bull and bear paths with explicit invalidation levels.');
  if (plan.requiresPriceNumbers) checklist.push('Include concrete numeric levels and triggers.');
  if (plan.requiresLiquidityWatchouts) checklist.push('Include liquidity risks: bid/ask spread, slippage risk, and thin-liquidity windows.');

  return [
    'REPAIR RESPONSE CONTRACT (internal):',
    '- Rewrite the previous answer for structure and clarity.',
    '- Keep facts consistent with called tool data; do not invent tool outputs.',
    '- Keep concise but complete.',
    ...checklist.map((item) => `- ${item}`),
  ].join('\n');
}

function toSafeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[^0-9.+-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatLevel(name: string, price: number | null): string | null {
  if (price == null) return null;
  return `${name} **$${price.toFixed(2)}**`;
}

function findLatestCall(functionCalls: FunctionCallLike[], functionName: string): FunctionCallLike | null {
  for (let idx = functionCalls.length - 1; idx >= 0; idx -= 1) {
    if (functionCalls[idx]?.function === functionName) return functionCalls[idx];
  }
  return null;
}

export function buildBudgetFallbackMessage(plan: IntentRoutingPlan, functionCallsRaw: FunctionCallLike[] | undefined): string {
  const functionCalls = Array.isArray(functionCallsRaw) ? functionCallsRaw : [];
  const successful = functionCalls.filter((call) => call.result && typeof call.result === 'object' && !(call.result as { error?: unknown }).error);
  const calledFunctions = dedupe(successful.map((call) => call.function || '').filter(Boolean));

  const lines: string[] = ['I gathered live data but hit the response budget before full analysis.'];

  if (plan.primarySymbol) {
    lines.push(`- Focus symbol: **${plan.primarySymbol}**`);
  } else if (plan.symbols.length > 0) {
    lines.push(`- Symbol scope: **${plan.symbols.join(', ')}**`);
  }

  if (calledFunctions.length > 0) {
    lines.push(`- Completed tools: ${calledFunctions.join(', ')}`);
  }

  const keyLevelsCall = findLatestCall(successful, 'get_key_levels');
  if (keyLevelsCall?.result && typeof keyLevelsCall.result === 'object') {
    const levels = (keyLevelsCall.result as {
      levels?: {
        resistance?: Array<{ name?: string; price?: unknown }>;
        support?: Array<{ name?: string; price?: unknown }>;
      };
    }).levels;

    const topResistance = levels?.resistance?.[0];
    const topSupport = levels?.support?.[0];

    const resistanceLine = formatLevel(topResistance?.name || 'Resistance', toSafeNumber(topResistance?.price));
    const supportLine = formatLevel(topSupport?.name || 'Support', toSafeNumber(topSupport?.price));

    const levelSummary = [resistanceLine, supportLine].filter(Boolean).join(', ');
    if (levelSummary) {
      lines.push(`- Key levels: ${levelSummary}`);
    }
  }

  const priceCall = findLatestCall(successful, 'get_current_price');
  if (priceCall?.result && typeof priceCall.result === 'object') {
    const result = priceCall.result as { symbol?: unknown; price?: unknown; high?: unknown; low?: unknown };
    const symbol = coerceSymbol(result.symbol) || plan.primarySymbol || 'Symbol';
    const price = toSafeNumber(result.price);
    const high = toSafeNumber(result.high);
    const low = toSafeNumber(result.low);

    const parts: string[] = [];
    const spot = formatLevel('Spot', price);
    const sessionHigh = formatLevel('High', high);
    const sessionLow = formatLevel('Low', low);
    if (spot) parts.push(spot);
    if (sessionHigh) parts.push(sessionHigh);
    if (sessionLow) parts.push(sessionLow);

    if (parts.length > 0) {
      lines.push(`- ${symbol} snapshot: ${parts.join(', ')}`);
    }
  }

  const missingRequired = plan.requiredFunctions.filter((fn) => !calledFunctions.includes(fn));
  if (missingRequired.length > 0) {
    lines.push(`- Remaining required tools: ${missingRequired.join(', ')}`);
  }

  lines.push('Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."');

  return lines.join('\n');
}
