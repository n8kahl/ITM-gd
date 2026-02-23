# Change Control and PR Standard: SPX Autonomous Recovery
Date: February 20, 2026

## 1. Purpose
Standardize how autonomous implementation slices are documented, reviewed, and validated for production safety.

## 2. Required Record Per Slice
Every slice must have a change-control entry with:
1. Slice ID (`P<phase>-S<index>`)
2. Summary
3. Scope boundaries
4. Files changed
5. Tests run and outcomes
6. Risk assessment
7. Rollback method
8. Status

## 3. Slice Entry Template
```md
### Slice: P?-S?
- Objective:
- Status: planned | in_progress | blocked | done
- Scope:
- Out of scope:
- Files:
  - /path/file1
  - /path/file2
- Tests run:
  - command
  - result
- Risks introduced:
- Mitigations:
- Rollback:
- Notes:
```

## 4. PR Description Standard
Every PR must include:
1. Scope summary.
2. Why this slice exists now.
3. Risks and mitigations.
4. Test evidence.
5. Rollback plan.
6. Follow-up work (if any).

## 5. PR Template (Copy/Paste)
```md
## Scope
- 

## Context
- 

## Changes
- 

## Risks
- 

## Mitigations
- 

## Tests Run
- `...`
- `...`

## Results
- 

## Rollback Plan
- 

## Follow-ups
- 
```

## 6. Change Approval Checklist
1. Scope is phase-aligned and bounded.
2. No unrelated files changed.
3. Required tests executed and passing.
4. No unresolved `P0/P1` defects introduced.
5. Rollback approach is immediate and practical.

## 7. Drift Control Rules
1. If scope expands, split into new slice instead of inflating active PR.
2. If dependencies shift, update the phase workplan and risk register.
3. If behavior changes for users, update release notes and QA checklist.

## 8. Final Merge Conditions
PR can merge only when:
1. All required checks are green.
2. Reviewer can verify claims from evidence.
3. Change-control entry is complete.
4. Rollback instructions are concrete.

## 9. Active Slice Log
### Slice: P0-S1
- Objective: Freeze baseline selector and failure contracts before regression recovery.
- Status: done
- Scope:
  - Baseline critical SPX E2E run
  - Selector contract manifest
  - Baseline findings report
- Out of scope:
  - Functional code repair
- Files:
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_SELECTOR_CONTRACT_2026-02-20.md`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE0_BASELINE_2026-02-20.md`
- Tests run:
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1`
  - Result: 7 failed / 2 passed (baseline inventory)
- Risks introduced:
  - None (docs-only lock).
- Mitigations:
  - Explicit selector and failure-contract freeze.
- Rollback:
  - Remove baseline docs if superseded.
- Notes:
  - Establishes deterministic recovery scope for Phase 1.

### Slice: P1-S1
- Objective: Restore broken SPX command-center contracts for coach/palette/contract flows.
- Status: done
- Scope:
  - Header selector/text contract recovery.
  - Coach pinned alert lifecycle lane restoration.
  - Coach timeline/action-chip discoverability restoration.
  - Contract revert-to-AI visibility stabilization.
- Out of scope:
  - Phase 2 command registry consolidation.
  - Structural page/context refactors.
- Files:
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-header.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/ai-coach-feed.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/contract-card.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/contract-selector.tsx`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE1_RECOVERY_2026-02-20.md`
- Tests run:
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1`
  - Result: 9 passed / 0 failed
- Risks introduced:
  - Coach timeline default-open posture may conflict with future UX preference changes.
- Mitigations:
  - Timeline behavior explicitly contract-tested.
  - Lifecycle state persisted via existing v2 store.
- Rollback:
  - Revert the four SPX component changes listed above.
  - Re-run SPX critical E2E baseline suite.
- Notes:
  - Eliminates current P0 contract failures and unlocks Phase 2.

### Slice: P2-S1
- Objective: Consolidate palette and keyboard execution into one canonical SPX command registry.
- Status: done
- Scope:
  - Introduce command ID and keyboard-binding contracts.
  - Introduce shared registry hook for command execution.
  - Rewire page-level command palette and keyboard shortcut handling to shared registry.
- Out of scope:
  - Action-strip integration into registry.
  - New command capabilities beyond existing behaviors.
- Files:
  - `/Users/natekahl/ITM-gd/lib/spx/commands.ts`
  - `/Users/natekahl/ITM-gd/hooks/use-spx-command-registry.ts`
  - `/Users/natekahl/ITM-gd/app/members/spx-command-center/page.tsx`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE2_SLICE_P2-S1_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint app/members/spx-command-center/page.tsx hooks/use-spx-command-registry.ts lib/spx/commands.ts`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1`
  - Result: lint pass; E2E 9 passed / 0 failed
- Risks introduced:
  - Centralized command layer can create broader blast radius if future command edits regress.
- Mitigations:
  - Existing E2E critical suite retained as immediate parity gate.
  - Command IDs and keyboard bindings documented in one module.
- Rollback:
  - Revert `commands.ts`, `use-spx-command-registry.ts`, and page wiring changes.
  - Re-run SPX critical E2E suite.
- Notes:
  - Removes duplicate keyboard/palette execution branches and unlocks action-strip parity follow-up (`P2-S2`).

### Slice: P2-S2
- Objective: Route action-strip command actions through the same shared registry.
- Status: done
- Scope:
  - Extend registry API for command execution by ID and source.
  - Rewire action-strip callbacks in page shell to registry commands.
  - Preserve existing action-strip behavior while centralizing execution.
- Out of scope:
  - New action-strip features.
  - Phase 3 shell/controller extraction.
- Files:
  - `/Users/natekahl/ITM-gd/hooks/use-spx-command-registry.ts`
  - `/Users/natekahl/ITM-gd/app/members/spx-command-center/page.tsx`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE2_SLICE_P2-S2_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint app/members/spx-command-center/page.tsx hooks/use-spx-command-registry.ts lib/spx/commands.ts`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1`
  - Result: lint pass; E2E 9 passed / 0 failed
- Risks introduced:
  - Centralized command predicate changes can now impact action strip as well.
- Mitigations:
  - Shared surface parity reduces drift.
  - Critical E2E command contracts remain mandatory gate.
- Rollback:
  - Revert `use-spx-command-registry.ts` and page callback wiring for ActionStrip.
  - Re-run SPX critical E2E suite.
- Notes:
  - Completes Phase 2 command surface consolidation across keyboard, palette, and action strip.

### Slice: P3-S1
- Objective: Extract SPX command-center orchestration/state management from page shell into a dedicated controller hook.
- Status: done
- Scope:
  - Move orchestration state/effects/handlers to `useSPXCommandController`.
  - Rewire page shell to consume controller outputs.
  - Preserve command and interaction contracts.
  - Stabilize runtime by guarding undefined service-worker registration path discovered during validation.
- Out of scope:
  - Full component decomposition of presentation branches.
  - New user-facing feature behavior.
- Files:
  - `/Users/natekahl/ITM-gd/hooks/use-spx-command-controller.ts`
  - `/Users/natekahl/ITM-gd/app/members/spx-command-center/page.tsx`
  - `/Users/natekahl/ITM-gd/components/pwa/service-worker-register.tsx`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE3_SLICE_P3-S1_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint app/members/spx-command-center/page.tsx hooks/use-spx-command-controller.ts components/pwa/service-worker-register.tsx`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1`
  - Result: lint pass; E2E 9 passed / 0 failed
- Risks introduced:
  - Extraction can leave stale page dependencies causing runtime reference errors.
  - Shared hook centralization increases blast radius of orchestration changes.
- Mitigations:
  - Page now depends on an explicit controller return contract.
  - Lint + SPX critical E2E suite remain mandatory post-slice gate.
  - Defensive guard added for undefined service-worker registration object.
- Rollback:
  - Revert `use-spx-command-controller.ts`, `page.tsx`, and service-worker guard change.
  - Re-run SPX critical E2E suite.
- Notes:
  - Establishes the Phase 3 controller boundary needed for next extraction slices.

### Slice: P3-S2
- Objective: Remove remaining shell rendering sprawl by extracting explicit surface sections and re-establish clean static TypeScript gates.
- Status: done
- Scope:
  - Fix unrelated TypeScript mock typing failures blocking `tsc`.
  - Extract desktop main/sidebar and spatial sidebar decision surfaces into dedicated section components.
  - Extract keyboard shortcut overlay and desktop view mode toggle into section components.
  - Rewire page shell to section components without behavior change.
- Out of scope:
  - Full mobile/desktop container split into standalone route-level surface containers.
  - New product features.
- Files:
  - `/Users/natekahl/ITM-gd/lib/academy-v3/__tests__/access-control.test.ts`
  - `/Users/natekahl/ITM-gd/lib/admin/__tests__/tabs-route.test.ts`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-sections.tsx`
  - `/Users/natekahl/ITM-gd/app/members/spx-command-center/page.tsx`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE3_SLICE_P3-S2_2026-02-20.md`
- Tests run:
  - `pnpm exec tsc --noEmit`
  - `pnpm exec eslint app/members/spx-command-center/page.tsx components/spx-command-center/spx-command-center-shell-sections.tsx`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1`
  - Result: tsc pass; lint pass; E2E 9 passed / 0 failed
- Risks introduced:
  - Section prop wiring mistakes can create hidden cross-surface behavior drift.
- Mitigations:
  - Telemetry-triggering callbacks remain centralized in page controller shell.
  - SPX critical E2E suite remains mandatory parity gate.
- Rollback:
  - Revert `spx-command-center-shell-sections.tsx`, page rewiring, and test typing adjustments.
  - Re-run `tsc`, lint, and SPX critical E2E suite.
- Notes:
  - Establishes a stable decomposition layer for next Phase 3 container split (`P3-S3`).

### Slice: P3-S3
- Objective: Move remaining mobile/desktop render branches out of `page.tsx` into dedicated shell container components.
- Status: done
- Scope:
  - Add mobile and desktop shell container module.
  - Rewrite `page.tsx` as a thin orchestration shell.
  - Export typed controller contract for container wiring.
- Out of scope:
  - Full spatial canvas decomposition beyond desktop container boundary.
  - New feature behavior.
- Files:
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-containers.tsx`
  - `/Users/natekahl/ITM-gd/app/members/spx-command-center/page.tsx`
  - `/Users/natekahl/ITM-gd/hooks/use-spx-command-controller.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE3_SLICE_P3-S3_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint app/members/spx-command-center/page.tsx components/spx-command-center/spx-command-center-shell-containers.tsx components/spx-command-center/spx-command-center-shell-sections.tsx hooks/use-spx-command-controller.ts`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; E2E 9 passed / 0 failed
- Risks introduced:
  - Container boundaries can drift from controller return shape over time.
- Mitigations:
  - `SPXCommandController` return type exported and consumed directly in container props.
  - Regression gates (`tsc`, lint, SPX critical E2E) enforced post-slice.
- Rollback:
  - Revert container module, page shell rewrite, and controller type export.
  - Re-run lint, `tsc`, and SPX critical E2E suite.
- Notes:
  - Completes mobile/desktop branch extraction and materially reduces route shell complexity.

### Slice: P3-S4
- Objective: Isolate desktop spatial canvas composition into a dedicated component.
- Status: done
- Scope:
  - Add spatial desktop canvas component for chart/overlay composition.
  - Rewire desktop shell container to compose the spatial canvas component.
  - Preserve all existing interactions and telemetry behavior.
