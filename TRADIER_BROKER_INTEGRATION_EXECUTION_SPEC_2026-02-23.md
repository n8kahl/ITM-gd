# Tradier Broker Integration UX — Autonomous Execution Specification

**SPX Command Center | v1.0 | 2026-02-23**

---

| Field | Value |
|---|---|
| **Owner** | Claude (Autonomous) |
| **Route** | `/members/spx-command-center` |
| **Surface** | SPX Settings Sheet → Broker Tab |
| **Execution Mode** | Spec-First Autonomous Delivery |
| **Priority** | P0 — Critical Path |
| **Est. Phases** | 5 phases, 14 slices |
| **Design Ref** | `tradier-ux-audit-mockup.html` |

---

## 1. Objective

Deliver a complete, user-facing Tradier broker integration UX inside the SPX Command Center Settings Sheet. The integration must provide self-service broker connection, a three-way execution mode toggle (Off / Manual / Auto), real-time position monitoring with reconciliation, and full settings control with safety guardrails.

**Key requirements:**

1. Add a "Broker" tab as a sibling to the existing "Optimizer" tab in `spx-settings-sheet.tsx`.
2. Implement a three-way execution mode toggle: **Off** (connected, no execution), **Manual** (user confirms each trade via modal), **Auto** (engine routes on setup triggers).
3. Surface broker connection status, portfolio sync stats, and sandbox/live environment indicator.
4. Build a position monitor with broker-to-ledger reconciliation and 0DTE flatten countdown.
5. Create a Manual Mode confirmation modal that surfaces on every order with one-tap Execute or Skip.
6. Implement a kill switch that cancels all open orders and flips execution mode to Off.
7. Follow the Emerald Standard brand guidelines: Onyx `#0A0A0B`, Emerald Elite `#10B981`, Champagne `#F3E5AB`.
8. Ensure 44px touch targets and mobile-first responsive layout with `glass-card-heavy` containers.

---

## 2. Scope and Constraints

### 2.1 In Scope

- New "Broker" tab in SPX Settings Sheet (`spx-settings-sheet.tsx`)
- Three-way execution mode toggle component (Off / Manual / Auto)
- Broker connection status card with token expiry, sync timing, and environment indicator
- Portfolio sync stats display (equity, DTBP, realized P&L)
- Execution mode behavior descriptions (what each mode does)
- Settings controls: risk %, DTBP utilization, entry limit offset, T1 scale %, flatten window
- Safety toggles: 0DTE auto-flatten, confirm-before-send, `sell_to_open` guard display
- Position monitor table with broker-to-ledger reconciliation Match/Drift badges
- Session fill quality stats (broker share %, avg slippage, proxy share)
- Manual mode confirmation modal (contract details, sizing, limit price, Execute/Skip CTAs)
- Kill switch button (cancels all open orders, flips to Off mode)
- SPX header broker status chip (connection state + sandbox/live indicator)
- React hook: `useTradierBroker()` for fetching status, toggling mode, testing balance
- Next.js API route: `PATCH /api/broker/tradier/mode` for execution mode updates
- Next.js API route: `POST /api/broker/tradier/kill` for kill switch
- Next.js API route: `GET /api/broker/tradier/positions` for position monitor

### 2.2 Out of Scope

- Tradier OAuth 2.0 authorization code flow (current design uses direct credential storage; OAuth is a future enhancement requiring Tradier partner approval for refresh tokens)
- New Supabase migrations (`broker_credentials`, `portfolio_snapshots`, and `spx_setup_execution_fills` tables already exist)
- Backend execution engine changes (fully implemented in `executionEngine.ts`, `orderRouter.ts`)
- Backend position reconciliation changes (`brokerLedgerReconciliation.ts` already operational)
- Backend portfolio sync changes (`portfolioSync.ts` already operational)
- Backend late-day flatten changes (`tradierFlatten.ts` already operational)
- Multi-broker support (Tradier-only for this spec)

### 2.3 Non-Negotiable Constraints

