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
| MMV2-R4 | 2026-03-11 | P1 | Scope Safety | Multi-leg or spread language could leak in from reused options-selection logic. | Hard lock V2 to long calls / long puts only and test for forbidden outputs. | Eng | Open | Release-blocking. |
| MMV2-R5 | 2026-03-11 | P2 | UX Clarity | Workspace can become too dense and obscure the fast-scan board value. | Keep board lightweight and load detail only in workspace. | Frontend | Open | Design risk, not architecture risk. |
| MMV2-R6 | 2026-03-11 | P1 | Trust | Users may mistake the tool for brokerage automation or live managed exits. | Keep language explicitly decision-support-only and avoid broker/action verbs that imply execution. | Product + Eng | Open | Copy and UX risk. |
| MMV2-R7 | 2026-03-11 | P1 | Access | Member proxy and backend route auth could drift on the new workspace routes. | Reuse current Money Maker access boundaries and add route-level auth tests. | Eng | Open | Same class as prior remediation risk. |
| MMV2-R8 | 2026-03-11 | P1 | Board Clarity | Duplicate hourly labels, raw confluence jargon, or synthetic indicator values can mislead entry and exit decisions. | Normalize level sources, translate internal labels, and render unavailable indicators explicitly. | Eng + Frontend | Open | Release-blocking because it affects trader interpretation. |
| MMV2-R9 | 2026-03-11 | P1 | Data Trust | Stale or delayed data could appear current and create bad intraday decisions. | Add freshness states, stale thresholds, and trust cues on both board and workspace. | Eng + Frontend | Open | Release-blocking trust surface. |
| MMV2-R10 | 2026-03-11 | P2 | Alert Noise | Transition alerts could fire repeatedly on every poll and train users to ignore them. | Add state-transition dedupe keyed by symbol and execution state. | Frontend | Open | Important adoption risk, but solvable with deterministic logic. |

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