- Out of scope:
  - New spatial overlays or feature behavior.
  - Mobile surface changes.
- Files:
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-desktop-spatial-canvas.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-containers.tsx`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE3_SLICE_P3-S4_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint components/spx-command-center/spx-desktop-spatial-canvas.tsx components/spx-command-center/spx-command-center-shell-containers.tsx app/members/spx-command-center/page.tsx hooks/use-spx-command-controller.ts`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; E2E 9 passed / 0 failed
- Risks introduced:
  - Spatial canvas prop wiring drift can create hidden overlay regressions.
- Mitigations:
  - Explicit component prop contract.
  - Mandatory SPX critical E2E validation gate post-slice.
- Rollback:
  - Revert `spx-desktop-spatial-canvas.tsx` and container rewiring.
  - Re-run lint, `tsc`, and SPX critical E2E suite.
- Notes:
  - Establishes a stable spatial-canvas boundary for future performance and visual refinement slices.

### Slice: P3-S5
- Objective: Centralize desktop header/action-strip/sidebar orchestration into one mode-aware desktop orchestrator component.
- Status: done
- Scope:
  - Add desktop surface orchestrator component.
  - Rewire desktop shell container to consume orchestrator in classic and spatial views.
  - Preserve existing command and sidebar behavior.
- Out of scope:
  - Mobile orchestration extraction.
  - New feature behavior.
- Files:
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-desktop-surface-orchestrator.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-containers.tsx`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE3_SLICE_P3-S5_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint components/spx-command-center/spx-desktop-surface-orchestrator.tsx components/spx-command-center/spx-command-center-shell-containers.tsx components/spx-command-center/spx-desktop-spatial-canvas.tsx app/members/spx-command-center/page.tsx hooks/use-spx-command-controller.ts`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; E2E 9 passed / 0 failed
- Risks introduced:
  - Mode-specific action-strip behavior can drift if orchestrator config diverges.
- Mitigations:
  - Single orchestrator now owns both classic/spatial config paths.
  - SPX critical E2E suite enforced post-slice.
- Rollback:
  - Revert orchestrator component and container rewiring.
  - Re-run lint, `tsc`, and SPX critical E2E suite.
- Notes:
  - Removes duplicated desktop control composition and improves maintainability of mode transitions.

### Slice: P3-S6
- Objective: Centralize mobile command-stack/tabs/coach-dock orchestration into a dedicated mobile orchestrator component.
- Status: done
- Scope:
  - Add mobile surface orchestrator component.
  - Rewire mobile shell container to explicit orchestrator prop contract.
  - Preserve mobile behavior and command-center contracts.
- Out of scope:
  - Desktop orchestration changes.
  - New feature behavior.
- Files:
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-mobile-surface-orchestrator.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-containers.tsx`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE3_SLICE_P3-S6_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint components/spx-command-center/spx-mobile-surface-orchestrator.tsx components/spx-command-center/spx-command-center-shell-containers.tsx components/spx-command-center/spx-desktop-surface-orchestrator.tsx components/spx-command-center/spx-desktop-spatial-canvas.tsx app/members/spx-command-center/page.tsx hooks/use-spx-command-controller.ts`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; E2E 9 passed / 0 failed
- Risks introduced:
  - Mobile smart-stack vs tab-path behavior can drift if orchestrator prop mapping regresses.
- Mitigations:
  - Single mobile orchestrator now owns both paths.
  - SPX critical E2E suite enforced post-slice.
- Rollback:
  - Revert mobile orchestrator component and container rewiring.
  - Re-run lint, `tsc`, and SPX critical E2E suite.
- Notes:
  - Completes parity with desktop orchestrator pattern and reduces mobile branch complexity.

### Slice: P3-S7
- Objective: Centralize shell callback/prop adaptation in one typed module to reduce fan-out and tighten controller-to-surface contracts.
- Status: done
- Scope:
  - Add shell adapter module for mobile, desktop, and spatial surface mappings.
  - Rewire shell containers to consume adapter outputs rather than inline mapping.
  - Export surface prop contracts to enforce adapter compile-time safety.
- Out of scope:
  - New feature behavior.
  - Phase 4 overlay-preset functionality.
- Files:
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-adapters.ts`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-containers.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-sections.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-desktop-surface-orchestrator.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-desktop-spatial-canvas.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-mobile-surface-orchestrator.tsx`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE3_SLICE_P3-S7_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint components/spx-command-center/spx-command-center-shell-adapters.ts components/spx-command-center/spx-command-center-shell-containers.tsx components/spx-command-center/spx-desktop-surface-orchestrator.tsx components/spx-command-center/spx-mobile-surface-orchestrator.tsx components/spx-command-center/spx-desktop-spatial-canvas.tsx components/spx-command-center/spx-command-center-shell-sections.tsx app/members/spx-command-center/page.tsx hooks/use-spx-command-controller.ts`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; E2E 9 passed / 0 failed
- Risks introduced:
  - Adapter module can become a drift point if surface contracts change without synchronized mapping updates.
- Mitigations:
  - Surface prop types now exported and consumed directly by adapters.
  - SPX critical E2E suite enforced post-slice.
- Rollback:
  - Revert shell adapter module, container rewiring, and prop-type export changes.
  - Re-run lint, `tsc`, and SPX critical E2E suite.
- Notes:
  - Establishes a single adapter boundary for shell evolution and closes a major Phase 3 maintainability gap.

### Slice: P3-S8
- Objective: Centralize desktop classic layout policy into typed shell selectors to remove remaining inline policy branching from container composition.
- Status: done
- Scope:
  - Add desktop classic layout policy selector in shell adapters.
  - Rewire desktop container to consume selector for skeleton gating and panel sizing/test ID behavior.
  - Preserve existing runtime behavior.
- Out of scope:
  - New feature behavior.
  - Phase 4 overlay preset packaging.
- Files:
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-adapters.ts`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-containers.tsx`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE3_SLICE_P3-S8_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint components/spx-command-center/spx-command-center-shell-adapters.ts components/spx-command-center/spx-command-center-shell-containers.tsx components/spx-command-center/spx-desktop-surface-orchestrator.tsx components/spx-command-center/spx-mobile-surface-orchestrator.tsx components/spx-command-center/spx-desktop-spatial-canvas.tsx components/spx-command-center/spx-command-center-shell-sections.tsx app/members/spx-command-center/page.tsx hooks/use-spx-command-controller.ts`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; E2E 9 passed / 0 failed
- Risks introduced:
  - Layout selector drift could silently alter desktop panel distribution or skeleton behavior.
- Mitigations:
  - Selector logic mirrors prior container formulas and is now explicit/typed.
  - SPX critical E2E suite enforced post-slice.
- Rollback:
  - Revert adapter selector and desktop container rewiring.
  - Re-run lint, `tsc`, and SPX critical E2E suite.
- Notes:
  - Further constrains shell behavior into auditable selectors and advances Phase 3 toward exit readiness.

### Slice: P3-S9
- Objective: Complete Phase 3 exit cleanup by removing remaining inline route/container shell policy logic and finalizing typed desktop view/layout boundaries.
- Status: done
- Scope:
  - Extract route-level coach preview fallback into dedicated component.
  - Add typed desktop view policy selector and complete adapter-driven layout constraints.
  - Rewire desktop container and page shell to consume explicit boundaries.
- Out of scope:
  - New user-facing functionality.
  - Phase 4 overlay preset behavior changes.
