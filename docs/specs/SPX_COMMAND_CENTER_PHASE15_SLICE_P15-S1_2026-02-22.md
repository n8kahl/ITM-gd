# SPX Command Center Phase 15 Slice Report: P15-S1

**Date:** 2026-02-22
**Slice:** P15-S1
**Objective:** Establish quantitative diagnostic baseline of full-population blocker distribution before gate recalibration.
**Status:** Completed

## 1) Scope
In scope:
1. Enhance `spxFailureAttribution.ts` with full-population blocker analysis.
2. Run attribution across YTD window and record baseline.
3. Identify blocker distribution, multi-blocker overlap patterns, and flow data availability.

Out of scope:
1. Gate logic changes.
2. Grace path modifications.

## 2) Files Changed
1. `backend/src/scripts/spxFailureAttribution.ts` — Added per-setup-type x per-blocker cross-tabulation, multi-blocker overlap analysis, flow data availability audit by date, and tier/status summary.

## 3) Diagnostic Results (2026-01-02 to 2026-02-22, 1000 rows)

### Population
- Total: 1000, Blocked: 530, Eligible: 470, Hidden: 969, Triggered: 30, Strict triggered: 21

### Top Blockers
| Rank | Reason | Count | % of Total |
|------|--------|-------|-----------|
| 1 | pwin_below_floor | 345 | 34.5% |
| 2 | timing_gate_blocked | 233 | 23.3% |
| 3 | volume_regime_alignment_required | 204 | 20.4% |
| 4 | evr_below_floor | 186 | 18.6% |
| 5 | trend_orb_confluence_required | 150 | 15.0% |
| 6 | flow_confirmation_required | 119 | 11.9% |
| 7 | flow_alignment_unavailable | 119 | 11.9% |
| 8 | trend_timing_window | 78 | 7.8% |
| 9 | confluence_below_floor | 75 | 7.5% |

### Critical Finding: Flow Data Availability
- Flow alignment available: **0% across all 27 dates**
- Flow confirmed: **0% across all dates**
- Directional events stored in metadata: **0 across all dates**
- Conclusion: `spx_setup_instances` metadata does NOT persist flow telemetry fields. Flow gates are evaluated at detection time against live data; historical instances have no flow record.

### Top Multi-Blocker Combos
| Combo | Count |
|-------|-------|
| evr_below_floor + pwin_below_floor | 87 |
| evr_below_floor + pwin_below_floor + timing_gate_blocked | 80 |
| trend_orb_confluence_required (SINGLE blocker) | 69 |
| full breakout_vacuum block (7 reasons) | 53 |
| timing + trend_orb + trend_timing + volume (trend_pullback) | 52 |

### Setup-Type Breakdown
- **trend_pullback**: #1 blocker is `trend_orb_confluence_required` (150), then `trend_timing_window` (78), `timing_gate_blocked` (70), `volume_regime_alignment_required` (68)
- **orb_breakout**: `volume_regime_alignment_required` (64), flow/quality blockers (47 each), `orb_flow_or_confluence_required` (30)
- **mean_reversion/fade_at_wall**: dominated by quality hardblocks (pWin/EVR)
- **breakout_vacuum**: fully blocked (paused + all gates)

## 4) Implications for P15 Implementation
1. Quality hardblocks (pWin/EVR) are the single largest blocker category (345+186) but are NOT targetable by grace paths — they represent genuinely low-quality setups.
2. The biggest single-gate recovery opportunity is `trend_orb_confluence_required` with 69 rows blocked by ONLY that reason. Relaxing this for trend_pullback would directly recover ~69 setups to eligible.
3. Flow/volume gates (S2-S3 targets) block ~200+ rows combined, heavily overlapping with ORB.
4. ORB activation (S4) depends on both flow and volume grace to unlock 64+ volume-blocked and 47+ flow-blocked rows.

## 5) Validation
- `pnpm --dir backend exec tsc --noEmit`: pass
- Attribution script runs successfully with enhanced output

## 6) Rollback
Revert `spxFailureAttribution.ts` changes.
