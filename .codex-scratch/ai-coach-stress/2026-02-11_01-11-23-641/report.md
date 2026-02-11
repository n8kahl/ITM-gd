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
- Output dir: /Users/natekahl/ITM-gd/.codex-scratch/ai-coach-stress/2026-02-11_01-11-23-641

## Summary
- Total requests: 2
- Passed: 2
- Failed: 0
- Warning cases: 1
- Pass rate: 100%
- Average score: 99
- Latency p50/p90/p95/max: 2495ms / 3364ms / 3364ms / 3364ms
- Duration: 6669ms

## Widget Coverage
- key_levels: 2
- current_price: 2

## Function Coverage
- get_key_levels: 2
- get_current_price: 2
- show_chart: 2

## Findings
### WARN ndx-levels#1
- Category: levels
- Status: 200 | Score: 98 | Latency: 2495ms
- Functions: get_key_levels, get_current_price, show_chart
- Widgets: key_levels, current_price
- Widget actions: key_levels: Show on Chart | View Options | Ask AI; current_price: Show on Chart | View Options | Set Alert
- Warnings: contract_warnings:missing_bull_bear_duality
- Contract blocking: none
- Contract warnings: missing_bull_bear_duality
- Prompt: Show me NDX levels with strongest confluence and invalidation points for a breakout trade.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **NDX** - Completed tools: get_key_levels, get_current_price, show_chart - Key levels: PDC **$25268.14**, PDL **$24876.28** - NDX snapshot: Spot **$25127.64**, High **$25363.12**, Low **$25113.43** Follow up with a narrower ask for …


## Recommendation
- No hard failures. Increase `--iterations` and expand prompt corpus before release.
