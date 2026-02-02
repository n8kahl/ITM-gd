# AI Coach - Master Specification

**Status**: Draft
**Last Updated**: 2026-02-03
**Owner**: Nate
**Version**: 1.0

---

## Executive Summary

The TITM AI Coach is an intelligent trading assistant powered by OpenAI's ChatKit and Massive.com's institutional-grade market data. It provides real-time analysis, position management, educational guidance, and opportunity discovery for options traders specializing in SPX and NDX, with support for day trading, swing trading, and LEAPS strategies.

### Key Value Proposition

**For Day Traders**: Real-time level tracking, position analysis, and contextual guidance during live trades
**For Swing Traders**: Multi-day position management, technical analysis across timeframes
**For LEAPS Investors**: Long-term position tracking, macro context, and strategic planning

### Core Capabilities

1. **Live Trade Companion**: Real-time Greeks, level proximity, risk/reward analysis
2. **Screenshot Position Analysis**: Upload broker screenshots, AI extracts and analyzes positions
3. **Key Levels Intelligence**: PDH/PMH/Pivots/VWAP/ATR with historical test data
4. **Options Analysis**: Full Greeks suite, IV analysis, spread calculations
5. **Trade Journal**: Historical performance tracking with pattern recognition
6. **Opportunity Scanner**: Proactive setup discovery based on technical and options flow
7. **Educational Integration**: Contextual learning with links to TITM courses (Phase 2)

---

## Product Vision

### Mission Statement

Empower TITM traders with an AI assistant that combines institutional-grade data with conversational intelligence, making complex market analysis accessible and actionable in real-time.

### Target Personas

#### Persona 1: Active SPX/NDX Day Trader
- **Name**: "Mike the Day Trader"
- **Experience**: 2-3 years options trading
- **Style**: 0-3 DTE options, 3-8 trades per day
- **Pain Points**:
  - Missing key levels during fast markets
  - Uncertainty about when to exit winners
  - Theta decay eating profits on hold-too-long positions
  - No systematic trade review process
- **AI Coach Use Cases**:
  - "Where's PDH and how far away are we?"
  - "My SPX calls are up 20%, should I take profits or hold?"
  - "Analyze my last 20 trades - where am I losing money?"

#### Persona 2: Swing Trader
- **Name**: "Sarah the Swing Trader"
- **Experience**: 5+ years trading
- **Style**: 5-30 DTE options, holds 2-7 days
- **Pain Points**:
  - Managing multiple positions across different timeframes
  - Knowing when technical setups are still valid
  - Position sizing and risk management
- **AI Coach Use Cases**:
  - Upload screenshot of 6 open positions, get portfolio Greeks analysis
  - "Is my NDX bull spread still on track?"
  - "Find me 2-week setups with high probability"

#### Persona 3: LEAPS Investor
- **Name**: "David the LEAPS Holder"
- **Experience**: 10+ years investing
- **Style**: 6-18 month LEAPS, strategic positions
- **Pain Points**:
  - Knowing when to roll or take profits on long-term positions
  - Understanding macro trends impact on tech indices
  - Position management (when to add/reduce)
- **AI Coach Use Cases**:
  - "Should I roll my Jan 2027 NDX calls?"
  - "What's the long-term technical picture for SPX?"
  - "Analyze my LEAPS position over the last 6 months"

---

## Success Metrics

### Product KPIs

| Metric | Target (Month 3) | Target (Month 6) | Target (Month 12) |
|--------|------------------|------------------|-------------------|
| Paying Subscribers | 25 | 75 | 150 |
| Daily Active Users (DAU) | 60% of subs | 70% of subs | 75% of subs |
| Avg Messages/User/Day | 15 | 20 | 25 |
| Feature Adoption: Screenshots | 40% | 60% | 70% |
| Feature Adoption: Trade Journal | 30% | 50% | 60% |
| Feature Adoption: Alerts | 50% | 70% | 80% |
| NPS Score | 40+ | 50+ | 60+ |

### Financial KPIs

