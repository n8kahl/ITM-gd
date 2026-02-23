# SPX Rollback Report: Non-Setup-Detection Changes Since bbed195

Date: 2026-02-23

## Baseline
- Baseline commit: `bbed195b74a2488b15237683ce1a6494d551b01d`
- Baseline title: feat(spx): add nightly optimizer automation and settings scan controls

## Setup-Detection Surface Definition
A commit is treated as setup-detection-impacting if it modifies any of:
- `backend/src/services/spx/setupDetector.ts`
- `backend/src/services/spx/optimizer.ts`
- `backend/src/services/spx/historicalReconstruction.ts`
- `backend/src/services/spx/winRateBacktest.ts`
- `backend/src/services/spx/outcomeTracker.ts`
- `backend/src/services/spx/types.ts`
- `backend/src/services/spx/flowEngine.ts`
- `backend/src/services/spx/regimeClassifier.ts`

## Summary
- Commits reviewed since baseline: 45
- Commits with setup-detection impact: 11
- Commits with NO setup-detection impact: 34

## Commits With NO Setup-Detection Impact

| Commit | Date | Type | Subject |
|---|---|---|---|
| `b680e2c` | 2026-02-19 | merge | Merge pull request #118 from n8kahl/codex/spx-setup-detection-spec |
| `df48f1f` | 2026-02-19 | merge | Merge pull request #119 from n8kahl/codex/spx-setup-detection-spec |
| `11a513f` | 2026-02-19 | merge | Merge pull request #120 from n8kahl/codex/spx-setup-detection-spec |
| `1521da8` | 2026-02-19 | merge | Merge pull request #121 from n8kahl/codex/spx-setup-detection-spec |
| `887add5` | 2026-02-19 | merge | Merge pull request #122 from n8kahl/codex/spx-setup-detection-spec |
| `b7536f6` | 2026-02-20 | merge | Merge pull request #123 from n8kahl/codex/spx-setup-detection-spec |
| `3741e4a` | 2026-02-20 | merge | Merge pull request #124 from n8kahl/codex/spx-setup-detection-spec |
| `e85badf` | 2026-02-20 | merge | Merge pull request #125 from n8kahl/codex/spx-setup-detection-spec |
| `306c605` | 2026-02-20 | merge | Merge pull request #126 from n8kahl/codex/spx-setup-detection-spec |
| `390a0b2` | 2026-02-20 | merge | Merge pull request #127 from n8kahl/codex/spx-setup-detection-spec |
| `e88cf59` | 2026-02-20 | merge | Merge pull request #128 from n8kahl/codex/spx-setup-detection-spec |
| `142aecf` | 2026-02-20 | merge | Merge pull request #129 from n8kahl/codex/spx-setup-detection-spec |
| `4532506` | 2026-02-21 | merge | Merge pull request #130 from n8kahl/codex/spx-setup-detection-spec |
| `5cb25f3` | 2026-02-21 | merge | Merge pull request #131 from n8kahl/codex/spx-setup-detection-spec |
| `0ef3d8e` | 2026-02-21 | merge | Merge pull request #132 from n8kahl/codex/spx-setup-detection-spec |
| `b8a835f` | 2026-02-21 | merge | Merge pull request #133 from n8kahl/codex/spx-setup-detection-spec |
| `c77dc5d` | 2026-02-21 | merge | Merge pull request #134 from n8kahl/codex/spx-setup-detection-spec |
| `6042267` | 2026-02-21 | merge | Merge pull request #135 from n8kahl/codex/spx-setup-detection-spec |
| `d14e3b2` | 2026-02-21 | merge | Merge pull request #136 from n8kahl/codex/spx-setup-detection-spec |
| `54c57a6` | 2026-02-21 | merge | Merge pull request #137 from n8kahl/codex/spx-setup-detection-spec |
| `6b9a9c7` | 2026-02-21 | merge | Merge pull request #138 from n8kahl/codex/spx-setup-detection-spec |
| `46e61b7` | 2026-02-21 | merge | Merge pull request #139 from n8kahl/codex/spx-setup-detection-spec |
| `a8da9f2` | 2026-02-21 | merge | Merge pull request #140 from n8kahl/codex/spx-setup-detection-spec |
| `13fd553` | 2026-02-22 | merge | Merge pull request #141 from n8kahl/codex/spx-setup-detection-spec |
| `ac94439` | 2026-02-22 | merge | Merge pull request #142 from n8kahl/codex/spx-setup-detection-spec |
| `be0b6db` | 2026-02-22 | merge | Merge pull request #143 from n8kahl/codex/spx-setup-detection-spec |
| `d4054df` | 2026-02-22 | merge | Merge pull request #144 from n8kahl/codex/spx-setup-detection-spec |
| `0fc0e1b` | 2026-02-22 | direct | Harden SPX level accuracy and overlay visibility semantics |
| `f7151e2` | 2026-02-22 | merge | Merge pull request #145 from n8kahl/codex/spx-setup-detection-spec |
| `77da1d4` | 2026-02-22 | direct | feat(spx): phase14 slice p14-s1 canonical microbar microstructure telemetry |
| `ece7d66` | 2026-02-22 | direct | feat(spx): phase14 slice p14-s2 microstructure-gated volume and vwap detectors |
| `fbe00e9` | 2026-02-22 | merge | Merge pull request #146 from n8kahl/codex/phase1-l2-microstructure |
| `39f838f` | 2026-02-22 | merge | Merge pull request #147 from n8kahl/codex/phase1-l2-microstructure |
| `84be10e` | 2026-02-22 | merge | Merge pull request #148 from n8kahl/codex/phase1-l2-microstructure |

## Notes
- This report classifies impact by file-touch analysis on the setup-detection surface only.
- Changes outside this surface can still affect execution UX, broker plumbing, or observability, but are marked non-impacting for setup-detection logic under this definition.
