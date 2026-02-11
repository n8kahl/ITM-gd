# AI Coach Temporary Stress Report

## Run Config
- API base: http://127.0.0.1:3001
- Prompts file: /Users/natekahl/ITM-gd/scripts/ai-coach/stress-prompts.temp.json
- Iterations: 1
- Concurrency: 1
- Timeout per request: 60000ms
- Strict contract gating: enabled
- Delay between requests: 350ms
- Category filter: all
- Output dir: /Users/natekahl/ITM-gd/.codex-scratch/ai-coach-stress/2026-02-11_02-40-28-439

## Summary
- Total requests: 44
- Passed: 42
- Failed: 2
- Warning cases: 29
- Pass rate: 95.5%
- Average score: 85.1
- Latency p50/p90/p95/max: 21455ms / 32095ms / 33133ms / 41660ms
- Duration: 903572ms

## Widget Coverage
- key_levels: 14
- current_price: 14
- options_chain: 8
- spx_game_plan: 2
- macro_context: 2
- market_overview: 2
- earnings_calendar: 1
- journal_insights: 1
- position_summary: 1
- trade_history: 1

## Function Coverage
- show_chart: 15
- get_key_levels: 14
- get_current_price: 14
- get_options_chain: 8
- get_iv_analysis: 7
- get_gamma_exposure: 3
- get_earnings_analysis: 3
- get_spx_game_plan: 2
- get_macro_context: 2
- get_market_status: 2
- set_alert: 1
- get_earnings_calendar: 1
- get_journal_insights: 1
- get_position_advice: 1
- analyze_position: 1
- get_trade_history_for_symbol: 1
- get_zero_dte_analysis: 1

## Findings
### FAIL advanced-multi-symbol-rotation#1
- Category: advanced
- Status: 503 | Score: 0 | Latency: 41660ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:scan_results, missing_functions:scan_opportunities
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Scan SPX, NDX, QQQ, NVDA, TSLA and rank where the best asymmetric setup is by structure, liquidity, and momentum quality.
- Response preview: {"error":"AI service unavailable","message":"The AI service is temporarily unavailable. Please try again in a moment.","details":"OpenAI call timed out after 30000ms","retryAfter":30}

### FAIL scanner-top-setups#1
- Category: scanner
- Status: 503 | Score: 0 | Latency: 33133ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:scan_results, missing_functions:scan_opportunities
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Scan SPX, NDX, QQQ, SPY, NVDA, AAPL and rank the top three setups with entry, stop, and target.
- Response preview: {"error":"AI service unavailable","message":"The AI service is temporarily unavailable. Please try again in a moment.","details":"OpenAI call timed out after 30000ms","retryAfter":30}

### WARN advanced-post-earnings-vol#1
- Category: advanced
- Status: 200 | Score: 58 | Latency: 32095ms
- Functions: get_earnings_analysis, get_iv_analysis, get_options_chain
- Widgets: options_chain
- Widget actions: options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:3, missing_widgets:earnings_analysis, contract_warnings:missing_recommended_functions:get_current_price,show_chart|missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_current_price,show_chart, missing_bull_bear_duality
- Prompt: For NVDA earnings, quantify expected move versus implied move and discuss post-event vol crush risk by strategy type.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **NVDA** - Completed tools: get_options_chain - Remaining required tools: get_iv_analysis Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN earnings-analysis-nvda#1
- Category: earnings
- Status: 200 | Score: 58 | Latency: 29809ms
- Functions: get_earnings_analysis, get_iv_analysis, get_options_chain
- Widgets: options_chain
- Widget actions: options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:4, missing_widgets:earnings_analysis, contract_warnings:missing_recommended_functions:get_current_price,show_chart|missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_current_price,show_chart, missing_bull_bear_duality
- Prompt: Analyze NVDA into earnings with expected move, IV context, and safest strategy choices.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **NVDA** - Completed tools: get_options_chain - Remaining required tools: get_iv_analysis, get_earnings_analysis Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN earnings-strategy-choice#1
- Category: earnings
- Status: 200 | Score: 58 | Latency: 32454ms
- Functions: get_earnings_analysis, get_iv_analysis, get_options_chain
- Widgets: options_chain
- Widget actions: options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:4, missing_widgets:earnings_analysis, contract_warnings:missing_recommended_functions:get_current_price,show_chart|missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_current_price,show_chart, missing_bull_bear_duality
- Prompt: For AAPL into earnings, compare debit spread vs iron condor using expected move and IV crush risk.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **AAPL** - Completed tools: get_options_chain - Remaining required tools: get_iv_analysis, get_earnings_analysis Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN gex-profile-spx#1
- Category: options
- Status: 200 | Score: 60 | Latency: 25954ms
- Functions: get_gamma_exposure, show_chart
- Widgets: none
- Widget actions: none
- Warnings: function_errors:2, no_widgets_for_data_prompt, missing_widgets:gex_profile
- Contract blocking: none
- Contract warnings: none
- Prompt: Give me SPX gamma exposure profile with flip level, max GEX strike, and implications for mean reversion vs trend.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: show_chart - Remaining required tools: get_gamma_exposure Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN strategy-credit-spread-selection#1
- Category: strategy
- Status: 200 | Score: 68 | Latency: 25742ms
- Functions: get_key_levels, get_iv_analysis, get_options_chain, show_chart
- Widgets: key_levels, options_chain
- Widget actions: key_levels: Show on Chart | View Options | Ask AI; options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:2, missing_widgets:iv_analysis, contract_warnings:missing_recommended_functions:get_current_price|missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_current_price, missing_bull_bear_duality
- Prompt: Given current SPX vol regime, should I consider a call credit spread or put credit spread today? Include strike logic and invalidation.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_key_levels, get_options_chain, show_chart - Key levels: PDC **$6964.82**, PDL **$6905.87** - Remaining required tools: get_iv_analysis Follow up with a narrower ask for full detail, for example: "SPX b…