| Metric | Target (Month 3) | Target (Month 6) | Target (Month 12) |
|--------|------------------|------------------|-------------------|
| Monthly Recurring Revenue | $3,750 | $11,250 | $22,500 |
| Churn Rate | <15% | <10% | <8% |
| API Cost/User/Month | <$40 | <$35 | <$30 |
| Gross Margin | >75% | >80% | >82% |
| Break-Even Subscribers | 10 | 10 | 15 |

### Quality KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| AI Accuracy (Levels) | >99.5% | Match TradingView within $0.50 |
| Response Time (p95) | <3 sec | End-to-end chat response |
| WebSocket Uptime | >99.5% | Real-time data delivery |
| Error Rate | <0.5% | Failed API calls |
| Support Tickets/User/Month | <0.2 | Quality indicator |

---

## Technical Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Member Dashboard (React/Next.js)                │   │
│  │  ├─ AI Coach Tab                                 │   │
│  │  │  ├─ ChatKit UI (Left 30%)                    │   │
│  │  │  └─ Center Panel (Right 70%)                 │   │
│  │  ├─ Card Widgets (Embedded in chat)             │   │
│  │  └─ Real-time Updates (WebSocket client)        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│                   API GATEWAY / BACKEND                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Node.js / Python FastAPI                       │   │
│  │  ├─ Authentication & Authorization               │   │
│  │  ├─ Rate Limiting & Usage Tracking              │   │
│  │  ├─ Session Management                           │   │
│  │  └─ Business Logic Layer                        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
            ↕                    ↕                   ↕
┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐
│   OPENAI API    │  │  MASSIVE.COM API │  │   DATABASE   │
│  ┌───────────┐  │  │  ┌────────────┐  │  │ PostgreSQL   │
│  │  ChatKit  │  │  │  │  Options   │  │  │ ├─Users      │
│  │    GPT-4  │  │  │  │  Stocks    │  │  │ ├─Positions  │
│  │  Vision   │  │  │  │  Indices   │  │  │ ├─Trades     │
│  │  Function │  │  │  │  WebSocket │  │  │ ├─Alerts     │
│  │   Calls   │  │  │  └────────────┘  │  │ └─Sessions   │
│  └───────────┘  │  └──────────────────┘  └──────────────┘
└─────────────────┘
            ↕
┌─────────────────────────────────────────────────────────┐
│              MICROSERVICES / WORKERS                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Levels Calculation Engine (Redis-backed)       │   │
│  │  Options Greeks Calculator                      │   │
│  │  Alert Monitoring Service                       │   │
│  │  Opportunity Scanner (Scheduled Jobs)           │   │
│  │  Trade Journal Analytics Engine                 │   │
│  │  WebSocket Connection Manager                   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Message** → ChatKit UI → Backend API → OpenAI ChatKit
2. **AI Function Call** → Backend executes (e.g., get_key_levels) → Queries Massive.com API
3. **Real-time Data** → Massive.com WebSocket → Backend → Frontend WebSocket → Center Panel
4. **Response** → Backend → ChatKit UI (with card widgets) + Center Panel update

### Technology Stack (Recommendations)

**Frontend**:
- Framework: Next.js 14+ (React)
- State Management: Zustand or React Context
- Real-time: Socket.io client
- Charts: TradingView Lightweight Charts or Recharts
- UI Components: Tailwind CSS + shadcn/ui

**Backend**:
- Runtime: Node.js (TypeScript) OR Python FastAPI
- API Framework: Express.js OR FastAPI
- Real-time: Socket.io OR Python WebSockets
- Task Queue: BullMQ (Redis-backed)
- Caching: Redis

**Database**:
- Primary: PostgreSQL (relational data)
- Cache: Redis (levels, frequently accessed data)
- Time-series: TimescaleDB extension (for trade history)

**External Services**:
- OpenAI API (ChatKit, GPT-4, Vision)
- Massive.com APIs (Options, Stocks, Indices)
- Authentication: Auth0 or Supabase Auth (integrate with existing)

**Infrastructure**:
- Hosting: Vercel (frontend) + AWS/Railway (backend)
- WebSocket: Dedicated server (AWS EC2 or Railway)
- Database: Managed PostgreSQL (Supabase, Railway, or AWS RDS)
- Monitoring: Sentry (errors), Datadog (metrics), LogRocket (session replay)

---

