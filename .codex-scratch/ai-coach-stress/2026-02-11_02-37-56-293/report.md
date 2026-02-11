# AI Coach Temporary Stress Report

## Run Config
- API base: http://127.0.0.1:3001
- Prompts file: /Users/natekahl/ITM-gd/scripts/ai-coach/stress-prompts.temp.json
- Iterations: 1
- Concurrency: 1
- Timeout per request: 60000ms
- Strict contract gating: enabled
- Delay between requests: 350ms
- Category filter: advanced
- Output dir: /Users/natekahl/ITM-gd/.codex-scratch/ai-coach-stress/2026-02-11_02-37-56-293

## Summary
- Total requests: 5
- Passed: 5
- Failed: 0
- Warning cases: 5
- Pass rate: 100%
- Average score: 68.4
- Latency p50/p90/p95/max: 11591ms / 34258ms / 34258ms / 34258ms
- Duration: 84201ms

## Widget Coverage
- key_levels: 2
- current_price: 2
- options_chain: 2

## Function Coverage
- show_chart: 3
- get_gamma_exposure: 2
- get_key_levels: 2
- get_current_price: 2
- get_iv_analysis: 2
- get_options_chain: 2
- get_earnings_analysis: 1

## Findings
### WARN advanced-flow-regime#1
- Category: advanced
- Status: 200 | Score: 55 | Latency: 7351ms
- Functions: get_gamma_exposure, show_chart
- Widgets: none
- Widget actions: none
- Warnings: function_errors:2, no_widgets_for_data_prompt, missing_widgets:spx_game_plan, missing_functions:get_spx_game_plan
- Contract blocking: none
- Contract warnings: none
- Prompt: Build an intraday regime map for SPX using gamma flip, max GEX, and expected move to define trend versus mean-reversion playbooks.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: show_chart - Remaining required tools: get_gamma_exposure Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN advanced-post-earnings-vol#1
- Category: advanced
- Status: 200 | Score: 58 | Latency: 25307ms
- Functions: get_earnings_analysis, get_iv_analysis, get_current_price, get_options_chain
- Widgets: current_price, options_chain
- Widget actions: current_price: Show on Chart | View Options | Set Alert; options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:3, missing_widgets:earnings_analysis, contract_warnings:missing_recommended_functions:show_chart|missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_recommended_functions:show_chart, missing_bull_bear_duality
- Prompt: For NVDA earnings, quantify expected move versus implied move and discuss post-event vol crush risk by strategy type.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **NVDA** - Completed tools: get_current_price, get_options_chain - NVDA snapshot: Spot **$188.54**, High **$192.48**, Low **$188.12** - Remaining required tools: get_iv_analysis Follow up with a narrower ask for full detail, for exa…

### WARN advanced-gex-execution#1
- Category: advanced
- Status: 200 | Score: 70 | Latency: 3917ms
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
- Status: 200 | Score: 72 | Latency: 11591ms
- Functions: get_iv_analysis, get_options_chain
- Widgets: options_chain
- Widget actions: options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:2, missing_widgets:iv_analysis
- Contract blocking: none
- Contract warnings: none
- Prompt: Compare front-end and back-end implied vol structure in QQQ and tell me how that should change trade construction today.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **QQQ** - Completed tools: get_options_chain - Remaining required tools: get_iv_analysis Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."

### WARN advanced-multi-symbol-rotation#1
- Category: advanced
- Status: 200 | Score: 87 | Latency: 34258ms
- Functions: get_key_levels, show_chart
- Widgets: key_levels
- Widget actions: key_levels: Show on Chart | View Options | Ask AI
- Warnings: missing_widgets:scan_results, missing_functions:scan_opportunities
- Contract blocking: none
- Contract warnings: none
- Prompt: Scan SPX, NDX, QQQ, NVDA, TSLA and rank where the best asymmetric setup is by structure, liquidity, and momentum quality.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_key_levels, show_chart - Key levels: PWH **$428.56**, PDH **$421.25** Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."


## Recommendation
- No hard failures. Increase `--iterations` and expand prompt corpus before release.