1. All UI must follow the Emerald Standard brand guidelines (`BRAND_GUIDELINES.md`).
2. No `#D4AF37` gold hex anywhere. Champagne `#F3E5AB` only.
3. Dark mode only. Onyx `#0A0A0B` background, never pure black or white.
4. `glass-card-heavy` for all card containers.
5. Playfair Display for headings, Inter for body, JetBrains Mono (or Geist Mono) for data/prices.
6. 44px minimum touch targets for all interactive elements.
7. Lucide React icons, stroke width 1.5.
8. Mobile-first responsive: stacked layout below `md` breakpoint.
9. The Broker tab must be a peer of Optimizer within the existing settings sheet architecture.
10. Manual mode must require explicit user confirmation for every order.

---

## 3. Baseline Findings (Validated 2026-02-23)

Comprehensive audit of the current Tradier integration reveals a robust backend with zero user-facing UI:

| Metric | Current State | Severity |
|---|---|---:|
| Backend Services | 7 (client, orderRouter, executionEngine, credentials, occFormatter, tradierFlatten, executionReconciliation) | Solid |
| Frontend Surfaces | 1 (optimizer scorecard data quality row only) | **P0 Critical** |
| Environment Vars | 25+ (all admin-only, no user controls) | P1 High |
| User Self-Service | 0 (no connect, no toggle, no monitor) | **P0 Critical** |
| Execution Mode Control | 0 (auto-execute is metadata-only, no UI toggle) | **P0 Critical** |
| Position Visibility | 0 (no broker position view, no recon display) | P1 High |
| Sandbox/Live Indicator | 0 (backend supports it, no visual indicator) | P1 High |
| Kill Switch | 0 (`is_active` toggle exists in DB but no UI surface) | P1 High |

### 3.1 Existing API Endpoints (Ready to Consume)

- `GET /broker/tradier/status` — Returns credential config, portfolio snapshot, runtime status
- `POST /broker/tradier/credentials` — Upserts encrypted credentials with metadata
- `POST /broker/tradier/test-balance` — Tests connection by fetching account balances

### 3.2 Database Schema (Ready)

- `broker_credentials` — `user_id` PK, `broker_name`, `account_id`, `access_token_ciphertext` (AES-256-GCM), `is_active`, `metadata` JSONB
- `portfolio_snapshots` — `total_equity`, `day_trade_buying_power`, `realized_pnl_daily`
- `spx_setup_execution_fills` — `side`, `phase`, `source`, `fill_price`, `slippage_points`, `slippage_bps`

### 3.3 Metadata Fields (JSONB in broker_credentials)

- `tradier_sandbox` (boolean) — sandbox vs live environment
- `spx_auto_execute` (boolean) — auto-execute entry orders on setup triggers
- `credential_source` (string) — source of credential entry

---

## 4. Target Experience Design

### 4.1 Navigation Architecture

The Broker tab lives inside the existing SPX Settings Sheet modal, accessed via the Settings gear icon in the SPX Command Center header:

```
/members/spx-command-center  →  Settings (⚙)  →  Broker Tab
```

The settings sheet uses a tab bar with two peers:

- **Optimizer** — existing tab (nightly automation, scope, scorecard, audit history)
- **Broker** — new tab (connection, execution mode, settings, positions)

### 4.2 Broker Tab Layout (Desktop)

Two-column grid layout matching the existing Optimizer tab pattern:

**Left Column (320px sidebar):**

- Connection Status Card — broker state, account masked, sync timing, token expiry, environment
- Portfolio Sync Toggles — sync enabled, PDT buying power alert
- Environment Switch — sandbox vs live (requires confirmation modal for live)

**Right Column (fluid main):**

- Execution Mode Toggle — three-way Off/Manual/Auto switcher (primary interaction)
- Sizing Parameters — risk %, DTBP utilization, entry limit offset, T1 scale %
- Safety Controls — 0DTE auto-flatten, confirm-before-send, flatten window, `sell_to_open` guard
- Position Monitor — broker positions table with Match/Drift reconciliation
- Fill Quality Stats — broker share %, avg slippage, proxy share

### 4.3 Execution Mode Toggle (Primary UX)

The three-way toggle is the centerpiece interaction. Each mode has a distinct visual treatment:

| Mode | Visual | Behavior | Backend Field |
|---|---|---|---|
| **Off** | Muted gray, no indicator | Connected for sync only, no orders routed, signals display-only | `is_active=true`, `spx_auto_execute=false`, `exec_mode=off` |
| **Manual** | Champagne `#F3E5AB` indicator | Confirmation modal on every order: contract, sizing, limit price, Execute/Skip | `is_active=true`, `spx_auto_execute=false`, `exec_mode=manual` |
| **Auto** | Emerald `#10B981` indicator | Engine routes automatically: Entry → T1 Scale (65%) → Runner Stop → Terminal Exit | `is_active=true`, `spx_auto_execute=true` |

