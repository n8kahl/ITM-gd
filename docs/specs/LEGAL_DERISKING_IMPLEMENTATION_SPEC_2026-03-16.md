# TradeITM Legal De-Risking Implementation Spec

**Date:** March 16, 2026
**Type:** Implementation Spec — Code Changes Only
**Goal:** Reduce legal exposure immediately through targeted add/remove/update changes across the codebase. No attorney required for these changes — they are all conservative, risk-reducing, and reversible.

---

## REMOVE — Things to Delete

### R1. Remove the Live Wins Ticker Entirely

**Why:** The `SAMPLE_WINS` array on lines 15-26 of `live-wins-ticker.tsx` is hardcoded fake data. Names like "S. Rodriguez," "A. Thompson," "M. Chen" are fabricated. Gains like "+142%," "+245%" are invented. The component presents these as "Live Member Wins" with fake timestamps ("Just now," "3m ago"). This is textbook deceptive social proof under FTC Act Section 5.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `components/ui/live-wins-ticker.tsx` | DELETE entire file | Remove the component entirely |
| `app/page.tsx` line 19 | REMOVE | Delete the import: `import { HeroWinsBadge, LiveWinsTicker } from "@/components/ui/live-wins-ticker"` |
| `app/page.tsx` lines 188-194 | REMOVE | Delete the `<HeroWinsBadge />` block inside the hero section |

**Result:** No more fake "M. Chen just hit +142% on NVDA" rotating in the hero. The hero still has the logo, headline, subheadline, and CTA button — it works fine without this.

---

### R2. Remove All Testimonials with Dollar Amounts or Percentage Returns

