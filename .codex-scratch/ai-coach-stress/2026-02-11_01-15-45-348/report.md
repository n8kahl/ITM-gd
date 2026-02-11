# AI Coach Temporary Stress Report

## Run Config
- API base: http://127.0.0.1:3001
- Prompts file: /Users/natekahl/ITM-gd/scripts/ai-coach/stress-prompts.temp.json
- Iterations: 1
- Concurrency: 1
- Timeout per request: 90000ms
- Strict contract gating: enabled
- Delay between requests: 1200ms
- Category filter: all
- Output dir: /Users/natekahl/ITM-gd/.codex-scratch/ai-coach-stress/2026-02-11_01-15-45-348

## Summary
- Total requests: 44
- Passed: 34
- Failed: 10
- Warning cases: 31
- Pass rate: 77.3%
- Average score: 79
- Latency p50/p90/p95/max: 14772ms / 30477ms / 32384ms / 36642ms
- Duration: 779283ms

## Widget Coverage
- key_levels: 16
- current_price: 13
- options_chain: 5
- spx_game_plan: 4
- macro_context: 2
- market_overview: 2
- journal_insights: 1
- trade_history: 1

## Function Coverage
- show_chart: 18
- get_key_levels: 16
- get_current_price: 13
- get_iv_analysis: 6
- get_options_chain: 5
- get_spx_game_plan: 4
- get_earnings_analysis: 3
- get_gamma_exposure: 2
- get_macro_context: 2
- get_market_status: 2
- get_journal_insights: 1
- get_position_advice: 1
- get_trade_history_for_symbol: 1
- get_zero_dte_analysis: 1