### 4.4 Manual Mode Confirmation Modal

When execution mode is Manual and a setup triggers, a modal appears with:

- Contract symbol (OCC format, e.g., `SPXW260223C06050000`)
- Direction (Bull/Bear) and setup strategy name
- Risk sizing: risk %, max risk $, contracts by risk, contracts by DTBP
- Resolved quantity (min of risk-based and DTBP-based)
- Limit price (ask + entry offset)
- Two CTAs: **Execute** (emerald, 44px) and **Skip** (ghost, 44px)
- Auto-dismiss after 60 seconds with Skip default

### 4.5 Kill Switch

Destructive action button (red/danger styling) that:

1. Cancels all open Tradier orders for the user
2. Flips execution mode to Off
3. Sets `is_active = false` on `broker_credentials`
4. Publishes a coach message confirming the kill
5. Requires confirmation modal before execution

### 4.6 SPX Header Broker Chip

A new status chip in the SPX header bar (alongside Health and Feed chips) showing:

- Connection state: Connected (emerald pulse) / Disconnected (muted)
- Environment: Sandbox (champagne badge) / Live (emerald badge)
- Execution mode: Off / Manual / Auto (icon indicator)

### 4.7 Mobile Layout

Below `md` breakpoint, the Broker tab stacks vertically:

1. Execution mode toggle (full width, stacked vertically)
2. Connection status card
3. Portfolio stats (horizontal scroll on small screens)
4. Position monitor (card list, not table)
5. Settings and safety toggles

---

## 5. Target Technical Architecture

### 5.1 New Components

| Component | Location | Purpose |
|---|---|---|
| `BrokerTab` | `components/spx-command-center/broker-tab.tsx` | Root component for the Broker settings tab |
| `BrokerConnectionCard` | `components/spx-command-center/broker-connection-card.tsx` | Connection status, token expiry, sync timing |
| `ExecutionModeToggle` | `components/spx-command-center/execution-mode-toggle.tsx` | Three-way Off/Manual/Auto switcher |
| `BrokerPositionMonitor` | `components/spx-command-center/broker-position-monitor.tsx` | Position table with recon badges |
| `BrokerFillQuality` | `components/spx-command-center/broker-fill-quality.tsx` | Fill stats: broker share, slippage, proxy |
| `BrokerSafetyControls` | `components/spx-command-center/broker-safety-controls.tsx` | Toggles for flatten, confirm, env switch |
| `ManualExecutionModal` | `components/spx-command-center/manual-execution-modal.tsx` | Confirmation modal for Manual mode orders |
| `KillSwitchButton` | `components/spx-command-center/kill-switch-button.tsx` | Destructive action with confirmation |
| `BrokerHeaderChip` | `components/spx-command-center/broker-header-chip.tsx` | Status chip for SPX header bar |

### 5.2 New Hook

**`useTradierBroker()`** — Central hook for all broker UI state.

Returns:

- `status`: BrokerStatus (from `GET /broker/tradier/status`)
- `executionMode`: `"off" | "manual" | "auto"`
- `isConnected`: boolean
- `isSandbox`: boolean
- `portfolio`: `{ equity, dtbp, realizedPnl }`
- `positions`: `BrokerPosition[]`
- `fillQuality`: FillQualityStats
- `setExecutionMode(mode)`: mutation
- `testBalance()`: mutation
- `killAll()`: mutation
- `isLoading`, `error`: standard query states

Implementation: React Query with 15-second polling for status, 30-second for positions.

### 5.3 New API Routes

| Method | Route | Purpose | Auth |
|---|---|---|---|
| `PATCH` | `/api/broker/tradier/mode` | Update execution mode (off/manual/auto) | `requireTier("pro")` |
| `POST` | `/api/broker/tradier/kill` | Kill switch: cancel orders + deactivate | `requireTier("pro")` |
| `GET` | `/api/broker/tradier/positions` | Fetch broker positions with recon status | `requireTier("pro")` |

