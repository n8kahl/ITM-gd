# AI Coach Temporary Stress Report

## Run Config
- API base: http://127.0.0.1:3001
- Prompts file: /Users/natekahl/ITM-gd/scripts/ai-coach/stress-prompts.temp.json
- Iterations: 1
- Concurrency: 1
- Timeout per request: 90000ms
- Delay between requests: 2500ms
- Category filter: beginner, advanced
- Output dir: /Users/natekahl/ITM-gd/.codex-scratch/ai-coach-stress/2026-02-11_00-43-01-304

## Summary
- Total requests: 10
- Passed: 10
- Failed: 0
- Warning cases: 5
- Pass rate: 100%
- Average score: 90.9
- Latency p50/p90/p95/max: 2638ms / 7533ms / 7867ms / 7867ms
- Duration: 62891ms

## Widget Coverage
- spx_game_plan: 3
- key_levels: 1
- scan_results: 1
- options_chain: 1

## Function Coverage
- get_spx_game_plan: 3
- get_gamma_exposure: 1
- get_key_levels: 1
- scan_opportunities: 1
- get_earnings_analysis: 1
- get_iv_analysis: 1
- get_options_chain: 1

## Findings
### WARN advanced-post-earnings-vol#1
- Category: advanced
- Status: 200 | Score: 70 | Latency: 1288ms
- Functions: get_earnings_analysis
- Widgets: none
- Widget actions: none
- Warnings: function_errors:1, no_widgets_for_data_prompt, missing_widgets:earnings_analysis
- Prompt: For NVDA earnings, quantify expected move versus implied move and discuss post-event vol crush risk by strategy type.
- Response preview: I've reached the complexity limit for this question. Could you simplify or break it into smaller parts?

### WARN advanced-gex-execution#1
- Category: advanced
- Status: 200 | Score: 82 | Latency: 1635ms
- Functions: get_gamma_exposure, get_key_levels
- Widgets: key_levels
- Widget actions: key_levels: Show on Chart | View Options | Ask AI
- Warnings: function_errors:1, missing_widgets:gex_profile
- Prompt: Use SPX gamma exposure and key levels to design a trigger-based execution plan with invalidation and sizing rules.
- Response preview: I've reached the complexity limit for this question. Could you simplify or break it into smaller parts?

### WARN advanced-vol-structure#1
- Category: advanced
- Status: 200 | Score: 82 | Latency: 2325ms
- Functions: get_iv_analysis, get_options_chain
- Widgets: options_chain
- Widget actions: options_chain: View Options | Open Chart | Ask AI
- Warnings: function_errors:1, missing_widgets:iv_analysis
- Prompt: Compare front-end and back-end implied vol structure in QQQ and tell me how that should change trade construction today.
- Response preview: I've reached the complexity limit for this question. Could you simplify or break it into smaller parts?

### WARN beginner-levels-explainer#1
- Category: beginner
- Status: 200 | Score: 87 | Latency: 4010ms
- Functions: get_spx_game_plan
- Widgets: spx_game_plan
- Widget actions: spx_game_plan: Show on Chart | View Options | Set Alert | Ask AI
- Warnings: missing_widgets:key_levels, missing_functions:get_key_levels
- Prompt: Can you explain support, resistance, and VWAP like I'm new and then show me SPX examples for today?
- Response preview: I've reached the complexity limit for this question. Could you simplify or break it into smaller parts?

### WARN beginner-options-safe#1
- Category: beginner
- Status: 200 | Score: 88 | Latency: 7867ms
- Functions: none
- Widgets: none
- Widget actions: none
- Warnings: no_widgets_for_data_prompt
- Prompt: I only understand basic calls and puts. Show me safer ways to approach options this week and what not to do.
- Response preview: I've reached the complexity limit for this question. Could you simplify or break it into smaller parts?


## Recommendation
- No hard failures. Increase `--iterations` and expand prompt corpus before release.