## Findings
### FAIL current-price-spx#1
- Category: context
- Status: 503 | Score: 0 | Latency: 10561ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:current_price, missing_functions:get_current_price
- Contract blocking: missing
- Contract warnings: missing
- Prompt: What's the current SPX price with today's high and low?
- Response preview: {"error":"AI service unavailable","message":"The AI service is temporarily unavailable. Please try again in a moment.","details":"429 Rate limit reached for gpt-4o in organization org-ONkJhrFxBIXBhHoyCD7YJKrD on tokens per min (TPM): Limit 30000, Used 29771, Requested 1578. Please try again in 2.698s. Visit https://pl…

### FAIL earnings-calendar#1
- Category: earnings
- Status: 503 | Score: 0 | Latency: 10814ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:earnings_calendar, missing_functions:get_earnings_calendar
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Show earnings calendar for my watchlist over the next 10 days and highlight highest risk names.
- Response preview: {"error":"AI service unavailable","message":"The AI service is temporarily unavailable. Please try again in a moment.","details":"429 Rate limit reached for gpt-4o in organization org-ONkJhrFxBIXBhHoyCD7YJKrD on tokens per min (TPM): Limit 30000, Used 28759, Requested 1593. Please try again in 704ms. Visit https://pla…

### FAIL gex-profile-spx#1
- Category: options
- Status: 503 | Score: 0 | Latency: 10771ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:gex_profile, missing_functions:get_gamma_exposure
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Give me SPX gamma exposure profile with flip level, max GEX strike, and implications for mean reversion vs trend.
- Response preview: {"error":"AI service unavailable","message":"The AI service is temporarily unavailable. Please try again in a moment.","details":"429 Rate limit reached for gpt-4o in organization org-ONkJhrFxBIXBhHoyCD7YJKrD on tokens per min (TPM): Limit 30000, Used 30000, Requested 1597. Please try again in 3.194s. Visit https://pl…

### FAIL journal-insights#1
- Category: journal
- Status: 503 | Score: 0 | Latency: 10584ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:journal_insights, missing_functions:get_journal_insights
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Review my journal and give me the top recurring mistakes and three concrete rules for tomorrow.
- Response preview: {"error":"AI service unavailable","message":"The AI service is temporarily unavailable. Please try again in a moment.","details":"429 Rate limit reached for gpt-4o in organization org-ONkJhrFxBIXBhHoyCD7YJKrD on tokens per min (TPM): Limit 30000, Used 30000, Requested 1593. Please try again in 3.186s. Visit https://pl…

### FAIL strategy-neutral-income#1
- Category: strategy
- Status: 503 | Score: 0 | Latency: 10962ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:iv_analysis,options_chain, missing_functions:get_iv_analysis,get_options_chain
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Design a neutral options income idea for QQQ and explain when to avoid it based on volatility structure.
- Response preview: {"error":"AI service unavailable","message":"The AI service is temporarily unavailable. Please try again in a moment.","details":"429 Rate limit reached for gpt-4o in organization org-ONkJhrFxBIXBhHoyCD7YJKrD on tokens per min (TPM): Limit 30000, Used 28920, Requested 1590. Please try again in 1.02s. Visit https://pla…

### FAIL advanced-post-earnings-vol#1
- Category: advanced
- Status: 200 | Score: 48 | Latency: 23861ms
- Functions: get_earnings_analysis, get_iv_analysis
- Widgets: none
- Widget actions: none
- Warnings: function_errors:2, no_widgets_for_data_prompt, missing_widgets:earnings_analysis, contract_blocking:missing_required_functions:get_options_chain, contract_warnings:missing_recommended_functions:get_current_price,show_chart,get_options_chain|missing_bull_bear_duality
- Contract blocking: missing_required_functions:get_options_chain
- Contract warnings: missing_recommended_functions:get_current_price,show_chart,get_options_chain, missing_bull_bear_duality
- Prompt: For NVDA earnings, quantify expected move versus implied move and discuss post-event vol crush risk by strategy type.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **NVDA** - Remaining required tools: get_iv_analysis, get_options_chain, get_earnings_analysis Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN earnings-analysis-nvda#1
- Category: earnings
- Status: 200 | Score: 68 | Latency: 18068ms
- Functions: get_earnings_analysis, get_iv_analysis, get_options_chain
- Widgets: options_chain
- Widget actions: options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:2, missing_widgets:earnings_analysis, contract_warnings:missing_recommended_functions:get_current_price,show_chart|missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_current_price,show_chart, missing_bull_bear_duality
- Prompt: Analyze NVDA into earnings with expected move, IV context, and safest strategy choices.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **NVDA** - Completed tools: get_options_chain - Remaining required tools: get_iv_analysis, get_earnings_analysis Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN earnings-strategy-choice#1
- Category: earnings
- Status: 200 | Score: 68 | Latency: 32384ms
- Functions: get_earnings_analysis, get_iv_analysis, get_options_chain
- Widgets: options_chain
- Widget actions: options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:2, missing_widgets:earnings_analysis, contract_warnings:missing_recommended_functions:get_current_price,show_chart|missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_current_price,show_chart, missing_bull_bear_duality
- Prompt: For AAPL into earnings, compare debit spread vs iron condor using expected move and IV crush risk.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **AAPL** - Completed tools: get_options_chain - Remaining required tools: get_iv_analysis, get_earnings_analysis Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### FAIL advanced-flow-regime#1
- Category: advanced
- Status: 200 | Score: 70 | Latency: 18299ms
- Functions: get_gamma_exposure, get_spx_game_plan
- Widgets: spx_game_plan
- Widget actions: spx_game_plan: Show on Chart | View Options | Set Alert | Ask AI
- Warnings: function_errors:1, contract_blocking:missing_required_functions:get_earnings_analysis|missing_chart_sync:show_chart_not_called, contract_warnings:missing_recommended_functions:show_chart,get_iv_analysis,get_options_chain|missing_bull_bear_duality
- Contract blocking: missing_required_functions:get_earnings_analysis, missing_chart_sync:show_chart_not_called
- Contract warnings: missing_recommended_functions:show_chart,get_iv_analysis,get_options_chain, missing_bull_bear_duality
- Prompt: Build an intraday regime map for SPX using gamma flip, max GEX, and expected move to define trend versus mean-reversion playbooks.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_spx_game_plan - Remaining required tools: get_gamma_exposure, get_earnings_analysis Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN portfolio-analysis#1
- Category: risk
- Status: 200 | Score: 75 | Latency: 7073ms
- Functions: get_position_advice
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:pnl_tracker, missing_functions:analyze_position
- Contract blocking: none
- Contract warnings: none
- Prompt: Analyze my portfolio risk and tell me what I should manage first based on net delta, gamma, theta.
- Response preview: I gathered live data but hit the response budget before full analysis. - Completed tools: get_position_advice Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### FAIL beginner-options-safe#1
- Category: beginner
- Status: 200 | Score: 76 | Latency: 10910ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, contract_blocking:missing_required_functions:get_options_chain, contract_warnings:missing_recommended_functions:get_current_price|missing_numeric_prices
- Contract blocking: missing_required_functions:get_options_chain
- Contract warnings: missing_recommended_functions:get_current_price, missing_numeric_prices
- Prompt: I only understand basic calls and puts. Show me safer ways to approach options this week and what not to do.
- Response preview: To approach options trading with a focus on safety, consider the following strategies and practices: ### Safer Options Strategies 1. **Covered Calls**: - Own the underlying stock and sell call options against it. - Generates income and provides a buffer against minor declines. 2. **Cash-Secured Puts**: - Sell put opti…

### WARN strategy-credit-spread-selection#1
- Category: strategy
- Status: 200 | Score: 78 | Latency: 16637ms
- Functions: get_key_levels, get_iv_analysis, get_options_chain, show_chart
- Widgets: key_levels, options_chain
- Widget actions: key_levels: Show on Chart | View Options | Ask AI; options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:1, missing_widgets:iv_analysis, contract_warnings:missing_recommended_functions:get_current_price|missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_current_price, missing_bull_bear_duality
- Prompt: Given current SPX vol regime, should I consider a call credit spread or put credit spread today? Include strike logic and invalidation.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_key_levels, get_options_chain, show_chart - Key levels: PDC **$6964.82**, PDL **$6905.87** - Remaining required tools: get_iv_analysis Follow up with a narrower ask for full detail, for example: "SPX b…

### FAIL options-chain-spx#1
- Category: options
- Status: 200 | Score: 79 | Latency: 2978ms
- Functions: get_current_price
- Widgets: current_price
- Widget actions: current_price: Show on Chart | View Options | Set Alert
- Warnings: missing_widgets:options_chain, missing_functions:get_options_chain, contract_blocking:missing_required_functions:get_options_chain
- Contract blocking: missing_required_functions:get_options_chain
- Contract warnings: none
- Prompt: Pull SPX options chain for nearest expiration and flag the most relevant strikes around spot.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_current_price - SPX snapshot: Spot **$6941.81**, High **$6986.83**, Low **$6937.53** - Remaining required tools: get_options_chain Follow up with a narrower ask for full detail, for example: "SPX bull …

### WARN advanced-gex-execution#1
- Category: advanced
- Status: 200 | Score: 80 | Latency: 18551ms
- Functions: get_key_levels, get_gamma_exposure, get_current_price, show_chart
- Widgets: key_levels, current_price
- Widget actions: key_levels: Show on Chart | View Options | Ask AI; current_price: Show on Chart | View Options | Set Alert
- Warnings: function_errors:1, missing_widgets:gex_profile, contract_warnings:missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_bull_bear_duality
- Prompt: Use SPX gamma exposure and key levels to design a trigger-based execution plan with invalidation and sizing rules.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_key_levels, get_current_price, show_chart - Key levels: PDC **$6964.82**, PDL **$6905.87** - SPX snapshot: Spot **$6941.81**, High **$6986.83**, Low **$6937.53** - Remaining required tools: get_gamma_e…

### FAIL beginner-risk-rules#1
- Category: beginner
- Status: 200 | Score: 80 | Latency: 9033ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: contract_blocking:missing_required_functions:get_key_levels,show_chart|missing_chart_sync:show_chart_not_called, contract_warnings:missing_recommended_functions:get_current_price|missing_bull_bear_duality
- Contract blocking: missing_required_functions:get_key_levels,show_chart, missing_chart_sync:show_chart_not_called
- Contract warnings: missing_recommended_functions:get_current_price, missing_bull_bear_duality
- Prompt: Explain in plain language how much I should risk per trade if my account is small, and when I should stop trading for the day.
- Response preview: Here’s a simple framework for managing risk and deciding when to stop trading for the day, especially if you have a small account: ### Risk Per Trade - **Percentage-Based Risk:** A common rule is to risk only 1-2% of your account on any single trade. - **Example:** If your account is $1,000, risk $10-$20 per trade. - …


## Recommendation
- Address FAIL cases first (non-200 responses or malformed payloads), then rerun with `--iterations 2 --concurrency 4`.