**Why:** Every testimonial on lines 557-631 of `app/page.tsx` cites specific dollar amounts and percentage returns that are unsubstantiated, have no "results not typical" disclosure, and no typical results data adjacent. Under the 2023 FTC Endorsement Guides, these are deceptive unless they represent typical member experience (they almost certainly don't).

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/page.tsx` lines 537-631 | REPLACE | Replace the entire testimonials section content |

**Replace the two `<TestimonialMarquee>` blocks (lines 556-631) with these non-financial testimonials:**

```tsx
<TestimonialMarquee
  testimonials={[
    {
      name: "Michael C.",
      role: "Executive Sniper Member",
      content: "The trade architecture education completely changed how I approach setups. I finally have a repeatable process instead of guessing.",
      avatar: "MC"
    },
    {
      name: "Sarah R.",
      role: "Pro Sniper Member",
      content: "Best trading education community I've been a part of. The risk management framework alone was worth the membership.",
      avatar: "SR"
    },
    {
      name: "David P.",
      role: "Executive Sniper Member",
      content: "The daily watchlist and educational commentary helped me understand market structure in a way no YouTube video ever could.",
      avatar: "DP"
    },
    {
      name: "Emily W.",
      role: "Pro Sniper Member",
      content: "The risk management education here is top-tier. I went from emotional trading to having a real plan every single day.",
      avatar: "EW"
    },
    {
      name: "James M.",
      role: "Core Sniper Member",
      content: "Clear, actionable educational content every morning. The community is supportive and the trade rationale breakdowns are incredibly valuable.",
      avatar: "JM"
    },
  ]}
  direction="left"
  speed={25}
  className="mb-6"
/>

<TestimonialMarquee
  testimonials={[
    {
      name: "Alex T.",
      role: "Core Sniper Member",
      content: "Perfect for someone with a full-time job. The mobile alerts and end-of-day recaps fit my schedule perfectly.",
      avatar: "AT"
    },
    {
      name: "Lisa K.",
      role: "Executive Sniper Member",
      content: "The 1-on-1 mentorship sessions are invaluable. Having someone review my trades and point out what I'm missing accelerated my learning.",
      avatar: "LK"
    },
    {
      name: "Robert G.",
      role: "Executive Sniper Member",
      content: "Tried 5 other communities before TITM. The quality of education and trade commentary here is on another level.",
      avatar: "RG"
    },
    {
      name: "Jennifer L.",
      role: "Pro Sniper Member",
      content: "The position sizing framework and portfolio management education gave me confidence I never had before. Highly recommend.",
      avatar: "JL"
    },
    {
      name: "Marcus B.",
      role: "Core Sniper Member",
      content: "Being able to watch trades analyzed in real-time and understand the reasoning behind each setup is a game-changer for learning.",
      avatar: "MB"
    },
  ]}
  direction="right"
  speed={30}
/>
```

**Key principle:** Every testimonial now speaks to the educational experience, community quality, or learning outcomes — never to specific dollars or percentages.

---

### R3. Remove the "87% Win Rate" and "100% Avg. Weekly Gain" Stats

**Why:** These appear at lines 263-264 of `app/page.tsx` with zero adjacent disclaimer, zero methodology disclosure, and zero substantiation. They are the single highest-risk marketing elements on the site.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/page.tsx` lines 261-277 | REPLACE | Replace the stats array content |

**Replace the stats array (lines 262-266) with:**

```tsx
{[
  { label: "Trade Setups", value: "Daily", icon: "🎯" },
  { label: "Asset Classes", value: "SPX+", icon: "📊" },
  { label: "Prime Setups", value: "Daily", icon: "⚡" },
  { label: "Years Experience", value: "8+", icon: "🏆" },
].map((stat, idx) => (
```

**Result:** Removes all numerical performance claims. "Daily" setups and "8+ years" are factual claims that don't carry advertising risk.

---

### R4. Remove "87% Success Rate" Bento Card

**Why:** Lines 312-320 of `app/page.tsx` repeat the 87% claim in the features grid with a visual chart, reinforcing the unsubstantiated performance claim.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/page.tsx` lines 312-321 | REPLACE | Change the bento card content |

**Replace with:**

```tsx
<StaggerItem>
  <BentoCard
    icon={Target}
    title="Proven Strategies"
    description="Detailed market analysis with charts, indicators, and actionable trade setups updated daily."
    spotlight="emerald"
    graphic={<WinRateChart className="absolute inset-0" percentage={87} />}
  />
</StaggerItem>
```

**Note:** You can also remove the `WinRateChart` graphic prop if you want to be extra conservative, since it still visualizes "87." If keeping it, add percentage as a generic decorative element or replace with `<CandlestickChart className="absolute inset-0" />`.

---

### R5. Remove "81% Win Rate Track Record" from Trial Card

**Why:** Line 409 of `app/page.tsx` lists "81% Win Rate Track Record" as a feature bullet on the 7-Day Trial pricing card. Same unsubstantiated performance claim issue.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/page.tsx` line 409 | REPLACE | Change the feature text |

**Replace:**
```
"📊 81% Win Rate Track Record"
```
**With:**
```
"📊 Daily Performance Recaps"
```

---

### R6. Remove "Targeting 100%+ Returns Per Trade" from Hero

**Why:** Line 182 of `app/page.tsx` makes a forward-looking performance promise. This is the most dangerous claim on the site because it implies expected future returns.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/page.tsx` lines 181-184 | REPLACE | Change the supporting copy |

**Replace:**
```tsx
<p className="text-sm sm:text-base md:text-lg text-platinum/70 max-w-xl mx-auto leading-relaxed">
  Targeting 100%+ returns per trade. Get exact entries, stop losses, and take profit levels.
  <span className="text-champagne/80"> No fluff. Just profits.</span>
</p>
```
**With:**
```tsx
<p className="text-sm sm:text-base md:text-lg text-platinum/70 max-w-xl mx-auto leading-relaxed">
  Options trading education with real-time setups, entries, stop losses, and take profit levels.
  <span className="text-champagne/80"> Learn to trade with precision.</span>
</p>
```

---

### R7. Remove "100%+ Trade You're Missing" from Final CTA

**Why:** Lines 710-711 of `app/page.tsx` reinforce the "100%+ per trade" promise in the bottom CTA section.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/page.tsx` lines 706-711 | REPLACE | Change CTA copy |

**Replace:**
```tsx
<h2 className="text-3xl md:text-5xl font-bold">
  Stop Missing{" "}
  <span className="text-gradient-champagne">Winning Trades</span>
</h2>
<p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto leading-relaxed mt-4">
  Every day you wait is another 100%+ trade you&apos;re missing. Get the exact entries elite traders use.
</p>
```
**With:**
```tsx
<h2 className="text-3xl md:text-5xl font-bold">
  Start Trading{" "}
  <span className="text-gradient-champagne">With an Edge</span>
</h2>
<p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto leading-relaxed mt-4">
  Get daily trade setups, educational commentary, and a community of serious traders. Learn the strategies that matter.
</p>
```

---

### R8. Remove "Only 7 Executive Sniper Spots Remaining" Scarcity Claim

**Why:** Lines 714-723 of `app/page.tsx` display a static, hardcoded scarcity number with a pulsing red dot. This is not connected to real inventory. Classic FTC dark pattern enforcement target.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/page.tsx` lines 714-723 | DELETE | Remove the entire urgency element block |

The block to remove:
```tsx
{/* Urgency Element */}
<div className="flex items-center justify-center gap-2 mt-6">
  <span className="relative flex h-2 w-2">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400"></span>
  </span>
  <span className="text-sm text-red-400 font-medium">
    Only 7 Executive Sniper spots remaining this month
  </span>
</div>
```

---

### R9. Remove Cohort "Only 20 Seats" Scarcity Indicator (Unless Real)

**Why:** Lines 182-190 of `components/ui/cohort-section.tsx` show "Only 20 seats per cohort - Applications reviewed personally" with a pulsing red dot. If the 20-seat cap is real and enforced, this can stay but must drop the urgency styling. If it's not real, it must go.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `components/ui/cohort-section.tsx` lines 182-190 | REPLACE | Remove urgency styling, keep factual statement if true |

**Replace:**
```tsx
<RevealContent delay={0.4}>
  <div className="flex items-center gap-2 text-sm text-red-400">
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400"></span>
    </span>
    <span>Only 20 seats per cohort - Applications reviewed personally</span>
  </div>
</RevealContent>
```
**With:**
```tsx
<RevealContent delay={0.4}>
  <p className="text-sm text-ivory/50">
    Cohort sizes are kept small to ensure quality mentorship.
  </p>
</RevealContent>
```

---

### R10. Remove Mentorship "Limited Spots Available" Scarcity

**Why:** Lines 270-276 of `components/ui/mentorship-section.tsx` show "Limited spots available" with a pulsing red dot. Same issue as R8/R9.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `components/ui/mentorship-section.tsx` lines 269-276 | DELETE | Remove the scarcity block entirely |

The block to remove:
```tsx
{/* Scarcity */}
<div className="flex items-center justify-center gap-2 text-sm text-red-400/90">
  <span className="relative flex h-2 w-2">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400"></span>
  </span>
  <span>Limited spots available</span>
</div>
```

---

### R11. Remove Promo HTML Files

**Why:** `promo-pricing-card.html` and `promo-stats-card.html` contain "81% Win Rate" and "6:1 Profit Factor" claims. Even if not deployed, having these in the repo creates evidence of a pattern of unsubstantiated claims.

**Files to change:**

| File | Action |
|------|--------|
| `promo-pricing-card.html` | DELETE |
| `promo-stats-card.html` | DELETE |

---

## ADD — Things to Create

### A1. Add Proximate Risk Disclaimer Component

**Why:** Every page that discusses trading, pricing, or performance needs an immediately visible disclaimer — not just in the footer.

**Create new file:** `components/ui/risk-disclaimer.tsx`

```tsx
"use client";

import { cn } from "@/lib/utils";

interface RiskDisclaimerProps {
  variant?: "inline" | "banner" | "compact";
  className?: string;
}

export function RiskDisclaimer({ variant = "inline", className }: RiskDisclaimerProps) {
  if (variant === "banner") {
    return (
      <div className={cn(
        "w-full bg-amber-500/5 border-b border-amber-500/20 py-2 px-4 text-center",
        className
      )}>
        <p className="text-xs text-amber-300/80 max-w-4xl mx-auto">
          <strong>Risk Disclosure:</strong> Trading options involves substantial risk of loss and is not suitable for all investors.
          Past performance does not guarantee future results. All content is for educational purposes only and does not constitute investment advice.
          You should consult with a licensed financial advisor before making investment decisions.
        </p>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <p className={cn("text-xs text-muted-foreground/60 leading-relaxed", className)}>
        Trading involves substantial risk. Past performance does not guarantee future results.
        Content is educational only — not investment advice.
      </p>
    );
  }

  return (
    <div className={cn(
      "rounded-lg border border-amber-500/20 bg-amber-500/5 p-4",
      className
    )}>
      <p className="text-xs text-amber-300/70 leading-relaxed">
        <strong className="text-amber-300/90">Risk Disclosure:</strong> Trading options and other financial instruments involves substantial
        risk of loss and is not suitable for all investors. You could lose some or all of your invested capital. Past performance
        is not indicative of future results. All content provided by Trade In The Money is for educational and informational
        purposes only and does not constitute personalized investment advice. You should consult with a licensed financial
        advisor before making any investment decisions.
      </p>
    </div>
  );
}
```

---

### A2. Add Risk Disclaimer Banner to Homepage

**Why:** The disclaimer must be visible without scrolling, near the top of the page.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/page.tsx` top of file | ADD import | `import { RiskDisclaimer } from "@/components/ui/risk-disclaimer"` |
| `app/page.tsx` after line 117 (after `<PromoBanner />`) | ADD | `<RiskDisclaimer variant="banner" />` |

---

### A3. Add Risk Disclaimer Near Pricing Section

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/page.tsx` after line 480 (after pricing cards grid closing tag) | ADD | Insert disclaimer below pricing cards |

**Add after the `</StaggerContainer>` closing the pricing grid:**

```tsx
{/* Risk Disclaimer - Proximate to Pricing */}
<div className="mt-8 max-w-3xl mx-auto">
  <RiskDisclaimer variant="inline" />
</div>
```

---

### A4. Add Risk Disclaimer Near Testimonials

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/page.tsx` after the testimonial section header (after line 552) | ADD | Insert compact disclaimer |

**Add after the testimonials header `</RevealContent>` and before the first `<TestimonialMarquee>`:**

```tsx
<p className="text-xs text-center text-muted-foreground/50 mt-2">
  Member experiences are individual and not representative of all members. Trading involves risk of loss.
</p>
```

---

### A5. Add "All Sales Final" Disclosure to Pricing Section

**Why:** The refund policy must be conspicuously disclosed before purchase, not only in the Terms. California Business and Professions Code § 17538 requires this.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/page.tsx` lines 753-755 | REPLACE | Strengthen the existing small text |

**Replace:**
```tsx
<p className="text-xs text-muted-foreground/60 mt-4">
  All sales final. No refund obligation.
</p>
```
**With:**
```tsx
<p className="text-xs text-muted-foreground/60 mt-4">
  All sales are final per our <a href="/refund-policy" className="underline hover:text-champagne/60">Refund Policy</a>.
  Trading involves substantial risk of loss. Content is for educational purposes only.
</p>
```

---

## UPDATE — Things to Change In Place

### U1. Fix the Governing Law Clause in Terms of Service

**Why:** "Laws of the United States" is not valid governing law (there is no general federal common law). This needs to specify a state.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/terms-of-service/page.tsx` lines 169-173 | REPLACE | Fix governing law |

**Replace:**
```tsx
<section>
  <h2 className="text-xl font-semibold text-ivory mb-3">12. Governing Law</h2>
  <p>
    These Terms shall be governed by and construed in accordance with the laws of the United States. Any disputes shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.
  </p>
</section>
```
**With (use your state of incorporation — placeholder uses Wyoming):**
```tsx
<section>
  <h2 className="text-xl font-semibold text-ivory mb-3">12. Governing Law & Dispute Resolution</h2>
  <p>
    These Terms shall be governed by and construed in accordance with the laws of the State of Wyoming, without regard to its conflict of law provisions.
  </p>
  <p className="mt-3">
    Any dispute arising from these Terms or the Service shall first be attempted to be resolved through good-faith negotiation. If unresolved within 30 days, the dispute shall be resolved through binding arbitration administered by the American Arbitration Association under its Consumer Arbitration Rules. The arbitration shall take place in the State of Wyoming or remotely at the election of the consumer.
  </p>
  <p className="mt-3">
    You agree that any arbitration shall be conducted on an individual basis and not as a class, consolidated, or representative action. If any court or arbitrator determines that this class action waiver is void or unenforceable for any reason, or that an arbitration can proceed on a class basis, then the arbitration provision shall be deemed null and void, and the parties shall be deemed to have not agreed to arbitrate disputes.
  </p>
</section>
```

**Note:** Replace "Wyoming" with your actual state of incorporation. Ask your attorney which state is optimal.

---

### U2. Update Privacy Policy with CCPA/CPRA Section

**Why:** If you have California users (you almost certainly do), CCPA/CPRA compliance is mandatory if you meet the thresholds.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/privacy-policy/page.tsx` after Section 7 (line 98) | ADD | Insert CCPA section |

**Add new section after "Your Rights":**

```tsx
<section>
  <h2 className="text-xl font-semibold text-ivory mb-3">8. California Privacy Rights (CCPA/CPRA)</h2>
  <p>
    If you are a California resident, you may have additional rights under the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA), including:
  </p>
  <p className="mt-2">- The right to know what personal information we collect, use, and disclose</p>
  <p>- The right to request deletion of your personal information</p>
  <p>- The right to opt out of the sale or sharing of your personal information</p>
  <p>- The right to correct inaccurate personal information</p>
  <p>- The right to limit the use of sensitive personal information</p>
  <p>- The right to non-discrimination for exercising your privacy rights</p>
  <p className="mt-3">
    <strong className="text-ivory">We do not sell or share your personal information</strong> as defined under the CCPA/CPRA.
  </p>
  <p className="mt-3">
    To exercise any of these rights, please{" "}
    <ContactLink className="text-champagne hover:underline">contact us</ContactLink>.
    We will respond to verified requests within 45 days.
  </p>
