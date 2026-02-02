# AI Coach - Cost Analysis & Financial Projections

**Status**: Draft
**Last Updated**: 2026-02-03
**Owner**: Nate
**Version**: 1.0

---

## Executive Summary

**Monthly Fixed Costs**: $1,097 - $1,697
**Variable Cost Per User**: $27 - $45
**Break-Even**: 11 paying Pro users
**Target Gross Margin**: 80%+

**12-Month Projection (Conservative)**:
- 150 paying subscribers @ average $180/month
- Monthly Revenue: $27,000
- Monthly Costs: $8,200
- **Monthly Profit: $18,800 ($225,600/year)**

---

## Fixed Monthly Costs

### Data Provider: Massive.com

| Service | Cost | Details |
|---------|------|---------|
| Options Advanced | $199/mo | Full Greeks, IV, 5+ years historical, all US options exchanges |
| Stocks Advanced | $199/mo | 20+ years historical, real-time trades/quotes, technicals |
| Indices Advanced | $199/mo | CME Group, CBOE, Nasdaq indices, index options |
| **Massive.com Total** | **$597/mo** | Unlimited API calls, flat rate |

**Notes**:
- One-time payment for all AI Coach users
- No per-API-call charges
- WebSocket connections included
- Can support 1,000+ users on same subscription

### Infrastructure Costs

| Service | Provider | Cost (Low) | Cost (High) | Details |
|---------|----------|------------|-------------|---------|
| Frontend Hosting | Vercel | $20 | $50 | Pro plan, serverless functions |
| Backend Hosting | Railway/AWS | $50 | $200 | Containerized backend, scales with load |
| Database (PostgreSQL) | Supabase/Railway | $25 | $50 | 8GB RAM, 50GB storage, includes backups |
| Redis Cache | Upstash/Railway | $10 | $30 | For levels caching, session storage |
| WebSocket Server | Railway/AWS | $30 | $100 | Dedicated instance for real-time connections |
| CDN | Cloudflare | $0 | $20 | Free plan likely sufficient, Pro if needed |
| File Storage | S3/Supabase | $5 | $20 | Screenshot uploads, exported reports |
| **Infrastructure Total** | | **$140** | **$470** | Scales with user count |

**Notes**:
- Low end: 50 active users
- High end: 200 active users
- Auto-scaling enabled for spikes

### Monitoring & Tools

| Service | Cost | Details |
|---------|------|---------|
| Sentry (Error Monitoring) | $26/mo | Team plan, 50k events/month |
| Datadog (APM & Metrics) | $50-100/mo | Pro plan, 5 hosts, APM |
| LogRocket (Session Replay) | $99/mo | Team plan, 10k sessions/month |
| Uptime Monitoring | $0-20/mo | UptimeRobot (free) or better-uptime |
| **Monitoring Total** | **$175-245/mo** | Critical for production reliability |

### Operational Costs

| Service | Cost | Details |
|---------|------|---------|
| Email (SendGrid/Resend) | $20/mo | 50k emails/month (alerts, notifications) |
| Push Notifications (OneSignal) | $9/mo | Growth plan, unlimited subscribers |
| Customer Support (Intercom) | $0-75/mo | Free initially, paid as we scale |
| Domain & SSL | $2/mo | Cloudflare SSL free |
| **Operational Total** | **$31-106/mo** | Communication infrastructure |

### **Total Fixed Monthly Costs**

| Scenario | Total |
|----------|-------|
| **Minimum** (Low infrastructure, no support tools) | **$1,097/mo** |
| **Typical** (Mid infrastructure, essential tools) | **$1,350/mo** |
| **High Scale** (200+ users, full monitoring) | **$1,697/mo** |

---

## Variable Costs (Per User)

### OpenAI API Costs

**GPT-4 Turbo Usage**:
- Average conversation: 10-30 messages
- Tokens per message: 500 input + 300 output (average with context)
- Cost: $10/1M input tokens, $30/1M output tokens

**Monthly Usage Estimate per User**:

| User Type | Messages/Month | Input Tokens | Output Tokens | Cost |
|-----------|----------------|--------------|---------------|------|
| Lite (light usage) | 100 | 50k | 30k | $1.40 |
| Pro (active usage) | 300 | 150k | 90k | $4.20 |
| Elite (power usage) | 800 | 400k | 240k | $11.20 |
| **Average User** | **350** | **175k** | **105k** | **$4.90** |

**GPT-4 Vision API (Screenshot Analysis)**:
- Cost: ~$0.05 per image (1024x1024)
- Average usage: 2-5 screenshots per user per month
- Monthly cost per user: $0.10 - $0.25

**Total OpenAI Cost per User**: $5 - $12/month
**Conservative Estimate**: **$10/month**

### Infrastructure Variable Costs

| Resource | Cost per User/Month |
|----------|---------------------|
| Bandwidth (charts, WebSocket data) | $0.50 - $2 |
| Database Storage (trades, sessions) | $0.10 - $0.30 |
| Compute (backend processing) | $2 - $5 |
| Redis (session + cache) | $0.20 - $0.50 |
| **Total Infrastructure Variable** | **$2.80 - $7.80** |

**Conservative Estimate**: **$5/month**

### Support & Operations

| Cost | Per User/Month |
|------|----------------|
| Customer Support (time) | $2 - $5 |
| Data backup & storage | $0.50 - $1 |
| Transaction fees (Stripe) | $0.60 - $1.20 (3% of revenue) |
| **Total Operations Variable** | **$3.10 - $7.20** |

**Conservative Estimate**: **$5/month**

### **Total Variable Cost per User**

| Scenario | Cost |
|----------|------|
| **Light User** (Lite tier) | **$15/month** |
| **Typical User** (Pro tier) | **$25/month** |
| **Power User** (Elite tier) | **$40/month** |
| **Average Blended** | **$27/month** |

**Conservative Planning Number**: **$35/month** (buffer for spikes)

---

## Revenue Model

### Pricing Tiers

| Tier | Monthly Price | Annual Price | Annual Savings |
|------|---------------|--------------|----------------|
| Lite | $99 | $950 | $240 (20%) |
| Pro | $199 | $1,900 | $480 (20%) |
| Elite | $399 | $3,820 | $960 (20%) |

### Launch Pricing (First 50 Subscribers)

| Tier | Launch Price | Discount |
|------|--------------|----------|
| Lite | $79/mo | 20% off |
| Pro | $149/mo | 25% off |
| Elite | $299/mo | 25% off |

**Launch Period**: First 50 paying subscribers OR 90 days, whichever comes first

---

## Break-Even Analysis

### Assumptions
- Fixed costs: $1,500/month (mid-range)
- Variable cost per user: $35/month
- Average revenue per user (ARPU): $180/month (blended Pro/Elite, most users on Pro)

### Calculation

**Revenue Required to Cover Fixed Costs**: $1,500
**Contribution Margin per User**: $180 - $35 = $145

**Break-Even Users**: $1,500 ÷ $145 = **10.3 users** → **11 paying users**

### Break-Even by Tier (assuming single tier only)

| Tier | Monthly Price | Variable Cost | Contribution Margin | Break-Even Users |
|------|---------------|---------------|---------------------|------------------|
| Lite | $99 | $20 | $79 | 19 users |
| Pro | $199 | $35 | $164 | 10 users |
| Elite | $399 | $45 | $354 | 5 users |

**Takeaway**: Need just 10 Pro users OR 5 Elite users to break even

---

## Financial Projections

### Conservative Scenario (Slow Growth)

| Month | Subscribers | Monthly Revenue | Monthly Costs | Monthly Profit | Cumulative Profit |
|-------|-------------|-----------------|---------------|----------------|-------------------|
| Month 1 | 5 | $750 | $1,675 | -$925 | -$925 |
| Month 2 | 10 | $1,500 | $1,850 | -$350 | -$1,275 |
| Month 3 | 20 | $3,600 | $2,200 | $1,400 | $125 ✅ |
| Month 6 | 50 | $9,000 | $3,250 | $5,750 | $19,375 |
| Month 9 | 80 | $14,400 | $4,300 | $10,100 | $47,075 |
| Month 12 | 120 | $21,600 | $5,700 | $15,900 | $94,475 |