- Files:
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-coach-preview-card.tsx`
  - `/Users/natekahl/ITM-gd/app/members/spx-command-center/page.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-adapters.ts`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-containers.tsx`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE3_SLICE_P3-S9_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint components/spx-command-center/spx-coach-preview-card.tsx components/spx-command-center/spx-command-center-shell-adapters.ts components/spx-command-center/spx-command-center-shell-containers.tsx components/spx-command-center/spx-desktop-surface-orchestrator.tsx components/spx-command-center/spx-mobile-surface-orchestrator.tsx components/spx-command-center/spx-desktop-spatial-canvas.tsx components/spx-command-center/spx-command-center-shell-sections.tsx app/members/spx-command-center/page.tsx hooks/use-spx-command-controller.ts`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; E2E 9 passed / 0 failed
- Risks introduced:
  - Phase exit cleanup can shift fallback rendering or desktop panel policy behavior if boundaries are mismatched.
- Mitigations:
  - Explicit component boundary for coach preview fallback.
  - Typed adapter selector contracts for desktop view/layout policy.
  - SPX critical E2E suite enforced post-slice.
- Rollback:
  - Revert coach preview component extraction and adapter/container rewiring.
  - Re-run lint, `tsc`, and SPX critical E2E suite.
- Notes:
  - Completes Phase 3 route/controller/container decomposition with adapter-driven policy boundaries.

### Slice: P4-S1
- Objective: Introduce deterministic overlay preset packaging (`execution`, `flow`, `spatial`) without regressing existing overlay/manual command behavior.
- Status: done
- Scope:
  - Add canonical overlay preset contract and state resolver.
  - Add controller preset state and selection handler.
  - Add action-strip preset controls and wire through desktop orchestrator/adapters.
- Out of scope:
  - Advanced drawer migration for all overlay controls.
  - Spatial performance throttle indicator UX polish.
- Files:
  - `/Users/natekahl/ITM-gd/lib/spx/overlay-presets.ts`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/action-strip.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-desktop-surface-orchestrator.tsx`
  - `/Users/natekahl/ITM-gd/hooks/use-spx-command-controller.ts`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-adapters.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE4_SLICE_P4-S1_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint lib/spx/overlay-presets.ts components/spx-command-center/action-strip.tsx components/spx-command-center/spx-desktop-surface-orchestrator.tsx hooks/use-spx-command-controller.ts components/spx-command-center/spx-command-center-shell-adapters.ts components/spx-command-center/spx-command-center-shell-containers.tsx app/members/spx-command-center/page.tsx`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; E2E 9 passed / 0 failed
- Risks introduced:
  - Preset mapping drift can cause mismatch between preset label and actual overlay state.
- Mitigations:
  - Canonical preset state contract plus derived preset resolver in controller.
  - Existing manual toggles remain intact and validated against SPX critical E2E suite.
- Rollback:
  - Revert overlay preset contract/controller/orchestrator/action-strip wiring.
  - Re-run lint, `tsc`, and SPX critical E2E suite.
- Notes:
  - Starts Phase 4 with deterministic preset packaging while preserving current command ergonomics.

### Slice: P4-S2
- Objective: Move advanced freeform overlay controls to optional Advanced HUD packaging and surface spatial auto-throttle status in the preset rail.
- Status: done
- Scope:
  - Refactor action strip to progressive-disclosure Advanced HUD drawer.
  - Keep advanced control selectors/contracts intact.
  - Wire spatial throttle state to visible preset-rail indicator.
- Out of scope:
  - New overlay algorithms.
  - Full sidebar architecture redesign.
- Files:
  - `/Users/natekahl/ITM-gd/components/spx-command-center/action-strip.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-desktop-surface-orchestrator.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-adapters.ts`
  - `/Users/natekahl/ITM-gd/e2e/spx-overlay-packaging.spec.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE4_SLICE_P4-S2_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint components/spx-command-center/action-strip.tsx components/spx-command-center/spx-desktop-surface-orchestrator.tsx components/spx-command-center/spx-command-center-shell-adapters.ts components/spx-command-center/spx-command-center-shell-containers.tsx hooks/use-spx-command-controller.ts lib/spx/overlay-presets.ts app/members/spx-command-center/page.tsx`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts e2e/spx-view-mode-toggle.spec.ts e2e/spx-spatial-overlays.spec.ts e2e/spx-overlay-packaging.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; E2E 15 passed / 0 failed
- Risks introduced:
  - Drawer packaging can regress discoverability and break selector-level contracts if controls are removed or inaccessible.
- Mitigations:
  - Controls remain in DOM with existing test IDs while being visually grouped in optional HUD drawer.
  - Expanded overlay/view-mode E2E suite is green post-slice.
- Rollback:
  - Revert action-strip HUD packaging and orchestrator/adapter throttle wiring.
  - Re-run lint, `tsc`, and SPX overlay/view-mode E2E suite.
- Notes:
  - Completes major Phase 4 requirement of moving advanced controls off primary rail while retaining deterministic preset flow.

### Slice: P5-S1
- Objective: Enforce one dominant state-aware primary CTA in desktop execution rail to reduce competing primary actions.
- Status: done
- Scope:
  - Add controller-derived primary CTA mode/label/enabled/handler contract.
  - Wire primary CTA through shell adapter and desktop orchestrator.
  - Render primary CTA in action strip with mode-aware visual hierarchy.
  - Add E2E coverage for state-driven CTA progression.
- Out of scope:
  - Full mobile CTA hierarchy redesign.
  - Coach panel copy/content strategy overhaul.
- Files:
  - `/Users/natekahl/ITM-gd/hooks/use-spx-command-controller.ts`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-adapters.ts`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-desktop-surface-orchestrator.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/action-strip.tsx`
  - `/Users/natekahl/ITM-gd/e2e/spx-primary-cta-hierarchy.spec.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE5_SLICE_P5-S1_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint components/spx-command-center/action-strip.tsx components/spx-command-center/spx-desktop-surface-orchestrator.tsx components/spx-command-center/spx-command-center-shell-adapters.ts hooks/use-spx-command-controller.ts e2e/spx-primary-cta-hierarchy.spec.ts e2e/spx-overlay-packaging.spec.ts`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts e2e/spx-view-mode-toggle.spec.ts e2e/spx-spatial-overlays.spec.ts e2e/spx-overlay-packaging.spec.ts e2e/spx-primary-cta-hierarchy.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; E2E 16 passed / 0 failed
- Risks introduced:
  - Primary CTA derivation could drift from trade-state transitions and conflict with existing CTA surfaces.
- Mitigations:
  - Mode-owned CTA contract is centralized in controller.
  - New hierarchy spec plus existing command/spatial specs enforce behavior parity.
- Rollback:
  - Revert controller CTA contract, adapter/orchestrator wiring, action-strip CTA UI, and hierarchy spec.
  - Re-run lint, `tsc`, and SPX command/spatial E2E suite.
- Notes:
  - Establishes state-aware CTA hierarchy baseline for subsequent mobile/coach polish slices.

### Slice: P5-S2
- Objective: Polish mobile/coach CTA hierarchy by enforcing one dominant mobile primary rail and reducing secondary-action competition in coach/setup surfaces.
- Status: done
- Scope:
  - Wire controller-owned primary CTA contract into mobile surface orchestrator.
  - Suppress local setup-feed primary CTA competition on mobile surfaces.
  - De-duplicate coach decision-row actions (remove `OPEN_HISTORY` duplication) and reduce default quick-prompt noise.
  - Add/refresh mobile hierarchy E2E coverage.
- Out of scope:
  - Header signal clarity redesign.
  - New decision-engine or feed-trust logic.
- Files:
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-adapters.ts`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-mobile-surface-orchestrator.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/ai-coach-feed.tsx`
  - `/Users/natekahl/ITM-gd/e2e/spx-responsive.spec.ts`
  - `/Users/natekahl/ITM-gd/e2e/spx-mobile-coach-cta-hierarchy.spec.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE5_SLICE_P5-S2_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint components/spx-command-center/spx-command-center-shell-adapters.ts components/spx-command-center/spx-mobile-surface-orchestrator.tsx components/spx-command-center/setup-feed.tsx components/spx-command-center/ai-coach-feed.tsx e2e/spx-responsive.spec.ts e2e/spx-mobile-coach-cta-hierarchy.spec.ts`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts e2e/spx-view-mode-toggle.spec.ts e2e/spx-spatial-overlays.spec.ts e2e/spx-overlay-packaging.spec.ts e2e/spx-primary-cta-hierarchy.spec.ts e2e/spx-responsive.spec.ts e2e/spx-mobile-coach-cta-hierarchy.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; E2E 18 passed / 0 failed
- Risks introduced:
  - Mobile action hierarchy could regress setup entry/exit discoverability if the primary rail is hidden or disabled unexpectedly.
- Mitigations:
  - Primary rail is controller-owned and always rendered on mobile surfaces with explicit `data-testid` contract.
  - Setup/coach secondary actions are still available but de-emphasized and validated via new mobile coach hierarchy spec.
- Rollback:
  - Revert mobile CTA rail wiring, setup-feed suppression behavior, and coach CTA packaging updates.
  - Re-run lint, `tsc`, and the SPX mobile/coach E2E suite.
- Notes:
  - Completes the Phase 5 mobile/coach CTA hierarchy objective with deterministic contract coverage.

### Slice: P5-S3
- Objective: Complete header signal clarity and focus/contrast accessibility pass for Phase 5.
- Status: done
- Scope:
  - Upgrade header trust chips (regime, health, feed, levels) with stronger contrast and explicit labels/test IDs.
  - Add focus-visible treatment for command trigger, mobile tabs, and coach CTA controls.
  - Add E2E coverage for header signal clarity and degraded-state representation.
- Out of scope:
  - New feed-orchestrator backend logic.
  - Decision-engine/risk-envelope algorithm changes.
- Files:
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-header.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/mobile-panel-tabs.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/ai-coach-feed.tsx`
  - `/Users/natekahl/ITM-gd/e2e/spx-header-signal-clarity.spec.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE5_SLICE_P5-S3_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint components/spx-command-center/spx-header.tsx components/spx-command-center/mobile-panel-tabs.tsx components/spx-command-center/ai-coach-feed.tsx e2e/spx-header-signal-clarity.spec.ts`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts e2e/spx-view-mode-toggle.spec.ts e2e/spx-spatial-overlays.spec.ts e2e/spx-overlay-packaging.spec.ts e2e/spx-primary-cta-hierarchy.spec.ts e2e/spx-responsive.spec.ts e2e/spx-mobile-coach-cta-hierarchy.spec.ts e2e/spx-header-signal-clarity.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; E2E 20 passed / 0 failed
- Risks introduced:
  - Header contract updates can break selector compatibility or reduce readability under stale/degraded transitions.
- Mitigations:
  - Added explicit header chip test IDs and dedicated header clarity E2E assertions.
  - Full SPX critical suite remained green after focus/contrast updates.
- Rollback:
  - Revert header/mobile-tab/coach focus styling changes and header clarity spec.
  - Re-run lint, `tsc`, and SPX critical E2E suite.
- Notes:
  - Closes the remaining Phase 5 clarity/accessibility objective and completes Phase 5 exit scope.

### Slice: P6-S1
- Objective: Execute repository cleanup and release hardening by tightening ignore hygiene, organizing superseded spec archive metadata, and validating final static/build gates.
- Status: done
- Scope:
  - Add editor/temp ignore hygiene and Next-generated file handling.
  - Add lint ignore boundaries for non-production local mockup artifacts.
  - Remove transient swap artifacts and add SPX superseded-spec archive index/governance docs.
  - Run release-hardening gate commands (`lint`, `tsc`, `build`) plus SPX smoke E2E.
- Out of scope:
  - New product functionality.
  - Deep remediation of pre-existing repo-wide lint warnings.
- Files:
  - `/Users/natekahl/ITM-gd/.gitignore`
  - `/Users/natekahl/ITM-gd/eslint.config.mjs`
  - `/Users/natekahl/ITM-gd/docs/specs/archive/spx/README.md`
  - `/Users/natekahl/ITM-gd/docs/specs/archive/spx/SPX_SUPERSEDED_SPEC_ARCHIVE_INDEX_2026-02-20.md`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE6_SLICE_P6-S1_2026-02-20.md`
- Tests run:
  - `pnpm run lint`
  - `pnpm exec tsc --noEmit`
  - `pnpm run build`
  - `pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1`
  - Result: lint pass (warnings only); tsc pass; build pass; smoke E2E 2 passed / 0 failed
- Risks introduced:
  - Ignore/lint boundary changes can hide genuinely important files if patterns are too broad.
- Mitigations:
  - Ignore additions are narrowly scoped to local editor/temp artifacts and known out-of-scope mockup prototypes.
  - Release gate commands were rerun immediately after hygiene changes.
- Rollback:
  - Revert `.gitignore`, `eslint.config.mjs`, and archive metadata docs.
  - Re-run lint, `tsc`, build, and SPX smoke E2E.
- Notes:
  - Completes Phase 6 cleanup + hardening baseline for production-readiness posture.

### Slice: P7-S1
- Objective: Establish canonical feed-trust orchestration by extracting realtime event schema normalization and health-state resolution into dedicated SPX modules.
- Status: done
- Scope:
  - Add `event-schema`, `market-data-orchestrator`, and `feed-health` modules.
  - Replace inline context feed-health branching with orchestrator-driven resolver.
  - Enrich data-health transition telemetry with source/age/sequence/heartbeat trust payload.
  - Add unit tests for new modules and validate SPX critical E2E suite.
- Out of scope:
  - Backend protocol changes for guaranteed sequence IDs.
  - Decision-engine/risk-envelope model rollout (Phase 8 scope).
- Files:
  - `/Users/natekahl/ITM-gd/lib/spx/event-schema.ts`
  - `/Users/natekahl/ITM-gd/lib/spx/market-data-orchestrator.ts`
  - `/Users/natekahl/ITM-gd/lib/spx/feed-health.ts`
  - `/Users/natekahl/ITM-gd/contexts/SPXCommandCenterContext.tsx`
  - `/Users/natekahl/ITM-gd/lib/spx/__tests__/event-schema.test.ts`
  - `/Users/natekahl/ITM-gd/lib/spx/__tests__/market-data-orchestrator.test.ts`
  - `/Users/natekahl/ITM-gd/lib/spx/__tests__/feed-health.test.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE7_SLICE_P7-S1_2026-02-21.md`
- Tests run:
  - `pnpm exec eslint contexts/SPXCommandCenterContext.tsx lib/spx/event-schema.ts lib/spx/feed-health.ts lib/spx/market-data-orchestrator.ts lib/spx/__tests__/event-schema.test.ts lib/spx/__tests__/feed-health.test.ts lib/spx/__tests__/market-data-orchestrator.test.ts`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec vitest run lib/spx/__tests__/event-schema.test.ts lib/spx/__tests__/feed-health.test.ts lib/spx/__tests__/market-data-orchestrator.test.ts lib/spx/__tests__/coach-decision-policy.test.ts`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts e2e/spx-view-mode-toggle.spec.ts e2e/spx-spatial-overlays.spec.ts e2e/spx-overlay-packaging.spec.ts e2e/spx-primary-cta-hierarchy.spec.ts e2e/spx-responsive.spec.ts e2e/spx-mobile-coach-cta-hierarchy.spec.ts e2e/spx-header-signal-clarity.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; unit 12 passed / 0 failed; E2E 20 passed / 0 failed
