# WebSocket Audit and Resolution (2026-02-16)

## Scope

Runtime websocket usage across frontend + backend code paths in this repo (excluding tests/docs/coverage artifacts).

## Findings

1. `usePriceStream` re-subscription churn on normal re-renders
- File: `hooks/use-price-stream.ts`
- Root cause:
  - Hook effect dependencies used array/callback references directly.
  - Common call-sites pass inline arrays/functions, creating new references every render.
  - This caused unnecessary consumer remove/add cycles and frequent subscribe/unsubscribe traffic.

2. Multiple independent websocket clients bypassed shared manager
- Files:
  - `components/ai-coach/position-tracker.tsx`
  - `components/ai-coach/tracked-setups-panel.tsx`
- Root cause:
  - Both components created their own `new WebSocket(...)` connections.
  - This bypassed shared retry policy, multiplied failure volume, and increased auth/connect noise.

3. Unauthorized tokens could repeatedly trigger reconnect attempts
- File: `hooks/use-price-stream.ts`
- Root cause:
  - After `4401/4403`, reconnect pause existed, but the same invalid token could be retried again.
  - This can still produce recurring connection failures until token refresh.

## Resolutions Implemented

1. Stable signature-based subscription inputs in shared hook
- File: `hooks/use-price-stream.ts`
- Change:
  - Added content-based signatures for symbols/channels.
  - Effect no longer churns on render-time array identity changes.
  - Moved `onMessage` to ref-backed dispatch to avoid re-subscribe on callback identity changes.

2. Consolidated AI Coach panel websockets onto shared manager
- Files:
  - `components/ai-coach/position-tracker.tsx`
  - `components/ai-coach/tracked-setups-panel.tsx`
- Change:
  - Removed raw `new WebSocket(...)` usage.
  - Both panels now subscribe via `usePriceStream(..., { channels, onMessage })`.
  - Result: one shared socket/reconnect policy across SPX, positions, and setups consumers.

3. Added auth-failure token blocking in shared hook
- File: `hooks/use-price-stream.ts`
- Change:
  - On `4401/4403`, mark token as auth-failed.
  - Block reconnects for that same token until token changes.
  - Prevents repeat reconnect storms from stale/invalid JWTs.

## Verification

Executed:
- `pnpm eslint hooks/use-price-stream.ts components/ai-coach/position-tracker.tsx components/ai-coach/tracked-setups-panel.tsx`
- `pnpm tsc --noEmit`

Both passed (environment emitted Node engine warning only).

Runtime inventory check:
- Frontend runtime now has one websocket constructor path:
  - `hooks/use-price-stream.ts`
- No remaining direct websocket constructors in runtime UI components.

## Operational Notes

- Browser devtools may still show a single connection failure event if backend closes handshake; browser-level warning cannot be suppressed by app code.
- With this patch set, failure volume is bounded by:
  - reconnect throttling,
  - failure pause window,
  - unauthorized-token reconnect blocking.
