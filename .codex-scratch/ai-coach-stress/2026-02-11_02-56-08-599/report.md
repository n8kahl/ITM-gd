# AI Coach Temporary Stress Report

## Run Config
- API base: http://127.0.0.1:3001
- Prompts file: /Users/natekahl/ITM-gd/scripts/ai-coach/stress-prompts.temp.json
- Iterations: 1
- Concurrency: 1
- Timeout per request: 60000ms
- Strict contract gating: enabled
- Delay between requests: 350ms
- Category filter: scanner
- Output dir: /Users/natekahl/ITM-gd/.codex-scratch/ai-coach-stress/2026-02-11_02-56-08-599

## Summary
- Total requests: 1
- Passed: 1
- Failed: 0
- Warning cases: 1
- Pass rate: 100%
- Average score: 87
- Latency p50/p90/p95/max: 16807ms / 16807ms / 16807ms / 16807ms
- Duration: 17162ms

## Widget Coverage
- key_levels: 1

## Function Coverage
- get_key_levels: 1
- show_chart: 1

## Findings
### WARN scanner-top-setups#1
- Category: scanner
- Status: 200 | Score: 87 | Latency: 16807ms
- Functions: get_key_levels, show_chart
- Widgets: key_levels
- Widget actions: key_levels: Show on Chart | View Options | Ask AI
- Warnings: missing_widgets:scan_results, missing_functions:scan_opportunities
- Contract blocking: none
- Contract warnings: none
- Prompt: Scan SPX, NDX, QQQ, SPY, NVDA, AAPL and rank the top three setups with entry, stop, and target.
- Response preview: I gathered live data but hit the response budget before full analysis. - Focus symbol: **SPX** - Completed tools: get_key_levels, show_chart - Key levels: PDC **$274.62**, PDL **$271.70** Follow up with a narrower ask for full detail, for example: "SPX bull case only with 15m invalidation and 2 levels."


## Recommendation
- No hard failures. Increase `--iterations` and expand prompt corpus before release.
