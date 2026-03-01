# Same-Day Replay — Change Control & PR Standard

> **Created:** 2026-02-28  
> **Feature Spec:** `/Users/natekahl/ITM-gd/docs/specs/SAME_DAY_REPLAY_EXECUTION_SPEC_2026-02-28.md`

---

## Change Control Log

| ID | Session | Scope | Files Changed | Gate Status | Commit SHA |
|----|--------|-------|---------------|-------------|------------|
| CC-S0 | Session 0 | Scope redefinition + control packet creation | Same-Day Replay spec + autonomous packet docs | Doc-only | pending |
| CC-S1 | Session 1 | Phase 1.1-1.4 DDL + RLS baseline | `supabase/migrations/20260328020000_same_day_replay_session1_data_foundation.sql` | PASS (DDL applied + advisors run + tsc) | pending |
| CC-S1b | Session 1b | Phase 1 closeout hotfix (SPX seed + FK covering indexes) | `supabase/migrations/20260328030000_same_day_replay_session1b_closeout_hotfix.sql` | PASS (DDL applied + advisors run + tsc) | pending |
| CC-S2 | Session 2 | Phase 1.5-1.6 shared replay types + env schema wiring | `lib/trade-day-replay/types.ts`, `lib/spx/replay-engine.ts`, `backend/src/config/env.ts`, `.env.example`, autonomous packet docs | PASS (eslint + tsc + vitest) | pending |
| CC-S3 | Session 3 | Phase 2.1 replay snapshot writer service + unit coverage (no Phase 2.2 integration) | `backend/src/services/spx/replaySnapshotWriter.ts`, `backend/src/services/spx/__tests__/replaySnapshotWriter.test.ts`, autonomous packet docs | PASS (eslint + tsc + jest) | pending |
| CC-S4 | Session 4 | Phase 2.2 replay snapshot integration into SPX snapshot cycle (interval + transition capture, fail-open) | `backend/src/services/spx/index.ts`, `backend/src/services/spx/__tests__/snapshotReplayIntegration.test.ts`, autonomous packet docs | PASS (eslint + tsc + jest) | pending |
| CC-S5 | Session 5 | Phase 2.3 admin snapshot fetch endpoint by canonical `session_id` (UUID) | `backend/src/routes/spx.ts`, `backend/src/__tests__/integration/spx-replay-snapshots-api.test.ts`, autonomous packet docs | PASS (eslint + tsc + jest) | pending |
| CC-S6 | Session 6 | Phase 2.4 bootstrap wiring for replay writer lifecycle + Discord bootstrap gate (no Phase 4 ingest logic) | `backend/src/server.ts`, `backend/src/services/spx/replaySnapshotWriter.ts`, `backend/src/services/spx/__tests__/replaySnapshotWriter.test.ts`, autonomous packet docs | PASS (eslint + tsc + jest) | pending |
| CC-S7 | Session 7 | Phase 4.1 Discord bot connection + listener lifecycle (no parser/state machine ingest) | `backend/src/services/discord/discordBot.ts`, `backend/src/services/discord/__tests__/discordBot.test.ts`, `backend/src/server.ts`, autonomous packet docs | PASS (eslint + tsc + jest) | pending |
| CC-S8 | Session 8 | Phase 4.2 deterministic Discord parser + lifecycle state machine (no LLM fallback/persistence/broadcast) | `backend/src/services/discord/messageParser.ts`, `backend/src/services/discord/__tests__/messageParser.test.ts`, autonomous packet docs | PASS (eslint + tsc + jest) | pending |
| CC-S9 | Session 9 | Phase 4.3 LLM fallback for unstructured Discord messages with strict schema validation + fail-open coercion (no broadcaster/persistence/routes) | `backend/src/services/discord/messageParser.ts`, `backend/src/services/discord/__tests__/messageParser.test.ts`, autonomous packet docs | PASS (eslint + tsc + jest) | pending |
| CC-S10 | Session 10 | Phase 4.4 realtime Discord broadcaster + bot parser pipeline wiring (no persistence/routes/UI) | `backend/src/services/discord/discordBroadcaster.ts`, `backend/src/services/discord/__tests__/discordBroadcaster.test.ts`, `backend/src/server.ts`, `backend/src/services/discord/discordBot.ts`, autonomous packet docs | PASS (eslint + tsc + jest) | pending |
| CC-S11 | Session 11 | Phase 5.2a admin replay session browser list API (`GET /api/spx/replay-sessions`) with date/channel/symbol filters + canonical `sessionId` rows | `backend/src/routes/spx.ts`, `backend/src/__tests__/integration/spx-replay-sessions-api.test.ts`, autonomous packet docs | PASS (eslint + tsc + jest) | pending |
| CC-S12 | Session 12 | Phase 5.2b admin replay session trades API (`GET /api/spx/replay-sessions/:sessionId/trades`) with canonical session lookup + deterministic trade ordering | `backend/src/routes/spx.ts`, `backend/src/__tests__/integration/spx-replay-session-trades-api.test.ts`, autonomous packet docs | PASS (eslint + tsc + jest) | pending |
| CC-S13 | Session 13 | Phase 5.2c admin replay session detail API (`GET /api/spx/replay-sessions/:sessionId`) assembling session + snapshots + trades + messages | `backend/src/routes/spx.ts`, `backend/src/__tests__/integration/spx-replay-session-detail-api.test.ts`, autonomous packet docs | PASS (eslint + tsc + jest) | pending |
| CC-S14 | Session 14 | Phase 5.1a desktop replay session browser UI shell (list/detail preview with local filters and deterministic loading/empty/error states) | `components/spx-command-center/replay-session-browser.tsx`, `components/spx-command-center/spx-command-center-shell-sections.tsx`, autonomous packet docs | PASS (eslint + tsc) | pending |
| CC-S15 | Session 15 | Phase 5.1b replay session browser calendar/day grouping refinement (day navigator + selected-day grouping + row scanability badges) | `components/spx-command-center/replay-session-browser.tsx`, autonomous packet docs | PASS (eslint + tsc) | pending |
| CC-S16 | Session 16 | Phase 5.2d replay session detail contract enrichment on existing endpoint (`GET /api/spx/replay-sessions/:sessionId`) with fail-open `bars` + `priorDayBar` market context | `backend/src/routes/spx.ts`, `backend/src/__tests__/integration/spx-replay-session-detail-api.test.ts`, autonomous packet docs | PASS (eslint + tsc + jest) | pending |
| CC-S17 | Session 17 | Phase 4.5a Discord persistence foundation (session upsert + raw message persistence wired into live bot pipeline, fail-open) | `backend/src/services/discord/discordPersistence.ts`, `backend/src/services/discord/__tests__/discordPersistence.test.ts`, `backend/src/server.ts`, autonomous packet docs | PASS (eslint + tsc + jest) | pending |
| CC-S18 | Session 18 | Phase 4.5b parsed trade lifecycle persistence (`discord_parsed_trades`) + `discord_messages.parsed_trade_id` linking with V1 single-stream channel assumption | `backend/src/services/discord/discordPersistence.ts`, `backend/src/services/discord/__tests__/discordPersistence.test.ts`, autonomous packet docs | PASS (eslint + tsc + jest) | pending |
| CC-S19 | Session 19 | Phase 4.5c session rollup maintenance in `discord_trade_sessions` (`session_start/session_end/trade_count/net_pnl_pct`) with replay list regression coverage | `backend/src/services/discord/discordPersistence.ts`, `backend/src/services/discord/__tests__/discordPersistence.test.ts`, `backend/src/__tests__/integration/spx-replay-sessions-api.test.ts`, autonomous packet docs | PASS (eslint + tsc + jest) | pending |