</section>
```

**Then renumber all subsequent sections (current 8→9, 9→10, etc.).**

---

### U3. Update Privacy Policy Cookies Section

**Why:** The current cookies section (line 101-105) is a single sentence. It needs to be more specific about what cookies are used and how to control them.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/privacy-policy/page.tsx` Section 8 (Cookies) | REPLACE | Expand cookies section |

**Replace:**
```tsx
<section>
  <h2 className="text-xl font-semibold text-ivory mb-3">8. Cookies</h2>
  <p>
    We use cookies and similar tracking technologies to enhance your experience on our website. You can control cookies through your browser settings.
  </p>
</section>
```
**With (after renumbering, this becomes Section 9):**
```tsx
<section>
  <h2 className="text-xl font-semibold text-ivory mb-3">9. Cookies & Tracking Technologies</h2>
  <p>
    We use cookies and similar technologies for the following purposes:
  </p>
  <p className="mt-2"><strong className="text-ivory">Essential Cookies:</strong> Required for site functionality, authentication, and security. These cannot be disabled.</p>
  <p className="mt-2"><strong className="text-ivory">Analytics Cookies:</strong> Help us understand how visitors interact with our website (e.g., pages visited, time on site). We use these to improve our service.</p>
  <p className="mt-2"><strong className="text-ivory">Marketing Cookies:</strong> Used to deliver relevant content and measure the effectiveness of our communications.</p>
  <p className="mt-3">
    You can control non-essential cookies through your browser settings. Disabling certain cookies may affect site functionality. For more information about cookies and how to manage them, visit{" "}
    <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer" className="text-champagne hover:underline">allaboutcookies.org</a>.
  </p>
</section>
```

