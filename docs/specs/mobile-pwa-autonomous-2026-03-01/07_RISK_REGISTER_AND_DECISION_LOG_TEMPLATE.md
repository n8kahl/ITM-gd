# Risk Register & Decision Log — Mobile UX + PWA Workstream

**Workstream:** Mobile Reachability, Native-Feel UX, and PWA Installability
**Date:** 2026-03-01
**Governing Spec:** `docs/specs/MOBILE_PWA_EXECUTION_SPEC_2026-03-01.md`

---

## 1. Risk Register

### Active Risks

| ID | Risk | Likelihood | Impact | Severity | Mitigation | Owner | Status |
|----|------|-----------|--------|----------|------------|-------|--------|
| R1 | iOS Safari `dvh` support varies across versions | Medium | Medium | P1 | Test on iOS 15+ only; add fallback `vh` for older. Caniuse shows dvh at 91%+ global support. | Frontend Agent | Open |
| R2 | Studio pointer events break complex drag/resize on some Android browsers | Medium | High | P1 | Manual QA on Chrome Android + Samsung Internet before merge. Add `touch-action: none` to prevent browser gestures during drag. | Frontend Agent | Open |
| R3 | `beforeinstallprompt` not supported in Firefox/Safari | Certain | Low | P2 | Graceful degradation — only show CTA where event is supported. iOS gets separate instruction UI. | Frontend Agent | Open — Accepted |
| R4 | SW caching change breaks offline journal queue | Low | High | P0 | Journal queue uses IndexedDB + Background Sync (separate from fetch cache). Targeted test in Slice 3.2. Verify with offline simulation. | Frontend Agent | Open |
| R5 | iOS push requires standalone mode — users may not understand | Medium | Medium | P1 | iOS-specific guidance UI in Slice 3.3 explains requirement. Link to "Install" flow from push settings. | Frontend Agent | Open |
| R6 | Uncapping tabs causes visual overflow on very small screens | Low | Medium | P2 | "More" menu hardening in Slice 1.2 handles overflow. Tested at 320px minimum width. | Frontend Agent | Open |
| R7 | `pwa-asset-generator` dependency size or build issues | Low | Low | P2 | devDependency only; not in production bundle. Pin version. | Frontend Agent | Open |
| R8 | SPX immersive mode removes escape path for users | Medium | High | P1 | Require visible "back" button in top bar or gesture support. Acceptance criterion in Slice 1.3. | Frontend Agent | Open |
| R9 | Execution artifacts drift (spec, phase reports, tracker out of sync) causes invalid release sign-off | Medium | Medium | P1 | Update phase slice report + tracker in same slice before advancing. Block phase transitions if documentation is stale. | Docs Agent | Open |

### Retired Risks

| ID | Risk | Resolution | Date |
|----|------|-----------|------|
| | | | |

---

## 2. Decision Log

### Decision Template

```markdown
### D-XXX: <Decision Title>
- **Date:** YYYY-MM-DD
- **Context:** Why this decision was needed
- **Options Considered:**
  1. Option A — pros/cons
  2. Option B — pros/cons
- **Decision:** Which option was chosen
- **Rationale:** Why
- **Consequences:** What this means for implementation
- **Revisit Trigger:** Under what conditions to reconsider
```

### Decisions

### D-001: Pointer Events over Touch Events for Studio

- **Date:** 2026-03-01
- **Context:** Studio uses `mousedown/move/up` which don't work on touch. Need to choose replacement.
- **Options Considered:**
  1. Touch Events (`touchstart/move/end`) — touch-only, would need both mouse and touch handlers.
  2. Pointer Events (`pointerdown/move/up`) — unified API covering mouse, touch, pen.
- **Decision:** Pointer Events.
- **Rationale:** Single event system covers all input types. Better browser support than maintaining dual handlers. Aligns with modern web standards.
- **Consequences:** Requires `touch-action: none` on draggable elements to prevent browser scroll during drag.
- **Revisit Trigger:** If a browser with significant user share doesn't support Pointer Events.

### D-002: Network-Only as Default SW Strategy for /api/*

- **Date:** 2026-03-01
- **Context:** Current `networkFirst` strategy caches all API responses, including trading data that must be fresh.
- **Options Considered:**
  1. Keep `networkFirst` with shorter TTL — still risks stale data.
  2. Network-only for all `/api/*` — simple, safe, eliminates stale data risk entirely.
  3. Per-route caching allowlist — maximum control, more complexity.
- **Decision:** Network-only default with optional allowlist (Option 2+3 hybrid).
- **Rationale:** Trading platform cannot serve stale market data. Allowlist can be added incrementally for truly static endpoints.
- **Consequences:** No offline API data except journal queue (which uses IndexedDB, not fetch cache). This is acceptable because the product is a real-time trading platform.
- **Revisit Trigger:** If significant user complaints about offline performance outside of journal.

### D-003: Immersive Mode for SPX vs Shared Bottom Inset

- **Date:** 2026-03-01
- **Context:** SPX coach dock (z-68) collides with member bottom nav (z-40). Two approaches possible.
- **Options Considered:**
  1. Shared `--mobile-bottom-inset` CSS variable — both elements aware of each other.
  2. Immersive mode — hide bottom nav entirely on SPX route.
- **Decision:** Immersive mode (Option 2).
- **Rationale:** SPX Command Center is a focused trading environment. Full-screen real estate is more valuable than persistent nav. Precedent: mobile trading apps (Robinhood, TOS) use immersive modes. Simpler implementation.
- **Consequences:** Must ensure clear escape path (back button or gesture). Users navigate away via top bar, not bottom nav.
- **Revisit Trigger:** If user research shows SPX users frequently need to switch to other features mid-session.

### D-004: No Feature Flags for This Workstream

- **Date:** 2026-03-01
- **Context:** §12.6 requires flags for risky upgrades. Assessed whether this workstream qualifies.
- **Options Considered:**
  1. Feature flags per phase — maximum safety.
  2. No flags — changes are low-risk, additive, no backend/DB impact.
- **Decision:** No flags.
- **Rationale:** All changes are UI-layer (CSS, components, assets, service worker). No database migrations. No backend route changes. No auth model changes. Each slice is independently revertible via git. Blast radius is strictly frontend.
- **Consequences:** Rollback is via git revert rather than flag toggle. Acceptable given scope.
- **Revisit Trigger:** If any slice requires backend or database changes.

### D-005: Split Final Playwright Gates by Project

- **Date:** 2026-03-01
- **Context:** `e2e/pwa.spec.ts` requires `serviceWorkers: 'allow'`, while default `chromium` config blocks service workers.
- **Options Considered:**
  1. Run `e2e/pwa.spec.ts` in `chromium` and `pwa-chromium` - duplicates coverage and can fail due to blocked service workers.
  2. Run `e2e/mobile-*.spec.ts` in `chromium` and run `e2e/pwa.spec.ts` only in `pwa-chromium`.
- **Decision:** Option 2.
- **Rationale:** Keeps gate behavior aligned with the test contract and avoids false negatives from project config mismatch.
- **Consequences:** Final release gate explicitly includes two Playwright runs with distinct scopes.
- **Revisit Trigger:** If default `chromium` project changes to allow service workers.

---

## 3. Issue Tracking

### Open Issues

| ID | Slice | Issue | Severity | Assigned To | Status |
|----|-------|-------|----------|-------------|--------|
| | | | | | |

### Resolved Issues

| ID | Slice | Issue | Resolution | Date |
|----|-------|-------|-----------|------|
| | | | | |