### Session 1 Evidence
- Migration: `supabase/migrations/20260328020000_same_day_replay_session1_data_foundation.sql`
- SQL evidence command: `rg -n "CREATE TABLE|CREATE INDEX|ENABLE ROW LEVEL SECURITY|CREATE POLICY" supabase/migrations/20260328020000_same_day_replay_session1_data_foundation.sql` (pass)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Advisor checks executed after DDL apply:
  - `get_advisors(type: "security")`
  - `get_advisors(type: "performance")`

### Session 1b Evidence
- Migration: `supabase/migrations/20260328030000_same_day_replay_session1b_closeout_hotfix.sql`
- SQL evidence command: `rg -n "INSERT INTO public.symbol_profiles|ON CONFLICT|entry_snapshot_id|parsed_trade_id|CREATE INDEX" supabase/migrations/20260328030000_same_day_replay_session1b_closeout_hotfix.sql` (pass)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Advisor checks executed after DDL apply:
  - `get_advisors(type: "security")`
  - `get_advisors(type: "performance")`

### Session 2 Evidence
- Shared contract wiring: `lib/trade-day-replay/types.ts` + `lib/spx/replay-engine.ts` (null-safe frame defaults preserved)
- Env schema wiring: `backend/src/config/env.ts` + `.env.example`
- Lint validation: `pnpm exec eslint lib/trade-day-replay/types.ts lib/spx/replay-engine.ts backend/src/config/env.ts` (pass with warning: backend env file matched ignore pattern)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation: `pnpm vitest run lib/spx/__tests__/replay-engine.test.ts` (pass)

