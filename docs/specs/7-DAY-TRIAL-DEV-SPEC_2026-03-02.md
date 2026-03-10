# 7-Day Trial Implementation — Development Specification

**Date:** 2026-03-02
**Status:** Ready for Implementation
**Priority:** P1
**Visual Reference:** `homepage-trial-mockup.html` (in project root)

---

## 1. Objective

Add a **$49.99 / 7-Day Trial** option for the Core Sniper (SPX) package to the Trade ITM homepage. The trial is displayed in 3 locations, uses a distinct **blue color palette** to differentiate from the existing emerald/champagne/platinum tiers, and is only visible to unauthenticated (new) visitors.

**Checkout Link:** `https://whop.com/checkout/plan_NeOYhHAwtWczQ`

---

## 2. Color Tokens

Add the following CSS custom properties to `app/globals.css` under the existing `:root` / design token block:

```css
--trial-blue: #3B82F6;
--trial-blue-deep: #1D4ED8;
--trial-blue-light: #60A5FA;
```

Also add corresponding Tailwind config extensions if needed in `tailwind.config.ts`:

```js
colors: {
  'trial-blue': {
    DEFAULT: '#3B82F6',
    deep: '#1D4ED8',
    light: '#60A5FA',
  }
}
```

---

## 3. Placements (3 Total)

### Placement 1: Navigation CTA Button

**File:** `components/ui/floating-navbar.tsx`

**Current State (lines 82-108):**
The desktop CTA area contains a single "Join Now" button that links to `#pricing`.

**Change:**
Add a "7-Day Trial $49.99" button to the LEFT of the existing "Join Now" button in the desktop nav. On mobile, add it as the last item in the mobile menu dropdown.

**Desktop implementation:**

```tsx
{/* Desktop CTA Buttons */}
<div className="hidden md:flex items-center gap-3">
  {/* NEW: Trial CTA — only show to unauthenticated visitors */}
  {!isAuthenticated && (
    <a
      href="https://whop.com/checkout/plan_NeOYhHAwtWczQ"
      className={cn(
        "px-4 py-2 rounded-sm text-sm font-semibold tracking-wide",
        "bg-gradient-to-r from-trial-blue to-trial-blue-deep text-white",
        "hover:shadow-[0_4px_20px_rgba(59,130,246,0.4)] hover:-translate-y-[1px]",
        "transition-all duration-300"
      )}
      onClick={() => Analytics.trackCTAClick('Nav Trial CTA')}
    >
      7-Day Trial $49.99
    </a>
  )}

  {/* Existing Join Now CTA */}
  <Button asChild variant="luxury" size="default" className="rounded-sm">
    <a href="#pricing">Join Now</a>
  </Button>
</div>
```

**Mobile menu implementation:**
Add the trial CTA as a prominent button at the bottom of the mobile menu (after the nav links, before the close of the mobile panel):

```tsx
{!isAuthenticated && (
  <a
    href="https://whop.com/checkout/plan_NeOYhHAwtWczQ"
    onClick={() => {
      setIsMobileMenuOpen(false);
      Analytics.trackCTAClick('Mobile Nav Trial CTA');
    }}
    className={cn(
      "flex items-center justify-center h-12 px-4 mx-2 mt-2",
      "bg-gradient-to-r from-trial-blue to-trial-blue-deep text-white",
      "text-sm font-semibold tracking-wide rounded-sm",
      "transition-all duration-300"
    )}
  >
    7-Day Trial — $49.99
  </a>
)}
```

**Auth check:** Use Supabase session. Add to the component:

```tsx
import { createClient } from "@/lib/supabase/client";

// Inside FloatingNavbar():
const [isAuthenticated, setIsAuthenticated] = useState(false);

useEffect(() => {
  const supabase = createClient();
  supabase.auth.getSession().then(({ data: { session } }) => {
    setIsAuthenticated(!!session);
  });
}, []);
```

---

### Placement 2: Trial Pricing Card