**Assumptions**:
- ARPU: $180 (mostly Pro, some Lite/Elite)
- Churn: 10%/month
- Growth: 5-10 net new per month
- **Profitable by Month 3**

### Moderate Scenario (Expected Growth)

| Month | Subscribers | Monthly Revenue | Monthly Costs | Monthly Profit | Cumulative Profit |
|-------|-------------|-----------------|---------------|----------------|-------------------|
| Month 1 | 10 | $1,500 | $1,850 | -$350 | -$350 |
| Month 2 | 20 | $3,600 | $2,200 | $1,400 | $1,050 ✅ |
| Month 3 | 35 | $6,300 | $2,725 | $3,575 | $4,625 |
| Month 6 | 75 | $13,500 | $4,125 | $9,375 | $36,375 |
| Month 9 | 120 | $21,600 | $5,700 | $15,900 | $82,275 |
| Month 12 | 180 | $32,400 | $7,800 | $24,600 | $164,775 |

**Assumptions**:
- ARPU: $180
- Churn: 8%/month
- Growth: 10-15 net new per month
- **Profitable by Month 2**

### Aggressive Scenario (Strong PMF)

| Month | Subscribers | Monthly Revenue | Monthly Costs | Monthly Profit | Cumulative Profit |
|-------|-------------|-----------------|---------------|----------------|-------------------|
| Month 1 | 20 | $3,600 | $2,200 | $1,400 | $1,400 ✅ |
| Month 2 | 40 | $7,200 | $2,900 | $4,300 | $5,700 |
| Month 3 | 70 | $12,600 | $3,950 | $8,650 | $14,350 |
| Month 6 | 150 | $27,000 | $6,750 | $20,250 | $85,100 |
| Month 9 | 240 | $43,200 | $9,900 | $33,300 | $184,000 |
| Month 12 | 350 | $63,000 | $13,750 | $49,250 | $353,250 |

**Assumptions**:
- ARPU: $180
- Churn: 5%/month (strong retention)
- Growth: 20-30 net new per month
- **Profitable from Day 1**

---

## Unit Economics

### Customer Lifetime Value (LTV)

**Assumptions**:
- ARPU: $180/month
- Gross margin: 80% ($144 profit per user per month)
- Average customer lifespan: 18 months (churn rate ~5.5%/month)

**LTV = $144 × 18 months = $2,592**

### Customer Acquisition Cost (CAC)

**Organic (TITM Community)**:
- Marketing cost: ~$500/month (email campaigns, content)
- Acquisition rate: 15 users/month
- **CAC = $33/user**

**Paid (If scaling beyond TITM)**:
- Paid ads budget: $2,000/month
- Conversion rate: 5% (500 clicks → 25 conversions)
- **CAC = $80/user**

### LTV:CAC Ratio

| Acquisition Channel | LTV | CAC | LTV:CAC Ratio |
|---------------------|-----|-----|---------------|
| Organic (TITM) | $2,592 | $33 | **78:1** ✅ Excellent |
| Paid Acquisition | $2,592 | $80 | **32:1** ✅ Excellent |