### Session 3 Evidence
- Replay snapshot writer service: `backend/src/services/spx/replaySnapshotWriter.ts`
- Unit coverage: `backend/src/services/spx/__tests__/replaySnapshotWriter.test.ts`
- Lint validation: `pnpm exec eslint backend/src/services/spx/replaySnapshotWriter.ts backend/src/services/spx/__tests__/replaySnapshotWriter.test.ts` (pass)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation: `pnpm --dir backend exec jest src/services/spx/__tests__/replaySnapshotWriter.test.ts --runInBand` (pass)

### Session 4 Evidence
- SPX cycle integration: `backend/src/services/spx/index.ts`
- Integration-style unit coverage: `backend/src/services/spx/__tests__/snapshotReplayIntegration.test.ts`
- Lint validation: `pnpm exec eslint backend/src/services/spx/index.ts backend/src/services/spx/__tests__/snapshotReplayIntegration.test.ts` (pass with warning: backend files matched ignore pattern)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation:
  - `pnpm --dir backend exec jest src/services/spx/__tests__/snapshotReplayIntegration.test.ts --runInBand` (pass)
  - `pnpm --dir backend exec jest src/services/spx/__tests__/replaySnapshotWriter.test.ts --runInBand` (pass)

### Session 5 Evidence
- Replay snapshots route: `backend/src/routes/spx.ts`
- Integration coverage: `backend/src/__tests__/integration/spx-replay-snapshots-api.test.ts`
- Lint validation: `pnpm exec eslint backend/src/routes/spx.ts backend/src/__tests__/integration/spx-replay-snapshots-api.test.ts` (pass)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation:
  - `pnpm --dir backend exec jest src/__tests__/integration/spx-replay-snapshots-api.test.ts --runInBand` (pass)
  - `pnpm --dir backend exec jest src/services/spx/__tests__/snapshotReplayIntegration.test.ts --runInBand` (pass regression)

### Session 6 Evidence
- Replay writer lifecycle + bootstrap wiring: `backend/src/server.ts` + `backend/src/services/spx/replaySnapshotWriter.ts`
- Lifecycle unit coverage extension: `backend/src/services/spx/__tests__/replaySnapshotWriter.test.ts`
- Lint validation: `pnpm exec eslint backend/src/server.ts backend/src/services/spx/replaySnapshotWriter.ts backend/src/services/spx/__tests__/replaySnapshotWriter.test.ts` (pass)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation:
  - `pnpm --dir backend exec jest src/services/spx/__tests__/replaySnapshotWriter.test.ts --runInBand` (pass)
  - `pnpm --dir backend exec jest src/services/spx/__tests__/snapshotReplayIntegration.test.ts --runInBand` (pass regression)

