# Risk Register And Decision Log

Date: 2026-03-15
Governing spec: `docs/specs/MEMBER_ACCESS_CONTROL_CENTER_EXECUTION_SPEC_2026-03-15.md`

## 1. Risk Register

| ID | Severity | Area | Description | Mitigation | Status |
|---|---|---|---|---|---|
| MACC-R1 | P0 | Access Drift | Old and new evaluators may disagree during cutover. | Shadow diff on member gate, tier, admin, and tab outputs. | Open |
| MACC-R2 | P0 | Auth Safety | Refactor could break login redirect and members-area access. | Migrate auth callback and member shell only after shared evaluator is proven. | Open |
| MACC-R3 | P1 | Guild Data | Guild roster may be stale or incomplete. | Cached roster with explicit freshness state and manual/bulk sync. | Open |
| MACC-R4 | P1 | Write Safety | Discord role mutation could desync app state or fail partially. | Use audited write flow plus forced post-mutation sync. | Open |
| MACC-R5 | P1 | Config Safety | Removing fallbacks could expose missing tab/config data in production. | Add explicit degraded-state handling and pre-cutover config validation. | Open |
| MACC-R6 | P1 | Identity Linkage | Discord member could be linked to the wrong site account. | Enforce uniqueness, conflict hard-fail, and audit on link/unlink. | Open |
| MACC-R7 | P1 | Override Abuse | Per-user overrides could become silent long-term permissions. | Require reason, expiry support, and audit review surface. | Open |
| MACC-R8 | P2 | UX Density | Admin page could become too complex to operate quickly. | Directory-first UI and progressive detail workspace. | Open |

## 2. Decision Log

| ID | Decision | Reason | Consequence |
|---|---|---|---|
| MACC-D1 | Treat this as a repo-wide access rewrite, not a page enhancement. | The current problem is architectural, not cosmetic. | Spec includes schema, service, route, UI, and deletion work. |
| MACC-D2 | Discord guild roster must be first-class. | Admins need visibility into users before first login. | Add `discord_guild_members`. |
| MACC-D3 | Role-driven access remains canonical. | Manual per-user tab toggles create unbounded drift. | Use audited overrides instead of ad hoc tab edits. |
| MACC-D4 | Fallback tab arrays must be removed from production paths. | Silent defaults hide real configuration failures. | Production degrades visibly instead of inventing tabs. |
| MACC-D5 | Auth/JWT metadata is cache, not source of truth. | Claims can be stale and are duplicated today. | Shared evaluator reads canonical DB-backed access state. |