### 5.4 Modified Files

| File | Change |
|---|---|
| `components/spx-command-center/spx-settings-sheet.tsx` | Add "Broker" tab to tab bar, render `BrokerTab` when selected |
| `components/spx-command-center/spx-header.tsx` | Add `BrokerHeaderChip` next to existing Health/Feed chips |
| `contexts/SPXCommandCenterContext.tsx` | Add brokerStatus to context (optional: can be standalone hook) |
| `app/globals.css` | Verify `glass-card-heavy` and emerald/champagne vars (likely no changes needed) |

### 5.5 State Machine: Execution Mode

| From | To | API Call | Side Effect |
|---|---|---|---|
| Off | Manual | `PATCH /mode {mode:"manual"}` | Sets `spx_auto_execute=false`, `exec_mode=manual` in metadata |
| Off | Auto | `PATCH /mode {mode:"auto"}` | Sets `spx_auto_execute=true`; requires confirmation modal |
| Manual | Off | `PATCH /mode {mode:"off"}` | Sets `exec_mode=off`; cancels pending confirmation modals |
| Manual | Auto | `PATCH /mode {mode:"auto"}` | Sets `spx_auto_execute=true`; requires confirmation modal |
| Auto | Off | `PATCH /mode {mode:"off"}` | Sets `spx_auto_execute=false`; does NOT cancel running orders |
| Auto | Manual | `PATCH /mode {mode:"manual"}` | Sets `spx_auto_execute=false`, `exec_mode=manual` |
| Any | Kill | `POST /kill` | Cancels all orders, sets `is_active=false`, mode=off |

---

## 6. Implementation Plan (Phase/Slice)

### Phase 0: Foundation (2 slices)

**Goal:** Create the Broker tab shell and hook infrastructure.

#### Slice P0-S1: Broker Tab Shell

- Add "Broker" tab to `spx-settings-sheet.tsx` tab bar
- Create `broker-tab.tsx` with two-column grid layout matching Optimizer pattern
- Empty state: "Connect your broker to get started" placeholder
- **Files:** `spx-settings-sheet.tsx`, `broker-tab.tsx`
- **Gate:** `pnpm exec tsc --noEmit`, `pnpm exec eslint components/spx-command-center/`

#### Slice P0-S2: useTradierBroker Hook

- Create `hooks/useTradierBroker.ts`
- Fetch `GET /broker/tradier/status` with React Query (15s poll)
- Derive `executionMode`, `isConnected`, `isSandbox`, portfolio stats
- Export typed interface for all consumers
- **Files:** `hooks/useTradierBroker.ts`
- **Gate:** `pnpm exec tsc --noEmit`, unit test for hook state derivation

---

### Phase 1: Connection and Status (3 slices)

**Goal:** Surface broker connection state and portfolio data.

#### Slice P1-S1: BrokerConnectionCard

- `glass-card-heavy` container showing: connection state, account masked, sandbox/live badge, token expiry countdown, last sync time
- Disconnect button (ghost style)
- Environment labels: `sandbox.tradier.com` vs `api.tradier.com`
- AES-256-GCM encryption indicator pill
- **Files:** `broker-connection-card.tsx`

#### Slice P1-S2: Portfolio Stats Display

- Three stat boxes: Total Equity, Day Trade Buying Power, Realized P&L (daily)
- JetBrains Mono for values, emerald for positive, rose for negative
- Sync status pill with "Xm ago" timing
- **Files:** `broker-tab.tsx` (inline stats section)

#### Slice P1-S3: BrokerHeaderChip

- Add to `spx-header.tsx` next to Health/Feed chips
- Shows: connection dot (emerald pulse if connected), "Sandbox" or "Live" label, mode indicator
- Clicking opens settings sheet to Broker tab
- **Files:** `broker-header-chip.tsx`, `spx-header.tsx`

---

### Phase 2: Execution Mode (3 slices)

**Goal:** Implement the three-way toggle and Manual mode confirmation modal.

#### Slice P2-S1: ExecutionModeToggle

- Three-segment switcher: Off (gray), Manual (champagne), Auto (emerald)
- Visual indicators: 8px colored dot per mode
- Mode behavior descriptions below toggle
- Calls `PATCH /api/broker/tradier/mode` on change
- Auto mode requires confirmation modal before activating
- **Files:** `execution-mode-toggle.tsx`
- **API:** `app/api/broker/tradier/mode/route.ts`
- **Gate:** Toggle renders all 3 states, mode persists via API, tsc clean

