# AI Coach Temporary Stress Report

## Run Config
- API base: http://127.0.0.1:3001
- Prompts file: /Users/natekahl/ITM-gd/scripts/ai-coach/stress-prompts.temp.json
- Iterations: 1
- Concurrency: 1
- Timeout per request: 90000ms
- Strict contract gating: enabled
- Delay between requests: 500ms
- Category filter: all
- Output dir: /Users/natekahl/ITM-gd/.codex-scratch/ai-coach-stress/2026-02-11_01-11-35-716

## Summary
- Total requests: 8
- Passed: 5
- Failed: 3
- Warning cases: 6
- Pass rate: 62.5%
- Average score: 69.1
- Latency p50/p90/p95/max: 10499ms / 26268ms / 26268ms / 26268ms
- Duration: 100723ms

## Widget Coverage
- current_price: 4
- key_levels: 2
- market_overview: 1
- spx_game_plan: 1

## Function Coverage
- get_current_price: 4
- show_chart: 3
- get_key_levels: 2
- get_market_status: 1
- get_spx_game_plan: 1
- get_zero_dte_analysis: 1

## Findings
### FAIL current-price-spx#1
- Category: context
- Status: 503 | Score: 0 | Latency: 10499ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:current_price, missing_functions:get_current_price
- Contract blocking: missing
- Contract warnings: missing
- Prompt: What's the current SPX price with today's high and low?
- Response preview: {"error":"AI service unavailable","message":"The AI service is temporarily unavailable. Please try again in a moment.","details":"429 Rate limit reached for gpt-4o in organization org-ONkJhrFxBIXBhHoyCD7YJKrD on tokens per min (TPM): Limit 30000, Used 30000, Requested 1578. Please try again in 3.156s. Visit https://pl…

### FAIL gex-profile-spx#1
- Category: options
- Status: 503 | Score: 0 | Latency: 10569ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:gex_profile, missing_functions:get_gamma_exposure
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Give me SPX gamma exposure profile with flip level, max GEX strike, and implications for mean reversion vs trend.
- Response preview: {"error":"AI service unavailable","message":"The AI service is temporarily unavailable. Please try again in a moment.","details":"429 Rate limit reached for gpt-4o in organization org-ONkJhrFxBIXBhHoyCD7YJKrD on tokens per min (TPM): Limit 30000, Used 30000, Requested 1597. Please try again in 3.194s. Visit https://pl…

### FAIL options-chain-spx#1
- Category: options
- Status: 200 | Score: 79 | Latency: 5402ms
- Functions: get_current_price
- Widgets: current_price
- Widget actions: current_price: Show on Chart | View Options | Set Alert
- Warnings: missing_widgets:options_chain, missing_functions:get_options_chain, contract_blocking:missing_required_functions:get_options_chain
- Contract blocking: missing_required_functions:get_options_chain
- Contract warnings: none
- Prompt: Pull SPX options chain for nearest expiration and flag the most relevant strikes around spot.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_current_price - SPX snapshot: Spot **$6941.81**, High **$6986.83**, Low **$6937.53** - Remaining required tools: get_options_chain Follow up with a narrower ask for full detail, for example: "SPX bull …

### WARN zero-dte-risk#1
- Category: options
- Status: 200 | Score: 80 | Latency: 15595ms
- Functions: get_current_price, get_zero_dte_analysis
- Widgets: current_price
- Widget actions: current_price: Show on Chart | View Options | Set Alert
- Warnings: function_errors:1, missing_widgets:zero_dte_analysis, contract_warnings:missing_recommended_functions:show_chart
- Contract blocking: none
- Contract warnings: missing_recommended_functions:show_chart
- Prompt: Analyze SPX 0DTE structure right now: expected move used, remaining move, and gamma risk.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_current_price - SPX snapshot: Spot **$6941.81**, High **$6986.83**, Low **$6937.53** - Remaining required tools: get_zero_dte_analysis Follow up with a narrower ask for full detail, for example: "SPX b…

### WARN spx-game-plan#1
- Category: core
- Status: 200 | Score: 96 | Latency: 13851ms
- Functions: get_spx_game_plan, show_chart
- Widgets: spx_game_plan
- Widget actions: spx_game_plan: Show on Chart | View Options | Set Alert | Ask AI
- Warnings: contract_warnings:missing_recommended_functions:get_market_status|missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_market_status, missing_bull_bear_duality
- Prompt: Give me today's SPX game plan with key levels, gamma flip, expected move, and the best bullish/bearish intraday setups.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_spx_game_plan, show_chart Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN ndx-levels#1
- Category: levels
- Status: 200 | Score: 98 | Latency: 26268ms
- Functions: get_key_levels, show_chart, get_current_price
- Widgets: key_levels, current_price
- Widget actions: key_levels: Show on Chart | View Options | Ask AI; current_price: Show on Chart | View Options | Set Alert
- Warnings: contract_warnings:missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_bull_bear_duality
- Prompt: Show me NDX levels with strongest confluence and invalidation points for a breakout trade.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **NDX** - Completed tools: get_key_levels, show_chart, get_current_price - Key levels: PDC **$25268.14**, PDL **$24876.28** - NDX snapshot: Spot **$25127.64**, High **$25363.12**, Low **$25113.43** Follow up with a narrower ask for …


## Recommendation
- Address FAIL cases first (non-200 responses or malformed payloads), then rerun with `--iterations 2 --concurrency 4`.
