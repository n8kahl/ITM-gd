# Navigation & Page Loading E2E Test Suite — Evidence Report

> **Date:** 2026-02-28
> **Author:** Claude (Autonomous QA Agent)
> **Status:** Session A Complete (Authored) — Session B Complete (Validated)

---

## 1. Objective

Validate production-grade web page navigation and user experience across the entire TradeITM member-facing application, covering:

- Initial cold page loads for all 7 member routes
- Authentication redirect enforcement
- Page refresh stability (no blank screens or crashes)
- Fast tab-to-tab navigation (sidebar, bottom-nav, direct URL)
- Browser history (back/forward) correctness
- Deep link support for every member route
- Mobile bottom-nav navigation
- Performance budget enforcement (< 8 second load per route)

---

## 2. Test Inventory

### Files Created

| File | Location | Purpose |
|------|----------|---------|
| `navigation-test-helpers.ts` | `e2e/specs/members/` | Shared mocks, auth bypass, metrics collection, assertion helpers |
| `app-loading.spec.ts` | `e2e/specs/members/` | Cold loads, auth redirects, skeleton/shell, refresh stability |
| `fast-tab-navigation.spec.ts` | `e2e/specs/members/` | Sidebar nav, rapid switching, back/forward, mobile nav, deep links, perf budget |

### Test Count by Category

| Category | Spec File | Tests | Priority |
|----------|-----------|-------|----------|
| Auth Redirect | `app-loading.spec.ts` | 3 | Critical |
| Cold Load (all 7 routes) | `app-loading.spec.ts` | 8 (7 routes + summary) | Critical |
| Shell & Skeleton | `app-loading.spec.ts` | 3 | High |
| Page Refresh Stability | `app-loading.spec.ts` | 4 | Critical |
| Sequential Sidebar Nav | `fast-tab-navigation.spec.ts` | 1 (covers all tabs) | Critical |
| Rapid Tab Switching | `fast-tab-navigation.spec.ts` | 2 | High |
| Browser History | `fast-tab-navigation.spec.ts` | 3 | High |
| Mobile Bottom-Nav | `fast-tab-navigation.spec.ts` | 2 | High |
| Deep Link Validation | `fast-tab-navigation.spec.ts` | 6 | Critical |
| Performance Budget | `fast-tab-navigation.spec.ts` | 1 (covers all routes) | High |

**Total: 33 tests across 2 spec files**

---

## 3. Routes Under Test

| Route | Tab ID | Landmark Selector | Tier |
|-------|--------|-------------------|------|
| `/members` | dashboard | `[aria-label="Dashboard welcome"]` | core |
| `/members/journal` | journal | Text: "Trade Journal" | core |
| `/members/ai-coach` | ai-coach | `[data-testid="ai-coach-layout"]` | core |
| `/members/academy` | academy | `[data-testid="academy-dashboard"]` | core |
| `/members/profile` | profile | `[data-testid="settings-button"]` | core |
| `/members/spx-command-center` | spx-command-center | `[data-testid="spx-command-center"]` | pro |
| `/members/social` | social | `[data-testid="social-feed"]` | core |

---

## 4. Mock Infrastructure

### Shell Mocks (shared across all tests)
- `GET /api/config/roles` — Empty roles config
- `GET /api/config/tabs` — All 7 tabs active with correct paths
- `GET /api/members/profile` — Pro-tier E2E test user

### Feature Page Mocks (lightweight stubs for load validation)
- Dashboard: stats, equity-curve, calendar
- Journal: entries, analytics
- Market: indices, status, analytics, movers, splits
- AI Coach: morning-brief, sessions, chat
- Academy: modules, mastery
- Profile: transcript, affiliate
- SPX: command center data
- Social: feed, leaderboard
- Catch-all: `GET /api/**` returns `{ success: true, data: {} }`

### Performance Metrics Collection
The `collectNavigationMetrics()` helper captures:
- DOM content loaded time
- First Contentful Paint (via Performance API)
- Total load time
- Landmark visibility time

---

## 5. Test Patterns & Assertions