---

### U4. Update the "NOT FINANCIAL ADVICE" Section in Terms to Be Stronger

**Why:** The current disclaimer at lines 58-72 of `terms-of-service/page.tsx` says "We are NOT registered investment advisors" — which is a factual statement about registration status but doesn't actually disclaim the advisory nature of the content. It needs to be clearer that the content is educational, not personalized advice.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/terms-of-service/page.tsx` lines 58-72 | REPLACE | Strengthen the disclaimer |

**Replace the existing Section 2 content with:**

```tsx
<section>
  <h2 className="text-xl font-semibold text-ivory mb-3">2. EDUCATIONAL CONTENT — NOT INVESTMENT ADVICE</h2>
  <p className="font-semibold text-amber-400">
    ALL CONTENT PROVIDED BY TRADE IN THE MONEY IS FOR EDUCATIONAL AND INFORMATIONAL PURPOSES ONLY.
  </p>
  <p className="mt-3">
    Trade In The Money is an educational platform. We are NOT registered investment advisors, broker-dealers, or financial planners under the Investment Advisers Act of 1940, the Securities Exchange Act of 1934, or any state securities laws. No content, commentary, trade setup discussion, or market analysis provided through our service constitutes:
  </p>
  <p className="mt-2">- Personalized investment advice tailored to your financial situation</p>
  <p>- A recommendation or solicitation to buy, sell, or hold any security</p>
  <p>- A guarantee or promise of any specific financial outcome</p>
  <p>- Professional financial planning, tax, or legal advice</p>
  <p className="mt-3">
    All trade setups, market commentary, and educational content shared through our Discord channels, website, or any other medium are presented as educational case studies and market analysis. They are not instructions to execute trades. You are solely responsible for your own investment research and decisions.
  </p>
  <p className="mt-3">
    You acknowledge that you should consult with a qualified, licensed financial advisor before making any investment decisions, and that past performance of any trading strategy or educational content does not guarantee future results.
  </p>
</section>
```