## Integration Strategy

### Massive.com Integration

**Required Plans**:
- Options Advanced: $199/month (Greeks, IV, full options data)
- Stocks Advanced: $199/month (historical data, technicals)
- Indices Advanced: $199/month (SPX, NDX, VIX)
- **Total**: $597/month

**API Usage Pattern**:
- REST API: Historical queries, options chains, daily pivots
- WebSocket: Real-time minute/second aggregates, live quotes
- Rate Limits: Unlimited API calls (flat pricing model)

**Critical Endpoints** (documented in `/integrations/MASSIVE_API_REFERENCE.md`):
- Aggregates (per minute): Real-time OHLCV data
- Options Chains: Greeks, IV, OI for all strikes
- Historical Data: 20+ years for backtesting
- Technical Indicators: SMA, EMA, RSI (pre-calculated)

### OpenAI ChatKit Integration

**Configuration**:
- Model: GPT-4 Turbo (128k context, function calling)
- Vision API: For screenshot position analysis
- Embeddings: For semantic search in trade history (future)

**Function Calling Tools** (AI can invoke):
- `get_key_levels(symbol, timeframe)` → Returns PDH/PMH/pivots/VWAP/ATR
- `get_options_chain(symbol, expiry)` → Returns full options chain with Greeks
- `analyze_position(position_data)` → Calculates portfolio Greeks, risk metrics
- `get_trade_history(user_id, filters)` → Returns past trades for analysis
- `scan_opportunities(criteria)` → Returns trading setups matching criteria
- `set_alert(symbol, level, condition)` → Configures price alert
- `get_market_context()` → Returns pre-market, sector rotation, economic calendar

**System Prompt** (High-Level - detailed in `/ai-prompts/SYSTEM_PROMPT.md`):
```
You are the TITM AI Coach, an expert options trading assistant specializing in
SPX and NDX. You help traders with real-time analysis, position management, and
education. You have access to institutional-grade data from Massive.com.

Your personality: Professional, concise, data-driven, educational. You explain
complex concepts simply. You never give financial advice - you present data and
let the trader decide.

Your specialties:
- SPX/NDX options (cash-settled, European-style)
- Day trading (0-3 DTE), swing trading (5-30 DTE), LEAPS (6-18 months)
- Key levels (PDH, PMH, pivots, VWAP, ATR-based analysis)
- Greeks (Delta, Gamma, Theta, Vega, portfolio-level exposure)
- Technical analysis (support/resistance, volume profile, multi-timeframe)
- Risk management (position sizing, stop placement, profit targets)
```

---

## Subscription Tiers & Permissions

### Tier 1: AI Coach Lite - $99/month

**Query Limits**: 100 queries/month
**Features**:
- ✅ Basic key levels (PDH, PMH, VWAP only)
- ✅ Position analysis (manual entry only, no screenshots)
- ✅ Limited to SPX and NDX
- ✅ Standard charts (5m, 15m, 1h, daily)
- ❌ No trade journal
- ❌ No real-time alerts
- ❌ No opportunity scanner
- ❌ No screenshot analysis
- ❌ No pattern recognition

**Target User**: Casual trader wanting to test AI Coach

### Tier 2: AI Coach Pro - $199/month ⭐ RECOMMENDED

**Query Limits**: 500 queries/month
**Features**:
- ✅ Full key levels (all pivots, ATR, Fibonacci, custom levels)
- ✅ Screenshot position analysis (up to 5/day)
- ✅ All underlyings (SPX, NDX, individual stocks)
- ✅ Advanced charts (multi-timeframe, Greeks overlays, volume profile)
- ✅ Trade journal with basic pattern recognition
- ✅ Real-time level alerts (5 concurrent)
- ✅ Opportunity scanner (1 scan/hour)
- ✅ Community shared insights (read + publish)
- ✅ Priority support

**Target User**: Active day trader or swing trader

### Tier 3: AI Coach Elite - $399/month

