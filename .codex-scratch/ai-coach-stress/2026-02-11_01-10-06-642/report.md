# AI Coach Temporary Stress Report

## Run Config
- API base: http://127.0.0.1:3001
- Prompts file: /Users/natekahl/ITM-gd/scripts/ai-coach/stress-prompts.temp.json
- Iterations: 1
- Concurrency: 1
- Timeout per request: 90000ms
- Strict contract gating: enabled
- Delay between requests: 400ms
- Category filter: levels
- Output dir: /Users/natekahl/ITM-gd/.codex-scratch/ai-coach-stress/2026-02-11_01-10-06-642

## Summary
- Total requests: 2
- Passed: 1
- Failed: 1
- Warning cases: 2
- Pass rate: 50%
- Average score: 89
- Latency p50/p90/p95/max: 4585ms / 7154ms / 7154ms / 7154ms
- Duration: 12562ms

## Widget Coverage
- key_levels: 2
- current_price: 1

## Function Coverage
- get_key_levels: 2
- show_chart: 1
- get_current_price: 1

## Findings
### FAIL spx-key-levels#1
- Category: levels
- Status: 200 | Score: 82 | Latency: 4585ms
- Functions: get_key_levels, get_current_price
- Widgets: key_levels, current_price
- Widget actions: key_levels: Show on Chart | View Options | Ask AI; current_price: Show on Chart | View Options | Set Alert
- Warnings: contract_blocking:missing_required_functions:show_chart|missing_chart_sync:show_chart_not_called, contract_warnings:missing_recommended_functions:show_chart
- Contract blocking: missing_required_functions:show_chart, missing_chart_sync:show_chart_not_called
- Contract warnings: missing_recommended_functions:show_chart
- Prompt: What are SPX key support and resistance levels right now and where does VWAP sit?
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_key_levels, get_current_price - Key levels: PDC **$6964.82**, PDL **$6905.87** - SPX snapshot: Spot **$6941.81**, High **$6986.83**, Low **$6937.53** - Remaining required tools: show_chart Follow up wi…

### WARN ndx-levels#1
- Category: levels
- Status: 200 | Score: 96 | Latency: 7154ms
- Functions: get_key_levels, show_chart
- Widgets: key_levels
- Widget actions: key_levels: Show on Chart | View Options | Ask AI
- Warnings: contract_warnings:missing_recommended_functions:get_current_price|missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_recommended_functions:get_current_price, missing_bull_bear_duality
- Prompt: Show me NDX levels with strongest confluence and invalidation points for a breakout trade.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **NDX** - Completed tools: get_key_levels, show_chart - Key levels: PDC **$25268.14**, PDL **$24876.28** Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."


## Recommendation
- Address FAIL cases first (non-200 responses or malformed payloads), then rerun with `--iterations 2 --concurrency 4`.
