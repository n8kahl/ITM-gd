# AI Coach Temporary Stress Report

## Run Config
- API base: https://itm-gd-production.up.railway.app
- Prompts file: /Users/natekahl/ITM-gd/scripts/ai-coach/stress-prompts.temp.json
- Iterations: 1
- Concurrency: 1
- Timeout per request: 90000ms
- Strict contract gating: enabled
- Delay between requests: 800ms
- Category filter: all
- Output dir: /Users/natekahl/ITM-gd/.codex-scratch/ai-coach-stress/2026-02-11_00-59-38-655

## Summary
- Total requests: 12
- Passed: 0
- Failed: 12
- Warning cases: 12
- Pass rate: 0%
- Average score: 0
- Latency p50/p90/p95/max: 107ms / 165ms / 392ms / 392ms
- Duration: 11305ms

## Widget Coverage
- none

## Function Coverage
- none

## Findings
### FAIL current-price-spx#1
- Category: context
- Status: 401 | Score: 0 | Latency: 132ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:current_price, missing_functions:get_current_price
- Contract blocking: missing
- Contract warnings: missing
- Prompt: What's the current SPX price with today's high and low?
- Response preview: {"error":"Unauthorized","message":"Invalid or expired token"}

### FAIL earnings-analysis-nvda#1
- Category: earnings
- Status: 401 | Score: 0 | Latency: 165ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:earnings_analysis, missing_functions:get_earnings_analysis
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Analyze NVDA into earnings with expected move, IV context, and safest strategy choices.
- Response preview: {"error":"Unauthorized","message":"Invalid or expired token"}

### FAIL earnings-calendar#1
- Category: earnings
- Status: 401 | Score: 0 | Latency: 106ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:earnings_calendar, missing_functions:get_earnings_calendar
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Show earnings calendar for my watchlist over the next 10 days and highlight highest risk names.
- Response preview: {"error":"Unauthorized","message":"Invalid or expired token"}

### FAIL gex-profile-spx#1
- Category: options
- Status: 401 | Score: 0 | Latency: 107ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:gex_profile, missing_functions:get_gamma_exposure
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Give me SPX gamma exposure profile with flip level, max GEX strike, and implications for mean reversion vs trend.
- Response preview: {"error":"Unauthorized","message":"Invalid or expired token"}

### FAIL iv-regime-qqq#1
- Category: options
- Status: 401 | Score: 0 | Latency: 99ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: missing_widgets:iv_analysis, missing_functions:get_iv_analysis
- Contract blocking: missing
- Contract warnings: missing
- Prompt: What is QQQ IV rank, skew, and term structure, and how should that change premium-selling decisions?
- Response preview: {"error":"Unauthorized","message":"Invalid or expired token"}

### FAIL market-status#1
- Category: context
- Status: 401 | Score: 0 | Latency: 109ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: missing_widgets:market_overview, missing_functions:get_market_status
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Are markets open right now and how should I adjust aggressiveness in this session?
- Response preview: {"error":"Unauthorized","message":"Invalid or expired token"}

### FAIL ndx-levels#1
- Category: levels
- Status: 401 | Score: 0 | Latency: 107ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:key_levels, missing_functions:get_key_levels
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Show me NDX levels with strongest confluence and invalidation points for a breakout trade.
- Response preview: {"error":"Unauthorized","message":"Invalid or expired token"}

### FAIL options-chain-spx#1
- Category: options
- Status: 401 | Score: 0 | Latency: 91ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:options_chain, missing_functions:get_options_chain
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Pull SPX options chain for nearest expiration and flag the most relevant strikes around spot.
- Response preview: {"error":"Unauthorized","message":"Invalid or expired token"}

### FAIL scanner-top-setups#1
- Category: scanner
- Status: 401 | Score: 0 | Latency: 120ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:scan_results, missing_functions:scan_opportunities
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Scan SPX, NDX, QQQ, SPY, NVDA, AAPL and rank the top three setups with entry, stop, and target.
- Response preview: {"error":"Unauthorized","message":"Invalid or expired token"}

### FAIL spx-game-plan#1
- Category: core
- Status: 401 | Score: 0 | Latency: 392ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:spx_game_plan, missing_functions:get_spx_game_plan
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Give me today's SPX game plan with key levels, gamma flip, expected move, and the best bullish/bearish intraday setups.
- Response preview: {"error":"Unauthorized","message":"Invalid or expired token"}

### FAIL spx-key-levels#1
- Category: levels
- Status: 401 | Score: 0 | Latency: 157ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:key_levels, missing_functions:get_key_levels
- Contract blocking: missing
- Contract warnings: missing
- Prompt: What are SPX key support and resistance levels right now and where does VWAP sit?
- Response preview: {"error":"Unauthorized","message":"Invalid or expired token"}

### FAIL zero-dte-risk#1
- Category: options
- Status: 401 | Score: 0 | Latency: 91ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:zero_dte_analysis, missing_functions:get_zero_dte_analysis
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Analyze SPX 0DTE structure right now: expected move used, remaining move, and gamma risk.
- Response preview: {"error":"Unauthorized","message":"Invalid or expired token"}


## Recommendation
- Address FAIL cases first (non-200 responses or malformed payloads), then rerun with `--iterations 2 --concurrency 4`.