**Files:**
- `components/ui/pricing-card.tsx` — extend with `trial` tier
- `app/page.tsx` — add trial card to pricing grid

#### 2a. Extend PricingCard Component

**File:** `components/ui/pricing-card.tsx`

**Step 1 — Update the `tier` type (line 35):**

```tsx
// FROM:
tier: "core" | "pro" | "executive";

// TO:
tier: "trial" | "core" | "pro" | "executive";
```

**Step 2 — Add trial colors to `tierColors` object (inside `TierTitleCard`, around line 45):**

```tsx
trial: {
  // Signal Blue - Trial & Discovery
  gradient: "from-[#1D4ED8] via-[#3B82F6] to-[#60A5FA]",
  accent: "#3B82F6",
  glow: "rgba(59, 130, 246, 0.3)",
  icon: "★",
},
```

**Step 3 — Add trial styles to `tierStyles` object** (search for `tierStyles` in the same file — this handles the card body, price color, check color, CTA button):

```tsx
trial: {
  priceColor: "text-trial-blue",
  checkColor: "text-trial-blue",
  ctaGradient: "from-trial-blue to-trial-blue-deep",
  ctaText: "text-white",
  ctaShadow: "shadow-[0_8px_24px_rgba(59,130,246,0.3)]",
  borderHover: "hover:border-trial-blue/30",
  glowHover: "hover:shadow-[0_20px_60px_rgba(59,130,246,0.15)]",
},
```

**Step 4 — Add corner accent marks for trial card:**
The trial card should have subtle blue corner accents (pseudo-elements or absolute-positioned divs). Reference the mockup's `.price-card.trial::before` / `::after` pattern:

```tsx
{tier === "trial" && (
  <>
    <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-trial-blue/40 rounded-tl-sm z-10" />
    <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-trial-blue/40 rounded-br-sm z-10" />
  </>
)}
```

**Step 5 — Add "NEW" badge for trial tier** in the TierTitleCard:

```tsx
{tier === "trial" && (
  <span className="inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase bg-white/15 text-white border border-white/20 backdrop-blur-sm">
    NEW
  </span>
)}
```

#### 2b. Add Trial Card to Homepage Grid

**File:** `app/page.tsx`

**Step 1 — Change grid from 3-col to 4-col (line 381):**

```tsx
// FROM:
<StaggerContainer className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch" staggerDelay={0.15}>

// TO:
<StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 items-stretch" staggerDelay={0.15}>
```

**Step 2 — Insert Trial Card as the FIRST card** (before Core Sniper, ~line 383):

```tsx
{/* 7-Day Trial Card — Only for unauthenticated visitors */}
{!isAuthenticated && (
  <StaggerItem>
    <PricingCard
      name="7-Day Trial"
      price="$49.99"
      period="/ 7 days"
      description="Core Sniper Access"
      features={[
        "🎯 Full Core Sniper SPX Alerts",
        "👀 Morning Watchlist Access",
        "🧠 Educational Commentary",
        "💬 Community Access",
        "📊 81% Win Rate Track Record",
      ]}
      whopLink="https://whop.com/checkout/plan_NeOYhHAwtWczQ"
      tier="trial"
      tagline="Limited Time"
      isYearly={false}
    />
  </StaggerItem>
)}
```

**Step 3 — Conditional grid adjustment:**
When trial is hidden (authenticated user), revert to 3-column:

```tsx
<StaggerContainer
  className={cn(
    "grid gap-6 lg:gap-8 items-stretch",
    isAuthenticated ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"
  )}
  staggerDelay={0.15}
>
```

**Step 4 — Add auth state to `app/page.tsx`:**

```tsx
const [isAuthenticated, setIsAuthenticated] = useState(false);

useEffect(() => {
  const supabase = createClient();
  supabase.auth.getSession().then(({ data: { session } }) => {
    setIsAuthenticated(!!session);
  });
}, []);
```

