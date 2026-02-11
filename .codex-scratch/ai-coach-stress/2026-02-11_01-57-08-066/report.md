# AI Coach Temporary Stress Report

## Run Config
- API base: http://127.0.0.1:3001
- Prompts file: /Users/natekahl/ITM-gd/scripts/ai-coach/stress-prompts.temp.json
- Iterations: 1
- Concurrency: 1
- Timeout per request: 90000ms
- Strict contract gating: enabled
- Delay between requests: 1400ms
- Category filter: beginner, advanced, options, strategy, earnings, journal
- Output dir: /Users/natekahl/ITM-gd/.codex-scratch/ai-coach-stress/2026-02-11_01-57-08-066

## Summary
- Total requests: 23
- Passed: 21
- Failed: 2
- Warning cases: 14
- Pass rate: 91.3%
- Average score: 81.9
- Latency p50/p90/p95/max: 18609ms / 32497ms / 34422ms / 39947ms
- Duration: 435708ms

## Widget Coverage
- options_chain: 9
- key_levels: 5
- current_price: 5
- spx_game_plan: 2
- journal_insights: 2
- earnings_calendar: 1
- trade_history: 1

## Function Coverage
- get_options_chain: 9
- get_iv_analysis: 7
- get_key_levels: 5
- get_current_price: 5
- show_chart: 5
- get_earnings_analysis: 4
- get_gamma_exposure: 3
- get_spx_game_plan: 2
- get_journal_insights: 2
- get_earnings_calendar: 1
- get_trade_history_for_symbol: 1
- get_zero_dte_analysis: 1

## Findings
### FAIL gex-profile-spx#1
- Category: options
- Status: 200 | Score: 50 | Latency: 4407ms
- Functions: get_gamma_exposure
- Widgets: none
- Widget actions: none
- Warnings: function_errors:2, no_widgets_for_data_prompt, missing_widgets:gex_profile, contract_blocking:missing_chart_sync:show_chart_not_called, contract_warnings:missing_recommended_functions:show_chart
- Contract blocking: missing_chart_sync:show_chart_not_called
- Contract warnings: missing_recommended_functions:show_chart
- Prompt: Give me SPX gamma exposure profile with flip level, max GEX strike, and implications for mean reversion vs trend.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Remaining required tools: get_gamma_exposure Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### FAIL advanced-flow-regime#1
- Category: advanced
- Status: 200 | Score: 58 | Latency: 25709ms
- Functions: get_gamma_exposure, get_spx_game_plan, get_earnings_analysis
- Widgets: spx_game_plan
- Widget actions: spx_game_plan: Show on Chart | View Options | Set Alert | Ask AI
- Warnings: function_errors:3, contract_blocking:missing_chart_sync:show_chart_not_called, contract_warnings:missing_recommended_functions:show_chart,get_iv_analysis,get_options_chain|missing_bull_bear_duality
- Contract blocking: missing_chart_sync:show_chart_not_called
- Contract warnings: missing_recommended_functions:show_chart,get_iv_analysis,get_options_chain, missing_bull_bear_duality
- Prompt: Build an intraday regime map for SPX using gamma flip, max GEX, and expected move to define trend versus mean-reversion playbooks.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_spx_game_plan - Remaining required tools: get_gamma_exposure, get_earnings_analysis Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN advanced-post-earnings-vol#1
- Category: advanced
- Status: 200 | Score: 58 | Latency: 20923ms
- Functions: get_earnings_analysis, get_iv_analysis, get_options_chain
- Widgets: options_chain
- Widget actions: options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:4, missing_widgets:earnings_analysis, contract_warnings:missing_recommended_functions:get_current_price,show_chart|missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_current_price,show_chart, missing_bull_bear_duality
- Prompt: For NVDA earnings, quantify expected move versus implied move and discuss post-event vol crush risk by strategy type.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **NVDA** - Completed tools: get_options_chain - Remaining required tools: get_iv_analysis, get_earnings_analysis Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN earnings-analysis-nvda#1
- Category: earnings
- Status: 200 | Score: 58 | Latency: 28193ms
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
- Status: 200 | Score: 58 | Latency: 32497ms
- Functions: get_earnings_analysis, get_iv_analysis, get_options_chain
- Widgets: options_chain
- Widget actions: options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:4, missing_widgets:earnings_analysis, contract_warnings:missing_recommended_functions:get_current_price,show_chart|missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_current_price,show_chart, missing_bull_bear_duality
- Prompt: For AAPL into earnings, compare debit spread vs iron condor using expected move and IV crush risk.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **AAPL** - Completed tools: get_options_chain - Remaining required tools: get_iv_analysis, get_earnings_analysis Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN strategy-credit-spread-selection#1
- Category: strategy
- Status: 200 | Score: 68 | Latency: 18494ms
- Functions: get_key_levels, get_iv_analysis, show_chart, get_options_chain
- Widgets: key_levels, options_chain
- Widget actions: key_levels: Show on Chart | View Options | Ask AI; options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:2, missing_widgets:iv_analysis, contract_warnings:missing_recommended_functions:get_current_price|missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_current_price, missing_bull_bear_duality
- Prompt: Given current SPX vol regime, should I consider a call credit spread or put credit spread today? Include strike logic and invalidation.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_key_levels, show_chart, get_options_chain - Key levels: PDC **$6964.82**, PDL **$6905.87** - Remaining required tools: get_iv_analysis Follow up with a narrower ask for full detail, for example: "SPX b…