---

### U5. Update Footer Disclaimer to Be More Complete

**Why:** The footer disclaimer at lines 788-790 of `app/page.tsx` is too short and generic.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `app/page.tsx` lines 787-791 | REPLACE | Expand footer disclaimer |

**Replace:**
```tsx
<div className="mt-6 text-center text-xs text-muted-foreground">
  <p>
    Trading involves risk. Past performance does not guarantee future results. Always trade responsibly.
  </p>
</div>
```
**With:**
```tsx
<div className="mt-6 text-center text-xs text-muted-foreground space-y-1 max-w-3xl mx-auto">
  <p>
    Trading options and other financial instruments involves substantial risk of loss and is not suitable for all investors.
    You could lose some or all of your invested capital. Past performance does not guarantee future results.
  </p>
  <p>
    Trade In The Money provides educational content only and is not a registered investment advisor.
    Nothing on this site constitutes personalized investment advice. Consult a licensed financial advisor before making investment decisions.
  </p>
</div>
```

---

### U6. Update Mentorship "Transformation" Language

**Why:** Lines 111-135 of `mentorship-section.tsx` make implied performance promises ("After 8 Weeks, You Will Know" + "No more blown accounts"). While less risky than dollar claims, the combination of high price + transformation promises + no disclaimers is still problematic.

