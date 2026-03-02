# Sniper Mentorship Release Notes (2026-03-01)

## Summary
Production hardening release for the new Sniper Mentorship member area.

## Added
- Route-level mentorship access gate tied to tab visibility authorization.
- Mentorship resources route (`/members/mentorship/resources`).
- Interactive Week 1 modules:
  - EV calculator,
  - risk and drawdown calculator,
  - answerable knowledge check interactions.
- Persistent Week 1 checklist progress in local storage.
- Mentorship access unit tests and member E2E tests.

## Changed
- Added `required_discord_role_ids` support in:
  - DB `tab_configurations` schema,
  - admin tabs API write path,
  - admin tabs configuration UI,
  - admin member-access diagnostics path.
- Updated mentorship nav/button sizing for better mobile touch targets.
- Updated mentorship presentation styling toward brand-consistent glass card patterns.

## Fixed
- Broken `Resources` mentorship sub-nav target that previously resolved to 404.
- Mentorship deep-link exposure when navigation hid the mentorship tab.

## Operational Notes
- Migration required: `20260330010000_mentorship_tab_role_gate.sql`.
- Mentorship tab defaults to role ID `1468748795234881597`.
- Admin users retain mentorship-tab bypass behavior per existing auth model.