### WARN advanced-gex-execution#1
- Category: advanced
- Status: 200 | Score: 70 | Latency: 20651ms
- Functions: get_key_levels, get_gamma_exposure, get_current_price, show_chart
- Widgets: key_levels, current_price
- Widget actions: key_levels: Show on Chart | View Options | Ask AI; current_price: Show on Chart | View Options | Set Alert
- Warnings: function_errors:2, missing_widgets:gex_profile, contract_warnings:missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_bull_bear_duality
- Prompt: Use SPX gamma exposure and key levels to design a trigger-based execution plan with invalidation and sizing rules.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_key_levels, get_current_price, show_chart - Key levels: PDC **$6964.82**, PDL **$6905.87** - SPX snapshot: Spot **$6941.81**, High **$6986.83**, Low **$6937.53** - Remaining required tools: get_gamma_e…

### WARN zero-dte-risk#1
- Category: options
- Status: 200 | Score: 70 | Latency: 3831ms
- Functions: get_current_price, get_zero_dte_analysis
- Widgets: current_price
- Widget actions: current_price: Show on Chart | View Options | Set Alert
- Warnings: function_errors:2, missing_widgets:zero_dte_analysis, contract_warnings:missing_recommended_functions:show_chart
- Contract blocking: none
- Contract warnings: missing_recommended_functions:show_chart
- Prompt: Analyze SPX 0DTE structure right now: expected move used, remaining move, and gamma risk.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_current_price - SPX snapshot: Spot **$6941.81**, High **$6986.83**, Low **$6937.53** - Remaining required tools: get_zero_dte_analysis Follow up with a narrower ask for full detail, for example: "SPX b…

### WARN advanced-vol-structure#1
- Category: advanced
- Status: 200 | Score: 72 | Latency: 34422ms
- Functions: get_iv_analysis, get_options_chain
- Widgets: options_chain
- Widget actions: options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:2, missing_widgets:iv_analysis
- Contract blocking: none
- Contract warnings: none
- Prompt: Compare front-end and back-end implied vol structure in QQQ and tell me how that should change trade construction today.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **QQQ** - Completed tools: get_options_chain - Remaining required tools: get_iv_analysis Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN iv-regime-qqq#1
- Category: options
- Status: 200 | Score: 72 | Latency: 9664ms
- Functions: get_iv_analysis, get_options_chain
- Widgets: options_chain
- Widget actions: options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:2, missing_widgets:iv_analysis
- Contract blocking: none
- Contract warnings: none
- Prompt: What is QQQ IV rank, skew, and term structure, and how should that change premium-selling decisions?
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **QQQ** - Completed tools: get_options_chain - Remaining required tools: get_iv_analysis Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN strategy-neutral-income#1
- Category: strategy
- Status: 200 | Score: 80 | Latency: 23147ms
- Functions: get_current_price, get_options_chain, get_iv_analysis
- Widgets: current_price, options_chain
- Widget actions: current_price: Show on Chart | View Options | Set Alert; options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:1, missing_widgets:iv_analysis, contract_warnings:missing_recommended_functions:show_chart
- Contract blocking: none
- Contract warnings: missing_recommended_functions:show_chart
- Prompt: Design a neutral options income idea for QQQ and explain when to avoid it based on volatility structure.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **QQQ** - Completed tools: get_current_price, get_options_chain - QQQ snapshot: Spot **$611.47**, High **$617.02**, Low **$611.01** Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidatio…

### WARN beginner-options-safe#1
- Category: beginner
- Status: 200 | Score: 84 | Latency: 14679ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, contract_warnings:missing_recommended_functions:get_current_price,get_options_chain|missing_numeric_prices
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_current_price,get_options_chain, missing_numeric_prices
- Prompt: I only understand basic calls and puts. Show me safer ways to approach options this week and what not to do.
- Response preview: Here's a guide to safer ways to approach options trading this week, along with some common pitfalls to avoid: ### Safer Approaches: 1. **Covered Calls**: - **What it is**: Selling call options against shares you already own. - **Why it's safer**: Generates income and offsets potential losses if the stock price drops. …

### WARN advanced-multi-symbol-rotation#1
- Category: advanced
- Status: 200 | Score: 87 | Latency: 39947ms
- Functions: get_key_levels, show_chart
- Widgets: key_levels
- Widget actions: key_levels: Show on Chart | View Options | Ask AI
- Warnings: missing_widgets:scan_results, missing_functions:scan_opportunities
- Contract blocking: none
- Contract warnings: none
- Prompt: Scan SPX, NDX, QQQ, NVDA, TSLA and rank where the best asymmetric setup is by structure, liquidity, and momentum quality.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_key_levels, show_chart - Key levels: PWH **$428.56**, PDH **$421.25** Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN options-beginner-greeks#1
- Category: beginner
- Status: 200 | Score: 98 | Latency: 24165ms
- Functions: get_options_chain, get_current_price
- Widgets: options_chain, current_price
- Widget actions: options_chain: View Options | Open Chart | Ask AI; current_price: Show on Chart | View Options | Set Alert
- Warnings: contract_warnings:missing_recommended_functions:show_chart
- Contract blocking: none
- Contract warnings: missing_recommended_functions:show_chart
- Prompt: Explain delta, theta, and IV in plain terms, then show how they matter for one real QQQ options example right now.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **QQQ** - Completed tools: get_options_chain, get_current_price - QQQ snapshot: Spot **$611.47**, High **$617.02**, Low **$611.01** Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidatio…


## Recommendation
- Address FAIL cases first (non-200 responses or malformed payloads), then rerun with `--iterations 2 --concurrency 4`.