Import `createClient` from `@/lib/supabase/client` and `cn` from `@/lib/utils`.

---

### Placement 3: Trial CTA Button in Final CTA Section

**File:** `app/page.tsx` (lines ~692-734, the "Stop Missing Winning Trades" section)

**Current State:**
A single "Choose Your Plan →" button links to `#pricing`.

**Change:**
Add a trial button next to the main CTA with an "or" separator. Only visible to unauthenticated visitors.

**Replace the current Button block (lines 719-726) with:**

```tsx
<div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
  <Button
    asChild
    size="xl"
    variant="luxury-champagne"
    className="rounded-sm min-w-[220px]"
  >
    <a href="#pricing">Choose Your Plan →</a>
  </Button>

  {!isAuthenticated && (
    <>
      <span className="text-sm text-muted-foreground/40 font-medium">or</span>
      <a
        href="https://whop.com/checkout/plan_NeOYhHAwtWczQ"
        className={cn(
          "inline-flex items-center justify-center min-w-[220px]",
          "px-8 py-4 rounded-sm text-sm font-semibold tracking-wider uppercase",
          "bg-transparent border border-trial-blue text-trial-blue-light",
          "hover:bg-trial-blue/10 hover:shadow-[0_0_24px_rgba(59,130,246,0.2)]",
          "transition-all duration-300"
        )}
        onClick={() => Analytics.trackCTAClick('Final CTA Trial Button')}
      >
        Try 7 Days for $49.99 →
      </a>
    </>
  )}
</div>
```

---

## 4. Authentication Gating

**Requirement:** All 3 trial placements are hidden for authenticated/existing members.

**Approach:** Use Supabase client-side session check. The auth check happens in two components:

| Component | Auth State Variable |
|-----------|-------------------|
| `floating-navbar.tsx` | Local `isAuthenticated` state |
| `app/page.tsx` | Local `isAuthenticated` state |

**Implementation pattern (same in both files):**

```tsx
import { createClient } from "@/lib/supabase/client";

const [isAuthenticated, setIsAuthenticated] = useState(false);

useEffect(() => {
  const supabase = createClient();
  supabase.auth.getSession().then(({ data: { session } }) => {
    setIsAuthenticated(!!session);
  });
}, []);
```

**Behavior:**
- Default state: `false` (show trial elements on initial render — avoids layout shift for new visitors, who are the primary audience)
- After auth check: if session exists, hide trial elements
- SSR: Trial elements render by default (new visitors see them immediately)

---

## 5. Analytics Events

Track all trial-related clicks for conversion measurement:

| Event | Location | Tracking Call |
|-------|----------|--------------|
| `Nav Trial CTA` | Floating navbar button | `Analytics.trackCTAClick('Nav Trial CTA')` |
| `Mobile Nav Trial CTA` | Mobile menu button | `Analytics.trackCTAClick('Mobile Nav Trial CTA')` |
| `Trial Pricing Card` | Pricing card CTA | Handled by existing PricingCard analytics |
| `Final CTA Trial Button` | Bottom CTA section | `Analytics.trackCTAClick('Final CTA Trial Button')` |

---

## 6. Responsive Behavior

| Breakpoint | Nav CTA | Pricing Grid | Final CTA |
|------------|---------|-------------|-----------|
| Desktop (lg+) | Visible inline next to "Join Now" | 4-column grid (trial + 3 tiers) | Side-by-side buttons |
| Tablet (md) | Visible inline next to "Join Now" | 2-column grid (2x2) | Side-by-side buttons |
| Mobile (<md) | In mobile menu as full-width button | Single column stack | Stacked vertically |

**Grid breakpoints for pricing (with trial visible):**
```
lg:grid-cols-4  →  Trial | Core | Pro | Executive
md:grid-cols-2  →  Trial | Core
                    Pro   | Executive
sm:grid-cols-1  →  Trial
                    Core
                    Pro
                    Executive
```

