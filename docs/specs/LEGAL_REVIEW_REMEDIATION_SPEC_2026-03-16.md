# TradeITM Legal Review & Remediation Spec

**Document Type:** Execution Specification — Legal Compliance Remediation
**Date:** March 16, 2026
**Status:** DRAFT — Pending Attorney Review
**Priority:** P0 (Regulatory Exposure)
**Owner:** Nate Kahl
**Prepared For:** Securities/Advertising Attorney Engagement

---

## 1. Objective

Systematically identify, prioritize, and remediate all legal and regulatory compliance issues across TradeITM's public-facing marketing surfaces, Terms of Service, Privacy Policy, and product delivery mechanisms. This spec serves as the canonical work plan for an attorney engagement and the subsequent implementation of their guidance.

---

## 2. Scope

**In Scope:**

- Homepage and all public marketing pages (performance claims, testimonials, social proof)
- Terms of Service (governing law, arbitration, refund policy)
- Privacy Policy (CCPA/CPRA, GDPR, cookie consent)
- Discord trade alert delivery channel (advisory content)
- Membership sales pages (Executive Sniper, Mentorship tiers)
- All marketing copy referencing win rates, returns, or dollar amounts

**Out of Scope:**

- Internal member-only platform features (AI Coach, Journal, SPX Command Center) — these may require a separate product-level compliance review but are not public-facing marketing
- Backend infrastructure and codebase changes (unless required to implement a legal remediation, e.g., removing a social proof widget)
- Tax or corporate structure advice

---

## 3. Risk Register — Issues by Severity

### 3.1 CRITICAL — Immediate Regulatory Exposure

#### Issue CR-1: Unregistered Investment Adviser Activity

**Current State:** The TradeITM service delivers specific, actionable trade alerts via Discord, including exact ticker symbols, strike prices, expiration dates, and entry/exit price levels (e.g., "buy NVDA 1000C @ 2.50"). These alerts are provided to paying subscribers as a core product feature.

**Legal Risk:** Under the Investment Advisers Act of 1940 (Section 202(a)(11)), any person who, for compensation, engages in the business of advising others as to the value of securities or the advisability of investing in securities must register as an investment adviser with the SEC, or qualify for an exemption. Providing specific buy/sell recommendations with exact entry points on named securities to paying members almost certainly constitutes investment advice. The "educational purposes only" disclaimer in the current Terms of Service does not override the substance of the activity. The SEC applies a substance-over-form analysis: if the service walks, talks, and functions like investment advice, a disclaimer calling it "education" will not provide protection.

**Potential Consequences:** SEC enforcement action; cease-and-desist order; disgorgement of profits; civil monetary penalties; potential referral for criminal prosecution if deemed willful; state-level securities regulator actions in all 50 states; member lawsuits for losses incurred following unregistered advice.

**Remediation Options (for attorney to evaluate):**

1. **Register as an Investment Adviser (RIA)** with the SEC or applicable state regulators. This triggers ongoing compliance obligations: Form ADV filing, written compliance policies, books and records requirements, custody rules (if applicable), annual filings, and potentially a compliance officer.
2. **Register as a publisher under the "publisher's exclusion"** (Section 202(a)(11)(D)) — but this exclusion is narrow. It applies only to bona fide publishers of general circulation who do not provide advice tailored to individual clients. Specific trade alerts sent to a subscriber group likely do not qualify.
3. **Restructure the service** to be genuinely educational — remove specific entry/exit prices, strike prices, and ticker recommendations from alerts. Reframe all content as educational case studies or market analysis without actionable trade instructions. This is the most conservative option but changes the core product.
4. **Operate under a registered broker-dealer** — if trade execution is contemplated, FINRA registration may also be necessary.
5. **Assess "impersonal advice" exemption** under Section 202(a)(11)(C) — advice given through publications or writings that do not purport to tailor advice to individual needs. This has narrow applicability and needs attorney analysis.

**Attorney Questions to Resolve:**

- Does the current alert format (specific ticker, strike, entry price to a group channel) qualify as investment advice under SEC guidance and relevant case law (SEC v. Lowe, SEC no-action letters)?
- If registration is required, is state-level registration (for fewer than 15 clients or under $100M AUM) sufficient, or is SEC registration required?
- Does any team member's background (e.g., prior FINRA registration, CFA, Series 65/66) create additional obligations or simplify a registration path?
- Is there a viable path to operate under the publisher's exclusion if alerts are restructured?

---