#### Slice P2-S2: ManualExecutionModal

- Modal surfaces when execution mode is Manual and a setup triggers
- Displays: OCC symbol, direction, strategy, risk sizing breakdown, resolved quantity, limit price
- Two CTAs: **Execute** (emerald, 44px min-height) and **Skip** (ghost, 44px)
- Auto-dismiss after 60s with Skip as default
- Listens to `SPXBrokerFillEventDetail` custom events
- **Files:** `manual-execution-modal.tsx`
- **Gate:** Modal renders with mock data, Execute/Skip dispatch correct actions, tsc clean

#### Slice P2-S3: KillSwitchButton

- Danger-styled button (rose background, desaturated)
- Requires confirmation modal: "Cancel all open orders and disable execution?"
- Calls `POST /api/broker/tradier/kill`
- On success: flips mode to Off, shows toast confirmation
- **Files:** `kill-switch-button.tsx`
- **API:** `app/api/broker/tradier/kill/route.ts`

---

### Phase 3: Position Monitor (3 slices)

**Goal:** Surface broker positions, reconciliation, and fill quality.

#### Slice P3-S1: BrokerPositionMonitor

- Table columns: Contract (OCC), Qty, Entry Price, Mark Price, Unrealized P&L, Recon Status
- Recon badges: **Match** (emerald pill), **Drift** (amber pill)
- 0DTE flatten countdown pill in header
- Desktop: grid table. Mobile: card list (no horizontal scroll per brand rules)
- **Files:** `broker-position-monitor.tsx`
- **API:** `app/api/broker/tradier/positions/route.ts`

#### Slice P3-S2: BrokerFillQuality

- Four stat boxes: Total Fills, Broker Tradier Share %, Avg Entry Slippage (pts/bps), Proxy Share %
- Data from `summarizeExecutionFillSourceComposition()`
- JetBrains Mono for values, contextual colors (emerald for high broker share, amber for high proxy)
- **Files:** `broker-fill-quality.tsx`

#### Slice P3-S3: Position API Route

- `GET /api/broker/tradier/positions` — fetches `TradierClient.getPositions()` with recon status
- Joins against `ai_coach_positions` for Match/Drift determination
- Returns: position list + recon summary + flatten countdown minutes
- **Files:** `app/api/broker/tradier/positions/route.ts`

---

### Phase 4: Settings and Safety (2 slices)

**Goal:** Settings controls, safety toggles, and integration polish.

#### Slice P4-S1: BrokerSafetyControls

- Toggle rows: Sync Enabled, PDT Buying Power Alert, 0DTE Auto-Flatten, Confirm Before Send
- Read-only displays: Flatten Window (5 min), `sell_to_open` Guard (Enforced), `buildTradierMarketExitOrder` (Terminal exits)
- Environment switch: sandbox to live (with confirmation modal)
- Sizing parameter display: Risk %, DTBP Utilization, Entry Limit Offset, T1 Scale %
- **Files:** `broker-safety-controls.tsx`

#### Slice P4-S2: Integration Polish

- Wire all components into `broker-tab.tsx` with proper loading/error states
- Pulsing Logo skeleton pattern for initial load (per brand guidelines)
- Error boundaries with graceful fallback
- Responsive breakpoint testing (mobile stacking, 44px targets)
- Verify no `#D4AF37` gold hex anywhere in new code
- **Files:** All new components
- **Gate:** Full build clean, `tsc --noEmit`, eslint, visual review

---

## 7. Quality Matrix

### 7.1 Unit Tests

- `useTradierBroker` hook: status derivation, mode mapping, polling interval
- `ExecutionModeToggle`: renders all 3 states, fires correct mode on click
- `ManualExecutionModal`: renders sizing data, auto-dismiss timer, Execute/Skip actions
- `KillSwitchButton`: confirmation modal, API call, mode reset
- `BrokerPositionMonitor`: renders positions, Match/Drift badge logic

### 7.2 Integration Tests

- `PATCH /api/broker/tradier/mode`: validates mode enum, updates metadata, returns new state
- `POST /api/broker/tradier/kill`: cancels orders, deactivates credentials, returns confirmation
- `GET /api/broker/tradier/positions`: returns positions with recon status

