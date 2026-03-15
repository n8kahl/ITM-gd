# Risk Register And Decision Log: Money Maker V2 Execution Guidance

Date: 2026-03-11
Governing spec: `docs/specs/MONEY_MAKER_V2_EXECUTION_GUIDANCE_SPEC_2026-03-11.md`
Implementation plan: `docs/specs/money-maker-v2-execution-guidance-autonomous-2026-03-11/02_IMPLEMENTATION_PLAN_AND_PRIORITY_MODEL.md`

## 1. Usage

Update this file whenever:
- a new material risk is found
- a risk is mitigated or accepted
- a product or architecture decision changes the implementation path

## 2. Risk Register

| ID | Date | Severity | Area | Description | Mitigation | Owner | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| MMV2-R1 | 2026-03-11 | P0 | Guidance Logic | Underlying plan and contract guidance could diverge in direction or validity. | Make underlying signal authoritative and unit-test direction mapping plus degraded-mode collapse. | Eng | Open | Release-blocking. |
| MMV2-R2 | 2026-03-11 | P1 | Options Data | Options-chain data may be stale, unavailable, or rate-limited. | Keep contract work off the snapshot poll path and preserve underlying-plan visibility in degraded mode. | Eng | Open | Must degrade cleanly. |
| MMV2-R3 | 2026-03-11 | P1 | Product Safety | Late-session single-leg options guidance can create poor entries due to rapid decay. | Enforce time-of-day caution and exclude same-day contracts in launch. | Eng + Product | Open | Release-blocking policy surface. |
| MMV2-R4 | 2026-03-11 | P1 | Scope Safety | Multi-leg or spread language could leak in from reused options-selection logic. | Hard lock V2 to long calls / long puts only and test for forbidden outputs. | Eng | Partially mitigated | Slice `2.3` landed a pure single-leg contract-guide builder with bullish-call / bearish-put tests; route and UI integration still need the same guardrails. |
| MMV2-R5 | 2026-03-11 | P2 | UX Clarity | Workspace can become too dense and obscure the fast-scan board value. | Keep board lightweight and load detail only in workspace. | Frontend | Open | Design risk, not architecture risk. |
| MMV2-R6 | 2026-03-11 | P1 | Trust | Users may mistake the tool for brokerage automation or live managed exits. | Keep language explicitly decision-support-only and avoid broker/action verbs that imply execution. | Product + Eng | Open | Copy and UX risk. |
| MMV2-R7 | 2026-03-11 | P1 | Access | Member proxy and backend route auth could drift on the new workspace routes. | Reuse current Money Maker access boundaries and add route-level auth tests. | Eng | Partially mitigated | Slice `2.4` added backend route auth coverage and a runnable member-access contract test; Slice `2.5` added local E2E proof for admin/non-admin planner access. Deployed smoke is still pending. |
| MMV2-R8 | 2026-03-11 | P1 | Board Clarity | Duplicate hourly labels, raw confluence jargon, or synthetic indicator values can mislead entry and exit decisions. | Normalize level sources, translate internal labels, and render unavailable indicators explicitly. | Eng + Frontend | Mitigated | Slice `2.1` landed targeted fixes and test coverage; final release proof still depends on full V2 smoke. |
| MMV2-R9 | 2026-03-11 | P1 | Data Trust | Stale or delayed data could appear current and create bad intraday decisions. | Add freshness states, stale thresholds, and trust cues on both board and workspace. | Eng + Frontend | Partially mitigated | Board and workspace trust cues are now implemented with unit/component/E2E coverage. Deployed smoke is still pending in Slice `2.7`. |
| MMV2-R10 | 2026-03-11 | P2 | Alert Noise | Transition alerts could fire repeatedly on every poll and train users to ignore them. | Add state-transition dedupe keyed by symbol and execution state. | Frontend | Mitigated | Shared transition-alert helpers plus component coverage now prove one alert per real state transition locally. |

## 3. Decision Log

| ID | Date | Decision | Reason | Consequence |
|---|---|---|---|---|
| MMV2-D1 | 2026-03-11 | Treat the next phase as a new V2 product layer, not a continuation of V1 phase numbering. | The old V1 "Phase 2" already meant backend API plumbing and would cause scope confusion. | New planning docs use V2 execution-guidance framing. |
| MMV2-D2 | 2026-03-11 | Underlying KCU plan is authoritative; option contract is only the expression layer. | Prevents contract logic from drifting away from the actual trade thesis. | Contract guidance collapses if the underlying setup is invalid. |
| MMV2-D3 | 2026-03-11 | Launch V2 with single-leg only: long calls and long puts. | Product direction excludes spreads and wants a simpler trader-guidance workflow. | Any multi-leg logic is out of scope and must not appear in output or UI. |
| MMV2-D4 | 2026-03-11 | Keep contract generation off the snapshot poll path. | Option-chain work is heavier and less reliable than the core signal board. | Add on-demand workspace/detail routes instead of bloating snapshot polling. |
| MMV2-D5 | 2026-03-11 | Do not ship sizing recommendations in V2 launch. | Without broker/account context, sizing can overstate confidence and create false precision. | UI may show premium per contract, but not contract counts. |
| MMV2-D6 | 2026-03-11 | Trader-facing UI must never expose raw confluence labels as the primary explanation. | Labels like `fortress` are engine shorthand, not execution guidance. | Add a translation layer and use plain-English support/resistance descriptors. |
| MMV2-D7 | 2026-03-11 | Board correctness and trust cues are release-blocking before larger workspace features. | The current surface can mislead even before V2 planning features are added. | Slice 2.1 is a hardening slice, not optional polish. |
| MMV2-D8 | 2026-03-11 | In-app transition alerts are in scope; browser notifications are not required for initial release. | Traders need state-change awareness, but browser permissions would add risk and rollout complexity. | Implement in-app alerts first and defer off-page notifications. |
| MMV2-D9 | 2026-03-14 | Treat `armed` as a bounded pre-trigger distance rather than any price that remains above/below the stop. | A naive stop-based threshold collapses most valid pre-trigger prices into `armed` and makes `watching` effectively unreachable. | The evaluator now uses a narrower deterministic pre-trigger distance so `watching` and `armed` remain distinct, testable states. |
| MMV2-D10 | 2026-03-14 | Use a shared frontend execution-summary helper for board rendering and alert generation. | The board already needed derived execution state, and duplicating that logic again for alerts would create drift. | Cards, trust copy, and transition alerts now share one frontend execution-state model while the backend workspace remains authoritative for the detailed planner. |

## 4. Update Template

```md
### Risk Update
- ID:
- Date:
- Change:
- Why:
- New status:
- Evidence:
```

```md
### Decision Update
- ID:
- Date:
- Decision:
- Reason:
- Consequence:
```
