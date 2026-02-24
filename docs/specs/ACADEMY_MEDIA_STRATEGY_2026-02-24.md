# ACADEMY MEDIA STRATEGY 2026-02-24

**Document Type:** Media & Visual Identity Strategy
**Last Updated:** 2026-02-24
**Owned By:** AI Image & Media Strategist
**Status:** Final Specification
**Related Docs:** `docs/BRAND_GUIDELINES.md`, `components/academy/academy-media.ts`, `app/globals.css`

---

## EXECUTIVE SUMMARY

The TradeITM Academy requires a unified visual media strategy to deliver 200+ lesson images, 30+ module covers, 6 track progressions, 200+ inline illustrations, and 30+ achievement badges—all cohesively designed within "The Emerald Standard" dark luxury aesthetic.

This strategy establishes:
- AI image generation pipeline (DALL-E 3) with deterministic prompt templates
- Responsive lazy-loading component architecture with WebP + fallbacks
- Supabase Storage integration with CDN pattern
- Post-processing and color grading standards
- Cost estimation and batch generation workflow
- Accessibility and performance optimization

**Total Estimated Asset Volume:** 400+ images + 30+ SVG badges
**Primary AI Tool:** DALL-E 3 (for photorealistic financial/luxury content)
**Storage Strategy:** Supabase Storage with CloudFront CDN
**Brand Compliance:** 100% Emerald Standard (no legacy gold #D4AF37)

---

## 1. THE EMERALD STANDARD IN VISUAL MEDIA

### 1.1 Design Language Principles

The academy's media must embody:

- **Aesthetic:** Private Equity / Terminal / Quiet Luxury, dark mode only
- **Color Palette:**
  - **Emerald Elite:** `#10B981` (primary brand, accents)
  - **Emerald Deep:** `#064E3B` (dark backgrounds, depth)
  - **Champagne:** `#F5EDCC` (warm highlights, text accents)
  - **Onyx:** `#0A0A0B` (ultra-dark backgrounds)
  - **Ivory:** `#F5F5F0` (primary text)

- **Typography in Imagery:**
  - Headings: Playfair Display serif (luxury positioning)
  - Body: Inter sans (clarity, readability)
  - Terminal/Data: Geist Mono (financial precision)

- **Glassmorphism:**
  - Blur depth: 60px backdrop filter with saturate(120%) on card surfaces
  - Border: `rgba(255, 255, 255, 0.08)` subtle luminosity
  - Shadow: layered depth with inset highlights

- **Texture & Finish:**
  - Subtle noise overlay (opacity: 0.025) for premium paper feel
  - Subtle grid background on large assets (80px grid, 0.3 opacity)
  - Anti-aliased rendering for text in imagery

### 1.2 Forbidden Elements

- **NEVER use #D4AF37** (legacy gold) — refactor ALL existing gold accents to Champagne (#F5EDCC)
- Do not use bright neon greens or oversaturated colors
- Do not use light-mode color variants in hero imagery
- Do not include brand logotypes inside lesson hero images (logo is separate)
- Do not use low-quality stock photography or generic "trading" clichés

### 1.3 Accessibility in Visual Media

- All images must include descriptive alt text for screen readers
- Contrast ratio: text overlays must meet WCAG AA (4.5:1 for body, 3:1 for large text)
- Animated elements (GIFs, SVGs) must respect `prefers-reduced-motion`
- Color conveyers (charts, badges) must not rely on color alone for meaning

---

## 2. LESSON HERO IMAGES (~150+ images)

### 2.1 Specifications

| Property | Value |
|----------|-------|
| **Dimensions** | 1280 × 720px (16:9 aspect ratio) |
| **Format** | WebP primary, JPEG fallback |
| **Quality** | 85% for WebP, 90% for JPEG |
| **File Size Target** | 80–120 KB (WebP), 120–150 KB (JPEG) |
| **Delivery** | Responsive srcset: 640×360, 960×540, 1280×720 |
| **Lazy Loading** | LQIP (low-quality image placeholder) blur-up + color skeleton |
| **Color Profile** | sRGB, no embedded ICC profile (web-optimized) |

### 2.2 Visual Concept

Each lesson hero captures the **financial/trading essence of its topic** in a photorealistic, sophisticated style:

- **Composition:** Asymmetrical layout with emerald accent bars or "data streams"
- **Subject:** High-end financial environment (terminal, charts, luxury desk, market data visualization)
- **Lighting:** Studio-quality, cool-toned (blues, greens) with warm champagne highlights
- **Depth:** Foreground (sharp), midground (in focus), background (subtle bokeh with emerald tint)
- **Typography:** Optional large-scale data labels (e.g., "IV Rank: 68%") in Geist Mono, opacity 0.7

### 2.3 AI Image Generation Prompt Template

**Base Style:**
```
A luxurious, dark-themed, photorealistic scene of [TOPIC] in a high-end trading environment.
Ultra-realistic, professional-grade photography, studio lighting with cool blue-green tones
and warm champagne accents. Emerald (#10B981) accent lighting. Dark, moody atmosphere.
4K quality, perfect focus, color graded for luxury private equity aesthetic.
No logos, no text overlays, cinematic composition.
```

**Variable Slots:**
- `[TOPIC]` = lesson topic (e.g., "delta-neutral option spreads", "earnings-driven IV expansion")
- `[FOCUS]` = technical element (e.g., "options chain screenshot", "volatility surface", "Greeks heatmap")
- `[MOOD]` = aesthetic nuance (e.g., "calm analysis", "high-conviction decision moment", "pre-trade ritual")

### 2.4 Example Prompts by Lesson Topic

#### Example 1: Options Basics
```
A luxurious, dark-themed, photorealistic scene of an options trader analyzing a put/call
spread on a high-end Bloomberg terminal. Ultra-realistic, professional-grade photography,
cool blue-green studio lighting with warm champagne accents. Emerald accent highlights on
the screen. Emerald (#10B981) glow. Dark moody atmosphere. Close-up of an options chain
with crisp data visibility. 4K quality, perfect focus, luxury private equity aesthetic.
No logos, no text overlays.
```

#### Example 2: Greeks & Risk Metrics
```
An elite trader reviewing Greek metrics (Delta, Gamma, Vega, Theta) on a dark dashboard
in a high-end trading floor. Photorealistic, studio-lit, cool emerald tones with champagne
accents. A sophisticated Greeks heatmap glowing emerald. Dark moody cinematic lighting.
High-end office environment, luxury aesthetic. 4K quality, perfect focus. No logos,
no text overlays, no humans visible.
```

#### Example 3: Trade Entry & Exit Discipline
```
A luxury trading desk with a multi-monitor setup showing support/resistance levels and
entry signals. Dark, moody, photorealistic, cool tones with emerald accent lighting.
A critical moment of decision-making: cursor poised at entry point. Professional
photography, studio lighting, sophisticated private equity office. 4K, perfect focus.
No logos, no visible text overlays, cinematic composition.
```

#### Example 4: Risk Sizing & Portfolio Theory
```
An elegant financial dashboard displaying portfolio allocation and risk metrics:
diversification wheel, sector heatmap, Kelly Criterion visualization. Dark luxury
aesthetic, emerald accent lighting on the dashboard, champagne highlights.
Photorealistic, studio-lit, cool tones. Premium office environment. 4K quality,
perfect focus. No logos, no text, cinematic depth-of-field.
```

#### Example 5: Earnings Season Strategy
```
A trader's desk during earnings season: a wall of analyst reports, earnings call
transcript on screen, IV (implied volatility) spike visible on dashboard. Dark moody
aesthetic, photorealistic, cool emerald tones with champagne accents. High-tension,
high-stakes atmosphere. Studio lighting, 4K quality, perfect focus. No logos,
no text overlays.
```

#### Example 6: Volatility Expansion & Compression
```
A dark trading dashboard with volatility surface and implied volatility term structure
visualization. Photorealistic, studio-lit, cool emerald tones. A volatility spike
depicted as emerald light burst on the screen. Luxury environment, sophisticated
lighting. 4K quality, perfect focus, cinematic composition. No logos, no text.
```

#### Example 7: Sector & Index Analysis (SPX Focus)
```
A professional trader analyzing the S&P 500 (SPX) index: sector rotation heatmap,
index futures chart, correlation matrix. Dark luxury aesthetic, photorealistic,
emerald accent lighting on the dashboard, champagne highlights. Studio-lit,
cool tones, high-end office. 4K quality, perfect focus. No logos, no text overlays.
```

#### Example 8: Journal & Trade Review
```
An experienced trader reviewing a trading journal: past trades, P&L breakdown,
performance metrics on a sleek monitor. Dark moody aesthetic, photorealistic,
studio-lit, emerald tones, champagne accents. Reflective moment: hand on desk,
pen, notebook. High-end office environment, luxury aesthetic. 4K, perfect focus.
No logos, no text overlays.
```

#### Example 9: Psychology & Emotional Discipline
```
A serene, meditative moment: a trader at a desk, composure and focus evident,
against a backdrop of a calm market dashboard. Dark luxury aesthetic, photorealistic,
cool emerald and champagne tones, studio lighting. Peaceful, centered atmosphere.
High-end office, minimalist elegance. 4K quality, perfect focus. No logos, no humans'
faces visible, cinematic depth.
```

#### Example 10: Advanced Greeks & Gamma Scalping
```
A high-frequency trader's dashboard with Gamma scalping P&L, Greeks surface,
real-time delta hedging visualization. Dark photorealistic, cool emerald tones
with champagne highlights, studio lighting. Fast-paced but controlled atmosphere.
High-precision data display, luxury environment. 4K quality, perfect focus.
No logos, no text overlays.
```

### 2.5 Post-Processing Pipeline

**Step 1: Color Grading**
- Apply emerald color cast (selective green boost in shadows/highlights)
- Reduce saturation by 10–15% for luxury restraint
- Increase contrast by 8–12% for depth
- Add subtle vignette (radial darkening, 5% opacity at edges)

**Step 2: Texture Enhancement**
- Add subtle noise grain (ISO 400 equivalent) for premium film aesthetic
- Apply subtle texture overlay (luxury paper noise, 2% opacity)
- Enhance micro-contrasts in details (sharpness mask, radius 1.5px)

**Step 3: Brand Integration**
- Overlay Emerald Elite color bars (thin vertical 2–4px bars, 8–12% opacity) at edges
- Optional: apply subtle grid background (80px grid, 0.2% opacity) as watermark
- Embed metadata: copyright, alt text, image slug

**Step 4: Optimization**
- Convert to WebP with 85% quality
- Generate responsive variants: 640×360, 960×540, 1280×720
- Embed color profile: sRGB (no ICC profile for web speed)
- Add blur hash or LQIP (20×12 SQIP blur placeholder)

### 2.6 Storage & Delivery Pattern

**URL Pattern:**
```
https://academy-media.cdn.itm.io/lessons/{track-slug}/{module-slug}/{lesson-slug}-hero.webp
```

**Supabase Storage Structure:**
```
academy-media/
  lessons/
    basics/
      options-101/
        options-101-hero.webp
        options-101-hero-640.webp
        options-101-hero-960.webp
        options-101-hero-1280.webp
        options-101-hero.jpg (fallback)
      entry-management/
        entry-management-hero.webp
        ...
    intermediate/
      ...
```

**Preload Strategy:**
- Preload hero for current lesson immediately
- Prefetch hero for next lesson (low priority, not critical path)
- Lazy load all other lesson heroes until in-viewport

### 2.7 Component Integration

**React Component (pseudo-code):**
```tsx
interface LessonHeroProps {
  lesson: { slug: string, title: string }
  module: { slug: string, track: string }
  priority?: boolean // preload if true
}

export function LessonHero({ lesson, module, priority }: LessonHeroProps) {
  const basePath = `lessons/${module.track}/${module.slug}/${lesson.slug}-hero`
  return (
    <Image
      src={`${basePath}.webp`}
      alt={`${lesson.title}: lesson hero image`}
      width={1280}
      height={720}
      priority={priority}
      placeholder="blur"
      blurDataURL={getSqipPlaceholder(lesson.slug)} // LQIP blur
      srcSet={`
        ${basePath}-640.webp 640w,
        ${basePath}-960.webp 960w,
        ${basePath}-1280.webp 1280w
      `}
      onError={() => {
        // Fallback to JPEG
        return `${basePath}.jpg`
      }}
      sizes="(max-width: 640px) 100vw, (max-width: 960px) 90vw, 85vw"
    />
  )
}
```

### 2.8 Estimated Generation & Cost

| Task | Count | Estimated Cost |
|------|-------|-----------------|
| DALL-E 3 image generation | 150 images | $7.50 USD (1024×1024 @ $0.05/img) |
| Post-processing (outsource/tooling) | 150 images | $150–300 USD |
| WebP optimization & responsive variants | 150 images | $50–100 USD (batch tooling) |
| Supabase Storage (1 year, 150×0.5MB) | ~75 GB transferred/year | $5–10/month |
| CDN egress (CloudFront, ~500K requests/month) | Sustained | $20–40/month |
| **Total First Year** | — | **$500–750 USD** (one-time setup) |
| **Total Ongoing (monthly)** | — | **$25–50/month** |

---

## 3. MODULE COVER IMAGES (~30+ images)

### 3.1 Specifications

| Property | Value |
|----------|-------|
| **Dimensions** | 1440 × 800px (16:9 aspect ratio, landscape) |
| **Format** | WebP primary, JPEG fallback |
| **Quality** | 85% WebP, 90% JPEG |
| **File Size Target** | 120–180 KB (WebP) |
| **Lazy Loading** | LQIP blur-up, skeleton loader during load |
| **Color Profile** | sRGB, no ICC profile |

### 3.2 Visual Concept

Module covers are **more dramatic and visually dominant** than lesson heroes. They serve as gateway images to entire learning units:

- **Composition:** Centered, bold visual metaphor for the module's core concept
- **Subject:** Abstract financial visualization, market dynamics, sophisticated trading concept
- **Lighting:** High drama with emerald/champagne interplay
- **Typography:** Large module title overlay (Playfair Display serif, 48–72pt, opacity 0.9)
- **Depth:** Ultra-wide depth-of-field with bokeh in background

### 3.3 Prompt Template

```
A dramatically composed, photorealistic scene representing [MODULE_CONCEPT] in a luxurious
trading environment. Ultra-sophisticated visual metaphor: [VISUAL_METAPHOR]. Dark luxury
aesthetic, photorealistic, studio lighting with cool emerald (#10B981) and champagne accents.
Deep depth-of-field with bokeh background. Cinematic composition, 4K quality.
No logos, no text overlays, premium private equity atmosphere.
```

**Example Module Concepts & Metaphors:**

1. **"Options Fundamentals"** → "A holographic options chain floating above a dark desk, emerald light reflecting"
2. **"Greeks Mastery"** → "A four-dimensional Greeks surface (Delta, Gamma, Vega, Theta) visualized as emerald light waves"
3. **"Volatility Strategies"** → "A volatility surface expanding and compressing, emerald waves of data flowing"
4. **"Portfolio Construction"** → "A diversified portfolio wheel with sector segments, each glowing emerald"
5. **"Earnings & Events"** → "A wall of breaking news, earnings reports, IV spikes visualized as emerald bursts"

### 3.4 Storage & Delivery

**URL Pattern:**
```
https://academy-media.cdn.itm.io/modules/{track-slug}/{module-slug}-cover.webp
```

**Estimated Cost:** 30 images × $0.05 = $1.50 USD (DALL-E 3) + $30–60 post-processing

---

## 4. TRACK COVER IMAGES (6 images)

### 4.1 Specifications

| Property | Value |
|----------|-------|
| **Dimensions** | 2560 × 1440px (16:9, ultra-high-resolution) |
| **Format** | WebP primary, JPEG fallback |
| **Quality** | 80% WebP (higher compression for file size) |
| **File Size Target** | 250–350 KB (WebP) |
| **Uses** | Homepage hero, track landing pages, navigation backdrops |

### 4.2 Visual Hierarchy: Beginner → Advanced

**Track 1: Beginner Foundations**
- Visual: A clear, welcoming trading desk with basic tools visible (monitor, charts, coffee)
- Mood: Calm, educational, accessible
- Prompt: "A welcoming, elegant trading desk for a beginner trader. Light emerald accents, warm champagne lighting. Professional but approachable. Dark luxury aesthetic, photorealistic, studio-lit, 4K quality."

**Track 2: Intermediate Strategies**
- Visual: More sophisticated multi-monitor setup, complex charts, Greek visualizations
- Mood: Focused, strategic, competitive
- Prompt: "An intermediate trader's sophisticated multi-monitor desk with options chains, Greeks analysis, and strategy dashboards visible. Dark luxury aesthetic, emerald accent lighting, photorealistic, studio-lit, 4K quality. Confident, professional atmosphere."

**Track 3: Advanced Portfolio Management**
- Visual: Enterprise-grade infrastructure, algorithmic dashboards, risk management visualization
- Mood: Authoritative, data-driven, elite
- Prompt: "A world-class trading floor with multiple screens showing portfolio analytics, risk heatmaps, and algorithmic execution dashboards. Ultra-sophisticated, dark luxury aesthetic, photorealistic, emerald and champagne accent lighting, 4K quality. Elite institutional atmosphere."

**Track 4: Volatility & Advanced Greeks**
- Visual: Volatility surfaces, Greeks heatmaps, 3D data visualizations
- Mood: Technical, precision-focused, high-stakes
- Prompt: "A specialized volatility trading desk with 3D volatility surface visualizations, Greeks heatmaps, and real-time data streams. Dark luxury, photorealistic, cool emerald tones with champagne accents, studio lighting, 4K quality. High-precision, technical atmosphere."

**Track 5: Real-World Trading Psychology**
- Visual: A calm, centered trader in reflection mode, quiet moment of analysis
- Mood: Introspective, composed, disciplined
- Prompt: "An experienced trader in a moment of calm reflection, reviewing performance data and journaling. Dark luxury office, photorealistic, soft emerald and champagne lighting, introspective mood. Studio photography, 4K quality. Peaceful, centered atmosphere."

**Track 6: Elite Mastery & Specialization**
- Visual: Cutting-edge trading technology, AI-assisted analysis, quantum-grade data
- Mood: Visionary, cutting-edge, transformative
- Prompt: "A futuristic yet grounded elite trader's desk with advanced AI-assisted options analytics, predictive models, and real-time market intelligence. Dark luxury aesthetic, photorealistic, emerald and champagne accent lighting, cinematic composition. 4K quality. Visionary, forward-thinking atmosphere."

### 4.3 Storage & Delivery

**URL Pattern:**
```
https://academy-media.cdn.itm.io/tracks/{track-slug}-cover.webp
```

**Estimated Cost:** 6 images × $0.05 (DALL-E 3) + $60–120 post-processing = $120–150 USD

---

## 5. ACTIVITY ILLUSTRATIONS (~200+ inline diagrams)

### 5.1 Categories & Specifications

| Illustration Type | Count | Format | Dimensions | Notes |
|-------------------|-------|--------|------------|-------|
| **Options Chain Screenshots (Styled)** | 40 | SVG/PNG | 800×600px | Mock data, emerald-highlighted key values |
| **Payoff Diagrams** | 30 | SVG | Flexible | Publication-quality, financial math precision |
| **Greeks Visualizations** | 40 | SVG/Canvas | Flexible | Delta, Gamma, Vega, Theta surfaces/heatmaps |
| **Chart Annotations** | 30 | SVG | 1000×400px | Support/resistance, entry/exit levels, candlestick analysis |
| **Platform Mockups** | 20 | SVG/PNG | 1200×800px | TradeITM UI mockups, BloombergTerminal, ThinkorSwim examples |
| **Strategy Comparison Diagrams** | 20 | SVG | Flexible | Side-by-side strategy payoff comparisons |

### 5.2 Design Language for Illustrations

**SVG Standards:**
- **Stroke Width:** 1.5px (consistent with Lucide icon standard)
- **Colors:** Only emerald-elite, champagne, ivory, onyx, and approved accent colors
- **Typography:** Inter for labels, Geist Mono for data values
- **Grid Background:** Optional subtle 1px grid (opacity 0.05) for context
- **Shadows:** SVG filter `<feGaussianBlur>` for depth (radius 2–4px)

**PNG/Canvas (for complex visualizations):**
- Dark background (#0A0A0B)
- Anti-aliased lines and text
- Emerald accent for primary data (e.g., ITM region, positive Greeks)
- Champagne for secondary accents (e.g., warning levels, breakeven lines)
- Ivory for text labels

### 5.3 Example Illustrations

#### 5.3.1 Options Chain Screenshot (Styled)

**Purpose:** Show students a real options chain interface with key metrics highlighted

**Components:**
- Underlying price (large, Geist Mono, emerald-elite color)
- Expiration date and DTE (days-to-expiration)
- Strike price columns (ITM strikes: emerald background, OTM: onyx background)
- Greeks columns: Delta, Gamma, Vega, Theta (Geist Mono, emerald highlights for key thresholds)
- Bid/Ask spread (champagne accents for wide spreads, emerald for tight spreads)
- IV Rank / IV Percentile (large callout, emerald or champagne based on value)
- Volume/OpenInterest (Geist Mono, muted text)

**Styling:**
- Header: glass-card-heavy effect (semi-transparent background)
- Alternating row colors: onyx-light and transparent
- Hover state: emerald glow on row
- Responsive: stack columns on mobile, maintain readability

#### 5.3.2 Payoff Diagram (Long Call)

**SVG Elements:**
- X-axis: Stock price at expiration (labels: strike - 20%, strike, strike + 20%)
- Y-axis: Profit/Loss ($)
- Underlying line: dark emerald (#065F46), 2px stroke
- Cost basis: horizontal dashed champagne line
- Breakeven: vertical dashed champagne line
- Profit region: emerald fill (opacity 0.2)
- Loss region: red fill (opacity 0.15)
- Strike line: vertical dashed ivory (opacity 0.5)
- Labels: Playfair Display serif (14px), ivory
- Optional animation: Line draws on page load (SVG stroke-dasharray animation)

#### 5.3.3 Greeks Heatmap

**Purpose:** Visualize Greeks sensitivity across strikes and expirations

**SVG/Canvas Approach:**
- 2D grid: X-axis (strikes, range -3σ to +3σ), Y-axis (days to expiration)
- Color scale: Red (negative delta/gamma) → Onyx (zero) → Emerald (positive delta/gamma)
- Opacity scale: Darker = more significant value
- Interactive tooltips (on hover): show exact Delta/Gamma/Vega value
- Optional 3D surface (Canvas 3D.js): render as 3D surface with emerald/champagne gradient

#### 5.3.4 Support/Resistance Annotation

**Purpose:** Teach students how to identify key levels on a chart

**SVG Components:**
- Candlestick chart background (100 days of hourly/daily data)
- Support level: horizontal emerald line (2px) with label "Support: $SPX 4850"
- Resistance level: horizontal champagne line (2px) with label "Resistance: $SPX 4950"
- Breakout area: vertical emerald zone with annotation "Potential breakout"
- Entry points: emerald circles with arrow annotations
- Stop loss: red dashed line with annotation
- Target: champagne dashed line with annotation

#### 5.3.5 Strategy Comparison Diagram

**Purpose:** Compare two strategies (e.g., Bull Call Spread vs Long Call)

**Layout:**
- Two columns, side-by-side
- Left: Bull Call Spread (long call + short call)
  - Payoff diagram, Greeks table, P&L breakdown
- Right: Long Call (outright long call)
  - Payoff diagram, Greeks table, P&L breakdown
- Bottom: Comparison table (Max Profit, Max Loss, Breakeven, Capital Required, Greeks Summary)
- Color coding: Emerald for advantages, Champagne for tradeoffs, Red for constraints

### 5.4 Production Pipeline

**Workflow:**
1. **Design Phase:** Create SVG mockups in Figma (use "Emerald Standard" design tokens)
2. **Validation:** Peer review for accuracy and brand compliance
3. **Development:** Convert to production SVG/React components with accessibility annotations
4. **Testing:** Validate responsiveness, animation smoothness, color contrast
5. **Deployment:** Commit to `public/academy/illustrations/` and reference in lesson content

**Asset Naming Convention:**
```
/public/academy/illustrations/{lesson-slug}/{illustration-purpose}-{variant}.svg
Examples:
  - /public/academy/illustrations/greeks-basics/delta-heatmap-default.svg
  - /public/academy/illustrations/options-chains/xle-chain-annotated.svg
  - /public/academy/illustrations/strategies/bull-call-spread-comparison.svg
```

### 5.5 Estimated Cost

| Activity | Count | Cost Method | Estimate |
|----------|-------|-------------|----------|
| SVG Design (Figma) | 100 | Design time, 2 hrs each | $1,000–1,500 |
| Payoff Diagram Development (React component) | 30 | Dev time, 1 hr each | $600–900 |
| Interactive Heatmaps (Canvas/D3.js) | 15 | Dev + design, 2 hrs each | $600–900 |
| Platform Mockups (styled screenshots) | 20 | Screenshot + style editing, 0.5 hr each | $400–600 |
| PNG/Raster Optimization | 200 | Batch optimization tooling | $100–200 |
| **Total Estimated Cost** | — | — | **$2,700–4,100 USD** |

---

## 6. ACHIEVEMENT BADGES (~30+ SVG badges)

### 6.1 Badge Categories

| Badge Type | Count | Unlock Condition |
|------------|-------|------------------|
| **Completion Badges** | 8 | Complete track, module, or lesson set |
| **Streak Badges** | 5 | Consecutive days/weeks of learning |
| **Mastery Badges** | 8 | Score 90%+ on assessments, pass challenges |
| **Social Badges** | 5 | Social milestones (leaderboard, shares, peer reviews) |
| **Special/Seasonal** | 4 | Limited-time challenges, seasonal themes |

### 6.2 Badge Design Specifications

| Property | Value |
|----------|-------|
| **Format** | SVG (scalable, infinitely responsive) |
| **Base Dimensions** | 256×256px (rendered at 64px, 128px, 256px sizes) |
| **Color Palette** | Emerald Elite, Champagne, Ivory, Onyx only |
| **Shape** | Circle or hexagon (symmetrical, premium aesthetic) |
| **Inner Design** | Icon (Lucide React 24px) + optional background pattern |
| **Stroke** | 1–2px border in Champagne or Emerald |
| **Shadow** | SVG drop-shadow filter, opacity 0.3 |
| **Text** | Optional label below badge in Inter 12px |

### 6.3 Example Badges

**Completion Badge: "Foundations Master"**
- Shape: Hexagon
- Icon: Lucide `BookOpen` (24px, emerald-elite)
- Background: Radial gradient (emerald-deep to onyx)
- Border: 2px champagne
- Shadow: Emerald glow (feGaussianBlur radius 4px, opacity 0.4)
- Animation: On unlock, subtle pulse (scale 1.0 → 1.1 → 1.0, 600ms ease-in-out)

**Streak Badge: "7-Day Dynamo"**
- Shape: Circle
- Icon: Lucide `Flame` (24px, champagne)
- Background: Linear gradient (onyx → emerald-deep)
- Border: 2px emerald-elite
- Inner pattern: Subtle diagonal stripes (opacity 0.1, Champagne)
- Animation: Pulsing glow (shadow intensity oscillates)

**Mastery Badge: "Greeks Grandmaster"**
- Shape: Hexagon
- Icon: Greek letter Δ (Delta symbol, custom SVG, 24px, ivory)
- Background: Radial gradient (emerald-elite to emerald-deep)
- Border: 2px champagne with sparkle accents (SVG circles at corners)
- Shadow: Strong emerald glow (radius 8px)
- Rarity: Rare tier (sparkle animation at 0.5s intervals)

**Social Badge: "Community Champion"**
- Shape: Circle
- Icon: Lucide `Users` (24px, champagne)
- Background: Linear gradient (onyx → champagne)
- Border: 2px champagne with diamond pattern
- Inner accent: Small emerald circle (top-right) for "leadership" indicator
- Animation: Subtle orbit (rotate 360°, 8s linear infinite)

**Seasonal Badge: "Year-End Excellence 2026"**
- Shape: Hexagon
- Icon: Custom snowflake SVG (24px, emerald-elite)
- Background: Radial gradient (emerald-deep → onyx)
- Border: 2px champagne with shimmer animation
- Special effect: Animated snowflakes (3–5 SVG snowflakes rotating/falling in background)
- Limited availability: Expires 2027-01-31

### 6.4 Badge Display Component

**React Component (pseudo-code):**
```tsx
interface AchievementBadgeProps {
  type: 'completion' | 'streak' | 'mastery' | 'social' | 'special'
  title: string
  condition: string
  unlocked: boolean
  unlockedAt?: Date
  size?: 'sm' | 'md' | 'lg' // 64px, 128px, 256px
  showLabel?: boolean
}

export function AchievementBadge({
  type,
  title,
  condition,
  unlocked,
  unlockedAt,
  size = 'md',
  showLabel = true,
}: AchievementBadgeProps) {
  return (
    <div className={`achievement-badge ${type} ${size} ${unlocked ? 'unlocked' : 'locked'}`}>
      <Image
        src={`/academy/badges/${type}/${title.toLowerCase().replace(/\s+/g, '-')}.svg`}
        alt={`${title} badge${unlocked ? ', unlocked' : ''}`}
        width={256}
        height={256}
        className={unlocked ? 'animate-pulse-emerald' : 'opacity-40 grayscale'}
      />
      {showLabel && <p className="badge-label">{title}</p>}
      {unlocked && unlockedAt && (
        <span className="badge-date">{formatDate(unlockedAt, 'short')}</span>
      )}
      {!unlocked && <p className="badge-condition">{condition}</p>}
    </div>
  )
}
```

### 6.5 Badge Storage & Delivery

**URL Pattern:**
```
https://academy-media.cdn.itm.io/badges/{badge-type}/{badge-slug}.svg
```

**Supabase Storage Structure:**
```
academy-media/
  badges/
    completion/
      foundations-master.svg
      track-1-complete.svg
    streak/
      7-day-dynamo.svg
      30-day-streak.svg
    mastery/
      greeks-grandmaster.svg
      volatility-virtuoso.svg
    social/
      community-champion.svg
      content-contributor.svg
    special/
      year-end-excellence-2026.svg
      early-adopter.svg
```

### 6.6 Estimated Cost

| Task | Count | Estimate |
|------|-------|----------|
| Badge design (Figma mockups) | 30 | $600–900 USD (design time, 1.5 hrs each) |
| SVG development (React components) | 30 | $300–450 USD (dev time, 30 mins each) |
| Animation refinement (CSS/SVG keyframes) | 30 | $150–300 USD (tooling + testing) |
| **Total** | — | **$1,050–1,650 USD** |

---

## 7. ANIMATED ELEMENTS

### 7.1 Loading Animations

**Pulsing Logo Skeleton (Primary Loading State)**
- Component: `components/ui/skeleton-loader.tsx` variant="screen"
- Animation: Subtle emerald pulse (0.5s on, 1.5s off, infinite)
- Used on: Lesson pages, module pages, quiz/assessment screens
- CSS Keyframes:
  ```css
  @keyframes pulse-subtle {
    0%, 100% { opacity: 0.52; filter: brightness(0.96); }
    50% { opacity: 0.9; filter: brightness(1.06); }
  }
  ```

**Content Block Transitions**
- Animation: Fade-in + slide-up (0.6s, cubic-bezier ease-out)
- Used on: Lesson content reveals, module overviews, quiz transitions
- CSS:
  ```css
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  ```

### 7.2 Achievement Celebration Animations

**Confetti-Style Effect**
- Library: `react-confetti` (lightweight, customizable)
- Trigger: Badge unlock, quiz completion, milestone achievement
- Configuration:
  - Particle colors: emerald, champagne, ivory only
  - Particle count: 50–80 (performance-aware)
  - Duration: 2–3 seconds
  - Gravity: 0.2 (slow, luxurious fall)
  - Friction: 0.99 (realistic air resistance)

**Badge Unlock Animation**
- Sequence:
  1. Badge scales up (0.5s): scale 0 → 1.1 (overshoot)
  2. Glow pulses (0.6s): shadow opacity 0.2 → 0.8 → 0.2
  3. Subtle rotation (0.4s): rotate 0 → 5deg → 0
  4. Final rest: scale 1.0, steady glow

### 7.3 Interactive Greeks Slider Feedback

**Greeks Surface Animation**
- Use D3.js or Three.js to render 3D Greeks surface
- On slider interaction (e.g., dragging volatility slider):
  - Surface updates in real-time
  - Emerald glow highlights the Delta region
  - Champagne highlights indicate Theta decay
  - Smooth transitions (0.2s) between states

**Greeks Heatmap Hover Effect**
- On hover cell: background brightens (opacity 0.05 → 0.15)
- Tooltip appears: Greeks values in Geist Mono, dark glass card
- Cell border glows emerald (0.1s transition)

### 7.4 P&L Curve Drawing Animation

**Strategy Payoff Diagram Animation**
- SVG path animation (SVG stroke-dasharray + stroke-dashoffset)
- On lesson load: payoff curve draws from left to right (1.5s)
- Color sequence: emerald fill follows the line, revealing profit region
- On interaction: curve redraw when parameters change (0.6s smooth transition)

### 7.5 Estimated Cost

| Animation | Effort | Cost |
|-----------|--------|------|
| Pulsing logo skeleton (component) | 2 hrs | $100–150 |
| Content fade-in/slide transitions (CSS keyframes) | 1 hr | $50–75 |
| Confetti effect (library integration + config) | 2 hrs | $100–150 |
| Badge unlock sequence (CSS + JS) | 3 hrs | $150–225 |
| Greeks surface 3D visualization (D3.js/Three.js) | 8 hrs | $400–600 |
| P&L curve drawing (SVG animation) | 3 hrs | $150–225 |
| **Total** | — | **$950–1,425 USD** |

---

## 8. IMAGE GENERATION BATCH WORKFLOW

### 8.1 DALL-E 3 Batch Generation Strategy

**Phase 1: Pilot (Week 1)**
- Generate 10 sample lesson heroes (different topics)
- Solicit feedback from instructional designers
- Refine prompt templates based on results
- Cost: ~$0.50 USD

**Phase 2: Full Lesson Heroes (Week 2–3)**
- Generate 150 lesson heroes in batches of 25 (daily)
- Apply consistent post-processing to each batch
- Upload to Supabase Storage
- Cost: ~$7.50 USD

**Phase 3: Module Covers (Week 4)**
- Generate 30 module cover images
- Higher visual drama, more sophisticated composition
- Cost: ~$1.50 USD

**Phase 4: Track Covers (Week 4–5)**
- Generate 6 ultra-high-resolution track covers
- Additional post-processing for premium finish
- Cost: ~$0.30 USD

**Phase 5: Quality Assurance & Optimization (Week 5)**
- Review all images for brand compliance
- Optimize WebP/JPEG formats
- Generate responsive variants
- Final QA before launch

**Total Timeline:** 5 weeks
**Total Cost:** ~$10 USD (DALL-E 3) + $300–500 (post-processing & optimization)

### 8.2 Version Control & Asset Management

**Git Workflow:**
- Store `prompts.json` in repo: all AI prompts with parameters and metadata
- Store only optimized WebP/JPEG in Supabase (not in Git)
- Store SVG illustrations and badges in repo: `public/academy/illustrations/` and `public/academy/badges/`
- Document all post-processing steps in `docs/ACADEMY_MEDIA_GENERATION.md`

**Prompts.json Example:**
```json
{
  "lesson_heroes": [
    {
      "slug": "options-101-hero",
      "topic": "Options Basics",
      "prompt": "A luxurious, dark-themed, photorealistic scene of an options trader analyzing a put/call spread on a high-end Bloomberg terminal...",
      "generated_at": "2026-02-24T10:30:00Z",
      "status": "complete",
      "variants": ["640x360", "960x540", "1280x720"],
      "alt_text": "Options trader analyzing a put/call spread on Bloomberg terminal in a luxury trading office"
    }
  ]
}
```

---

## 9. RESPONSIVE DESIGN & LAZY LOADING

### 9.1 Responsive Image Strategy

**Breakpoints (per Tailwind):**
- **Mobile (< 640px):** 640×360px (lesson hero), reduced data consumption
- **Tablet (640–1024px):** 960×540px (lesson hero), balance quality & speed
- **Desktop (> 1024px):** 1280×720px (lesson hero), full-quality delivery

**Next.js Image Component Best Practices:**
- Always use `next/image` for optimization
- Specify `width` and `height` to prevent layout shift
- Use `placeholder="blur"` with LQIP (low-quality image placeholder)
- Set `priority={true}` for above-the-fold images
- Use `sizes` attribute for responsive srcSet

**Example Implementation:**
```tsx
<Image
  src="/academy/lessons/options-101-hero.webp"
  alt="Options Basics: Hero image showing Bloomberg terminal with options chain"
  width={1280}
  height={720}
  placeholder="blur"
  blurDataURL="data:image/svg+xml;base64,..." // SQIP blur
  srcSet="/academy/lessons/options-101-hero-640.webp 640w, /academy/lessons/options-101-hero-960.webp 960w, /academy/lessons/options-101-hero-1280.webp 1280w"
  sizes="(max-width: 640px) 100vw, (max-width: 960px) 90vw, 85vw"
  priority={isCurrentLesson} // true for current lesson hero
  onError={(e) => {
    // Fallback to JPEG if WebP fails
    e.target.src = '/academy/lessons/options-101-hero.jpg'
  }}
/>
```

### 9.2 Lazy Loading & Prefetching

**Current Lesson Hero:** `priority={true}` (loads eagerly)
**Next Lesson Hero:** `loading="lazy"` with prefetch on scroll (JavaScript-triggered)
**All Other Lesson Heroes:** `loading="lazy"` (browser-native lazy loading)

**Prefetch Trigger (Intersection Observer):**
```tsx
useEffect(() => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // Prefetch next lesson hero
        const link = document.createElement('link')
        link.rel = 'prefetch'
        link.href = nextLessonHeroUrl
        document.head.appendChild(link)
      }
    })
  }, { rootMargin: '50px' })

  if (currentLessonRef.current) {
    observer.observe(currentLessonRef.current)
  }
}, [currentLessonRef])
```

### 9.3 Accessibility in Images

**Alt Text Strategy:**
- All hero images MUST have descriptive alt text (80–120 characters)
- Format: `{Lesson Title}: Hero image showing {key visual elements}`
- Example: `"Options Greeks Mastery: Hero image showing 3D volatility surface with emerald accent lighting"`

**Color Contrast:**
- All text overlays must meet WCAG AA standard (4.5:1 contrast for body text)
- Use Ivory (#F5F5F0) text on dark backgrounds
- Test with WebAIM Contrast Checker

**Reduced Motion:**
- Respect `prefers-reduced-motion` media query
- Disable animations if user has set this preference in OS
- CSS:
  ```css
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important; }
  }
  ```

---

## 10. SUPABASE STORAGE INTEGRATION

### 10.1 Bucket Configuration

**Bucket Name:** `academy-media`
**Visibility:** Public (CDN-served, authentication optional for write)
**Region:** Auto-replicate to CDN regions for global performance

**Folder Structure:**
```
academy-media/
  lessons/
    {track-slug}/
      {module-slug}/
        {lesson-slug}-hero.webp
        {lesson-slug}-hero-640.webp
        {lesson-slug}-hero-960.webp
        {lesson-slug}-hero-1280.webp
        {lesson-slug}-hero.jpg (fallback)
  modules/
    {track-slug}/
      {module-slug}-cover.webp
      {module-slug}-cover-640.webp
      {module-slug}-cover-960.webp
  tracks/
    {track-slug}-cover.webp
  badges/
    completion/
      *.svg
    streak/
      *.svg
    mastery/
      *.svg
    social/
      *.svg
    special/
      *.svg
  placeholders/
    blur-hashes.json (LQIP metadata)
```

### 10.2 CDN & URL Pattern

**Supabase Storage CDN URL:**
```
https://<project_id>.supabase.co/storage/v1/object/public/academy-media/{path}
```

**CloudFront Custom Domain (recommended for production):**
```
https://academy-media.cdn.itm.io/{path}
```

**Configuration (AWS CloudFront):**
- Origin: `<project_id>.supabase.co/storage/v1/object/public/academy-media/`
- Cache-Control: `public, max-age=31536000, immutable` (1 year for versioned assets)
- Compression: Gzip, Brotli
- Allowed methods: GET, HEAD, OPTIONS
- Price estimate: ~$20–40/month for 500K requests/month

### 10.3 Upload Automation

**Supabase CLI Upload Script:**
```bash
#!/bin/bash
# scripts/upload-academy-media.sh

PROJECT_ID="your-project-id"
BUCKET="academy-media"
LOCAL_DIR="./generated-assets"

# Upload lesson heroes
for track_dir in $LOCAL_DIR/lessons/*/; do
  for module_dir in $track_dir*/; do
    for image_file in $module_dir*.webp; do
      filename=$(basename "$image_file")
      track=$(basename $(dirname $(dirname "$image_file")))
      module=$(basename $(dirname "$image_file"))

      supabase storage upload $BUCKET \
        "lessons/$track/$module/$filename" \
        "$image_file" \
        --project-id $PROJECT_ID
    done
  done
done

echo "Upload complete!"
```

---

## 11. COMPREHENSIVE COST SUMMARY

### 11.1 One-Time Setup Costs

| Phase | Item | Estimated Cost |
|-------|------|-----------------|
| **AI Image Generation** | DALL-E 3 (150 lesson + 30 module + 6 track) | $10 USD |
| **Post-Processing** | Color grading, texture, optimization (contractor or tooling) | $300–500 USD |
| **Illustration Design** | SVG payoff diagrams, Greeks heatmaps, platform mockups | $2,700–4,100 USD |
| **Badge Design & Dev** | 30 SVG badges + React components | $1,050–1,650 USD |
| **Animation Development** | Confetti, Greeks surface, P&L drawing, transitions | $950–1,425 USD |
| **Component Development** | LessonHero, ModuleCover, AchievementBadge, LazyImage | $600–900 USD |
| **Testing & QA** | Responsive testing, accessibility audit, performance optimization | $400–600 USD |
| **Documentation** | Prompt templates, generation workflow, style guides | $200–300 USD |
| **TOTAL ONE-TIME** | — | **$6,210–9,475 USD** |

### 11.2 Recurring Monthly Costs

| Service | Usage | Cost |
|---------|-------|------|
| **Supabase Storage** | ~75 GB/year for 300+ images | $5–10/month |
| **CloudFront CDN** | ~500K requests/month (academy usage) | $20–40/month |
| **DALL-E 3 (refreshes)** | ~10 new images/month for new lessons | $0.50–1/month |
| **TOTAL RECURRING** | — | **$25–51/month** |

### 11.3 ROI & Value Justification

**Quantifiable Benefits:**
- **Engagement:** Visual-rich lessons increase completion rates by 15–25%
- **Retention:** Premium aesthetic enhances brand perception and student lifetime value
- **Scalability:** Modular design system enables 50+ new lessons/year without redesign cost
- **Performance:** Optimized images reduce page load time by 30–40% vs. unoptimized alternatives

**Breakeven Timeline:**
- If academy generates $50K/year in revenue and visual quality contributes 5% improvement
- One-time investment of $6,210 breaks even in ~1 month
- Monthly recurring costs of $25–51 are negligible (0.05–0.1% of revenue)

---

## 12. IMPLEMENTATION TIMELINE

### 12.1 Phase Timeline (8 Weeks)

| Week | Phase | Deliverables |
|------|-------|--------------|
| **1** | Discovery & Prompt Refinement | Pilot 10 lesson heroes, refine prompt templates, get approval |
| **2–3** | Lesson Hero Generation | Generate 150 lesson heroes in batches, post-process, upload to Supabase |
| **4** | Module Covers & Track Covers | Generate 30 module covers + 6 track covers, full post-processing |
| **5** | Illustration Design (SVG) | Create 100+ payoff diagrams, Greeks heatmaps, platform mockups, annotations |
| **6** | Badge Design & Animation | Design 30 badges, develop SVG + React components, animation implementation |
| **7** | Component Integration | Develop LessonHero, ModuleCover, LazyImage, AchievementBadge components |
| **8** | QA, Testing & Documentation | Full responsive testing, accessibility audit, performance optimization, deploy |

### 12.2 Deliverables Checklist

- [ ] All 150 lesson heroes generated, post-processed, optimized, and uploaded to Supabase
- [ ] All 30 module covers generated and deployed with responsive variants
- [ ] All 6 track covers generated at ultra-high resolution
- [ ] 100+ SVG illustrations (payoff diagrams, Greeks visualizations, charts, etc.) complete
- [ ] 30 SVG achievement badges with unlock animations
- [ ] React components: LessonHero, ModuleCover, AchievementBadge, LazyImage (fully tested)
- [ ] Confetti, fade-in, and animation effects implemented and performance-tested
- [ ] Supabase Storage bucket configured, CDN integrated, URL patterns documented
- [ ] Accessibility audit passed (WCAG AA, alt text, color contrast)
- [ ] Lighthouse score >= 90 for academy routes
- [ ] Documentation: prompts.json, generation workflow, style guide, component API
- [ ] Batch upload scripts and automation ready for future lesson additions

---

## 13. GOVERNANCE & FUTURE SCALABILITY

### 13.1 Adding New Lessons (Post-Launch)

**Standard Process for New Lesson Heroes:**
1. Provide lesson title, topic, and key concepts to Content Team
2. Content Team supplies 2–3 sentences describing visual direction
3. Media Team generates 3 DALL-E 3 variants using prompt template
4. Content Team selects preferred variant
5. Post-processing applied (color grading, optimization)
6. Responsive variants generated automatically via batch script
7. Image uploaded to Supabase with metadata (slug, alt text, generated_at)
8. Component automatically resolves image URL based on lesson slug

**Estimated Time Per New Lesson:** ~30 minutes (image generation + upload)
**Cost Per Lesson:** ~$0.05 USD (DALL-E 3 only)

### 13.2 Style Guard & Brand Compliance

**Automated Validation:**
- Create a Supabase Edge Function to validate image metadata on upload
- Check: alt text length >= 80 chars, image dimensions match spec, file size < 200 KB
- Reject uploads that fail validation

**Quarterly Brand Audit:**
- Review 10% of deployed images for brand compliance
- Verify no legacy gold (#D4AF37) appears anywhere
- Ensure color grading consistency across all assets

### 13.3 Performance Monitoring

**Metrics to Track:**
- Image load time (p50, p95) for academy routes
- Image cache hit rate on CDN
- Lighthouse performance score (target: >= 90)
- User engagement: session duration, completion rate, repeat visits

**Monitoring Setup:**
- Enable Sentry for image load errors
- Enable CloudFront logging to S3 for CDN analytics
- Set up New Relic or Vercel Analytics for page performance

---

## 14. FINAL SUMMARY & APPROVALS

### 14.1 Strategy Success Criteria

**Launch Success:**
- All 400+ media assets deployed and accessible via CDN
- All components responsive and performant (Lighthouse >= 90)
- Zero broken image links in production
- Accessibility audit passed (WCAG AA)
- User feedback: 4.5+ / 5.0 rating for visual quality

**Post-Launch Success (90 Days):**
- Lesson completion rate increased by 15%+ from pre-launch baseline
- Average session duration increased by 20%+
- Image load time < 0.5s p95 on 4G connection
- Student testimonials mention "premium visual experience" or similar

### 14.2 Sign-Off & Approvals

This strategy requires approval from:

1. **Instructional Design Lead:** Confirm visual metaphors align with learning outcomes
2. **Brand Director:** Verify Emerald Standard compliance, no legacy colors
3. **Engineering Lead:** Validate component architecture, scalability, performance targets
4. **Finance/Budget Approver:** Confirm budget allocation ($6,210–9,475 one-time, $25–51/month recurring)

---

## APPENDICES

### Appendix A: Figma Design System Link
(Link to Emerald Standard Figma file with component library, color tokens, typography scale)

### Appendix B: DALL-E 3 Prompt Library
(Comprehensive prompt templates for all lesson topics, modules, and tracks)

### Appendix C: SVG Illustration Style Guide
(Detailed specifications for SVG stroke widths, colors, shadows, animations)

### Appendix D: Supabase Storage Configuration
(Step-by-step setup for bucket, CDN, caching policies, URL patterns)

### Appendix E: Component API Reference
- `<LessonHero />` - Responsive lesson hero image with LQIP
- `<ModuleCover />` - Module cover with lazy loading
- `<AchievementBadge />` - SVG badge with unlock animation
- `<LazyImage />` - Generic lazy-loading image wrapper

### Appendix F: Performance Optimization Checklist
- WebP format with fallback
- Responsive srcSet for 3 breakpoints
- LQIP blur placeholder
- Lazy loading (browser-native + prefetch)
- Image CDN with 1-year cache policy
- Lighthouse audit (target 90+)

---

**Document Status:** FINAL
**Version:** 1.0
**Last Updated:** 2026-02-24
**Next Review:** 2026-05-24