### 7.3 E2E Critical Flows

- Settings sheet opens to Broker tab when navigated
- Execution mode toggle persists across page refresh
- Manual mode shows confirmation modal on mock setup trigger
- Kill switch cancels and resets to Off mode
- Header chip reflects current broker state

### 7.4 Visual/Brand Checks

- No `#D4AF37` gold hex in any new file
- All cards use `glass-card-heavy` pattern
- All interactive elements meet 44px minimum touch target
- Mobile layout stacks correctly below `md` breakpoint
- Playfair Display headings, Inter body, JetBrains Mono data

---

## 8. Validation Gates

### 8.1 Per-Slice Gates

- `pnpm exec eslint <touched files>` — zero errors
- `pnpm exec tsc --noEmit` — zero type errors
- `pnpm vitest run <targeted tests>` — all pass

### 8.2 Release Gates

- `pnpm exec eslint .` — full project clean
- `pnpm exec tsc --noEmit` — full project clean
- `pnpm run build` — production build succeeds
- `pnpm vitest run` — all tests pass

### 8.3 Runtime Requirement

All release evidence must be validated under **Node >= 22** (project standard).

---

## 9. Acceptance Criteria (Production Ready)

1. "Broker" tab renders in SPX Settings Sheet as a sibling to "Optimizer" tab.
2. Three-way execution mode toggle (Off/Manual/Auto) persists selection via API.
3. Manual mode surfaces confirmation modal with sizing data on setup trigger.
4. Auto mode activates only after explicit user confirmation.
5. Kill switch cancels all open orders and resets to Off mode.
6. Connection status card shows: state, account masked, sandbox/live, token expiry, sync timing.
7. Portfolio stats display equity, DTBP, and realized P&L with 15s polling.
8. Position monitor shows broker positions with Match/Drift reconciliation badges.
9. Fill quality stats show broker share %, avg slippage, proxy share.
10. SPX header chip shows connection state, environment, and execution mode.
11. All UI follows Emerald Standard: onyx bg, emerald primary, champagne accents, `glass-card-heavy`.
12. Mobile layout stacks correctly, 44px touch targets, card list for positions.
13. Full build, lint, and type check pass under Node >= 22.
14. No `#D4AF37` gold hex in any new or modified file.

---

## 10. Rollback Strategy

1. The Broker tab is additive-only. Removing it requires deleting the tab entry in `spx-settings-sheet.tsx` and the `BrokerHeaderChip` import in `spx-header.tsx`.
2. Backend API routes are new additions. Removing them has no impact on existing functionality.
3. No database migrations in this spec. All tables and schemas are pre-existing.
4. The execution engine continues to function independently of the UI. If the UI is rolled back, auto-execute behavior reverts to its pre-UI state (metadata-driven).
5. Feature flag approach: the Broker tab can be gated behind a feature flag (e.g., `BROKER_UI_ENABLED`) for staged rollout.

---

## 11. Canonical File Manifest

### 11.1 New Files (13)

| File | Type | Phase |
|---|---|---|
| `components/spx-command-center/broker-tab.tsx` | Component | P0-S1 |
| `hooks/useTradierBroker.ts` | Hook | P0-S2 |
| `components/spx-command-center/broker-connection-card.tsx` | Component | P1-S1 |
| `components/spx-command-center/broker-header-chip.tsx` | Component | P1-S3 |
| `components/spx-command-center/execution-mode-toggle.tsx` | Component | P2-S1 |
| `app/api/broker/tradier/mode/route.ts` | API Route | P2-S1 |
| `components/spx-command-center/manual-execution-modal.tsx` | Component | P2-S2 |
| `components/spx-command-center/kill-switch-button.tsx` | Component | P2-S3 |
| `app/api/broker/tradier/kill/route.ts` | API Route | P2-S3 |
| `components/spx-command-center/broker-position-monitor.tsx` | Component | P3-S1 |
| `app/api/broker/tradier/positions/route.ts` | API Route | P3-S3 |
| `components/spx-command-center/broker-fill-quality.tsx` | Component | P3-S2 |
| `components/spx-command-center/broker-safety-controls.tsx` | Component | P4-S1 |

### 11.2 Modified Files (2)