**Target**: LTV:CAC > 3:1 (we're far exceeding this)

### Payback Period

**Payback Period = CAC ÷ Monthly Profit per User**

| Channel | CAC | Monthly Profit | Payback Period |
|---------|-----|----------------|----------------|
| Organic | $33 | $144 | **0.2 months** (6 days) |
| Paid | $80 | $144 | **0.6 months** (18 days) |

**Excellent**: Payback in under 1 month

---

## Pricing Sensitivity Analysis

### Impact of Price Changes

**Scenario: Reduce Pro from $199 to $149** (permanent launch pricing)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| ARPU | $180 | $145 | -19% |
| Conversion Rate | 10% | 15% (+50%) | +5 pp |
| Subscribers (Month 6) | 75 | 112 | +37 |
| Monthly Revenue (Month 6) | $13,500 | $16,240 | +$2,740 |
| Monthly Profit (Month 6) | $9,375 | $11,890 | +$2,515 |

**Conclusion**: If lower price drives 50% more conversions, it's worth it

**Scenario: Increase Pro from $199 to $249**

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| ARPU | $180 | $220 | +22% |
| Conversion Rate | 10% | 7% (-30%) | -3 pp |
| Subscribers (Month 6) | 75 | 53 | -22 |
| Monthly Revenue (Month 6) | $13,500 | $11,660 | -$1,840 |
| Monthly Profit (Month 6) | $9,375 | $7,740 | -$1,635 |

**Conclusion**: Don't increase price without strong value add

### Optimal Pricing Strategy

**Phase 1 (Months 1-3)**: Launch pricing ($149 Pro) to drive adoption
**Phase 2 (Months 4-6)**: Standard pricing ($199 Pro) for new users, grandfather early adopters
**Phase 3 (Months 7-12)**: Add new features, consider Elite tier increase to $499
**Phase 4 (Year 2+)**: Value-based pricing based on user outcomes

---

## Cost Optimization Strategies

### Short-Term (Months 1-6)

1. **Aggressive Caching**
   - Cache levels calculations (daily pivots, PDH/PMH) for 24 hours
   - Cache options chains for 1 minute
   - Reduce Massive.com API calls by 60%
   - **Savings**: ~$0 (flat pricing, but faster responses)

2. **Tier-Based Rate Limiting**
   - Lite: 100 queries/month (prevent abuse)
   - Pro: 500 queries/month
   - Elite: Unlimited but monitor outliers
   - **Savings**: Reduce OpenAI costs by 20% ($2/user/month)

3. **Batch Processing**
   - Opportunity scanner runs for all users at once (shared computation)
   - Alert monitoring batched (check all alerts in single WebSocket subscription)
   - **Savings**: $50-100/month in compute

4. **Self-Host Components**
   - Move from Vercel to Railway (lower cost at scale)
   - Use Upstash Redis free tier initially
   - **Savings**: $50-100/month

**Total Short-Term Savings**: $150-250/month

### Long-Term (Months 6-12)

1. **Model Optimization**
   - Use GPT-4o-mini for simple queries (10x cheaper)
   - Only use GPT-4 for complex analysis
   - **Savings**: Reduce OpenAI costs by 40% ($4-5/user/month)

2. **Data Provider Optimization**
   - Negotiate volume discount with Massive.com (if we grow large)
   - Cache historical data locally (avoid repeated queries)
   - **Savings**: Potentially $100-200/month

3. **Infrastructure Right-Sizing**
   - Monitor actual usage, scale down over-provisioned resources
   - Use spot instances for background jobs
   - **Savings**: $100-200/month

4. **Self-Serve Support**
   - Comprehensive FAQ and tutorials reduce support load
   - AI-powered support bot (using our own AI Coach tech)
   - **Savings**: $50-100/month

**Total Long-Term Savings**: $300-600/month

---

## Risk Scenarios

### Worst Case: API Costs Exceed Projections

**Scenario**: Users consume 3x expected tokens (power users dominating)

| Metric | Expected | Worst Case |
|--------|----------|------------|
| OpenAI Cost per User | $10/mo | $30/mo |
| Variable Cost per User | $35/mo | $55/mo |
| ARPU | $180/mo | $180/mo |
| Contribution Margin | $145/mo | $125/mo |
| Break-Even Users | 11 | 13 |

**Impact**: Still profitable, but lower margins

**Mitigation**:
1. Implement stricter rate limits
2. Use GPT-4o-mini for 70% of queries
3. Increase Elite tier price to $499
4. Charge overage fees for extreme usage

### Worst Case: Low Conversion Rate

**Scenario**: Only 3% of TITM members subscribe (vs 10% expected)

| Metric | Expected (Month 6) | Worst Case (Month 6) |
|--------|-------------------|---------------------|
| Subscribers | 75 | 25 |
| Monthly Revenue | $13,500 | $4,500 |
| Monthly Costs | $4,125 | $2,375 |
| Monthly Profit | $9,375 | $2,125 |

**Impact**: Still profitable, but slower growth

**Mitigation**:
1. Extend beta period (validate before full launch)
2. Free trial (14 days) to drive adoption
3. Enhanced marketing (video testimonials, case studies)
4. Feature improvements based on feedback

### Best Case: Viral Growth

**Scenario**: Word-of-mouth drives 2x expected signups

| Metric | Expected (Month 12) | Best Case (Month 12) |
|--------|-------------------|---------------------|
| Subscribers | 180 | 360 |
| Monthly Revenue | $32,400 | $64,800 |
| Monthly Costs | $7,800 | $14,100 |
| Monthly Profit | $24,600 | $50,700 |
| Annual Profit | $164,775 | $404,550 |

**Impact**: Extremely profitable, scale infrastructure

**Action Items**:
1. Hire dedicated support (avoid burnout)
2. Scale infrastructure proactively
3. Invest in product improvements (retain users)
4. Consider raising prices (capture value)

---

## Investment Requirements

### Initial Development (Months 1-6)

| Item | Cost |
|------|------|
| Development Team (3 FTE × 6 months × $10k/mo) | $180,000 |
| Infrastructure (6 months × $1,500/mo) | $9,000 |
| Massive.com (6 months × $597/mo) | $3,582 |
| Tools & Monitoring (6 months × $200/mo) | $1,200 |
| **Total Development Investment** | **$193,782** |

**Revenue During Development** (Beta users):
- Month 4: $750
- Month 5: $1,500
- Month 6: $3,000
- **Total**: $5,250

**Net Investment Required**: $188,532

### Operating Costs (Months 7-12)

| Item | Cost |
|------|------|
| Ongoing Development (1 FTE × 6 months × $10k/mo) | $60,000 |
| Infrastructure (6 months × $2,000/mo) | $12,000 |
| Massive.com (6 months × $597/mo) | $3,582 |
| Marketing (6 months × $1,000/mo) | $6,000 |
| **Total Operating Costs (Months 7-12)** | **$81,582** |

**Expected Revenue (Months 7-12)**: $162,000 (avg $27k/month)
**Expected Costs**: $81,582
**Expected Profit**: $80,418

### Total 12-Month Investment & Return

| Item | Amount |
|------|--------|
| Initial Investment (Months 1-6) | -$188,532 |
| Operating Profit (Months 7-12) | +$80,418 |
| **Net Position (End of Year 1)** | **-$108,114** |

**Payback Period**: Month 16-18 (covers initial investment)
**Year 2 Profit** (assuming 300 users avg): $400,000+

---

## Financial Recommendations

### Pricing
1. **Launch with $149 Pro pricing** to drive early adoption
2. **Grandfather early adopters** at launch pricing (loyalty reward)
3. **Move to $199 Pro** after first 50 subscribers
4. **Annual plans at 20% discount** to improve retention and cash flow

### Cost Management
1. **Monitor API costs daily** in first 3 months
2. **Implement aggressive caching** from Day 1
3. **Use GPT-4o-mini** for simple queries (after testing accuracy)
4. **Start with minimum infrastructure**, scale as needed

### Growth Strategy
1. **Focus on TITM community first** (low CAC, high trust)
2. **Run 2-week beta with 15 users** before launch
3. **Launch to 50 users**, validate unit economics, then scale
4. **Consider paid marketing** only after TITM community saturated

### Investment
1. **Seed funding of $200k** covers development through Month 6
2. **Revenue post-launch** covers operating costs (no additional funding needed)
3. **Profitable by Month 3-6** (depending on adoption rate)
4. **Payback on investment** by Month 16-18

---

## Related Documentation

- [Master Specification](./MASTER_SPEC.md)
- [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md)
- [Pricing Strategy](./permissions/SUBSCRIPTION_TIERS.md)
- [Infrastructure Architecture](./architecture/SYSTEM_OVERVIEW.md)

---

**Document Version History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-03 | Nate | Initial cost analysis with 3 growth scenarios |