- Risks introduced:
  - New orchestration layer can drift from actual transport semantics if upstream events omit sequence/heartbeat guarantees.
- Mitigations:
  - Resolver remains backwards-compatible when sequence metadata is absent.
  - Context feeds synthetic heartbeat events from price timestamps to keep trust-state cadence aligned with live price updates.
- Rollback:
  - Revert orchestrator module additions and context integration.
  - Re-run lint, `tsc`, SPX unit suite, and SPX critical E2E suite.
- Notes:
  - Provides the Phase 7 foundation for follow-on fallback policy and trust-state UI refinements.

### Slice: P7-S2
- Objective: Complete feed-trust fallback policy by introducing explicit reason codes and connecting trust transitions to header/primary command safety behavior.
- Status: done
- Scope:
  - Add reason-coded fallback policy contract (stage + reason + trade-entry safety gate) in feed-health resolver.
  - Surface trust-stage and reason-code transitions in header/mobile trust copy.
  - Gate `enter-trade-focus` and primary CTA entry path when feed trust policy blocks trade entry.
  - Add unit + E2E coverage for policy reason visibility and CTA blocked behavior.
- Out of scope:
  - Risk-envelope model rollout (Phase 8).
  - Backend transport protocol changes.
- Files:
  - `/Users/natekahl/ITM-gd/lib/spx/feed-health.ts`
  - `/Users/natekahl/ITM-gd/contexts/spx/SPXAnalyticsContext.tsx`
  - `/Users/natekahl/ITM-gd/contexts/SPXCommandCenterContext.tsx`
  - `/Users/natekahl/ITM-gd/hooks/use-spx-command-controller.ts`
  - `/Users/natekahl/ITM-gd/hooks/use-spx-command-registry.ts`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-header.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/action-strip.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-desktop-surface-orchestrator.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-adapters.ts`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-mobile-surface-orchestrator.tsx`
  - `/Users/natekahl/ITM-gd/lib/spx/__tests__/feed-health.test.ts`
  - `/Users/natekahl/ITM-gd/e2e/spx-header-signal-clarity.spec.ts`
  - `/Users/natekahl/ITM-gd/e2e/spx-primary-cta-hierarchy.spec.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE7_SLICE_P7-S2_2026-02-21.md`
- Tests run:
  - `pnpm exec eslint lib/spx/feed-health.ts contexts/spx/SPXAnalyticsContext.tsx contexts/SPXCommandCenterContext.tsx hooks/use-spx-command-controller.ts hooks/use-spx-command-registry.ts components/spx-command-center/spx-header.tsx components/spx-command-center/action-strip.tsx components/spx-command-center/spx-desktop-surface-orchestrator.tsx components/spx-command-center/spx-command-center-shell-adapters.ts components/spx-command-center/spx-mobile-surface-orchestrator.tsx e2e/spx-header-signal-clarity.spec.ts e2e/spx-primary-cta-hierarchy.spec.ts lib/spx/__tests__/feed-health.test.ts`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec vitest run lib/spx/__tests__/event-schema.test.ts lib/spx/__tests__/feed-health.test.ts lib/spx/__tests__/market-data-orchestrator.test.ts lib/spx/__tests__/coach-decision-policy.test.ts`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts e2e/spx-view-mode-toggle.spec.ts e2e/spx-spatial-overlays.spec.ts e2e/spx-overlay-packaging.spec.ts e2e/spx-primary-cta-hierarchy.spec.ts e2e/spx-responsive.spec.ts e2e/spx-mobile-coach-cta-hierarchy.spec.ts e2e/spx-header-signal-clarity.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; unit 14 passed / 0 failed; E2E 21 passed / 0 failed
- Risks introduced:
  - Overly aggressive feed-trust gating can block legitimate entry actions during benign fallback periods.
- Mitigations:
  - Trade-entry blocking is reason-code-scoped to high-risk trust states only.
  - Header + control surfaces expose explicit blocked reason for operator clarity.
  - Full SPX critical suite validated post-change.
- Rollback:
  - Revert all files listed above and re-run lint, `tsc`, SPX unit suite, and SPX critical E2E suite.
- Notes:
  - Completes the remaining Phase 7 fallback-policy/UI-linkage scope and unlocks Phase 8 decision-intelligence work.

### Slice: P8-S1
- Objective: Introduce deterministic decision-intelligence baseline (multi-timeframe alignment + confidence scoring) and wire it into setup ranking/display contracts.
- Status: done
- Scope:
  - Add `decision-engine.ts` with deterministic alignment/confidence/EVR computation.
  - Add setup enrichment helper for score/probability/EV/driver/risk fields.
  - Integrate setup enrichment into active-setup derivation in `SPXCommandCenterContext`.
  - Surface alignment/confidence trend chips in setup cards.
  - Add dedicated decision-engine unit tests.
- Out of scope:
  - Risk-envelope hard command blocking and reason-code UI (planned for follow-up Phase 8 slice).
  - Backend model endpoint changes.
- Files:
  - `/Users/natekahl/ITM-gd/lib/spx/decision-engine.ts`
  - `/Users/natekahl/ITM-gd/lib/spx/__tests__/decision-engine.test.ts`
  - `/Users/natekahl/ITM-gd/contexts/SPXCommandCenterContext.tsx`
  - `/Users/natekahl/ITM-gd/lib/types/spx-command-center.ts`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/setup-card.tsx`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE8_SLICE_P8-S1_2026-02-21.md`
- Tests run:
  - `pnpm exec eslint lib/spx/decision-engine.ts lib/spx/__tests__/decision-engine.test.ts contexts/SPXCommandCenterContext.tsx components/spx-command-center/setup-card.tsx`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec vitest run lib/spx/__tests__/decision-engine.test.ts lib/spx/__tests__/event-schema.test.ts lib/spx/__tests__/feed-health.test.ts lib/spx/__tests__/market-data-orchestrator.test.ts lib/spx/__tests__/coach-decision-policy.test.ts`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts e2e/spx-view-mode-toggle.spec.ts e2e/spx-spatial-overlays.spec.ts e2e/spx-overlay-packaging.spec.ts e2e/spx-primary-cta-hierarchy.spec.ts e2e/spx-responsive.spec.ts e2e/spx-mobile-coach-cta-hierarchy.spec.ts e2e/spx-header-signal-clarity.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; unit 17 passed / 0 failed; E2E 21 passed / 0 failed
- Risks introduced:
  - New scoring weights can reorder setups unexpectedly if not deterministic across identical fixtures.
- Mitigations:
  - Pure deterministic scoring function with fixed weighting and unit fixtures.
  - Active setup output remains constrained by existing status/tier priority ordering.
  - Full SPX critical E2E suite validated post-integration.
- Rollback:
  - Revert all files listed above and re-run lint, `tsc`, SPX unit suite, and SPX critical E2E suite.
- Notes:
  - Establishes the Phase 8 scoring baseline needed for risk-envelope gating and explainability hardening.

### Slice: P8-S2
- Objective: Add risk-envelope reason-code gating for trade-entry actions and unify command/CTA safety behavior.
- Status: done
- Scope:
  - Add deterministic `risk-envelope.ts` entry-gate policy and reason-code contract.
  - Integrate envelope gate into controller primary entry flow.
  - Integrate envelope gate into command registry `enter-trade-focus` command availability + blocked telemetry payload.
  - Add unit coverage for allow/block reason-code behavior.
  - Recalibrate default thresholds to prevent benign false-positive entry blocks.
- Out of scope:
  - Contract-level risk budget computation.
  - Coach decision payload enrichment from envelope drivers/risks.
- Files:
  - `/Users/natekahl/ITM-gd/lib/spx/risk-envelope.ts`
  - `/Users/natekahl/ITM-gd/lib/spx/__tests__/risk-envelope.test.ts`
  - `/Users/natekahl/ITM-gd/hooks/use-spx-command-controller.ts`
  - `/Users/natekahl/ITM-gd/hooks/use-spx-command-registry.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE8_SLICE_P8-S2_2026-02-21.md`
- Tests run:
  - `pnpm exec eslint lib/spx/risk-envelope.ts lib/spx/__tests__/risk-envelope.test.ts hooks/use-spx-command-controller.ts hooks/use-spx-command-registry.ts`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec vitest run lib/spx/__tests__/decision-engine.test.ts lib/spx/__tests__/risk-envelope.test.ts lib/spx/__tests__/event-schema.test.ts lib/spx/__tests__/feed-health.test.ts lib/spx/__tests__/market-data-orchestrator.test.ts lib/spx/__tests__/coach-decision-policy.test.ts`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts e2e/spx-view-mode-toggle.spec.ts e2e/spx-spatial-overlays.spec.ts e2e/spx-overlay-packaging.spec.ts e2e/spx-primary-cta-hierarchy.spec.ts e2e/spx-responsive.spec.ts e2e/spx-mobile-coach-cta-hierarchy.spec.ts e2e/spx-header-signal-clarity.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; unit 20 passed / 0 failed; E2E 21 passed / 0 failed
- Risks introduced:
  - Aggressive risk-envelope thresholds can block legitimate entry actions and break command flow contracts.
- Mitigations:
  - Default thresholds are conservative; hard-block reasons prioritize feed trust + structural invalid states.
  - Blocking reason is propagated to CTA and telemetry for rapid tuning.
  - E2E command/CTA suite revalidated post-threshold calibration.
- Rollback:
  - Revert files listed above and re-run lint, `tsc`, SPX unit suite, and SPX critical E2E suite.
- Notes:
  - Establishes the Phase 8 command-safety contract for follow-on coach explainability integration.

### Slice: P8-S3
- Objective: Complete Phase 8 coach explainability payload enrichment from deterministic setup intelligence.
- Status: done
- Scope:
  - Add coach explainability enrichment helper.
  - Add explainability unit tests.
  - Integrate enrichment into `requestCoachDecision` success path.
  - Add telemetry metadata for explainability payload depth.
- Out of scope:
  - New backend coach response schema changes.
  - Post-trade analytics/journal instrumentation.
- Files:
  - `/Users/natekahl/ITM-gd/lib/spx/coach-explainability.ts`
  - `/Users/natekahl/ITM-gd/lib/spx/__tests__/coach-explainability.test.ts`
  - `/Users/natekahl/ITM-gd/contexts/SPXCommandCenterContext.tsx`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE8_SLICE_P8-S3_2026-02-21.md`
