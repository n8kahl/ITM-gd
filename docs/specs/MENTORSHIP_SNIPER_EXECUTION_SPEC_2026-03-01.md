# Sniper Mentorship Execution Spec (2026-03-01)

## Objective
Ship the new `/members/mentorship` surface as a production-grade feature that is:
- role-gated and route-protected,
- mobile and desktop friendly,
- aligned with TradeITM brand standards,
- covered by targeted automated tests,
- documented with operational runbook and release notes.

## Scope
- Mentorship routes and sub-nav.
- Tab visibility and role-gating integration via `tab_configurations`.
- Admin tab configuration support for `required_discord_role_ids`.
- Week 1 UX hardening and interactivity upgrades.
- Mentorship docs + targeted automated tests.

## Out Of Scope
- New mentorship week content beyond Week 1.
- Backend analytics schema changes.
- New mentorship APIs beyond existing tab configuration surfaces.

## Acceptance Criteria
1. Mentorship route no longer exposes a broken sub-nav link.
2. Mentorship deep-links are blocked when tab visibility gate fails.
3. `required_discord_role_ids` is persisted in DB and admin tabs API/UI.
4. Week 1 mentorship content follows mobile rules (no horizontal-only core data rendering on mobile) and 44px+ touch targets on primary controls.
5. Week 1 includes interactive modules (calculator and answerable quiz pattern).
6. Automated coverage includes at least one non-happy-path mentorship test.

## Implementation Plan (Two-Session Process)

### Session A — Author + Integrate
- Add migration for `required_discord_role_ids` and mentorship tab seed.
- Update admin tabs API + UI to round-trip `required_discord_role_ids`.
- Add mentorship route access gate based on visible tab access.
- Add `/members/mentorship/resources` route and fix sub-nav integration gap.
- Harden Week 1 UX for brand/mobile and add interactive components.
- Add docs packet and automated tests.

### Session B — Validate + Fix + Evidence
- Lint touched files.
- Typecheck full app.
- Run targeted unit tests for mentorship access logic.
- Run targeted Playwright mentorship spec.
- Fix any introduced failures and record final outcomes.

## Risk Register
- Risk: environments missing migration could hide mentorship tab.
  - Mitigation: idempotent migration + fail-closed route gate + fallback tab config includes mentorship entry.
- Risk: route gate blocks valid users if tab config is misconfigured.
  - Mitigation: explicit admin tabs control for role IDs and runbook validation checks.
- Risk: e2e bypass tests drift from production tab shape.
  - Mitigation: dedicated mentorship e2e mock with explicit role-gate payload.

## Rollback Plan
1. Disable mentorship tab from `tab_configurations` (`is_active=false`).
2. Revert mentorship route gate and tab-role migration if needed.
3. Restore previous Week 1 page state via git revert.
