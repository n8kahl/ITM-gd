# TradeITM Brand & Design Guidelines
**Version:** 2.0 (Emerald Standard)
**Philosophy:** "Private Equity Terminal" — Quiet Luxury, High Density, Professional Stability.

## 1. Core Color Palette
We have moved away from "Crypto Gold" to "Institutional Emerald".

### Primary Colors
* **Emerald Elite (Primary Action):** `#10B981` (Tailwind: `text-emerald-500`)
    * *Usage:* Primary buttons, active states, positive data values, logos.
* **Deep Emerald (Backgrounds/Gradients):** `#064E3B` to `#047857`
    * *Usage:* Subtle background gradients, button hover states.

### Secondary & Accents
* **Champagne (Highlight/Accent):** `#F3E5AB` (Tailwind: custom `text-champagne`)
    * *Usage:* Thin borders, text highlights, special badges, "premium" indicators.
    * *Note:* Use sparingly. It replaces the old yellow/gold but is softer.
* **Onyx (Background):** `#0A0A0B`
    * *Usage:* Main page background. Never use pure black (`#000000`) for large areas; use this rich charcoal.

### Functional Colors
* **Success/Win:** `#10B981` (Emerald)
* **Error/Loss:** `#EF4444` (Red-500) — *Keep desaturated, not neon.*
* **Text Muted:** `rgba(255,255,255,0.6)`

---

## 2. Typography
* **Headings:** `Playfair Display` (Serif). Used for page titles and major stats. Adds the "Luxury" feel.
* **Body:** `Inter` (Sans). Clean, legible, high readability for dense text.
* **Data/Terminal:** `Geist Mono`. Used for prices, dates, account IDs, and P&L figures.

## 3. UI Patterns & Components

### Glassmorphism ("The Terminal Look")
Do not use flat colors for cards. Use the "Heavy Glass" utility.
* **Class:** `glass-card-heavy`
* **Style:** `bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5`

### Borders
* **Standard:** `border-white/5`
* **Active/Selected:** `border-emerald-500/50`
* **Premium/Highlight:** `border-champagne/30` (Holographic effect)

### Branding
* **Logo:** Always use `public/hero-logo.png` (transparent canonical wordmark).
* **Iconography:** Lucide React icons. Stroke width `1.5` (thin/elegant).
* **Prohibited:** Do not use the generic `Sparkles` icon as a logo substitute.

## 4. Mobile Layout Rules
* **Navigation:** Bottom sheet or Hamburger menu. No top-heavy nav bars.
* **Data Tables:** Convert to "Card Lists" on mobile. Do not allow horizontal scrolling for core data.
* **Touch Targets:** Buttons must be at least 44px height.

---

## 5. "The Ban List" (Deprecated Styles)
* ❌ **Hex `#D4AF37` (Old Gold):** Strictly forbidden. Replace with Emerald or Champagne.
* ❌ **Yellow Spinners:** Loading states must use the pulsing Logo or Emerald spinner.
* ❌ **Pure White Backgrounds:** Never.
* ❌ **Skeuomorphic Buttons:** No 3D bevels. Use flat + subtle glow.

## 6. Academy Design Patterns
* **Lesson Chunks:** Each chunk card uses `glass-card-heavy` with emerald left border for the active chunk.
* **Quick Check Cards:** Emerald border, option buttons with 44px minimum height, and clear green/red feedback states.
* **Mastery Arc:** Radar chart uses emerald fill at 30% opacity and champagne accent for top scores.
* **Review Cards:** Flip-card style pattern with question on front and answer on back.
* **Progress Dots:** 8px circles, emerald for completed, white/10 for remaining, and emerald ring for current.

## 7. Social Card Templates
* **Approved Trade Card Templates:** `dark-elite`, `emerald-gradient`, `champagne-premium`, `minimal`, `story`.
* **Required Visuals:** Symbol, direction, P&L, P&L %, entry/exit price, member identity.
* **P&L Color Rules:** Positive is emerald (`#10B981`), negative is red (`#EF4444`).
* **Tier Accents:** Core (emerald), Pro (blue), Executive (champagne).
* **Template Usage:**
  - `dark-elite`: default feed and web share.
  - `emerald-gradient`: top-performing wins and highlight shares.
  - `champagne-premium`: milestone and premium member stories.
  - `minimal`: compressed or dense feed contexts.
  - `story`: vertical social story format.