#### Issue CR-2: Misleading Performance Claims (FTC Act Section 5 / SEC Marketing Rule)

**Current State:** The homepage prominently displays the following claims in large, attention-grabbing format near the top of the page:

- "87% Win Rate"
- "100% Avg. Weekly Gain"
- "Targeting 100%+ returns per trade"

These claims appear without any adjacent disclaimer, qualifying language, or methodology disclosure. The only disclaimer ("past performance doesn't guarantee future results") is buried in the footer, physically separated from the claims by multiple viewport heights of content.

**Legal Risk — FTC:** Under FTC Act Section 5 (15 U.S.C. § 45), advertising claims must be truthful, not misleading, and substantiated before dissemination. The FTC's Endorsement Guides (16 CFR Part 255, revised 2023) and its enforcement history establish that performance claims in advertising must reflect typical consumer experience OR clearly and conspicuously disclose what typical results are. "Clear and conspicuous" under FTC guidance means the disclosure must be in close proximity to the claim, in the same format and prominence, and unavoidable by the consumer — not buried in a footer.

**Legal Risk — SEC:** If TradeITM is or should be a registered investment adviser, the SEC Marketing Rule (Rule 206(4)-1 under the Advisers Act, effective November 2022) imposes specific requirements on performance advertising: hypothetical performance must include certain disclosures; gross and net performance must be shown together; extracted performance (cherry-picked wins) is prohibited without context; and all performance must include prescribed legends.

**Remediation Requirements (Minimum):**

1. **Substantiation file:** Create and maintain a written substantiation document showing exactly how each performance metric is calculated. This file must include: the date range, the total number of alerts issued, the methodology for determining "wins" vs. "losses" (including criteria for when a trade is deemed closed), whether partial fills or different execution times are accounted for, and whether the metric includes all alerts or only a subset.
2. **Proximate disclaimer:** Every instance where a performance figure appears on a page must have a disclaimer immediately adjacent (within the same visual block, same font size or no more than one size smaller, not separated by a scroll break). The disclaimer must state at minimum: "Past performance does not guarantee future results. These results are based on [specific methodology]. Individual results vary. See full disclaimer [link]."
3. **Typical results disclosure:** If the displayed results are not representative of what an average paying member experiences, add a clear disclosure of what typical member results look like. This must be based on actual data, not a generic "results may vary."
4. **Methodology page:** Create a dedicated page (linked from every performance claim) that discloses the full calculation methodology, including: date range, number of trades, win/loss criteria, whether slippage and commissions are included, whether the figures are based on paper trades or actual fills.
5. **Remove or qualify "Targeting 100%+ returns per trade":** This forward-looking claim is particularly dangerous. It implies expected future performance. Either remove it entirely or reframe it with heavy qualification (e.g., "Our trading approach focuses on high-conviction setups. Actual returns per trade vary widely and can include significant losses.").

**Attorney Questions to Resolve:**

- Are the current performance metrics substantiable? What documentation currently exists?
- Should performance claims be removed entirely pending registration resolution (Issue CR-1)?
- If not registered, does displaying performance metrics create additional evidence of acting as an unregistered adviser?
- What specific disclaimer language does the attorney recommend for each claim?

---

#### Issue CR-3: Testimonials with Specific Dollar Amounts and Percentage Returns

**Current State:** The website displays member testimonials citing very specific financial outcomes:

- "Account grew 180% in 6 months"
- "$22,000 in a quarter"
- "Turned $2,500 into $11,200"
- Additional similar claims with specific dollar figures

These testimonials appear without any disclosure of whether these results are typical, what percentage of members achieve comparable results, or any "results not typical" qualifier.

**Legal Risk:** The FTC's revised Endorsement Guides (effective 2023) eliminated the previous safe harbor of simply adding "results not typical." Under current guidance, endorsements reflecting the experience of one consumer must either: (a) represent the results that consumers generally achieve, OR (b) clearly and conspicuously disclose the generally expected results, backed by competent and reliable evidence. If TradeITM cannot demonstrate that these outcomes represent typical member experience, displaying them without disclosing typical results is likely deceptive advertising under FTC Act Section 5.

Additionally, if these testimonials were solicited, compensated (including free membership), or if the testimonial providers have a material connection to TradeITM (e.g., affiliate relationships), that connection must be disclosed.

**Remediation Requirements:**