**Query Limits**: Unlimited
**Features**:
- ✅ Everything in Pro, PLUS:
- ✅ Unlimited screenshot analysis
- ✅ Advanced ML pattern recognition
- ✅ Historical backtesting of strategies
- ✅ Unlimited real-time alerts
- ✅ Opportunity scanner (unlimited, auto-refresh every 5min)
- ✅ Priority API access (faster response times)
- ✅ Custom level definitions & calculations
- ✅ Export all data (CSV, PDF reports)
- ✅ Early access to new features
- ✅ 1-on-1 onboarding session
- ✅ Dedicated support (Slack channel)

**Target User**: Professional trader or high-volume user

### Annual Pricing (20% discount)

- Lite: $950/year (save $240)
- Pro: $1,900/year (save $480)
- Elite: $3,820/year (save $960)

---

## Feature Roadmap

### Phase 1: MVP (Weeks 1-16)
- Levels Calculation Engine (PDH, PMH, pivots, VWAP, ATR)
- Basic AI Chat (text Q&A about levels)
- Center Panel: Charts with annotated levels
- Card Widgets: Key Levels Dashboard
- SPX/NDX support only

**Deliverable**: Traders can ask "Where's PDH?" and see annotated chart

### Phase 2: Options Analysis (Weeks 17-24)
- Massive.com Options API integration
- Greeks calculations & display
- Options chain viewer
- Position analysis (manual entry)
- Card Widgets: Position Summary, Greeks Dashboard

**Deliverable**: Traders can analyze positions with full Greeks

### Phase 3: Screenshot Analysis (Weeks 25-28)
- File upload in chat
- OpenAI Vision API integration
- Position extraction from screenshots
- Auto-populate position tracker

**Deliverable**: Upload broker screenshot, AI extracts & analyzes positions

### Phase 4: Trade Journal (Weeks 29-32)
- Trade history database
- Manual entry & CSV import
- Performance analytics dashboard
- Basic pattern recognition (win rate by time/strategy)

**Deliverable**: Historical trade analysis with actionable insights

### Phase 5: Real-Time Alerts (Weeks 33-36)
- Alert configuration UI
- Background monitoring service
- Push notifications + in-chat alerts
- Contextual alerts (volume, multiple tests, etc.)

**Deliverable**: Get notified when price approaches key levels

### Phase 6: Opportunity Scanner (Weeks 37-40)
- Technical setup scanner (breakouts, bounces, consolidations)
- Options flow analysis (unusual activity, IV rank)
- User-defined filters
- AI presents opportunities with context

**Deliverable**: AI proactively finds high-probability setups

### Phase 7: Swing & LEAPS Module (Weeks 41-44)
- Multi-timeframe analysis (weekly, monthly charts)
- Long-term position tracking
- Macro context integration
- LEAPS-specific dashboards

**Deliverable**: Support for longer timeframe trading

### Phase 8: Beta Launch (Weeks 45-48)
- 10-15 beta users
- Feedback collection & iteration
- Performance optimization
- Cost monitoring

**Deliverable**: Validated product with real user feedback

### Phase 9: Public Launch (Week 49+)
- Marketing campaign
- Full rollout to TITM members
- Support infrastructure
- Ongoing iteration

**Deliverable**: General availability

### Phase 10: Training Materials Integration (6-12 months post-launch)
- Course database integration
- AI recommendations based on knowledge gaps
- In-chat course previews
- Progress tracking & quizzes

**Deliverable**: AI Coach becomes learning companion

---

## Cost Analysis

### Fixed Monthly Costs

| Item | Cost |
|------|------|
| Massive.com APIs (Options + Stocks + Indices) | $597 |
| Infrastructure (hosting, database, WebSocket) | $400-900 |
| Monitoring & Tools (Sentry, Datadog, LogRocket) | $100-200 |
| **Total Fixed** | **$1,097-1,697** |

### Variable Costs (Per User)

| Item | Cost/User/Month |
|------|-----------------|
| OpenAI API (GPT-4, ~200 messages) | $20-30 |
| OpenAI Vision API (~10 screenshots) | $2-5 |
| Infrastructure (compute, bandwidth) | $5-10 |
| **Total Variable** | **$27-45** |

### Break-Even Analysis

**At Tier 2 (Pro) - $199/month pricing**:
- Revenue per user: $199
- Cost per user: ~$40 (variable + allocated fixed)
- Gross margin per user: ~$159
- **Break-even**: 11 paying users (~$2,189 revenue covers $1,697 fixed + $440 variable)