### WARN advanced-gex-execution#1
- Category: advanced
- Status: 200 | Score: 70 | Latency: 20300ms
- Functions: get_key_levels, get_gamma_exposure, get_current_price, show_chart
- Widgets: key_levels, current_price
- Widget actions: key_levels: Show on Chart | View Options | Ask AI; current_price: Show on Chart | View Options | Set Alert
- Warnings: function_errors:2, missing_widgets:gex_profile, contract_warnings:missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_bull_bear_duality
- Prompt: Use SPX gamma exposure and key levels to design a trigger-based execution plan with invalidation and sizing rules.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_key_levels, get_current_price, show_chart - Key levels: PDC **$6964.82**, PDL **$6905.87** - SPX snapshot: Spot **$6941.81**, High **$6986.83**, Low **$6937.53** - Remaining required tools: get_gamma_e…

### WARN advanced-vol-structure#1
- Category: advanced
- Status: 200 | Score: 70 | Latency: 17437ms
- Functions: get_iv_analysis
- Widgets: none
- Widget actions: none
- Warnings: function_errors:2, missing_widgets:iv_analysis, contract_warnings:missing_recommended_functions:get_options_chain
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_options_chain
- Prompt: Compare front-end and back-end implied vol structure in QQQ and tell me how that should change trade construction today.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **QQQ** - Remaining required tools: get_iv_analysis Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN zero-dte-risk#1
- Category: options
- Status: 200 | Score: 70 | Latency: 11140ms
- Functions: get_current_price, get_zero_dte_analysis
- Widgets: current_price
- Widget actions: current_price: Show on Chart | View Options | Set Alert
- Warnings: function_errors:2, missing_widgets:zero_dte_analysis, contract_warnings:missing_recommended_functions:show_chart
- Contract blocking: none
- Contract warnings: missing_recommended_functions:show_chart
- Prompt: Analyze SPX 0DTE structure right now: expected move used, remaining move, and gamma risk.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_current_price - SPX snapshot: Spot **$6941.81**, High **$6986.83**, Low **$6937.53** - Remaining required tools: get_zero_dte_analysis Follow up with a narrower ask for full detail, for example: "SPX b…

### WARN iv-regime-qqq#1
- Category: options
- Status: 200 | Score: 72 | Latency: 27101ms
- Functions: get_iv_analysis, get_options_chain
- Widgets: options_chain
- Widget actions: options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:2, missing_widgets:iv_analysis
- Contract blocking: none
- Contract warnings: none
- Prompt: What is QQQ IV rank, skew, and term structure, and how should that change premium-selling decisions?
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **QQQ** - Completed tools: get_options_chain - Remaining required tools: get_iv_analysis Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN portfolio-analysis#1
- Category: risk
- Status: 200 | Score: 75 | Latency: 14208ms
- Functions: get_position_advice
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:pnl_tracker, missing_functions:analyze_position
- Contract blocking: none
- Contract warnings: none
- Prompt: Analyze my portfolio risk and tell me what I should manage first based on net delta, gamma, theta.
- Response preview: I gathered live data but hit the response budget before full analysis. - Completed tools: get_position_advice Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN advanced-flow-regime#1
- Category: advanced
- Status: 200 | Score: 80 | Latency: 21799ms
- Functions: get_gamma_exposure, show_chart, get_spx_game_plan
- Widgets: spx_game_plan
- Widget actions: spx_game_plan: Show on Chart | View Options | Set Alert | Ask AI
- Warnings: function_errors:2
- Contract blocking: none
- Contract warnings: none
- Prompt: Build an intraday regime map for SPX using gamma flip, max GEX, and expected move to define trend versus mean-reversion playbooks.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: show_chart, get_spx_game_plan - Remaining required tools: get_gamma_exposure Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN strategy-neutral-income#1
- Category: strategy
- Status: 200 | Score: 80 | Latency: 33941ms
- Functions: get_options_chain, get_iv_analysis, get_current_price
- Widgets: options_chain, current_price
- Widget actions: options_chain: View Options | Open Chart | Ask AI; current_price: Show on Chart | View Options | Set Alert
- Warnings: function_errors:1, missing_widgets:iv_analysis, contract_warnings:missing_recommended_functions:show_chart
- Contract blocking: none
- Contract warnings: missing_recommended_functions:show_chart
- Prompt: Design a neutral options income idea for QQQ and explain when to avoid it based on volatility structure.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **QQQ** - Completed tools: get_options_chain, get_current_price - QQQ snapshot: Spot **$611.47**, High **$617.02**, Low **$611.01** Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidatio…

### WARN beginner-options-safe#1
- Category: beginner
- Status: 200 | Score: 84 | Latency: 13150ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, contract_warnings:missing_recommended_functions:get_current_price,get_options_chain|missing_numeric_prices
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_current_price,get_options_chain, missing_numeric_prices
- Prompt: I only understand basic calls and puts. Show me safer ways to approach options this week and what not to do.
- Response preview: Here's how you can approach options trading with a focus on safety, along with some practices to avoid: ### Safer Strategies 1. **Covered Calls:** - Sell call options against stocks you own. - Generates income (premium) while potentially selling your stock at a higher price. - Limits upside, but provides income if the…


## Recommendation
- Address FAIL cases first (non-200 responses or malformed payloads), then rerun with `--iterations 2 --concurrency 4`.