1. **Audit every testimonial** currently displayed. For each, document: the member's name or identifier, the exact time period referenced, whether the claimed result has been verified against actual brokerage statements, whether the member received any compensation or benefit for providing the testimonial, and whether the member has any material connection to TradeITM.
2. **Calculate and disclose typical member results.** Compile actual performance data across all paying members for a representative period. Determine median and average outcomes. If the featured testimonials are outliers, you must either: (a) replace them with testimonials reflecting typical results, or (b) add a prominent disclosure stating what typical results look like, placed immediately adjacent to each testimonial (not in a footer or separate page).
3. **Add material connection disclosures** to any testimonial where the provider received free membership, compensation, or has any other material connection.
4. **Maintain a testimonial substantiation file** containing: the original testimonial, evidence of the result (e.g., brokerage statement screenshot with sensitive data redacted), verification date, and disclosure language applied.
5. **Consider removing all financial-figure testimonials** until the substantiation and disclosure framework is in place. Replace with qualitative testimonials about the educational experience, community quality, etc.

**Attorney Questions to Resolve:**

- What constitutes adequate verification of a testimonial claim (brokerage screenshots, written attestation, other)?
- If typical results data shows most members do not achieve the advertised outcomes, is it safer to remove the testimonials entirely rather than add a negative disclosure?
- Do state-level consumer protection laws (particularly California, New York, Florida, Texas — likely the largest member populations) impose additional testimonial requirements?

---

### 3.2 HIGH — Significant Legal Risk

#### Issue HI-1: Fabricated or Unsubstantiated Social Proof Notifications

**Current State:** The website displays rotating pop-up notifications in real time, e.g.:

- "S. Rodriguez just hit +87% on TSLA"
- "A. Thompson just hit +94% on META"

These appear to show live member trading results.

**Legal Risk:** If these notifications are fabricated, algorithmically generated, or use fictitious names/results, they constitute deceptive trade practices under FTC Act Section 5. Even if the results are real but cherry-picked (only showing winners, never showing losses), this creates a materially misleading impression of what members can expect. The FTC has brought enforcement actions against companies using fake social proof (FTC v. Sunday Riley, 2019, for fake reviews; FTC v. Roomster, 2023, for fake testimonials).

**Remediation Requirements:**

1. **Determine the source of these notifications.** Answer definitively: Are they pulled from real, verified trade data from actual members? Are they generated from a database of historical results? Are they randomized or fabricated for marketing effect?
2. **If real:** Maintain a data trail linking each notification to a verified trade (member ID, trade ID, timestamp, result). Ensure the selection is not cherry-picked — either show a representative sample (including losses) or add a disclosure that "Featured results highlight winning trades and are not representative of all member outcomes."
3. **If fabricated or synthetic:** Remove immediately. There is no compliant way to display fabricated trading results as if they are real. This is straightforward deceptive advertising.
4. **If based on real data but cherry-picked:** Add an immediately adjacent disclosure stating that only winning trades are featured and that these results do not represent typical member experience. Alternatively, show a balanced feed that includes losing trades.
5. **Implement a "social proof substantiation log"** that records every notification displayed, the underlying data source, and the member's consent to have their result displayed (even in anonymized form, GDPR/CCPA may apply).

**Attorney Questions to Resolve:**

- If notifications are based on real but cherry-picked data, is a disclosure sufficient or should they be removed?
- Does displaying even anonymized member trading results (initials + percentage) require member consent under applicable privacy laws?
- What record retention requirements apply to substantiation of advertising claims?

---

#### Issue HI-2: Deceptive Urgency and Artificial Scarcity

**Current State:** The website displays "Only 7 Executive Sniper spots remaining this month" (or similar count). It is unclear whether this number reflects actual inventory constraints or is a static/arbitrary marketing element.

**Legal Risk:** The FTC has pursued enforcement actions against companies using fake countdown timers and artificial scarcity claims (FTC v. Age of Empires / Microsoft, settlement; multiple FTC dark patterns enforcement actions 2021-2024). The EU Digital Services Act and the California Consumer Privacy Act's dark patterns provisions (CCPA Regs § 7004(a)) also specifically target artificial urgency/scarcity tactics. If the number does not change based on actual enrollment, or if there is no genuine capacity constraint, this is a deceptive marketing practice.

**Remediation Requirements:**

1. **Determine whether the scarcity claim is real.** Is there actually a cap on Executive Sniper memberships? If so, does the displayed number reflect real-time availability?
2. **If real:** Connect the display to actual inventory data. The number must decrement when a spot is sold and reset only when new spots genuinely become available. Maintain logs showing the number displayed at any time corresponds to actual availability.
3. **If not real:** Remove the scarcity claim entirely. Replace with honest marketing copy that does not imply limited availability unless it is genuine.
4. **Audit all urgency/scarcity language** across the site. This includes countdown timers, "limited time" offers, "spots filling fast" language, and any similar tactics. Each must be backed by genuine constraints or removed.