- Tests run:
  - `pnpm exec eslint lib/spx/coach-explainability.ts lib/spx/__tests__/coach-explainability.test.ts contexts/SPXCommandCenterContext.tsx`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec vitest run lib/spx/__tests__/coach-explainability.test.ts lib/spx/__tests__/decision-engine.test.ts lib/spx/__tests__/risk-envelope.test.ts lib/spx/__tests__/event-schema.test.ts lib/spx/__tests__/feed-health.test.ts lib/spx/__tests__/market-data-orchestrator.test.ts lib/spx/__tests__/coach-decision-policy.test.ts`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts e2e/spx-view-mode-toggle.spec.ts e2e/spx-spatial-overlays.spec.ts e2e/spx-overlay-packaging.spec.ts e2e/spx-primary-cta-hierarchy.spec.ts e2e/spx-responsive.spec.ts e2e/spx-mobile-coach-cta-hierarchy.spec.ts e2e/spx-header-signal-clarity.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; unit 23 passed / 0 failed; E2E 21 passed / 0 failed
- Risks introduced:
  - Explainability line inflation can reduce coach brevity and clarity if not constrained.
- Mitigations:
  - Enrichment caps unique lines and preserves existing decision copy priority.
  - Explainability is deterministic and test-covered.
  - Full SPX critical E2E suite remains green.
- Rollback:
  - Revert files listed above and re-run lint, `tsc`, SPX unit suite, and SPX critical E2E suite.
- Notes:
  - Completes the remaining Phase 8 explainability deliverable.

### Slice: P9-S1
- Objective: Deliver Phase 9 chart interaction/replay/scenario/focus-mode baseline with deterministic behavior and selector-stable UX contracts.
- Status: done
- Scope:
  - Added deterministic replay engine with checksum, frame windows, and playback interval helper.
  - Added chart replay state wiring, replay status badges, and progress telemetry.
  - Added focus-mode switching controls and command-registry parity hooks.
  - Added scenario lanes to chart and coach surfaces.
  - Added crosshair snapshot plumbing and OHLC tooltip rendering contract.
  - Added focused E2E coverage for replay/focus/scenario interactions.
- Out of scope:
  - Server-persisted replay journals.
  - Strategy backtesting workflows beyond chart replay.
- Files:
  - `/Users/natekahl/ITM-gd/lib/spx/replay-engine.ts`
  - `/Users/natekahl/ITM-gd/lib/spx/scenario-lanes.ts`
  - `/Users/natekahl/ITM-gd/components/ai-coach/trading-chart.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-chart.tsx`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/action-strip.tsx`
  - `/Users/natekahl/ITM-gd/hooks/use-spx-command-controller.ts`
  - `/Users/natekahl/ITM-gd/hooks/use-spx-command-registry.ts`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/ai-coach-feed.tsx`
  - `/Users/natekahl/ITM-gd/e2e/spx-chart-replay-focus.spec.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE9_SLICE_P9-S1_2026-02-21.md`
- Tests run:
  - `pnpm exec eslint <phase 9 touched files>`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec vitest run lib/spx/__tests__/replay-engine.test.ts lib/spx/__tests__/scenario-lanes.test.ts`
  - `pnpm exec playwright test e2e/spx-chart-replay-focus.spec.ts --project=chromium --workers=1`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts e2e/spx-view-mode-toggle.spec.ts e2e/spx-spatial-overlays.spec.ts e2e/spx-overlay-packaging.spec.ts e2e/spx-primary-cta-hierarchy.spec.ts e2e/spx-responsive.spec.ts e2e/spx-mobile-coach-cta-hierarchy.spec.ts e2e/spx-header-signal-clarity.spec.ts e2e/spx-chart-replay-focus.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; targeted vitest pass; SPX E2E critical+phase9 suite 22 passed / 0 failed.
- Risks introduced:
  - Replay/focus controls can drift between command and chart state if ownership is fragmented.
- Mitigations:
  - Controller is the single state owner for replay/focus and both action-strip + command-registry route to controller handlers.
  - E2E contract added for replay/focus/scenario controls.
- Rollback:
  - Revert listed files and rerun static + unit + SPX E2E suites.
- Notes:
  - Marks Phase 9 exit criteria complete.

### Slice: P10-S1
- Objective: Deliver Phase 10 learning/governance loop with trade journal auto-capture, post-trade analytics, alert suppression policy, and flag lifecycle metadata hardening.
- Status: done
- Scope:
  - Added trade-journal capture engine and persistence helpers.
  - Auto-capture journal artifact on trade-exit path in command-center context.
  - Added post-trade analytics panel to SPX command-center desktop/mobile surfaces.
  - Added duplicate-alert suppression policy in AI coach feed.
  - Added lifecycle metadata catalog for all SPX flags and metadata coverage checks.
  - Added SPX recovery runbook.
  - Added E2E coverage for post-trade artifact capture.
- Out of scope:
  - Server-side trade journal persistence.
  - Multi-account analytics rollup.
- Files:
  - `/Users/natekahl/ITM-gd/lib/spx/trade-journal-capture.ts`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/post-trade-panel.tsx`
  - `/Users/natekahl/ITM-gd/contexts/SPXCommandCenterContext.tsx`
  - `/Users/natekahl/ITM-gd/lib/spx/alert-suppression.ts`
  - `/Users/natekahl/ITM-gd/components/spx-command-center/ai-coach-feed.tsx`
  - `/Users/natekahl/ITM-gd/lib/spx/flags.ts`
  - `/Users/natekahl/ITM-gd/lib/spx/__tests__/flags.test.ts`
  - `/Users/natekahl/ITM-gd/e2e/spx-post-trade-journal.spec.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE10_SLICE_P10-S1_2026-02-21.md`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_RUNBOOK_2026-02-20.md`
- Tests run:
  - `pnpm exec eslint <phase 10 touched files>`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec vitest run lib/spx/__tests__/trade-journal-capture.test.ts lib/spx/__tests__/alert-suppression.test.ts lib/spx/__tests__/flags.test.ts`
  - `pnpm exec playwright test e2e/spx-post-trade-journal.spec.ts --project=chromium --workers=1`
  - `pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts e2e/spx-view-mode-toggle.spec.ts e2e/spx-spatial-overlays.spec.ts e2e/spx-overlay-packaging.spec.ts e2e/spx-primary-cta-hierarchy.spec.ts e2e/spx-responsive.spec.ts e2e/spx-mobile-coach-cta-hierarchy.spec.ts e2e/spx-header-signal-clarity.spec.ts e2e/spx-chart-replay-focus.spec.ts e2e/spx-post-trade-journal.spec.ts --project=chromium --workers=1`
  - Result: lint pass; tsc pass; targeted vitest pass; SPX E2E critical+phase9+phase10 suite 23 passed / 0 failed.
- Risks introduced:
  - Exit-trigger capture can create noise artifacts if invoked without active trade context.
- Mitigations:
  - `exitTrade` guard now requires active in-trade setup before capture.
  - Coverage added for journal capture behavior and metadata completeness.
- Rollback:
  - Revert listed files and rerun static + unit + SPX E2E suites.
- Notes:
  - Marks Phase 10 exit criteria complete and closes autonomous implementation scope.

### Slice: P10-S2
- Objective: Finalize release-gate evidence with full-suite rerun and resolve strict-selector ambiguity found during closeout validation.
- Status: done
- Scope:
  - Re-ran full release gate command set (`eslint`, `tsc`, `build`, SPX vitest, SPX Playwright).
  - Added deterministic mode-chip test IDs for mobile smart-stack state assertions.
  - Updated failing E2E state-machine spec to use deterministic selectors.
  - Updated runbook/release notes/tracker with final validation outcomes.
- Out of scope:
  - New feature behavior.
  - Deployment execution.
- Files:
  - `/Users/natekahl/ITM-gd/components/spx-command-center/spx-mobile-surface-orchestrator.tsx`
  - `/Users/natekahl/ITM-gd/e2e/spx-layout-state-machine.spec.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_RELEASE_NOTES_2026-02-21.md`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_RUNBOOK_2026-02-20.md`
  - `/Users/natekahl/ITM-gd/docs/specs/spx-production-recovery-autonomous-2026-02-20/08_AUTONOMOUS_EXECUTION_TRACKER.md`
  - `/Users/natekahl/ITM-gd/docs/specs/spx-production-recovery-autonomous-2026-02-20/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`
- Tests run:
  - `pnpm exec eslint .`
  - `pnpm exec tsc --noEmit`
  - `pnpm run build`
  - `pnpm vitest run lib/spx/__tests__`
  - `pnpm exec playwright test e2e/spx-layout-state-machine.spec.ts --project=chromium --workers=1`
  - `pnpm exec playwright test e2e/spx-*.spec.ts --project=chromium --workers=1`
  - Result: lint pass (warnings only); tsc pass; build pass; vitest 24/24 files pass; Playwright 29/29 pass.
- Risks introduced:
  - Additional test IDs slightly expand selector surface area in UI markup.
- Mitigations:
  - IDs are narrow and mode-specific; they remove strict-mode locator ambiguity and improve long-term test stability.
- Rollback:
  - Revert files listed above and rerun full release-gate command set.
- Notes:
  - Closes the final validation gap and leaves only release-process deployment authorization outside engineering execution scope.

### Slice: P10-S3
- Objective: Close runtime-environment validation by executing the full release gate under Node 22.
- Status: done
- Scope:
  - Re-ran all release gate commands under Node `v22.12.0`.
  - Captured final environment-accurate evidence for lint, typecheck, build, unit, and SPX E2E.
- Out of scope:
  - Production deploy execution.
- Files:
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_RELEASE_NOTES_2026-02-21.md`
  - `/Users/natekahl/ITM-gd/docs/specs/spx-production-recovery-autonomous-2026-02-20/08_AUTONOMOUS_EXECUTION_TRACKER.md`
  - `/Users/natekahl/ITM-gd/docs/specs/spx-production-recovery-autonomous-2026-02-20/06_CHANGE_CONTROL_AND_PR_STANDARD.md`
- Tests run:
  - `export PATH="/usr/local/bin:$PATH"; corepack pnpm exec eslint .`
  - `export PATH="/usr/local/bin:$PATH"; corepack pnpm exec tsc --noEmit`
  - `export PATH="/usr/local/bin:$PATH"; corepack pnpm run build`
  - `export PATH="/usr/local/bin:$PATH"; corepack pnpm vitest run lib/spx/__tests__`
  - `export PATH="/usr/local/bin:$PATH"; corepack pnpm exec playwright test e2e/spx-*.spec.ts --project=chromium --workers=1`
  - Result: all release gates passed under Node 22.
- Risks introduced:
  - None.
- Mitigations:
  - Environment-specific gate rerun removed the final runtime uncertainty.
- Rollback:
  - Documentation-only slice; revert docs above if process narrative needs adjustment.
- Notes:
  - Confirms project runtime target (`>=22`) is now validated in the final evidence trail.

### Slice: P10-S4
- Objective: Close the final release checklist item by recording production deploy approval.
- Status: done
- Scope:
  - Marked deploy approval as complete in the autonomous execution spec checklist.
  - Logged authorization closure in the execution tracker session log.
- Out of scope:
  - Executing deployment mechanics.
- Files:
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PRODUCTION_RECOVERY_EXECUTION_SPEC_2026-02-20.md`
  - `/Users/natekahl/ITM-gd/docs/specs/spx-production-recovery-autonomous-2026-02-20/08_AUTONOMOUS_EXECUTION_TRACKER.md`
- Tests run:
  - None (documentation-only closure slice).
- Risks introduced:
  - None.
- Mitigations:
  - Checklist and tracker now align with approval state.
- Rollback:
  - Revert documentation updates above if approval status changes.
- Notes:
  - Autonomous delivery packet is fully closed from engineering and release-authorization perspectives.

### Slice: P12-S5
- Objective: Upgrade setup pWin calibration to realized-outcome modeling and enforce nightly replay->optimize orchestration.
- Status: done
- Scope:
  - Add data-driven setup calibration model from `spx_setup_instances`.
  - Integrate calibration into live `setupDetector` pWin pipeline.
  - Add nightly replay orchestrator and wire nightly worker to replay before optimizer scan.
  - Add targeted tests for calibration and orchestration fail-closed behavior.
- Out of scope:
  - New setup families.
  - UI redesign.
  - Contract selector/exit model rewrites.