| File | Change | Phase |
|---|---|---|
| `components/spx-command-center/spx-settings-sheet.tsx` | Add Broker tab to tab bar, render `BrokerTab` | P0-S1 |
| `components/spx-command-center/spx-header.tsx` | Add `BrokerHeaderChip` import and render | P1-S3 |

### 11.3 Backend Reference Files (Read-Only)

| File | Purpose |
|---|---|
| `backend/src/services/broker/tradier/client.ts` | `TradierClient`: balances, positions, placeOrder, cancelOrder |
| `backend/src/services/broker/tradier/executionEngine.ts` | Auto-execution lifecycle: entry → T1 → exit |
| `backend/src/services/broker/tradier/orderRouter.ts` | Order builders: entry, scale, market exit, runner stop |
| `backend/src/services/broker/tradier/credentials.ts` | AES-256-GCM encryption/decryption, runtime enablement |
| `backend/src/services/broker/tradier/occFormatter.ts` | OCC symbol formatting, SPX → SPXW normalization |
| `backend/src/services/positions/tradierFlatten.ts` | 0DTE late-day auto-flatten service |
| `backend/src/services/spx/executionReconciliation.ts` | Fill recording, slippage calc, source composition |
| `backend/src/routes/spx.ts` | Express routes: `/broker/tradier/status`, credentials, test-balance |

---

## 12. Execution Checklist

- [ ] Phase 0: Broker tab shell added to settings sheet
- [ ] Phase 0: `useTradierBroker` hook created and typed
- [ ] Phase 1: Connection card renders broker status
- [ ] Phase 1: Portfolio stats display equity/DTBP/P&L
- [ ] Phase 1: Header chip shows connection and mode
- [ ] Phase 2: Three-way execution mode toggle functional
- [ ] Phase 2: Manual mode confirmation modal surfaces
- [ ] Phase 2: Kill switch cancels and resets
- [ ] Phase 3: Position monitor renders with recon badges
- [ ] Phase 3: Fill quality stats display
- [ ] Phase 3: Positions API route returns recon data
- [ ] Phase 4: Safety controls and toggles wired
- [ ] Phase 4: Integration polish, loading states, mobile layout
- [ ] Release: `eslint .` clean
- [ ] Release: `tsc --noEmit` clean
- [ ] Release: `pnpm run build` succeeds
- [ ] Release: `vitest run` passes
- [ ] Release: No `#D4AF37` gold in any file
- [ ] Release: All 44px touch targets verified
- [ ] Release: Mobile stacking confirmed

---

## 13. Appendix: Environment Variables Reference

All environment variables relevant to the Tradier broker integration. These are backend-only; the frontend consumes them via API responses.

| Variable | Default | Purpose |
|---|---|---|
| `TRADIER_EXECUTION_ENABLED` | `false` | Master execution feature flag |
| `TRADIER_EXECUTION_PRODUCTION_ENABLED` | — | Production gate (required for live) |
| `TRADIER_EXECUTION_SANDBOX` | `true` | Default to sandbox mode |
| `TRADIER_EXECUTION_RISK_PCT` | `0.02` | Risk per trade as % of equity |
| `TRADIER_EXECUTION_DTBP_UTILIZATION` | `0.90` | DTBP utilization cap |
| `TRADIER_EXECUTION_ENTRY_LIMIT_OFFSET` | `0.2` | Ask + offset for limit price |
| `TRADIER_EXECUTION_T1_SCALE_PCT` | `0.65` | T1 scale percentage |
| `TRADIER_EXECUTION_ALLOWED_USER_IDS` | — | CSV allow-list for execution |
| `TRADIER_PORTFOLIO_SYNC_ENABLED` | `false` | Portfolio sync feature flag |
| `TRADIER_FORCE_FLATTEN_ENABLED` | `false` | 0DTE late-day flatten flag |
| `TRADIER_FORCE_FLATTEN_MINUTES_BEFORE_CLOSE` | `5` | Minutes before close to flatten |
| `TRADIER_PDT_DTBP_ALERT_THRESHOLD` | `25000` | PDT alert threshold ($) |
| `TRADIER_CREDENTIAL_ENVELOPE_KEY_B64` | — | 32-byte AES-256-GCM key (base64) |

---

*— END OF SPEC —*