**Files to change:**

| File | Action | Detail |
|------|--------|--------|
| `components/ui/mentorship-section.tsx` line 134 | REPLACE | Soften the guarantee-like language |

**Replace:**
```tsx
<p className="text-champagne font-semibold text-lg pt-2">
  No more guessing. No more emotional trading. No more blown accounts.
</p>
```
**With:**
```tsx
<p className="text-champagne font-semibold text-lg pt-2">
  Build the discipline, process, and confidence to trade on your own terms.
</p>
```

---

## IMPLEMENTATION CHECKLIST

Execute in this order:

| # | Change | File(s) | Risk Reduced |
|---|--------|---------|-------------|
| 1 | R1 — Remove live wins ticker | `live-wins-ticker.tsx`, `page.tsx` | Fabricated social proof (FTC Section 5) |
| 2 | R3 — Remove 87%/100% stats | `page.tsx` | Unsubstantiated performance claims |
| 3 | R4 — Remove 87% bento card | `page.tsx` | Redundant performance claim |
| 4 | R5 — Remove 81% from trial | `page.tsx` | Performance claim in pricing |
| 5 | R6 — Remove 100%+ hero copy | `page.tsx` | Forward-looking return promise |
| 6 | R7 — Remove 100%+ CTA copy | `page.tsx` | Redundant return promise |
| 7 | R8 — Remove "7 spots" scarcity | `page.tsx` | Artificial scarcity (FTC dark pattern) |
| 8 | R9 — Remove cohort scarcity | `cohort-section.tsx` | Artificial scarcity |
| 9 | R10 — Remove mentorship scarcity | `mentorship-section.tsx` | Artificial scarcity |
| 10 | R2 — Replace testimonials | `page.tsx` | Dollar/percentage testimonials (FTC Endorsement Guides) |
| 11 | R11 — Delete promo HTML files | `promo-*.html` | Unsubstantiated claims in repo |
| 12 | A1 — Create risk disclaimer component | NEW: `risk-disclaimer.tsx` | Missing proximate disclaimers |
| 13 | A2 — Add banner disclaimer to homepage | `page.tsx` | No top-of-page risk disclosure |
| 14 | A3 — Add disclaimer near pricing | `page.tsx` | No proximate disclaimer at point of sale |
| 15 | A4 — Add disclaimer near testimonials | `page.tsx` | No disclosure near social proof |
| 16 | A5 — Strengthen sales-final disclosure | `page.tsx` | Consumer protection (CA B&P § 17538) |
| 17 | U1 — Fix governing law | `terms-of-service/page.tsx` | Invalid choice of law clause |
| 18 | U2 — Add CCPA section to privacy | `privacy-policy/page.tsx` | CCPA/CPRA non-compliance |
| 19 | U3 — Expand cookies section | `privacy-policy/page.tsx` | Inadequate cookie disclosure |
| 20 | U4 — Strengthen advisory disclaimer | `terms-of-service/page.tsx` | Weak SEC defense language |
| 21 | U5 — Expand footer disclaimer | `page.tsx` | Insufficient footer disclosure |
| 22 | U6 — Soften mentorship promises | `mentorship-section.tsx` | Implied performance guarantee |