### Session 7 Evidence
- Discord bot lifecycle service (new): `backend/src/services/discord/discordBot.ts`
- Discord bot unit coverage (new): `backend/src/services/discord/__tests__/discordBot.test.ts`
- Server bootstrap wiring: `backend/src/server.ts`
- Lint validation: `pnpm exec eslint backend/src/server.ts backend/src/services/discord/discordBot.ts backend/src/services/discord/__tests__/discordBot.test.ts` (pass)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation:
  - `pnpm --dir backend exec jest src/services/discord/__tests__/discordBot.test.ts --runInBand` (pass)
  - `pnpm --dir backend exec jest src/services/spx/__tests__/replaySnapshotWriter.test.ts --runInBand` (pass regression)

### Session 8 Evidence
- Discord deterministic parser + state machine (new): `backend/src/services/discord/messageParser.ts`
- Parser/state-machine unit coverage (new): `backend/src/services/discord/__tests__/messageParser.test.ts`
- Lint validation: `pnpm exec eslint backend/src/services/discord/messageParser.ts backend/src/services/discord/__tests__/messageParser.test.ts` (pass)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation:
  - `pnpm --dir backend exec jest src/services/discord/__tests__/messageParser.test.ts --runInBand` (pass)
  - `pnpm --dir backend exec jest src/services/discord/__tests__/discordBot.test.ts --runInBand` (pass regression)

### Session 9 Evidence
- Discord parser fallback extension: `backend/src/services/discord/messageParser.ts`
- Fallback unit coverage extension: `backend/src/services/discord/__tests__/messageParser.test.ts`
- Lint validation: `pnpm exec eslint backend/src/services/discord/messageParser.ts backend/src/services/discord/__tests__/messageParser.test.ts` (pass)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation:
  - `pnpm --dir backend exec jest src/services/discord/__tests__/messageParser.test.ts --runInBand` (pass)
  - `pnpm --dir backend exec jest src/services/discord/__tests__/discordBot.test.ts --runInBand` (pass regression)

### Session 10 Evidence
- Realtime broadcaster service (new): `backend/src/services/discord/discordBroadcaster.ts`
- Broadcaster unit coverage (new): `backend/src/services/discord/__tests__/discordBroadcaster.test.ts`
- Bot pipeline wiring updates: `backend/src/server.ts` + `backend/src/services/discord/discordBot.ts`
- Lint validation: `pnpm exec eslint backend/src/services/discord/discordBroadcaster.ts backend/src/services/discord/__tests__/discordBroadcaster.test.ts backend/src/server.ts backend/src/services/discord/discordBot.ts` (pass)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation:
  - `pnpm --dir backend exec jest src/services/discord/__tests__/discordBroadcaster.test.ts --runInBand` (pass)
  - `pnpm --dir backend exec jest src/services/discord/__tests__/messageParser.test.ts --runInBand` (pass regression)
  - `pnpm --dir backend exec jest src/services/discord/__tests__/discordBot.test.ts --runInBand` (pass regression)

### Session 11 Evidence
- Replay sessions list route extension: `backend/src/routes/spx.ts`
- Integration coverage (new): `backend/src/__tests__/integration/spx-replay-sessions-api.test.ts`
- Lint validation: `pnpm exec eslint backend/src/routes/spx.ts backend/src/__tests__/integration/spx-replay-sessions-api.test.ts` (pass with warning: backend files matched ignore pattern)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation:
  - `pnpm --dir backend exec jest src/__tests__/integration/spx-replay-sessions-api.test.ts --runInBand` (pass)
  - `pnpm --dir backend exec jest src/services/discord/__tests__/discordBroadcaster.test.ts --runInBand` (pass regression)

