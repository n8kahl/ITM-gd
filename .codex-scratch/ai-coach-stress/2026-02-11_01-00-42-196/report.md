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
- Output dir: /Users/natekahl/ITM-gd/.codex-scratch/ai-coach-stress/2026-02-11_01-00-42-196

## Summary
- Total requests: 16
- Passed: 0
- Failed: 16
- Warning cases: 16
- Pass rate: 0%
- Average score: 0
- Latency p50/p90/p95/max: 54ms / 95ms / 372ms / 372ms
- Duration: 9242ms

## Widget Coverage
- none

## Function Coverage
- none

## Findings
### FAIL current-price-spx#1
- Category: context
- Status: 500 | Score: 0 | Latency: 49ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:current_price, missing_functions:get_current_price
- Contract blocking: missing
- Contract warnings: missing
- Prompt: What's the current SPX price with today's high and low?
- Response preview: {"error":"Internal server error","message":"E2E auth bootstrap failed"}

### FAIL earnings-analysis-nvda#1
- Category: earnings
- Status: 500 | Score: 0 | Latency: 41ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:earnings_analysis, missing_functions:get_earnings_analysis
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Analyze NVDA into earnings with expected move, IV context, and safest strategy choices.
- Response preview: {"error":"Internal server error","message":"E2E auth bootstrap failed"}

### FAIL earnings-calendar#1
- Category: earnings
- Status: 500 | Score: 0 | Latency: 47ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:earnings_calendar, missing_functions:get_earnings_calendar
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Show earnings calendar for my watchlist over the next 10 days and highlight highest risk names.
- Response preview: {"error":"Internal server error","message":"E2E auth bootstrap failed"}

### FAIL gex-profile-spx#1
- Category: options
- Status: 500 | Score: 0 | Latency: 52ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:gex_profile, missing_functions:get_gamma_exposure
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Give me SPX gamma exposure profile with flip level, max GEX strike, and implications for mean reversion vs trend.
- Response preview: {"error":"Internal server error","message":"E2E auth bootstrap failed"}

### FAIL iv-regime-qqq#1
- Category: options
- Status: 500 | Score: 0 | Latency: 51ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: missing_widgets:iv_analysis, missing_functions:get_iv_analysis
- Contract blocking: missing
- Contract warnings: missing
- Prompt: What is QQQ IV rank, skew, and term structure, and how should that change premium-selling decisions?
- Response preview: {"error":"Internal server error","message":"E2E auth bootstrap failed"}

### FAIL journal-insights#1
- Category: journal
- Status: 500 | Score: 0 | Latency: 57ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:journal_insights, missing_functions:get_journal_insights
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Review my journal and give me the top recurring mistakes and three concrete rules for tomorrow.
- Response preview: {"error":"Internal server error","message":"E2E auth bootstrap failed"}

### FAIL macro-context-spx#1
- Category: macro
- Status: 500 | Score: 0 | Latency: 54ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:macro_context, missing_functions:get_macro_context
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Summarize this week's macro catalysts and explain how they impact SPX intraday risk.
- Response preview: {"error":"Internal server error","message":"E2E auth bootstrap failed"}

### FAIL market-status#1
- Category: context
- Status: 500 | Score: 0 | Latency: 57ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: missing_widgets:market_overview, missing_functions:get_market_status
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Are markets open right now and how should I adjust aggressiveness in this session?
- Response preview: {"error":"Internal server error","message":"E2E auth bootstrap failed"}

### FAIL ndx-levels#1
- Category: levels
- Status: 500 | Score: 0 | Latency: 59ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:key_levels, missing_functions:get_key_levels
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Show me NDX levels with strongest confluence and invalidation points for a breakout trade.
- Response preview: {"error":"Internal server error","message":"E2E auth bootstrap failed"}

### FAIL options-chain-spx#1
- Category: options
- Status: 500 | Score: 0 | Latency: 44ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:options_chain, missing_functions:get_options_chain
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Pull SPX options chain for nearest expiration and flag the most relevant strikes around spot.
- Response preview: {"error":"Internal server error","message":"E2E auth bootstrap failed"}

### FAIL portfolio-analysis#1
- Category: risk
- Status: 500 | Score: 0 | Latency: 95ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:pnl_tracker, missing_functions:analyze_position
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Analyze my portfolio risk and tell me what I should manage first based on net delta, gamma, theta.
- Response preview: {"error":"Internal server error","message":"E2E auth bootstrap failed"}

### FAIL position-analysis-single#1
- Category: risk
- Status: 500 | Score: 0 | Latency: 55ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:position_summary, missing_functions:analyze_position
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Analyze this position: long 1 SPX 5900 call expiring next Friday at 40.00 entry. Give risk and adjustment plan.
- Response preview: {"error":"Internal server error","message":"E2E auth bootstrap failed"}

### FAIL scanner-top-setups#1
- Category: scanner
- Status: 500 | Score: 0 | Latency: 48ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:scan_results, missing_functions:scan_opportunities
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Scan SPX, NDX, QQQ, SPY, NVDA, AAPL and rank the top three setups with entry, stop, and target.
- Response preview: {"error":"Internal server error","message":"E2E auth bootstrap failed"}

### FAIL spx-game-plan#1
- Category: core
- Status: 500 | Score: 0 | Latency: 372ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:spx_game_plan, missing_functions:get_spx_game_plan
- Contract blocking: missing
- Contract warnings: missing
- Prompt: Give me today's SPX game plan with key levels, gamma flip, expected move, and the best bullish/bearish intraday setups.
- Response preview: {"error":"Internal server error","message":"E2E auth bootstrap failed"}

### FAIL spx-key-levels#1
- Category: levels
- Status: 500 | Score: 0 | Latency: 61ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt, missing_widgets:key_levels, missing_functions:get_key_levels
- Contract blocking: missing
- Contract warnings: missing
- Prompt: What are SPX key support and resistance levels right now and where does VWAP sit?
- Response preview: {"error":"Internal server error","message":"E2E auth bootstrap failed"}


## Recommendation
- Address FAIL cases first (non-200 responses or malformed payloads), then rerun with `--iterations 2 --concurrency 4`.