### Cold Load Validation
For each of the 7 member routes:
1. Navigate to route with `?e2eBypassAuth=1`
2. Assert HTTP status < 400
3. Wait for `load` + bounded best-effort `networkidle`
4. Verify body has non-empty text content
5. Collect performance metrics
6. Assert DOM load < 10 seconds

### Auth Redirect Validation
For `/members`, `/members/journal`, `/members/ai-coach`:
1. Navigate WITHOUT auth bypass
2. Assert redirect to `/login`
3. Verify URL contains `/login`

### Refresh Stability
1. Load page → verify landmark visible
2. `page.reload()` → verify content survives
3. Rapid sequential refresh (3x) → verify no crash

### Fast Tab Navigation
1. Start at dashboard with sidebar visible
2. Click each sidebar link in sequence
3. Assert URL changes and page has content
4. Measure transition time per tab
5. Log performance table

### Rapid Switching Stress Test
1. Navigate 5 tabs in rapid sequence via URL
2. Alternate between 2 tabs 5 times rapidly
3. Verify final page is functional after stress

### Browser History
1. Navigate Dashboard → Journal → Profile
2. `goBack()` twice → assert each URL
3. `goForward()` → assert restored URL
4. Verify content present at each step

### Mobile Navigation
1. Set viewport to 375×812
2. Verify bottom-nav is visible
3. Click nav links → verify navigation works

### Performance Budget
- All 7 routes must load within 8 seconds (DOM + network idle)
- Results logged as table for evidence

---

## 6. Validation Results (Session B)

### Step 1 — Type Check ✅
```bash
pnpm exec tsc --noEmit
```

### Step 2 — Lint ✅
```bash
pnpm exec eslint e2e/specs/members/navigation-test-helpers.ts e2e/specs/members/app-loading.spec.ts e2e/specs/members/fast-tab-navigation.spec.ts
```

### Step 3 — Run Tests ✅
```bash
pnpm exec playwright test e2e/specs/members/app-loading.spec.ts e2e/specs/members/fast-tab-navigation.spec.ts --project=chromium --workers=1
```
Result: **33/33 passed** on 2026-02-28.

### Step 4 — Stabilization ✅
Applied bounded `networkidle` fallback, robust mobile bottom-nav selectors, and resilient sidebar tab link selection to avoid false failures from persistent background connections and transient DOM re-renders.

### Step 5 — Full Green Run ✅
All 33 tests passed with no skips.

---

## 7. Risk Register

| Risk | Mitigation |
|------|------------|
| Landmark selectors may not match actual DOM | Fallback assertions check body content; selectors hardened for real layout structure |
| SPX and AI Coach pages have complex loading states | Generous timeouts (15s landmark, 60s test) and bounded `networkidle` fallback |
| Mobile bottom-nav selector may vary | Uses `.or()` pattern for multiple selector strategies |
| Performance budget too strict for CI | 8s budget is generous; can adjust if CI machines are slower |
| External market-data service noise in logs | Tests rely on mocked member-surface APIs and continue to pass despite provider warnings |

---

## 8. Coverage Map

```
                    Auth  Cold  Refresh  Sidebar  Rapid  History  Mobile  DeepLink  Perf
Dashboard            ✅    ✅     ✅       ✅      ✅      ✅       ✅      —         ✅
Journal              ✅    ✅     ✅       ✅      ✅      ✅       ✅      ✅        ✅
AI Coach             ✅    ✅     —        ✅      ✅      —        —       ✅        ✅
Academy              —     ✅     —        ✅      —       —        —       ✅        ✅
Profile              —     ✅     ✅       ✅      ✅      ✅       —       ✅        ✅
SPX Command Center   —     ✅     —        ✅      —       —        —       ✅        ✅
Social               —     ✅     —        ✅      —       —        —       ✅        ✅
```

**Total unique test scenarios: 33**
**Routes covered: 7/7 (100%)**
**Critical user journeys: Cold load, auth redirect, refresh, navigation, deep links**

---

## 9. Session Status

| Phase | Status |
|-------|--------|
| Session A — Plan & Author | ✅ Complete |
| Session B — Validate & Fix | ✅ Complete (33/33 passed) |
| Session C — Harden & Commit | ⏳ Pending |