### Session 12 Evidence
- Replay session trades route extension: `backend/src/routes/spx.ts`
- Integration coverage (new): `backend/src/__tests__/integration/spx-replay-session-trades-api.test.ts`
- Lint validation: `pnpm exec eslint backend/src/routes/spx.ts backend/src/__tests__/integration/spx-replay-session-trades-api.test.ts` (pass with warning: backend files matched ignore pattern)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation:
  - `pnpm --dir backend exec jest src/__tests__/integration/spx-replay-session-trades-api.test.ts --runInBand` (pass)
  - `pnpm --dir backend exec jest src/__tests__/integration/spx-replay-sessions-api.test.ts --runInBand` (pass regression)

### Session 13 Evidence
- Replay session detail route extension: `backend/src/routes/spx.ts`
- Integration coverage (new): `backend/src/__tests__/integration/spx-replay-session-detail-api.test.ts`
- Lint validation: `pnpm exec eslint backend/src/routes/spx.ts backend/src/__tests__/integration/spx-replay-session-detail-api.test.ts` (pass with warning: backend files matched ignore pattern)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation:
  - `pnpm --dir backend exec jest src/__tests__/integration/spx-replay-session-detail-api.test.ts --runInBand` (pass)
  - `pnpm --dir backend exec jest src/__tests__/integration/spx-replay-session-trades-api.test.ts --runInBand` (pass regression)

### Session 14 Evidence
- Replay session browser UI shell (new): `components/spx-command-center/replay-session-browser.tsx`
- Desktop sidebar wiring update: `components/spx-command-center/spx-command-center-shell-sections.tsx`
- Lint validation: `pnpm exec eslint components/spx-command-center/replay-session-browser.tsx components/spx-command-center/spx-command-center-shell-sections.tsx` (pass)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Component test note: UI component test harness not available for DOM rendering in current workspace (`jsdom` package not installed), so this slice validates via lint + typecheck only.

### Session 15 Evidence
- Replay session browser refinement update: `components/spx-command-center/replay-session-browser.tsx`
- Lint validation: `pnpm exec eslint components/spx-command-center/replay-session-browser.tsx components/spx-command-center/spx-command-center-shell-sections.tsx` (pass)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Component test note: UI component test harness remains unavailable for DOM rendering in current workspace (`jsdom` package not installed), so this slice validates via lint + typecheck only.

### Session 16 Evidence
- Replay session detail route enrichment: `backend/src/routes/spx.ts`
- Integration coverage update: `backend/src/__tests__/integration/spx-replay-session-detail-api.test.ts`
- Lint validation: `pnpm exec eslint backend/src/routes/spx.ts backend/src/__tests__/integration/spx-replay-session-detail-api.test.ts` (pass with warning: backend files matched ignore pattern)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation:
  - `pnpm --dir backend exec jest src/__tests__/integration/spx-replay-session-detail-api.test.ts --runInBand` (pass but skipped by socket gate in default sandbox mode)
  - `pnpm --dir backend exec jest src/__tests__/integration/spx-replay-session-trades-api.test.ts --runInBand` (pass but skipped by socket gate in default sandbox mode)
  - `JEST_SOCKET_BIND_ALLOWED=1 pnpm --dir backend exec jest src/__tests__/integration/spx-replay-session-detail-api.test.ts --runInBand` (pass, executed)
  - `JEST_SOCKET_BIND_ALLOWED=1 pnpm --dir backend exec jest src/__tests__/integration/spx-replay-session-trades-api.test.ts --runInBand` (pass regression, executed)