---

#### Issue HI-3: Defective Governing Law and Arbitration Clause

**Current State:** The Terms of Service specify "laws of the United States" as the governing law. The arbitration clause includes a class action waiver.

**Legal Risk:** "Laws of the United States" is not a valid choice of law — there is no general federal common law (Erie Railroad Co. v. Tompkins, 1938). A governing law clause must specify a particular state (e.g., "the laws of the State of [X]"). Without a valid choice of law, a court could apply the law of any state with a connection to the dispute, which creates unpredictability. Additionally, class action waivers in consumer arbitration agreements are unenforceable in some states (notably California under McGill v. Citibank, for claims seeking public injunctive relief) and may be challenged under unconscionability doctrines in others, particularly where the contract is one of adhesion and the consumer has no meaningful bargaining power.

**Remediation Requirements:**

1. **Specify a state** for governing law. Choose the state where TradeITM is incorporated or principally operates. Consult attorney on strategic considerations (Delaware, Wyoming, and the company's home state each have different implications).
2. **Review the arbitration clause** with attorney for enforceability in key member states (California, New York, Texas, Florida). Address: whether class action waiver is enforceable in all jurisdictions, whether an opt-out period is required, whether a small claims court carve-out is needed, and whether the clause meets unconscionability defenses.
3. **Review the "all sales final" policy** in conjunction with the arbitration clause. If performance claims are deemed misleading, a no-refund policy combined with an arbitration clause could be characterized as an unfair contract term designed to prevent consumers from seeking recourse.
4. **Add severability language** so that if the arbitration or class action waiver is struck down, the remaining Terms survive.

---

#### Issue HI-4: No-Refund Policy Combined with Aggressive Marketing

**Current State:** The Terms of Service state "All Sales Final / No Refund" for all membership tiers, including the $1,500 and $2,500 mentorship programs.

**Legal Risk:** A blanket no-refund policy is not illegal per se, but it becomes legally problematic when combined with marketing claims that may be misleading. If a consumer purchases a $2,500 mentorship based on claims of "87% win rate" and "100% weekly gain" that turn out to be unsubstantiated, the no-refund policy could be challenged as: (a) an unfair contract term under state consumer protection laws (California's CLRA, New York GBL § 349, etc.), (b) evidence of a deceptive scheme when combined with misleading advertising, or (c) unenforceable under state-specific refund laws (California requires conspicuous refund policy disclosure at point of sale; several states allow refunds within specific windows for services not yet rendered).

**Remediation Requirements:**

1. **Consult attorney on whether a limited refund window** (e.g., 7-day or 14-day) should be implemented, particularly for higher-priced tiers, to reduce consumer protection exposure.
2. **Ensure the no-refund policy is conspicuously disclosed** before purchase (not only in Terms of Service). Display it on the checkout page, in confirmation emails, and at any point where payment is collected.
3. **Add a chargeback/dispute process** in the Terms so consumers have a clear escalation path short of filing a complaint with the FTC or state AG.
4. **Review state-specific requirements** — California Business and Professions Code § 17538 requires specific refund policy disclosures for online sales.

---

### 3.3 MEDIUM — Compliance Gaps Requiring Remediation

#### Issue MD-1: Privacy Policy Deficiencies (CCPA/CPRA and GDPR)

**Current State:** The Privacy Policy is described as "fairly standard" but does not address California Consumer Privacy Act/California Privacy Rights Act requirements, does not mention GDPR for EU visitors, and lacks a cookie consent mechanism.

**Remediation Requirements:**

1. **CCPA/CPRA Compliance (if applicable):** If TradeITM meets the CCPA thresholds (annual gross revenue over $25M, OR buys/sells/shares personal information of 100,000+ California consumers/households/devices, OR derives 50%+ of annual revenue from selling/sharing California consumers' personal information), the Privacy Policy must include: categories of personal information collected; purposes for collection; categories of third parties with whom data is shared; right to know, right to delete, right to opt-out of sale/sharing; right to correct; right to limit use of sensitive personal information; a "Do Not Sell or Share My Personal Information" link; notice at collection.
2. **GDPR Compliance (if EU visitors exist):** If any EU residents access the site, add: lawful basis for processing, data subject rights (access, rectification, erasure, portability, restriction, objection), data retention periods, international transfer mechanisms (Standard Contractual Clauses or adequacy decisions), DPO contact information (if required), and right to lodge a complaint with a supervisory authority.
3. **Cookie Consent:** Implement a cookie consent mechanism that: obtains affirmative consent before setting non-essential cookies (required by GDPR/ePrivacy Directive and increasingly by US state laws); provides granular controls (necessary, analytics, marketing); records consent with timestamp; allows withdrawal of consent.
4. **Audit data collection practices** — map all personal data collected, where it is stored (Supabase, analytics platforms, email providers, Discord), who has access, and retention periods. This data map is foundational to a compliant privacy policy.

---

#### Issue MD-2: Proximate Disclaimer Placement

**Current State:** The "past performance does not guarantee future results" disclaimer exists only in the website footer, physically separated from the performance claims that appear at the top of the page.

**Remediation Requirements:**

1. **Place a disclaimer immediately adjacent to every performance statistic.** "Adjacent" means within the same visual container, visible without scrolling, and in a font size no smaller than one step below the claim itself.
2. **Each performance claim requires its own proximate disclaimer.** A single disclaimer at the bottom of a section containing multiple claims may be insufficient if the claims appear in different visual areas.
3. **The disclaimer must include, at minimum:** "Past performance does not guarantee future results. These figures reflect [specific methodology/time period]. Individual results vary significantly. [Link to full methodology]."
4. **For video and social media marketing:** Disclaimers must appear on screen simultaneously with performance claims and remain visible for the duration the claim is displayed.
5. **Maintain a "disclaimer placement audit" document** mapping every page/URL where a performance claim appears, the exact disclaimer text adjacent to it, and the date last verified.

---

## 4. Remediation Priority Matrix

| Priority | Issue ID | Issue | Deadline Target | Owner |
|----------|----------|-------|-----------------|-------|
| P0 — Immediate | CR-1 | Unregistered Investment Adviser | Attorney engagement within 2 weeks; interim action within 30 days | Attorney + Nate |
| P0 — Immediate | CR-2 | Misleading Performance Claims | Remove or add proximate disclaimers within 2 weeks; substantiation file within 30 days | Nate + Attorney |
| P0 — Immediate | CR-3 | Testimonials with Dollar Amounts | Remove or add typical results disclosure within 2 weeks | Nate + Attorney |
| P1 — Urgent | HI-1 | Fake/Unsubstantiated Social Proof | Determine source within 1 week; remove or substantiate within 2 weeks | Nate |
| P1 — Urgent | HI-2 | Artificial Scarcity | Remove or connect to real inventory within 1 week | Nate |
| P1 — Urgent | HI-3 | Defective Governing Law / Arbitration | Attorney revision of Terms within 30 days | Attorney |
| P1 — Urgent | HI-4 | No-Refund + Aggressive Marketing | Attorney review and recommendation within 30 days | Attorney |
| P2 — Required | MD-1 | Privacy Policy Gaps | Full revision within 60 days | Attorney + Nate |
| P2 — Required | MD-2 | Disclaimer Placement | Implement with CR-2 remediation | Nate |

---

## 5. Immediate Interim Actions (Before Attorney Engagement)

These actions can and should be taken immediately to reduce exposure while waiting for attorney review. They are conservative, risk-reducing measures that do not require legal advice:

1. **Remove or heavily qualify all specific performance numbers from the homepage** ("87% Win Rate," "100% Avg. Weekly Gain," "Targeting 100%+ returns per trade"). Replace with general educational messaging or hide behind a "View Performance" click-through that includes a proximate disclaimer.
2. **Remove all testimonials citing specific dollar amounts or percentage returns.** Replace with qualitative testimonials about the educational and community experience.
3. **Remove the social proof notification widget** entirely until its data source is verified and documented.
4. **Remove the "Only 7 spots remaining" scarcity language** unless it can be immediately verified as reflecting real-time inventory.
5. **Add a prominent, sitewide banner disclaimer** at the top of every public page: "TradeITM provides educational content about options trading. Nothing on this site constitutes investment advice. Trading involves substantial risk of loss. Past performance does not guarantee future results."
6. **Fix the governing law clause** from "laws of the United States" to a specific state (the state of incorporation or principal business, as a temporary measure pending full attorney review of the Terms).

---

## 6. Attorney Engagement Brief

The following is a summary for the retained attorney covering the three areas of most serious regulatory exposure.

### 6.1 Question Set for Securities/Advertising Attorney

**Re: Investment Adviser Registration**

1. Given the current trade alert format (specific ticker, strike price, expiration, entry/exit levels delivered to paying subscribers via Discord), is TradeITM required to register as an investment adviser under the Investment Advisers Act of 1940?
2. If registration is required, what is the most practical path — SEC registration, state registration, or operating under a registered entity?
3. Is there a viable restructuring of the alert format that would avoid triggering the registration requirement while preserving educational value?
4. Does any current team member's background create additional registration obligations or simplify a registration path?
5. What is the statute of limitations exposure for operating without registration up to the present date?

**Re: FTC Advertising Compliance**

6. Are the performance claims ("87% Win Rate," "100% Avg. Weekly Gain") substantiable under the FTC's substantiation doctrine? What documentation standard applies?
7. Under the 2023 Endorsement Guides, what specific disclosures are required adjacent to the member testimonials?
8. If typical member results are substantially lower than the featured testimonials, is it legally safer to remove the testimonials or to add a negative disclosure?
9. Does the social proof notification widget (rotating member results) require the same substantiation as a formal testimonial?
10. What record retention requirements apply to advertising substantiation files?

**Re: Terms of Service and Consumer Protection**

11. What state should govern the Terms of Service, and what strategic considerations apply?
12. Is the mandatory arbitration clause with class action waiver enforceable in California, New York, and Texas?
13. Should TradeITM implement a limited refund window for the $1,500 and $2,500 tiers to reduce consumer protection exposure?
14. What specific changes are needed to the Privacy Policy to comply with CCPA/CPRA?

---

## 7. Implementation Tracking

Each remediation item will be tracked as follows. This table is updated as work progresses.

| Issue ID | Status | Date Started | Date Completed | Implemented By | Verified By | Notes |
|----------|--------|--------------|----------------|----------------|-------------|-------|
| CR-1 | NOT STARTED | — | — | — | — | Awaiting attorney engagement |
| CR-2 | NOT STARTED | — | — | — | — | Interim: remove claims from homepage |
| CR-3 | NOT STARTED | — | — | — | — | Interim: remove dollar-figure testimonials |
| HI-1 | NOT STARTED | — | — | — | — | Determine data source first |
| HI-2 | NOT STARTED | — | — | — | — | Quick fix: remove scarcity language |
| HI-3 | NOT STARTED | — | — | — | — | Awaiting attorney engagement |
| HI-4 | NOT STARTED | — | — | — | — | Awaiting attorney engagement |
| MD-1 | NOT STARTED | — | — | — | — | Awaiting attorney engagement |
| MD-2 | NOT STARTED | — | — | — | — | Implement with CR-2 |

---

## 8. File Inventory for Attorney

Provide the following to the retained attorney before the initial consultation:

1. This spec document
2. Current Terms of Service (full text)
3. Current Privacy Policy (full text)
4. Homepage screenshots (full page capture showing all performance claims, testimonials, and social proof notifications)
5. Discord trade alert channel screenshots (showing 10-20 representative alerts with format of ticker/strike/entry/exit)
6. Membership sales page screenshots (all tiers, including Executive Sniper and Mentorship pricing)
7. List of states where known members reside (for jurisdictional analysis)
8. Business entity documents (state of incorporation, EIN, operating agreement)
9. Any existing substantiation documentation for performance claims
10. Any existing records of testimonial verification

---

## 9. Governing References

- Investment Advisers Act of 1940, 15 U.S.C. § 80b-1 et seq.
- SEC Marketing Rule, 17 CFR § 275.206(4)-1 (effective Nov 2022)
- FTC Act Section 5, 15 U.S.C. § 45
- FTC Endorsement Guides, 16 CFR Part 255 (revised 2023)
- FTC Policy Statement on Deception (1983, reaffirmed)
- CCPA/CPRA, Cal. Civ. Code § 1798.100 et seq.
- GDPR, Regulation (EU) 2016/679
- California CLRA, Cal. Civ. Code § 1750 et seq.
- California Business and Professions Code § 17538
- Erie Railroad Co. v. Tompkins, 304 U.S. 64 (1938)
- McGill v. Citibank, N.A., 2 Cal. 5th 945 (2017)

---

**DISCLAIMER:** This document is a remediation planning spec prepared for internal use and attorney engagement. It does not constitute legal advice. All remediation actions should be reviewed and approved by a qualified securities and/or advertising attorney before implementation.