**At 50 Pro users**:
- Revenue: $9,950/month
- Costs: $1,697 (fixed) + $2,000 (variable) = $3,697
- **Profit: $6,253/month ($75,036/year)**

**At 100 Pro users**:
- Revenue: $19,900/month
- Costs: $1,697 (fixed) + $4,000 (variable) = $5,697
- **Profit: $14,203/month ($170,436/year)**

### Pricing Strategy

**Launch Pricing** (First 50 subscribers):
- Lite: $79/month (20% off)
- Pro: $149/month (25% off)
- Elite: $299/month (25% off)

**Standard Pricing** (After launch period):
- Lite: $99/month
- Pro: $199/month
- Elite: $399/month

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Massive.com API outage | Medium | High | Caching (5min stale data), fallback to delayed data, clear user communication |
| OpenAI rate limits | Medium | Medium | Queuing system, tier-based priority, graceful degradation |
| WebSocket instability | Medium | Medium | Auto-reconnection, fallback to polling, connection status indicator |
| Database performance | Low | High | Proper indexing, read replicas, query optimization |
| Security breach | Low | Critical | Auth0/Supabase Auth, encrypted data at rest, regular security audits |

### Product Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Low user adoption | Medium | High | Extensive beta testing, iterate on prompts, freemium tier, strong onboarding |
| High churn rate | Medium | High | Feature usage analytics, proactive user outreach, continuous improvement |
| API costs exceed budget | Medium | Critical | Per-user query limits, aggressive caching, daily cost monitoring, price adjustment |
| AI provides bad advice | Low | Critical | Clear disclaimers, AI trained to present data (not advice), legal review |
| Competition launches similar | Medium | Medium | First-mover advantage, TITM community integration, continuous innovation |

### Regulatory/Compliance Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Classified as financial advice | Low | Critical | Clear disclaimers, AI phrasing ("here's the data" not "you should"), legal counsel, updated ToS |
| Data privacy violation | Low | High | GDPR/CCPA compliance, data encryption, privacy policy, user data controls |
| Securities violation | Very Low | Critical | No trade execution, no "guaranteed returns", educational framing, legal review |

---

## Next Steps

### Immediate (This Week)
1. ✅ Document master spec (this file)
2. ⬜ Survey 10 TITM traders: "What would you ask an AI trading coach?"
3. ⬜ Create 1-page wireframe of AI Coach interface
4. ⬜ Set up project repository structure

### Week 2-4
1. ⬜ Sign up for Massive.com trial, test APIs
2. ⬜ Experiment with OpenAI ChatKit (simple POC)
3. ⬜ Design database schema
4. ⬜ Write feature specs (start with Levels Engine)

### Week 5-8
1. ⬜ Finalize technical architecture
2. ⬜ Complete all feature specs
3. ⬜ Create detailed wireframes/mockups
4. ⬜ Validate specs with 3-5 TITM traders

### Week 9-12
1. ⬜ Assemble development team
2. ⬜ Begin Phase 1 development (Levels Engine + Basic Chat)
3. ⬜ Set up infrastructure (hosting, database, monitoring)
4. ⬜ Weekly progress reviews

---

## Related Documentation

- [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md) - Detailed phase breakdown
- [Cost Analysis](./COST_ANALYSIS.md) - Financial projections & pricing
- [Architecture Overview](./architecture/SYSTEM_OVERVIEW.md) - Technical architecture
- [Levels Engine Spec](./features/levels-engine/SPEC.md) - Key levels calculation
- [Center Column Design](./ui-ux/CENTER_COLUMN_DESIGN.md) - Data visualization
- [Massive.com Integration](./integrations/MASSIVE_API_REFERENCE.md) - API details
- [OpenAI ChatKit Setup](./integrations/OPENAI_CHATKIT_SETUP.md) - AI configuration

---

## Approval & Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | Nate | 2026-02-03 | ⬜ |
| Technical Lead | TBD | | ⬜ |
| Stakeholder | TBD | | ⬜ |

---

**Document Version History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-03 | Nate | Initial draft - comprehensive AI Coach specification |