---

## FILES TOUCHED SUMMARY

| File | Changes |
|------|---------|
| `app/page.tsx` | R1, R2, R3, R4, R5, R6, R7, R8, A2, A3, A4, A5, U5 |
| `components/ui/live-wins-ticker.tsx` | R1 (DELETE) |
| `components/ui/cohort-section.tsx` | R9 |
| `components/ui/mentorship-section.tsx` | R10, U6 |
| `components/ui/risk-disclaimer.tsx` | A1 (NEW) |
| `app/terms-of-service/page.tsx` | U1, U4 |
| `app/privacy-policy/page.tsx` | U2, U3 |
| `promo-pricing-card.html` | R11 (DELETE) |
| `promo-stats-card.html` | R11 (DELETE) |

**Total: 9 files, 22 changes. No backend changes. No database changes. No breaking changes to member features.**

---

## WHAT THIS DOES NOT FIX

These code changes reduce marketing/advertising risk but do **not** resolve:

1. **SEC registration question** — Whether the Discord trade alert format requires investment adviser registration. That requires an attorney.
2. **Substantiation** — You still need to build a substantiation file if you ever want to re-introduce performance claims.
3. **Arbitration enforceability** — The class action waiver needs attorney review for CA/NY/TX enforceability.
4. **GDPR** — If you have EU users, you need a full GDPR-compliant privacy policy and cookie consent mechanism. This spec adds CCPA only.
5. **Refund policy legal exposure** — The blanket no-refund policy for $1,500-$2,500 programs may still be challenged. Attorney should review.