- Files:
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/setupCalibration.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/nightlyReplayOptimizer.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`
  - `/Users/natekahl/ITM-gd/backend/src/workers/spxOptimizerWorker.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/setupCalibration.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/nightlyReplayOptimizer.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/setupDetector.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/workers/__tests__/spxOptimizerWorker.test.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE12_SLICE_P12-S5_2026-02-22.md`
- Tests run:
  - `pnpm --dir /Users/natekahl/ITM-gd exec eslint --no-ignore backend/src/services/spx/setupCalibration.ts backend/src/services/spx/setupDetector.ts backend/src/services/spx/nightlyReplayOptimizer.ts backend/src/workers/spxOptimizerWorker.ts backend/src/services/spx/__tests__/setupCalibration.test.ts backend/src/services/spx/__tests__/nightlyReplayOptimizer.test.ts backend/src/services/spx/__tests__/setupDetector.test.ts backend/src/workers/__tests__/spxOptimizerWorker.test.ts`
  - `pnpm --dir /Users/natekahl/ITM-gd/backend exec tsc --noEmit`
  - `pnpm --dir /Users/natekahl/ITM-gd exec tsc --noEmit`
  - `pnpm --dir /Users/natekahl/ITM-gd/backend test -- src/services/spx/__tests__/setupCalibration.test.ts src/services/spx/__tests__/nightlyReplayOptimizer.test.ts src/services/spx/__tests__/setupDetector.test.ts src/workers/__tests__/spxOptimizerWorker.test.ts src/__tests__/integration/spx-api.test.ts`
  - `pnpm --dir /Users/natekahl/ITM-gd exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1`
  - `pnpm --dir /Users/natekahl/ITM-gd/backend backtest:last-week instances second`
  - Result: all listed gates passed.
- Risks introduced:
  - Calibration drift if resolved-outcome samples are sparse in active buckets.
  - Nightly replay pre-pass adds a failure point before optimizer scan.
- Mitigations:
  - Hierarchical smoothing + conservative blend limits small-sample overreaction.
  - Replay fail-closed thresholds are explicit and tunable via env.
- Rollback:
  - Revert this slice commit.
  - Disable replay pre-pass (`SPX_OPTIMIZER_NIGHTLY_REPLAY_ENABLED=false`) if incident triage requires optimizer-only mode.
  - Zero calibration blend weights to restore heuristic-only behavior temporarily.
- Notes:
  - Last-week strict second-bar backtest remained strong after slice (`T1 76.47%`, `T2 70.59%`, `expectancyR +1.0587`).

### Slice: P13-S1
- Objective: Add quote microstructure fidelity to tick and microbar aggregation without breaking existing consumers.
- Status: done
- Scope:
  - Extend normalized ticks with bid/ask sizes and aggressor proxy.
  - Extend microbars with side-volume, delta-volume, and bid/ask imbalance fields.
  - Wire additive websocket microbar payload fields.
- Out of scope:
  - Detector-level gate logic and macro filters.
- Files:
  - `/Users/natekahl/ITM-gd/backend/src/config/env.ts`
  - `/Users/natekahl/ITM-gd/backend/.env.example`
  - `/Users/natekahl/ITM-gd/backend/src/services/tickCache.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/massiveTickStream.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/microbarAggregator.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/websocket.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/__tests__/tickCache.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/__tests__/massiveTickStream.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/microbarAggregator.test.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE13_SLICE_P13-S1_2026-02-22.md`
- Tests run:
  - `pnpm --dir backend test -- src/services/__tests__/massiveTickStream.test.ts`
  - `pnpm --dir backend test -- src/services/__tests__/tickCache.test.ts`
  - `pnpm --dir backend test -- src/services/spx/__tests__/microbarAggregator.test.ts`
  - `pnpm --dir backend exec tsc --noEmit`
  - Result: all listed gates passed.
- Risks introduced:
  - Quote sparsity can make aggressor/imbalance fields unavailable for some symbols/time windows.
- Mitigations:
  - Feature flag fallback (`ENABLE_L2_MICROSTRUCTURE`) and nullable additive fields.
- Rollback:
  - Set `ENABLE_L2_MICROSTRUCTURE=false` or revert slice commit.
- Notes:
  - Microstructure contract is now available for detector and optimizer layers.

### Slice: P13-S2
- Objective: Integrate macro + microstructure fidelity into production SPX setup scoring and gating.
- Status: done
- Scope:
  - Add macro kill-switch score and gate reason.
  - Add tick-derived microstructure summary/alignment and trend-family enforcement.
  - Add strike-flow and intraday gamma-pressure confluence signals.
  - Persist macro/microstructure diagnostics to setup metadata.
- Out of scope:
  - Legacy detector stack under `backend/src/services/setupDetector/*`.
  - Contract selection and exit advisor refactor slices.
- Files:
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/types.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/outcomeTracker.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/setupDetector.test.ts`
  - `/Users/natekahl/ITM-gd/backend/.env.example`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE13_SLICE_P13-S2_2026-02-22.md`
- Tests run:
  - `pnpm exec eslint --no-ignore backend/src/services/spx/setupDetector.ts backend/src/services/spx/types.ts backend/src/services/spx/outcomeTracker.ts backend/src/services/spx/__tests__/setupDetector.test.ts`
  - `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts`
  - `pnpm --dir backend exec tsc --noEmit`
  - Result: all listed gates passed.
- Risks introduced:
  - Overly strict macro floor or trend microstructure rule can suppress setup throughput.
- Mitigations:
  - Full env controls for floors/strictness and fail-open default when microstructure is unavailable.
  - Historical timestamp runs ignore live tick-cache microstructure to avoid replay contamination.
- Rollback:
  - Disable filters (`SPX_SETUP_MACRO_KILLSWITCH_ENABLED=false`, `SPX_SETUP_MICROSTRUCTURE_ENABLED=false`) or revert slice commit.
- Notes:
  - Gate reasons now explicitly expose macro/microstructure blockers for optimizer governance and UI audit.

### Slice: P13-S3
- Objective: Move macro/microstructure optimization from static/env behavior to profile-driven learning with replay parity and governance guardrails.
- Status: done
- Scope:
  - Extend optimizer row prep/candidate evaluation with macro/micro metadata.
  - Add profile-driven macro/micro policy maps by setup/regime/time bucket.
  - Replace confluence source-count saturation with weighted confluence.
  - Add historical microstructure parity in replay via Massive second-bar-derived synthetic ticks.
  - Add optimizer blocker-mix scorecard and trigger-throughput guardrail.
- Out of scope:
  - Contract selector and exit-advisor behavior changes.
  - New setup families.
- Files:
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/optimizer.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/historicalReconstruction.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/types.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/setupDetector.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/nightlyReplayOptimizer.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/workers/__tests__/spxOptimizerWorker.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/__tests__/integration/spx-api.test.ts`
  - `/Users/natekahl/ITM-gd/backend/.env.example`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE13_SLICE_P13-S3_2026-02-22.md`
- Tests run:
  - `pnpm exec eslint --no-ignore backend/src/services/spx/optimizer.ts backend/src/services/spx/setupDetector.ts backend/src/services/spx/historicalReconstruction.ts backend/src/services/spx/types.ts backend/src/services/spx/__tests__/setupDetector.test.ts backend/src/services/spx/__tests__/nightlyReplayOptimizer.test.ts backend/src/workers/__tests__/spxOptimizerWorker.test.ts`
  - `pnpm --dir backend exec tsc --noEmit`
  - `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts src/services/spx/__tests__/nightlyReplayOptimizer.test.ts src/workers/__tests__/spxOptimizerWorker.test.ts`
  - `pnpm --dir backend test -- src/services/__tests__/massiveTickStream.test.ts src/services/spx/__tests__/microbarAggregator.test.ts src/services/spx/__tests__/contractSelector.test.ts src/services/positions/__tests__/exitAdvisor.test.ts`
  - `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-20`
  - `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`
  - `LOG_LEVEL=warn pnpm --dir backend spx:optimizer-weekly`
  - Result: all listed gates passed.
- Risks introduced:
  - Macro/micro gates can still over-suppress throughput if floors are too strict.
  - Historical microstructure parity is based on synthetic quote fields from second bars (not native quote tape).
- Mitigations:
  - New throughput guardrail in optimizer promotion path.
  - Blocker-mix telemetry in scorecard by setup/regime/time bucket.
  - Fail-open default for unavailable microstructure remains enabled.
- Rollback:
  - Revert profile via optimizer history endpoint.
  - Temporarily relax macro/micro gates via env (`SPX_SETUP_MACRO_KILLSWITCH_ENABLED=false`, `SPX_SETUP_MICROSTRUCTURE_ENABLED=false`) if incident response requires immediate throughput recovery.
- Notes:
  - Promotion gate backfill succeeded 5/5 sessions with strict second-bar fidelity (`usedMassiveMinuteBars=false`).
  - Last-week strict replay remained low-throughput (`triggeredCount=1`), now explicitly observable in blocker/throughput governance outputs.

### Slice: P13-S4
- Objective: Implement contract/exit mechanics refinements for institutional execution discipline while preserving strict replay fidelity.
- Status: done
- Scope:
  - Add setup/regime-aware delta banding and setup-family 0DTE rollover discipline in contract selection.
  - Add deterministic 1R/2R scale-out mechanics and pivot-style runner trailing in exit advisor.
  - Wire entry-price context from position tracker into advisor risk-unit model.
- Out of scope:
  - New setup families and optimizer threshold policy redesign.
  - Brokerage execution/routing integration.
- Files:
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/contractSelector.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/positions/exitAdvisor.ts`
  - `/Users/natekahl/ITM-gd/backend/src/workers/positionTrackerWorker.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/positions/__tests__/exitAdvisor.test.ts`
  - `/Users/natekahl/ITM-gd/backend/.env.example`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE13_SLICE_P13-S4_2026-02-22.md`
- Tests run:
  - `pnpm --dir backend exec tsc --noEmit`
  - `pnpm --dir backend test -- src/services/__tests__/massiveTickStream.test.ts src/services/spx/__tests__/microbarAggregator.test.ts src/services/spx/__tests__/contractSelector.test.ts src/services/positions/__tests__/exitAdvisor.test.ts`
  - `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-20`
  - `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`
- Risks introduced:
  - Contract candidate pool can shrink if delta/theta strictness is miscalibrated.
  - Deterministic scale-outs can conflict with discretionary trader workflow expectations.
- Mitigations:
  - Relaxed filter fallback remains available in selector path.
  - Advisor actions remain guidance (not forced broker automation) and include explicit milestone metadata.
- Rollback:
  - Revert this slice commit.
  - Temporarily relax contract strictness by reverting delta-band/theta filters if starvation is observed.
- Notes:
  - Promotion-gate backfill held at 5/5 successful sessions with strict second-resolution fidelity.
  - Last-week strict replay output: `T1 0.00%`, `T2 0.00%`, `expectancyR -1.04`, `triggeredCount=1`.
  - Baseline comparator from earlier strict run (`T1 76.47%`, `T2 70.59%`, `expectancyR +1.0587`) implies deltas of `-76.47pp`, `-70.59pp`, `-2.0987R`; throughput policy recalibration remains the blocking promotion issue.

### Slice: P14-S1
- Objective: Resolve spec ambiguity in microstructure math and add canonical close-quote telemetry to SPX microbars.
- Status: done
- Scope:
  - Extend microbar contract with close-quote ratio/coverage/spread metrics.
  - Preserve backward-compatible existing microbar fields.
  - Fan out new telemetry through websocket microbar payloads.
- Out of scope:
  - Detector threshold policy changes.
  - Broker/tradier routing and portfolio sync.
  - Database migration work.
- Files:
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/microbarAggregator.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/websocket.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/microbarAggregator.test.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE14_INSTITUTIONAL_UPGRADE_SPEC_2026-02-22.md`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE14_SLICE_P14-S1_2026-02-22.md`
- Tests run:
  - `pnpm --dir backend test -- src/services/spx/__tests__/microbarAggregator.test.ts`
  - `pnpm --dir backend exec tsc --noEmit`
  - `pnpm exec eslint backend/src/services/spx/microbarAggregator.ts backend/src/services/spx/__tests__/microbarAggregator.test.ts backend/src/services/websocket.ts`
  - Result: unit pass, typecheck pass, eslint warning-only (backend sources matched ignore pattern).
- Risks introduced:
  - New telemetry fields can be misinterpreted if direction-normalization is not applied in detectors.
- Mitigations:
  - Preserved existing normalized imbalance metric and added explicit ratio fields for next-slice direction-aware gating.
- Rollback:
  - Revert P14-S1 files listed above and redeploy websocket service.
- Notes:
  - This slice intentionally limits change radius to telemetry contracts before detector-policy edits.

### Slice: P14-S2
- Objective: Integrate directional microstructure confirmation into setup-detector `volumeClimax` and `vwap` logic.
- Status: done
- Scope:
  - Extend setup-detector snapshot contract with optional microstructure telemetry.
  - Build microstructure summary from live tick cache in setup-detector service.
  - Apply directional pressure confirmation in `volumeClimax` and `vwap` detectors.
  - Add targeted unit tests for microstructure conflict/confirm behavior.
- Out of scope:
  - Optimizer scorecard/blocker-mix changes for this detector pipeline.
  - SPX core setup-detector threshold/gating changes.
  - Broker routing or reconciliation work.
- Files:
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/types.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/index.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/volumeClimax.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/vwap.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/__tests__/volumeClimax.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/__tests__/vwap.test.ts`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE14_SLICE_P14-S2_2026-02-22.md`
- Tests run:
  - `pnpm --dir backend test -- src/services/setupDetector/__tests__/volumeClimax.test.ts src/services/setupDetector/__tests__/vwap.test.ts src/services/setupDetector/__tests__/detectors.test.ts`
  - `pnpm --dir backend exec tsc --noEmit`
  - Result: all pass.
- Risks introduced:
  - Static directional microstructure thresholds may require regime tuning.
- Mitigations:
  - Fail-open behavior retained when microstructure unavailable.
  - Signal payload now carries microstructure evidence for later optimization/governance.
- Rollback:
  - Revert P14-S2 files listed above and rerun targeted tests.
- Notes:
  - This slice improves live directional fidelity while preserving backward compatibility in sparse quote conditions.

### Slice: P14-S3
- Objective: Add Tradier adapter foundations, DTBP-aware sizing hooks, and portfolio snapshot sync plumbing behind explicit flags.
- Status: done
- Scope:
  - Add Tradier OCC symbol formatter/parser, REST client, and order payload router helpers.
  - Add portfolio sync service + worker and wire worker lifecycle in backend server.
  - Add DTBP/PDT-aware sizing context in SPX contract selector + route input parsing.
  - Add additive Supabase migration for broker credentials, portfolio snapshots, and execution-fidelity setup-instance columns.
- Out of scope:
  - Live execution state transitions in setup lifecycle.
  - Broker/internal position reconciliation and slippage feedback loop.
  - UI execution controls (flatten/routing pulses) in this backend slice.
- Files:
  - `/Users/natekahl/ITM-gd/backend/src/services/broker/tradier/occFormatter.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/broker/tradier/client.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/broker/tradier/orderRouter.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/broker/tradier/__tests__/occFormatter.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/broker/tradier/__tests__/orderRouter.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/portfolio/portfolioSync.ts`
  - `/Users/natekahl/ITM-gd/backend/src/workers/portfolioSyncWorker.ts`
  - `/Users/natekahl/ITM-gd/backend/src/server.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/contractSelector.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/types.ts`
  - `/Users/natekahl/ITM-gd/backend/src/routes/spx.ts`
  - `/Users/natekahl/ITM-gd/backend/.env.example`
  - `/Users/natekahl/ITM-gd/supabase/migrations/20260326000000_institutional_upgrade.sql`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE14_SLICE_P14-S3_2026-02-22.md`
- Tests run:
  - `pnpm --dir backend test -- src/services/broker/tradier/__tests__/occFormatter.test.ts src/services/broker/tradier/__tests__/orderRouter.test.ts src/services/spx/__tests__/contractSelector.test.ts`
  - `pnpm --dir backend exec tsc --noEmit`
  - `pnpm exec eslint backend/src/services/broker/tradier/client.ts backend/src/services/broker/tradier/orderRouter.ts backend/src/services/broker/tradier/occFormatter.ts backend/src/services/broker/tradier/__tests__/occFormatter.test.ts backend/src/services/broker/tradier/__tests__/orderRouter.test.ts backend/src/services/portfolio/portfolioSync.ts backend/src/workers/portfolioSyncWorker.ts backend/src/services/spx/contractSelector.ts backend/src/routes/spx.ts backend/src/server.ts backend/src/services/spx/types.ts`
  - Result: tests/typecheck pass; eslint warning-only because backend files are ignored by root config.
- Risks introduced:
  - Credential decryption remains placeholder in this foundation slice (`access_token_ciphertext` pass-through).
  - Risk-context cache cardinality increases due new DTBP/PDT fingerprint.
- Mitigations:
  - Worker defaults to disabled and sandbox-first env posture.
  - Missing migration tables fail-safe with warn-and-skip behavior in portfolio sync.
  - Cache key now includes risk fingerprint and ad-hoc setup requests bypass cache to prevent stale sizing leakage.
- Rollback:
  - Revert P14-S3 files listed above.
  - Keep `TRADIER_PORTFOLIO_SYNC_ENABLED=false` to disable runtime sync.
- Notes:
  - This slice is intentionally backend-foundational; live broker reconciliation remains `P14-S4`.

### Slice: P14-S4
- Objective: Add broker/internal ledger reconciliation and execution slippage feedback that auto-adjusts optimizer EV floors under sustained fill friction.
- Status: done
- Scope:
  - Add Tradier positions retrieval in broker client.
  - Add Tradier-vs-internal position reconciliation service for `ai_coach_positions`.
  - Wire reconciliation and slippage-guardrail cycles into `positionTrackerWorker` with bounded intervals.
  - Add optimizer slippage guardrail function that bumps `qualityGate.minEvR` when rolling broker entry slippage breaches threshold.
- Out of scope:
  - Full broker order lifecycle reconciliation (entry/exit routing + cancel/replace orchestration).
  - UI contract changes for explicit post-trade mode transitions.
  - KMS-backed credential decryption hardening.
- Files:
  - `/Users/natekahl/ITM-gd/backend/src/services/broker/tradier/client.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/positions/brokerLedgerReconciliation.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/positions/__tests__/brokerLedgerReconciliation.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/workers/positionTrackerWorker.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/optimizer.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/optimizer-confidence.test.ts`
  - `/Users/natekahl/ITM-gd/backend/.env.example`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE14_SLICE_P14-S4_2026-02-22.md`
- Tests run:
  - `pnpm --dir backend test -- src/services/positions/__tests__/brokerLedgerReconciliation.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts src/services/spx/__tests__/contractSelector.test.ts`
  - `pnpm --dir backend exec tsc --noEmit`
  - `pnpm --dir backend test -- src/workers/__tests__/spxOptimizerWorker.test.ts`
  - `pnpm exec eslint backend/src/services/broker/tradier/client.ts backend/src/services/positions/brokerLedgerReconciliation.ts backend/src/services/positions/__tests__/brokerLedgerReconciliation.test.ts backend/src/workers/positionTrackerWorker.ts backend/src/services/spx/optimizer.ts backend/src/services/spx/__tests__/optimizer-confidence.test.ts`
  - Result: tests/typecheck pass; eslint warning-only because backend files are ignored by root config.
- Risks introduced:
  - Incorrect broker symbol normalization can produce false force-close actions.
  - Slippage guardrail can reduce trade throughput when raised repeatedly in low-liquidity periods.
- Mitigations:
  - Reconciliation is disabled by default and uses strict option-key normalization.
  - Guardrail is idempotent per rolling-window signature and capped with configurable max `minEvR`.
  - Optimizer history persists each guardrail adjustment for full audit/revert.
- Rollback:
  - Revert P14-S4 files listed above.
  - Disable runtime toggles:
    - `TRADIER_POSITION_RECONCILIATION_ENABLED=false`
    - `SPX_OPTIMIZER_SLIPPAGE_GUARDRAIL_ENABLED=false`
- Notes:
  - This slice closes the Phase 14 “execution reconciliation + drift calibration” backend objective with bounded automation controls.

### Slice: P14-S5
- Objective: Execute full Phase 14 promotion gates and determine production promotion posture from strict replay parity evidence.
- Status: done (promotion blocked)
- Scope:
  - Run targeted Phase 14 test and compile gates.
  - Run strict Massive historical backfill (`2026-02-10` -> `2026-02-22`).
  - Run strict last-week replay (`instances`, `second`) and compare parity outcome.
  - Document promotion decision and blocker attribution.
- Out of scope:
  - Policy/gating retune implementation.
  - Additional setup detector feature changes.
- Files:
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE14_SLICE_P14-S5_2026-02-22.md`
  - `/Users/natekahl/ITM-gd/docs/specs/spx-production-recovery-autonomous-2026-02-20/06_CHANGE_CONTROL_AND_PR_STANDARD.md`
  - `/Users/natekahl/ITM-gd/docs/specs/spx-production-recovery-autonomous-2026-02-20/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`
  - `/Users/natekahl/ITM-gd/docs/specs/spx-production-recovery-autonomous-2026-02-20/08_AUTONOMOUS_EXECUTION_TRACKER.md`
- Tests run:
  - `pnpm --dir backend test -- src/services/spx/__tests__/microbarAggregator.test.ts src/services/setupDetector/__tests__/volumeClimax.test.ts src/services/setupDetector/__tests__/vwap.test.ts src/services/broker/tradier/__tests__/occFormatter.test.ts src/services/broker/tradier/__tests__/orderRouter.test.ts src/services/positions/__tests__/brokerLedgerReconciliation.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts`
  - `pnpm --dir backend exec tsc --noEmit`
  - `pnpm --dir backend test -- src/workers/__tests__/spxOptimizerWorker.test.ts`
  - `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-10 2026-02-22`
  - `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`
  - Result:
    - tests/tsc: pass
    - backfill: pass (`attemptedDays=9`, `successfulDays=9`, `failedDays=0`)
    - strict replay: zero actionable trades (`95 blocked`, `62 hidden-tier`)
- Risks introduced:
  - None (reporting/governance slice only).
- Promotion decision:
  - Blocked pending throughput recovery: strict replay produced zero actionable/resolved trades.
- Rollback:
  - No runtime rollback required for this slice (documentation/evidence only).
- Notes:
  - Strict second-bar fidelity remained intact (`usedMassiveMinuteBars=false`) while throughput collapsed.

### Slice: P15-S1
- Objective: Establish quantitative diagnostic baseline of full-population blocker distribution before gate recalibration.
- Status: done
- Scope: Enhanced `spxFailureAttribution.ts` with full-population blocker analysis, multi-blocker overlap, flow data availability audit.
- Files: `backend/src/scripts/spxFailureAttribution.ts`
- Validation: `pnpm --dir backend exec tsc --noEmit` pass.
- Key findings: 1000 rows analyzed (YTD). Flow data availability is 0% across all 27 dates. Top blockers: pwin_below_floor (345), timing_gate_blocked (233), volume_regime_alignment_required (204), evr_below_floor (186), trend_orb_confluence_required (150).
- Rollback: Revert script changes.

### Slice: P15-S2
- Objective: Replace narrow trend-only flow grace with structured flow-availability classification for all setup types.
- Status: done
- Scope: Added `flowAvailability` classification, unified `flowUnavailableGraceActive`, env kill switch `SPX_FLOW_UNAVAILABLE_GRACE_ENABLED`.
- Files: `backend/src/services/spx/setupDetector.ts`, `backend/src/services/spx/__tests__/setupDetector.test.ts`
- Tests run: `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts` (19/19 pass), `tsc --noEmit` pass.
- Rollback: `SPX_FLOW_UNAVAILABLE_GRACE_ENABLED=false` or revert.

### Slice: P15-S3
- Objective: Extend volume grace to all trend types and add flat-volume tolerance.
- Status: done
- Scope: Added `expandedVolumeGraceEligible`, widened time windows (trend 240→300, ORB 180→240), env kill switch `SPX_VOLUME_GRACE_EXPANDED_ENABLED`.
- Files: `backend/src/services/spx/setupDetector.ts`, `backend/src/services/spx/__tests__/setupDetector.test.ts`
- Tests run: 19/19 pass, `tsc --noEmit` pass.
- Rollback: `SPX_VOLUME_GRACE_EXPANDED_ENABLED=false` or revert.

### Slice: P15-S4
- Objective: Make ORB setups achievable in replay with sparse-flow alternative confirmation.
- Status: done
- Scope: Added `orbSparseFlowGrace`, lowered ORB flow quality score 52→45 when sparse.
- Files: `backend/src/services/spx/setupDetector.ts`, `backend/src/services/spx/__tests__/setupDetector.test.ts`
- Tests run: 19/19 pass, `tsc --noEmit` pass.
- Rollback: Revert code.

### Slice: P15-S5
- Objective: Ensure optimizer `passesCandidate` produces consistent results with detector grace-aware gating.
- Status: done
- Scope: Refactored `evaluateOptimizationGate` return type, added `effectiveFlowConfirmed`/`effectiveVolumeAligned` to metadata, updated `toPreparedRow` and `passesCandidate`.
- Files: `backend/src/services/spx/setupDetector.ts`, `backend/src/services/spx/optimizer.ts`, `backend/src/services/spx/types.ts`, `backend/src/services/spx/__tests__/setupDetector.test.ts`
- Tests run: 40/40 pass across 3 suites, `tsc --noEmit` pass.
- Rollback: Revert setupDetector.ts, optimizer.ts, types.ts.

### Slice: P15-S6
- Objective: Run full promotion pipeline and compare against Gold Standard baseline.
- Status: done (promotion blocked)
- Scope: Backfill, strict replay, attribution, promotion decision.
- Tests run: 40/40 pass, `tsc --noEmit` pass, backfill 5/5 days pass.
- Strict replay: triggered=7, T1=28.57%, T2=28.57%, expectancy=-0.093R.
- Blocker elimination: flow_confirmation_required 30→0, flow_alignment_unavailable 30→0, volume_regime_alignment_required 42→0.
- Promotion decision: **BLOCKED** — quality far below targets despite throughput recovery.
- Rollback: Kill switches for S2/S3 graces, code revert for S4.

### Slice: P16-S1
- Objective: Remove ORB sparse-flow grace and re-baseline strict replay behavior.
- Status: done
- Scope: Remove ORB sparse-flow grace path + restore ORB flow-quality discipline.
- Files: `backend/src/services/spx/setupDetector.ts`, `backend/src/services/spx/__tests__/setupDetector.test.ts`.
- Tests run: `pnpm --dir backend exec tsc --noEmit`, `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/winRateBacktest.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts`.
- Notes: ORB sparse-flow bypass removed; promotion remained blocked due low/zero strict sample in re-baseline window.

### Slice: P16-S2
- Objective: Recover trend-family throughput without restoring ORB sparse-flow grace.
- Status: done
- Scope: Bounded trend ORB-confluence alternatives + regime-bounded timing-window widening.
- Files: `backend/src/services/spx/setupDetector.ts`, `backend/src/services/spx/__tests__/setupDetector.test.ts`.
- Tests run: same Phase 16 detector/optimizer targeted suites + `tsc`.
- Notes: Throughput recovered partially but remained below institutional promotion thresholds.

### Slice: P16-S3
- Objective: Persist deterministic flow/microstructure evidence for historical attribution.
- Status: done
- Scope: Persist flow availability/effective gate booleans/microstructure coverage evidence to setup metadata and consume in replay readers.
- Files: `backend/src/services/spx/setupDetector.ts`, `backend/src/services/spx/outcomeTracker.ts`, `backend/src/services/spx/winRateBacktest.ts`, `backend/src/scripts/spxFailureAttribution.ts`, `backend/src/services/spx/types.ts`.
- Tests run: setup detector + win-rate backtest + outcome tracker suites, `tsc`.
- Notes: Evidence parity improved; throughput/promotion posture unchanged.

### Slice: P16-S4
- Objective: Harden execution-truth path for broker realism and source-composition governance.
- Status: done
- Scope: Tradier credential hardening, production runtime enablement guards, execution source composition metrics, proxy-share fail/warn gates.
- Files: `backend/src/services/broker/tradier/credentials.ts`, `backend/src/services/positions/brokerLedgerReconciliation.ts`, `backend/src/services/portfolio/portfolioSync.ts`, `backend/src/workers/positionTrackerWorker.ts`, `backend/src/services/spx/executionReconciliation.ts`, `backend/src/services/spx/optimizer.ts`, `hooks/use-spx-optimizer.ts`, `components/spx-command-center/spx-settings-sheet.tsx`.
- Tests run: broker credential + reconciliation + optimizer confidence suites, `tsc`.
- Notes: Realism gates added; strategy quality/throughput policy unchanged.

### Slice: P16-S5
- Objective: Tighten optimizer governance so low-diversity/low-realism windows cannot promote.
- Status: done
- Scope: Add resolved-sample floor, setup-family diversity floor, conservative objective delta floor, execution-fill evidence requirement, and proxy-share cap to promotion qualification.
- Files: `backend/src/services/spx/optimizer.ts`, `backend/src/services/spx/__tests__/optimizer-confidence.test.ts`, `hooks/use-spx-optimizer.ts`, `components/spx-command-center/spx-settings-sheet.tsx`, `components/spx-command-center/optimizer-scorecard-panel.tsx`, `backend/.env.example`.
- Tests run:
  - `pnpm --dir backend test -- src/services/spx/__tests__/optimizer-confidence.test.ts`
  - `pnpm --dir backend exec tsc --noEmit`
  - `pnpm --dir /Users/natekahl/ITM-gd exec tsc --noEmit`
  - `LOG_LEVEL=warn pnpm --dir backend spx:optimizer-weekly`
- Notes: Promotion qualification now explicitly blocked with governance reason codes when evidence is insufficient.

### Slice: P16-S6
- Objective: Run release gates and record institutional promote/block decision with explicit evidence.
- Status: done (promotion blocked)
- Scope: Execute validation commands, strict replay + attribution, optimizer governance readout, release artifact updates.
- Files:
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE16_SLICE_P16-S5_2026-02-23.md`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE16_SLICE_P16-S6_2026-02-23.md`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_RELEASE_NOTES_2026-02-21.md`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_GOLD_STANDARD_CONFIG_2026-02-22.md`
  - `/Users/natekahl/ITM-gd/docs/specs/spx-production-recovery-autonomous-2026-02-20/06_CHANGE_CONTROL_AND_PR_STANDARD.md`
  - `/Users/natekahl/ITM-gd/docs/specs/spx-production-recovery-autonomous-2026-02-20/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`
  - `/Users/natekahl/ITM-gd/docs/specs/spx-production-recovery-autonomous-2026-02-20/08_AUTONOMOUS_EXECUTION_TRACKER.md`
- Tests run:
  - `pnpm --dir backend test`
  - `pnpm --dir backend build`
  - `pnpm --dir backend exec tsc --noEmit`
  - `pnpm --dir /Users/natekahl/ITM-gd exec tsc --noEmit`
  - `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`
  - `LOG_LEVEL=warn pnpm --dir backend exec tsx src/scripts/spxFailureAttribution.ts 2026-02-16 2026-02-20`
  - `LOG_LEVEL=warn pnpm --dir backend spx:optimizer-weekly`
- Notes:
  - Added deterministic test-time control in `src/workers/__tests__/setupPushWorker.test.ts` to remove wall-clock flakiness from release gates.
  - Promotion blocked due strict replay quality/throughput failure (`triggered=1`, `T1=0%`, `expectancyR=-1.04`) and governance disqualification (`resolved 9/10`, conservative objective delta below floor, no execution fill evidence).

### Slice: P16-S7
- Objective: Wire sandbox-safe Tradier execution and portfolio/position safety controls without changing setup-detection policy.
- Status: done
- Scope:
  - Transition-driven Tradier routing foundation.
  - User-scoped Tradier sandbox credential/status/balance API controls.
  - DTBP-aware sizing output in contract selector.
  - Portfolio sync >1% persistence threshold + PDT behavioral alerts.
  - Late-day 0DTE flatten safety and reconciliation cadence in position tracker.
- Out of scope:
  - Broker webhook fill ingestion and strict fill-parity reconciliation.
  - Promotion decision changes.
- Files:
  - `/Users/natekahl/ITM-gd/backend/src/services/broker/tradier/executionEngine.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/broker/tradier/client.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/broker/tradier/occFormatter.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/coachPushChannel.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/websocket.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/portfolio/portfolioSync.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/contractSelector.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/types.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/positions/tradierFlatten.ts`
  - `/Users/natekahl/ITM-gd/backend/src/workers/positionTrackerWorker.ts`
  - `/Users/natekahl/ITM-gd/backend/src/routes/spx.ts`
  - `/Users/natekahl/ITM-gd/backend/.env.example`
  - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE16_SLICE_P16-S7_2026-02-23.md`
- Tests run:
  - `pnpm --dir backend exec tsc --noEmit`
  - `pnpm --dir backend test -- src/services/broker/tradier/__tests__/occFormatter.test.ts src/services/broker/tradier/__tests__/orderRouter.test.ts src/services/spx/__tests__/contractSelector.test.ts src/services/spx/__tests__/executionCoach.test.ts`
  - `pnpm --dir backend test -- src/services/broker/tradier/__tests__/occFormatter.test.ts src/services/positions/__tests__/brokerLedgerReconciliation.test.ts`
  - `pnpm exec eslint <touched files>` (warning-only due backend ignore pattern)
- Risks introduced:
  - Execution lifecycle still uses transition-time approximations until broker fill webhooks land.
- Mitigations:
  - Runtime remains disabled-by-default and sandbox-first.
  - `sell_to_open` hard rejection enforced.
  - Flatten/reconciliation pathways are guarded and fail-safe.
- Rollback:
  - Revert listed files or disable all Tradier runtime flags.
- Notes:
  - Slice aligns live-trading testability with sandbox controls while preserving current setup-detection behavior.
