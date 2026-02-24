import {
  buildBudgetFallbackMessage,
  buildIntentRoutingDirective,
  buildIntentRoutingPlan,
  shouldAttemptContractRewrite,
  evaluateResponseContract,
} from '../intentRouter';

describe('intentRouter', () => {
  it('routes setup-help prompts to key levels + chart sync', () => {
    const plan = buildIntentRoutingPlan('Help with setup on SPY: entry, stop, invalidation and show chart.');

    expect(plan.intents).toContain('setup_help');
    expect(plan.requiredFunctions).toEqual(expect.arrayContaining(['get_key_levels', 'scan_opportunities', 'show_chart']));
    expect(plan.primarySymbol).toBe('SPY');
    expect(plan.requiresChart).toBe(true);
    expect(plan.requiresSetupPlan).toBe(true);

    const directive = buildIntentRoutingDirective(plan);
    expect(directive).toContain('Required tool calls');
    expect(directive).toContain('get_key_levels');
    expect(directive).toContain('scan_opportunities');
    expect(directive).toContain('show_chart');
  });

  it('routes strategy prompts to IV + options chain tools', () => {
    const plan = buildIntentRoutingPlan('Compare call credit spread vs put credit spread on SPX today.');

    expect(plan.intents).toContain('strategy_selection');
    expect(plan.requiredFunctions).toEqual(expect.arrayContaining(['get_iv_analysis', 'get_options_chain']));
    expect(plan.requiresBullBear).toBe(true);
    expect(plan.requiresDisclaimer).toBe(true);
    expect(plan.requiresScenarioProbabilities).toBe(true);
    expect(plan.requiresLiquidityWatchouts).toBe(true);
    expect(plan.primarySymbol).toBe('SPX');
  });

  it('routes scan prompts to scanner + chart with setup-plan contract', () => {
    const plan = buildIntentRoutingPlan('Scan for setups on NVDA and show me the best one with levels.');

    expect(plan.intents).toContain('scan_opportunities');
    expect(plan.requiredFunctions).toEqual(expect.arrayContaining(['scan_opportunities', 'show_chart']));
    expect(plan.requiresChart).toBe(true);
    expect(plan.requiresSetupPlan).toBe(true);
  });

  it('applies intent precedence for SPX game plan prompts', () => {
    const plan = buildIntentRoutingPlan(
      "Give me today's SPX game plan with key levels, gamma flip, expected move, and the best bullish/bearish intraday setups.",
    );

    expect(plan.intents).toContain('spx_game_plan');
    expect(plan.requiredFunctions).toEqual(expect.arrayContaining(['get_spx_game_plan', 'show_chart']));
    expect(plan.requiredFunctions).not.toContain('get_key_levels');
    expect(plan.requiredFunctions).not.toContain('get_gamma_exposure');
    expect(plan.requiredFunctions).not.toContain('get_earnings_analysis');
    expect(plan.requiresDisclaimer).toBe(false);
    expect(plan.requiresScenarioProbabilities).toBe(false);
    expect(plan.requiresLiquidityWatchouts).toBe(false);
  });

  it('does not force price-check for generic market-status prompts without a symbol', () => {
    const plan = buildIntentRoutingPlan('Are markets open right now and how should I adjust aggressiveness?');

    expect(plan.intents).toContain('market_status');
    expect(plan.requiredFunctions).toContain('get_market_status');
    expect(plan.requiredFunctions).not.toContain('get_current_price');
    expect(plan.symbols).toHaveLength(0);
  });

  it('keeps beginner risk-education prompts from requiring setup tools', () => {
    const plan = buildIntentRoutingPlan(
      'Explain in plain language how much I should risk per trade with a small account and when to stop trading for the day.',
    );

    expect(plan.requiredFunctions).not.toContain('get_key_levels');
    expect(plan.requiredFunctions).not.toContain('show_chart');
  });

  it('does not require symbol-bound options tools for no-symbol educational prompts', () => {
    const plan = buildIntentRoutingPlan(
      'I only understand basic calls and puts. Show me safer ways to approach options this week and what not to do.',
    );

    expect(plan.symbols).toHaveLength(0);
    expect(plan.requiredFunctions).not.toContain('get_options_chain');
    expect(plan.requiredFunctions).not.toContain('get_iv_analysis');
    expect(plan.recommendedFunctions).toContain('get_options_chain');
  });

  it('does not force company profile tool calls without a symbol', () => {
    const plan = buildIntentRoutingPlan('Give me a company profile and fundamentals overview.');

    expect(plan.intents).toContain('company_profile');
    expect(plan.requiredFunctions).not.toContain('get_company_profile');
    expect(plan.recommendedFunctions).toContain('get_company_profile');
  });

  it('uses active chart symbol context when setup prompt omits ticker', () => {
    const plan = buildIntentRoutingPlan(
      'Help with setup: entry, stop, invalidation, and show chart.',
      { activeSymbol: 'AAPL' },
    );

    expect(plan.symbols).toContain('AAPL');
    expect(plan.primarySymbol).toBe('AAPL');
    expect(plan.requiredFunctions).toEqual(expect.arrayContaining(['get_key_levels', 'show_chart']));
  });

  it('does not force setup workflow for plain-language context + invalidation prompts', () => {
    const plan = buildIntentRoutingPlan(
      'Explain the SPX context in plain English: trend, nearest support/resistance, and what would invalidate the current idea.',
    );

    expect(plan.intents).toContain('key_levels');
    expect(plan.intents).not.toContain('setup_help');
    expect(plan.requiredFunctions).toContain('get_key_levels');
    expect(plan.requiredFunctions).not.toContain('scan_opportunities');
  });

  it('avoids company profile intent for generic educational "what is" prompts', () => {
    const plan = buildIntentRoutingPlan('What is delta and why does it matter for options?');

    expect(plan.intents).not.toContain('company_profile');
  });

  it('fails contract audit when required functions are missing', () => {
    const plan = buildIntentRoutingPlan('Give me SPX key levels and show chart.');

    const audit = evaluateResponseContract(plan, [], 'SPX looks fine today.');

    expect(audit.passed).toBe(false);
    expect(audit.blockingViolations.some((v) => v.includes('missing_required_functions'))).toBe(true);
  });

  it('passes contract audit when required calls and numeric content are present', () => {
    const plan = buildIntentRoutingPlan('SPX setup with entry, stop, invalidation and chart.');

    const functionCalls = [
      {
        function: 'get_key_levels',
        arguments: { symbol: 'SPX' },
        result: {
          symbol: 'SPX',
          levels: {
            resistance: [{ name: 'PDH', price: 6020.25 }],
            support: [{ name: 'PDL', price: 5981.5 }],
          },
        },
      },
      {
        function: 'scan_opportunities',
        arguments: { symbols: ['SPX'] },
        result: { opportunities: [{ symbol: 'SPX' }] },
      },
      {
        function: 'show_chart',
        arguments: { symbol: 'SPX', timeframe: '15m' },
        result: { symbol: 'SPX', timeframe: '15m' },
      },
    ];

    const audit = evaluateResponseContract(
      plan,
      functionCalls,
      [
        'This is not financial advice; this is educational market analysis.',
        'Scenario matrix: bull case 40%, base case 35%, bear case 25%.',
        'Setup plan: Entry $6012.00, Stop $5998.50, Target $6030.00.',
        'Bull case above $6020.25, bear case below $5981.50. Invalidation on 15m close under $5981.50.',
        'Liquidity watchouts: bid/ask can widen around open and close; account for slippage on market orders.',
      ].join(' '),
    );

    expect(audit.passed).toBe(true);
    expect(audit.blockingViolations).toHaveLength(0);
  });

  it('fails contract audit when disclaimer/probabilities/liquidity watchouts are missing', () => {
    const plan = buildIntentRoutingPlan('Help with setup on SPX: entry, stop, invalidation and show chart.');
    const functionCalls = [
      {
        function: 'get_key_levels',
        arguments: { symbol: 'SPX' },
        result: { symbol: 'SPX' },
      },
      {
        function: 'show_chart',
        arguments: { symbol: 'SPX', timeframe: '15m' },
        result: { symbol: 'SPX', timeframe: '15m' },
      },
      {
        function: 'scan_opportunities',
        arguments: { symbols: ['SPX'] },
        result: { opportunities: [{ symbol: 'SPX' }] },
      },
    ];

    const audit = evaluateResponseContract(
      plan,
      functionCalls,
      'Bull case above $6020 and bear case below $5980 with invalidation on a 15m close.',
    );

    expect(audit.passed).toBe(false);
    expect(audit.blockingViolations).toContain('missing_financial_disclaimer');
    expect(audit.blockingViolations).toContain('missing_scenario_probabilities');
    expect(audit.blockingViolations).toContain('missing_liquidity_watchouts');
    expect(audit.blockingViolations).toContain('missing_setup_plan_levels');
  });

  it('does not trigger rewrite for warnings-only audits', () => {
    const plan = buildIntentRoutingPlan('Give me SPX key levels and show chart.');
    const audit = evaluateResponseContract(plan, [
      {
        function: 'get_key_levels',
        arguments: { symbol: 'SPX' },
        result: { symbol: 'SPX' },
      },
      {
        function: 'show_chart',
        arguments: { symbol: 'SPX', timeframe: '1D' },
        result: { symbol: 'SPX', timeframe: '1D' },
      },
    ], 'SPX key levels are in play.');

    expect(audit.blockingViolations).toHaveLength(0);
    expect(audit.warnings).toContain('missing_numeric_prices');
    expect(shouldAttemptContractRewrite(audit)).toBe(false);
  });

  it('builds a budget fallback summary from tool outputs', () => {
    const plan = buildIntentRoutingPlan('SPX setup help with key levels and chart');
    const message = buildBudgetFallbackMessage(plan, [
      {
        function: 'get_key_levels',
        arguments: { symbol: 'SPX' },
        result: {
          symbol: 'SPX',
          levels: {
            resistance: [{ name: 'PDH', price: 6020.25 }],
            support: [{ name: 'PDL', price: 5981.5 }],
          },
        },
      },
    ]);

    expect(message).toContain('quick read');
    expect(message).toContain('SPX');
    expect(message).toContain('PDH');
    expect(message).toContain('PDL');
    expect(message).not.toContain('Completed tools');
    expect(message).not.toContain('Remaining required tools');
  });
});