### Session 17 Evidence
- Discord persistence service (new): `backend/src/services/discord/discordPersistence.ts`
- Discord persistence unit coverage (new): `backend/src/services/discord/__tests__/discordPersistence.test.ts`
- Bot pipeline wiring update: `backend/src/server.ts`
- Lint validation: `pnpm exec eslint backend/src/services/discord/discordPersistence.ts backend/src/services/discord/__tests__/discordPersistence.test.ts backend/src/server.ts` (pass with warning: backend files matched ignore pattern)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation:
  - `pnpm --dir backend exec jest src/services/discord/__tests__/discordPersistence.test.ts --runInBand` (pass)
  - `pnpm --dir backend exec jest src/services/discord/__tests__/discordBot.test.ts --runInBand` (pass regression)
  - `pnpm --dir backend exec jest src/services/discord/__tests__/discordBroadcaster.test.ts --runInBand` (pass regression)
  - `pnpm --dir backend exec jest src/services/discord/__tests__/messageParser.test.ts --runInBand` (pass regression)

### Session 18 Evidence
- Discord persistence service lifecycle extension: `backend/src/services/discord/discordPersistence.ts`
- Discord persistence lifecycle unit coverage extension: `backend/src/services/discord/__tests__/discordPersistence.test.ts`
- Lint validation: `pnpm exec eslint backend/src/services/discord/discordPersistence.ts backend/src/services/discord/__tests__/discordPersistence.test.ts backend/src/server.ts` (pass with warning: backend files matched ignore pattern)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation:
  - `pnpm --dir backend exec jest src/services/discord/__tests__/discordPersistence.test.ts --runInBand` (pass)
  - `pnpm --dir backend exec jest src/services/discord/__tests__/messageParser.test.ts --runInBand` (pass regression)
  - `pnpm --dir backend exec jest src/services/discord/__tests__/discordBot.test.ts --runInBand` (pass regression)
  - `pnpm --dir backend exec jest src/services/discord/__tests__/discordBroadcaster.test.ts --runInBand` (pass regression)

### Session 19 Evidence
- Discord persistence rollup maintenance update: `backend/src/services/discord/discordPersistence.ts`
- Discord persistence rollup unit coverage update: `backend/src/services/discord/__tests__/discordPersistence.test.ts`
- Replay sessions list integration regression update: `backend/src/__tests__/integration/spx-replay-sessions-api.test.ts`
- Lint validation: `pnpm exec eslint backend/src/services/discord/discordPersistence.ts backend/src/services/discord/__tests__/discordPersistence.test.ts backend/src/__tests__/integration/spx-replay-sessions-api.test.ts` (pass with warnings: backend files matched ignore pattern)
- Compile validation: `pnpm exec tsc --noEmit` (pass)
- Targeted test validation:
  - `pnpm --dir backend exec jest src/services/discord/__tests__/discordPersistence.test.ts --runInBand` (pass)
  - `pnpm --dir backend exec jest src/__tests__/integration/spx-replay-sessions-api.test.ts --runInBand` (pass)
  - `pnpm --dir backend exec jest src/services/discord/__tests__/messageParser.test.ts --runInBand` (pass regression)
  - `pnpm --dir backend exec jest src/services/discord/__tests__/discordBroadcaster.test.ts --runInBand` (pass regression)
  - `pnpm --dir backend exec jest src/services/discord/__tests__/discordBot.test.ts --runInBand` (pass regression)

---

## PR Standard

### Commit Format
- `same-day-replay: <phase/slice> — <summary>`

### Scope Rules
1. Stage only files listed in the active slice prompt.
2. No unrelated refactors in SPX, replay, or auth surfaces.
3. Keep backend/frontend contracts synchronized before merge.
4. Keep replay APIs admin-only in V1 (`authenticateToken` + `requireAdmin`).

### Required Validation Before Merge
1. `pnpm exec eslint <touched files>`
2. `pnpm exec tsc --noEmit`
3. `pnpm vitest run <targeted tests>`
4. `pnpm exec playwright test <targeted specs> --project=chromium --workers=1`
5. For DDL slices, run:
   - `get_advisors(type: "security")`
   - `get_advisors(type: "performance")`

### Merge Blockers
- Missing RLS policy coverage on any new table.
- Missing admin gate on any new replay endpoint.
- Missing documented rollback point for the active slice.