**Grid breakpoints for pricing (authenticated, no trial):**
```
md:grid-cols-3  →  Core | Pro | Executive
sm:grid-cols-1  →  Core → Pro → Executive
```

---

## 7. File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `app/globals.css` | **Edit** | Add `--trial-blue`, `--trial-blue-deep`, `--trial-blue-light` CSS variables |
| `tailwind.config.ts` | **Edit** | Add `trial-blue` color tokens to theme extend |
| `components/ui/floating-navbar.tsx` | **Edit** | Add trial CTA button (desktop + mobile), add auth check |
| `components/ui/pricing-card.tsx` | **Edit** | Extend `tier` union type with `"trial"`, add trial colors/styles/badge/corner accents |
| `app/page.tsx` | **Edit** | Add trial pricing card to grid, add trial button to final CTA, add auth check, conditional grid cols |

**No new files required.** All changes are modifications to existing components.

---

## 8. Trial Card Content

```
Header Label:    "Limited Time"
Card Name:       "7-Day Trial"
Badge:           "NEW"
Subtitle:        "Core Sniper Access"
Price:           "$49.99"
Period:          "/ 7 days"
Features:
  ✓ Full Core Sniper SPX Alerts
  ✓ Morning Watchlist Access
  ✓ Educational Commentary
  ✓ Community Access
  ✓ 81% Win Rate Track Record
CTA Button:      "Start Trial"
CTA Link:        https://whop.com/checkout/plan_NeOYhHAwtWczQ
Disclaimer:      "No commitment. Cancel anytime." (optional, below button)
```

---

## 9. Visual Design Reference

The approved mockup is located at: **`homepage-trial-mockup.html`** (project root).

Key visual characteristics of the trial card:
- **Blue gradient header** matching `from-[#1D4ED8] to-[#3B82F6]`
- **Blue price text** instead of emerald
- **Blue checkmarks** instead of emerald
- **Blue gradient CTA button** with white text and blue box-shadow
- **Corner accent marks** (top-left, bottom-right) in blue at 40% opacity
- **"NEW" badge** in the header (white text, white/15 background, white/20 border)

The trial card sits in position 1 (leftmost) of the 4-column pricing grid.

---

## 10. Out of Scope

- No changes to Supabase/database schema
- No changes to WHOP webhook handling (existing webhook already handles this plan)
- No changes to the promo banner component
- No hero banner placement
- No floating CTA bar
- No performance proof card section
- No changes to existing tier pricing or styling

---

## 11. Acceptance Criteria

1. Unauthenticated visitors see the trial CTA in all 3 placements
2. Authenticated members see NO trial elements (grid reverts to 3-col)
3. All trial CTAs link to `https://whop.com/checkout/plan_NeOYhHAwtWczQ`
4. Trial elements use blue color palette (`#3B82F6` / `#1D4ED8` / `#60A5FA`), NOT emerald
5. Pricing grid adjusts responsively between 4-col (with trial) and 3-col (without)
6. All trial clicks fire Analytics tracking events
7. No layout shift on initial page load for unauthenticated visitors
8. Mobile nav includes trial CTA in dropdown menu
9. Visual output matches approved mockup (`homepage-trial-mockup.html`)

---

## 12. Validation Commands

```bash
# Type check
pnpm exec tsc --noEmit

# Lint touched files
pnpm exec eslint app/page.tsx components/ui/floating-navbar.tsx components/ui/pricing-card.tsx app/globals.css

# Build
pnpm run build

# E2E (if applicable)
pnpm exec playwright test e2e/ --project=chromium --workers=1
```

---

## 13. Rollback Plan

All changes are purely presentational and gated behind auth state. To rollback:
1. Remove the trial card from the pricing grid in `app/page.tsx`
2. Remove the trial CTA from `floating-navbar.tsx`
3. Remove the trial button from the final CTA section
4. Revert grid to `md:grid-cols-3`
5. CSS tokens can remain (no side effects)

No database changes, no API changes, no backend changes required.
