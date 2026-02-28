# Trade Day Replay V2 — Change Control & PR Standard

> **Created:** 2026-02-28

---

## Change Control Log

| ID | Phase/Slice | Files Changed | Gate Status | Commit SHA |
|----|------------|---------------|-------------|------------|
| CC-1 | V2 Slices 1-5 (chart + analysis) | Replay chart/components/types/backend route | tsc: PASS, backend tsc: PASS | pending |
| CC-2 | V2 Slices 6-7 (levels controls + sparkline polish) | replay controls, legend, trade-card sparkline/fallback, replay E2E expansion | eslint: PASS, tsc: PASS, vitest: PASS, playwright: PASS | pending |
| CC-3 | Session C hardening + release closeout docs | release notes, runbook, execution tracker, risk/change-control packet | Node 22 gates PASS (`eslint`, root `tsc`, targeted `vitest`, targeted `playwright`, backend `tsc`) | pending |

---

## PR Standard

### Commit Format
- `trade-day-replay-v2: <phase/slice> — <summary>`

### Scope Rules
1. Stage only files listed in the active slice report.
2. No unrelated refactors in replay-adjacent areas.
3. Keep backend and frontend contracts synchronized (`ReplayPayload` mirrors).

### Required Validation Before Merge
1. `export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"`
2. `pnpm exec eslint components/trade-day-replay/ e2e/specs/members/trade-day-replay.spec.ts e2e/specs/members/trade-day-replay-test-helpers.ts` (PASS, no output, exit 0)
3. `pnpm exec tsc --noEmit` (PASS, no output, exit 0)
4. `pnpm vitest run components/trade-day-replay/__tests__/trade-chart-markers.test.ts lib/trade-day-replay/__tests__/session-grader.test.ts` (PASS, 2 files / 6 tests)
5. `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/members/trade-day-replay.spec.ts --project=chromium --workers=1` (PASS, 5 tests)
6. `cd /Users/natekahl/ITM-gd/backend && npx tsc --noEmit` (PASS, no output, exit 0)
