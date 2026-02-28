# SPX Command Center Expert Trade Stream Selector Contract
Date: 2026-02-28
Scope route: `/members/spx-command-center`
Contract version: `2026-02-28`

## 1. Purpose
Define the selector boundary and lifecycle-order contract for the upcoming Expert Trade Stream surface before implementation slices begin.

## 2. Selector Contract

| Contract ID | Selector | Intent |
|---|---|---|
| ETS-001 | `spx-command-center` | Route shell container for SPX command center. |
| ETS-002 | `spx-now-focus` | Pinned now-focus card root. |
| ETS-003 | `spx-now-focus-lifecycle` | Lifecycle badge shown on now-focus card. |
| ETS-004 | `spx-now-focus-action` | Single now-focus action button label/CTA node. |
| ETS-005 | `spx-trade-stream` | Trade stream panel root. |
| ETS-006 | `spx-trade-stream-lifecycle-forming` | Forming lifecycle group container. |
| ETS-007 | `spx-trade-stream-lifecycle-triggered` | Triggered lifecycle group container. |
| ETS-008 | `spx-trade-stream-lifecycle-past` | Past lifecycle group container. |
| ETS-009 | `spx-trade-stream-row` | Base selector for each row in stream order. |
| ETS-010 | `spx-trade-stream-row-{stableIdHash}` | Deterministic row selector by stable hash. |
| ETS-011 | `spx-trade-stream-row-lifecycle` | Row lifecycle and age chip. |
| ETS-012 | `spx-trade-stream-row-freshness` | Row freshness/source badge. |
| ETS-013 | `spx-trade-stream-row-action` | Row recommended-action label/button. |
| ETS-014 | `spx-trade-stream-row-details-toggle` | Details disclosure toggle. |
| ETS-015 | `spx-trade-stream-row-expanded` | Expanded details body root. |

## 3. Fixture Payload Set
Fixture directory: `/Users/natekahl/ITM-gd/e2e/fixtures/spx-trade-stream`

1. `selector-contract.json`
2. `trade-stream.unordered.json`
3. `trade-stream.expected-ordered.json`
4. `trade-stream.empty.json`

## 4. Lifecycle-Order Assertions
Global stream order:
1. `forming`
2. `triggered`
3. `past`

Within each lifecycle:
1. Primary: `momentPriority` descending (higher first).
2. Secondary:
   - `forming`: `etaToTriggerMs` ascending (nearer first).
   - `triggered`: `triggeredAt` recency descending (newer first / lower age first).
   - `past`: `resolvedAt` recency descending (newer first).
3. Tertiary: `stableIdHash` ascending (deterministic tie-break).

Now-focus contract:
1. `nowFocusItemId` must be the highest-urgency item across all lifecycle states.
2. Lifecycle rank is not a now-focus gate; urgency wins first.

## 5. Validation Gate
Primary contract test:
```bash
pnpm playwright test e2e/spx-trade-stream-contract.spec.ts --project=chromium --workers=1
```
