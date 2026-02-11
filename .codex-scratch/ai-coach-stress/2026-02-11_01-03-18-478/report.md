# AI Coach Temporary Stress Report

## Run Config
- API base: http://127.0.0.1:3001
- Prompts file: /Users/natekahl/ITM-gd/scripts/ai-coach/stress-prompts.temp.json
- Iterations: 1
- Concurrency: 1
- Timeout per request: 90000ms
- Strict contract gating: enabled
- Delay between requests: 600ms
- Category filter: all
- Output dir: /Users/natekahl/ITM-gd/.codex-scratch/ai-coach-stress/2026-02-11_01-03-18-478

## Summary
- Total requests: 8
- Passed: 5
- Failed: 3
- Warning cases: 6
- Pass rate: 62.5%
- Average score: 87.8
- Latency p50/p90/p95/max: 1705ms / 2804ms / 2804ms / 2804ms
- Duration: 20175ms

## Widget Coverage
- current_price: 5
- key_levels: 3
- market_overview: 1
- options_chain: 1
- spx_game_plan: 1

## Function Coverage
- get_current_price: 5
- get_key_levels: 3
- get_gamma_exposure: 1
- get_market_status: 1
- get_options_chain: 1
- get_spx_game_plan: 1
- show_chart: 1
- get_zero_dte_analysis: 1

## Findings
### FAIL gex-profile-spx#1
- Category: options
- Status: 200 | Score: 58 | Latency: 1575ms
- Functions: get_gamma_exposure
- Widgets: none
- Widget actions: none
- Warnings: function_errors:1, no_widgets_for_data_prompt, missing_widgets:gex_profile, contract_blocking:missing_chart_sync:show_chart_not_called, contract_warnings:missing_recommended_functions:show_chart|missing_symbol_coverage:GEX
- Contract blocking: missing_chart_sync:show_chart_not_called
- Contract warnings: missing_recommended_functions:show_chart, missing_symbol_coverage:GEX
- Prompt: Give me SPX gamma exposure profile with flip level, max GEX strike, and implications for mean reversion vs trend.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Remaining required tools: get_gamma_exposure Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN zero-dte-risk#1
- Category: options
- Status: 200 | Score: 80 | Latency: 1705ms
- Functions: get_current_price, get_zero_dte_analysis
- Widgets: current_price
- Widget actions: current_price: Show on Chart | View Options | Set Alert
- Warnings: function_errors:1, missing_widgets:zero_dte_analysis, contract_warnings:missing_recommended_functions:show_chart
- Contract blocking: none
- Contract warnings: missing_recommended_functions:show_chart
- Prompt: Analyze SPX 0DTE structure right now: expected move used, remaining move, and gamma risk.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_current_price - SPX snapshot: Spot **$6941.81**, High **$6986.83**, Low **$6937.53** - Remaining required tools: get_zero_dte_analysis Follow up with a narrower ask for full detail, for example: "SPX b…

### FAIL ndx-levels#1
- Category: levels
- Status: 200 | Score: 82 | Latency: 1846ms
- Functions: get_key_levels, get_current_price
- Widgets: key_levels, current_price
- Widget actions: key_levels: Show on Chart | View Options | Ask AI; current_price: Show on Chart | View Options | Set Alert
- Warnings: contract_blocking:missing_required_functions:show_chart|missing_chart_sync:show_chart_not_called, contract_warnings:missing_bull_bear_duality
- Contract blocking: missing_required_functions:show_chart, missing_chart_sync:show_chart_not_called
- Contract warnings: missing_bull_bear_duality
- Prompt: Show me NDX levels with strongest confluence and invalidation points for a breakout trade.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **NDX** - Completed tools: get_key_levels, get_current_price - Key levels: PDC **$25268.14**, PDL **$24876.28** - NDX snapshot: Spot **$25127.64**, High **$25363.12**, Low **$25113.43** - Remaining required tools: show_chart Follow …

### FAIL spx-key-levels#1
- Category: levels
- Status: 200 | Score: 88 | Latency: 1929ms
- Functions: get_key_levels, get_current_price
- Widgets: key_levels, current_price
- Widget actions: key_levels: Show on Chart | View Options | Ask AI; current_price: Show on Chart | View Options | Set Alert
- Warnings: contract_blocking:missing_chart_sync:show_chart_not_called, contract_warnings:missing_recommended_functions:show_chart|missing_symbol_coverage:VWAP
- Contract blocking: missing_chart_sync:show_chart_not_called
- Contract warnings: missing_recommended_functions:show_chart, missing_symbol_coverage:VWAP
- Prompt: What are SPX key support and resistance levels right now and where does VWAP sit?
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_key_levels, get_current_price - Key levels: PDC **$6964.82**, PDL **$6905.87** - SPX snapshot: Spot **$6941.81**, High **$6986.83**, Low **$6937.53** Follow up with a narrower ask for full detail, for …

### WARN spx-game-plan#1
- Category: core
- Status: 200 | Score: 96 | Latency: 2478ms
- Functions: get_spx_game_plan, show_chart
- Widgets: spx_game_plan
- Widget actions: spx_game_plan: Show on Chart | View Options | Set Alert | Ask AI
- Warnings: contract_warnings:missing_recommended_functions:get_market_status|missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_market_status, missing_bull_bear_duality
- Prompt: Give me today's SPX game plan with key levels, gamma flip, expected move, and the best bullish/bearish intraday setups.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_spx_game_plan, show_chart Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN current-price-spx#1
- Category: context
- Status: 200 | Score: 98 | Latency: 1690ms
- Functions: get_current_price, get_key_levels
- Widgets: current_price, key_levels
- Widget actions: current_price: Show on Chart | View Options | Set Alert; key_levels: Show on Chart | View Options | Ask AI
- Warnings: contract_warnings:missing_recommended_functions:show_chart
- Contract blocking: none
- Contract warnings: missing_recommended_functions:show_chart
- Prompt: What's the current SPX price with today's high and low?
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_current_price, get_key_levels - Key levels: PDC **$6964.82**, PDL **$6905.87** - SPX snapshot: Spot **$6941.81**, High **$6986.83**, Low **$6937.53** Follow up with a narrower ask for full detail, for …


## Recommendation
- Address FAIL cases first (non-200 responses or malformed payloads), then rerun with `--iterations 2 --concurrency 4`.
