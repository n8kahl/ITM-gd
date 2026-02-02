# AI Coach - Implementation Roadmap

**Status**: Draft
**Last Updated**: 2026-02-03
**Owner**: Nate
**Version**: 1.0

---

## Overview

This document provides a detailed phase-by-phase implementation plan for the TITM AI Coach, from initial foundation through public launch and beyond.

**Total Timeline**: 48-52 weeks from start to public launch
**Team Size**: 3-4 full-time developers + 1 PM + 1 QA

---

## Phase 0: Foundation & Planning (Weeks 1-6)

### Objectives
- Complete all specification documentation
- Validate product-market fit with TITM community
- Finalize cost model and pricing strategy
- Select beta testers
- Make critical technical decisions

### Activities

**Week 1-2: Specification Completion**
- ✅ Master specification document
- ⬜ All feature specs written
- ⬜ Architecture design finalized
- ⬜ UI/UX wireframes created
- ⬜ Database schema designed

**Week 3: Market Validation**
- ⬜ Survey 20 TITM traders
- ⬜ Focus group: 5-6 top traders (1-hour session)
- ⬜ Collect actual questions they would ask AI Coach
- ⬜ Prioritize features based on feedback
- ⬜ Document pain points and desired outcomes

**Week 4: Technical Decisions**
- ⬜ Tech stack finalized (see Technology Decisions section)
- ⬜ Massive.com account created, APIs tested
- ⬜ OpenAI ChatKit POC completed
- ⬜ Hosting provider selected
- ⬜ Database provider selected

**Week 5: Cost & Pricing Analysis**
- ⬜ API cost projections validated with actual testing
- ⬜ Infrastructure cost estimates
- ⬜ Break-even analysis completed
- ⬜ Pricing tiers finalized
- ⬜ Launch pricing strategy approved

**Week 6: Team & Setup**
- ⬜ Development team assembled (hire or assign)
- ⬜ Project management tools set up (Jira, Linear, or similar)
- ⬜ Repository structure created
- ⬜ Development environment standardized
- ⬜ Beta tester list finalized (10-15 people)

### Deliverables
- ✅ Complete specification documents
- ⬜ Validated product roadmap
- ⬜ Technical architecture document
- ⬜ Team assembled and ready
- ⬜ Beta tester commitments

### Success Criteria
- All specs reviewed and approved
- 80%+ of surveyed traders say "I would use this"
- Technical POCs successful (Massive.com + ChatKit working)
- Budget approved
- Team committed

---

## Phase 1: Levels Engine MVP (Weeks 7-12)

### Objectives
- Build foundation: Levels Calculation Engine
- Establish data pipeline from Massive.com
- Create simple API for levels queries
- Validate accuracy against TradingView

### Technical Components

**Backend Services**:
- Levels Calculation Engine (Node.js/Python)
- Massive.com API wrapper
- Redis caching layer
- PostgreSQL database (user profiles, configuration)
- REST API endpoints

**Calculations to Implement**:
- PDH, PDL, PDC (Previous Day High/Low/Close)
- PMH, PML (Pre-Market High/Low, 4am-9:30am ET)
- Standard Pivots (R3, R2, R1, PP, S1, S2, S3)
- VWAP (Volume Weighted Average Price, real-time)
- ATR (Average True Range, 14-period default)

**Data Requirements**:
- Massive.com REST API: Daily aggregates, extended hours data
- Massive.com WebSocket: Real-time minute aggregates
- Historical data: Last 5 days minimum (for ATR calculation)

### Activities

**Week 7-8: Backend Setup & Massive.com Integration**
- Set up backend server (Node.js/Python)
- Implement Massive.com API client
- Test REST API endpoints (daily data, historical)
- Test WebSocket connection (minute aggregates)
- Implement retry/reconnection logic

**Week 9-10: Levels Calculation Engine**
- Implement pivot calculations (formulas documented in `/features/levels-engine/CALCULATIONS.md`)
- Implement PMH/PML detection (extended hours data)
- Implement VWAP calculation (cumulative from market open)
- Implement ATR calculation
- Unit tests for all calculations

**Week 11: Caching & Optimization**
- Redis caching strategy (pivots cached daily, VWAP every minute)
- Database schema for storing calculated levels
- Performance optimization (target: <500ms response time)
- Load testing

**Week 12: Validation & Testing**
- Compare against TradingView for SPX/NDX (100 samples)
- Edge case testing (market holidays, half-days, data gaps)
- Integration tests
- Documentation

### Deliverables
- Working Levels API: `GET /api/levels/:symbol`
- Redis-backed caching
- Unit test coverage >80%
- Validation report (accuracy vs TradingView)

### Success Criteria
- Levels match TradingView within $0.50 for SPX/NDX (99%+ accuracy)
- API response time <500ms (p95)
- WebSocket connection stable (>99% uptime over 1 week)
- All unit tests passing

---

## Phase 2: Basic AI Chat (Weeks 13-16)

### Objectives
- Embed OpenAI ChatKit in member dashboard
- Implement function calling for levels queries
- Create conversational interface
- Establish session management

### Technical Components

**Frontend**:
- AI Coach tab in member dashboard
- ChatKit UI (embedded)
- Basic layout (chat on left, placeholder center panel)
- Authentication integration

**Backend**:
- ChatKit backend configuration
- Function calling implementations
- Session management
- Usage tracking (query count per user)

**AI Functions**:
- `get_key_levels(symbol, timeframe)` → Calls Levels API
- `get_current_price(symbol)` → Queries Massive.com real-time data
- `get_market_status()` → Pre-market, market hours, after-hours

### Activities

**Week 13: Frontend Integration**
- Create AI Coach tab in Next.js dashboard
- Embed ChatKit UI component
- Authentication flow (pass user context to ChatKit)
- Basic styling (match TITM branding)

**Week 14: ChatKit Backend Setup**
- Configure OpenAI ChatKit backend
- Write system prompt (AI personality, specialties)
- Implement function calling handlers
- Test function execution

**Week 15: Session & Usage Tracking**
- Database schema for chat sessions
- Usage tracking (query count, tier limits)
- Rate limiting per tier
- Session persistence (chat history)

**Week 16: Testing & Polish**
- End-to-end testing (user asks question, AI responds)
- Response time optimization
- Error handling (API failures, rate limits)
- Beta tester dry run (2-3 people)

### Deliverables
- AI Coach tab visible in member dashboard
- Working conversational interface
- AI can answer questions like:
  - "Where's PDH for SPX?"
  - "What's the ATR?"
  - "Show me pre-market high and low"
- Session management working
- Usage tracking dashboard (admin view)

### Success Criteria
- AI responds accurately to levels queries
- Response time <3 seconds (end-to-end)
- No errors in 100 consecutive queries
- Beta testers can have natural conversations
- Tier limits enforced (Lite: 100/month, Pro: 500/month)

---

## Phase 3: Center Panel - Charts (Weeks 17-20)

### Objectives
- Build interactive chart component
- Annotate levels on charts
- Synchronize with AI chat
- Multi-timeframe support

### Technical Components

**Frontend**:
- Chart library integration (TradingView Lightweight Charts or Recharts)
- Center panel routing
- Level annotation engine
- Real-time updates via WebSocket

**Backend**:
- Historical data endpoint (for chart rendering)
- WebSocket server (real-time price updates)
- Chart configuration API

### Activities

**Week 17: Chart Component**
- Select and integrate chart library
- Basic candlestick chart rendering
- Volume bars
- Zoom and pan functionality

**Week 18: Level Annotations**
- Overlay levels on chart (PDH, PMH, pivots, VWAP, ATR)
- Color coding (resistance red, support green, pivots gray)
- Level labels with distances
- Dynamic updates as levels change

**Week 19: Multi-Timeframe & Real-time**
- Timeframe selector (1m, 5m, 15m, 1h, 4h, daily)
- WebSocket integration for live updates
- Chart refreshes as new bars form
- VWAP updates in real-time

**Week 20: AI Integration**
- AI can trigger chart display: "Show me SPX chart with levels"
- Chart appears in center panel
- Highlighted levels based on conversation context
- Screenshot capture feature (for user to re-upload and analyze)

### Deliverables
- Interactive chart component in center panel
- Levels auto-annotated
- Multi-timeframe support (5 timeframes minimum)
- Real-time updates
- AI can trigger chart display

### Success Criteria
- Charts render in <1 second
- Real-time updates <2 second latency
- Levels accurately placed on chart
- Works on desktop and tablet (mobile stretch goal)
- Beta testers find it visually clear and useful

---

## Phase 4: Card Widgets (Weeks 21-24)

### Objectives
- Create embeddable card widgets in ChatKit responses
- Build Key Levels Dashboard card
- Build Position Summary card (basic)
- Implement live-updating cards

### Technical Components

**Frontend**:
- Card widget components (React)
- Embedded rendering in ChatKit
- WebSocket subscriptions for live updates
- Click-to-expand functionality (to center panel)

**Widget Types to Build**:
1. Key Levels Dashboard
2. Position Summary (manual entry)
3. P&L Tracker
4. Alert Status

### Activities

**Week 21: Card Framework**
- Build reusable card component system
- ChatKit embedding mechanism
- Card state management
- WebSocket subscription pattern

**Week 22: Key Levels Dashboard Card**
- Display current price
- List resistance levels (above) with distances
- List support levels (below) with distances
- ATR context
- Live updates

**Week 23: Position & P&L Cards**
- Manual position entry form
- Position Summary card (ticker, strike, P&L, Greeks placeholder)
- P&L Tracker card (total portfolio P&L)
- Click to expand to center panel

**Week 24: Integration & Polish**
- AI knows when to show cards vs center panel
- Card animations and transitions
- Mobile responsiveness
- Beta testing with widgets

### Deliverables
- 4 card widget types functional
- Cards update in real-time (<2 sec latency)
- Click-through to center panel works
- AI correctly uses cards in responses

### Success Criteria
- Cards render without breaking chat layout
- Live updates work reliably
- Beta testers prefer cards to text-only responses
- Mobile experience acceptable

---

## Phase 5: Options Analysis (Weeks 25-28)

### Objectives
- Integrate Massive.com Options API
- Calculate/retrieve Greeks
- Build options chain viewer
- Position analysis with full Greeks

### Technical Components

**Backend**:
- Massive.com Options API integration
- Greeks calculations (if not provided by Massive)
- Options chain caching (chains are large)
- Portfolio Greeks calculator

**Frontend**:
- Options chain table (center panel)
- Greeks visualizations (Delta curve, IV smile)
- Position analysis dashboard

### Activities

**Week 25: Options Data Integration**
- Massive.com Options API endpoints
- Fetch options chains for SPX/NDX
- Cache options data (chains updated every minute)
- Parse Greeks, IV, OI data

**Week 26: Position Analysis Engine**
- Manual position entry form (improved)
- Calculate portfolio-level Greeks:
  - Net Delta (directional exposure)
  - Net Gamma (acceleration risk)
  - Net Theta (time decay earning/cost)
  - Net Vega (volatility sensitivity)
- Risk metrics (max loss, breakeven, probability of profit)

**Week 27: Options Chain Viewer**
- Full options chain table in center panel
- Filter by expiry, strike range
- Highlight ATM/ITM/OTM
- Greeks columns (Delta, Gamma, Theta, Vega, IV)
- Spread calculator (click two strikes to see spread metrics)

**Week 28: AI Integration**
- AI can discuss Greeks intelligently
- AI can answer: "What's my net Delta?"
- AI can suggest: "Your Theta is -$150/day, consider this..."
- Greeks-aware recommendations

### Deliverables
- Options data flowing from Massive.com
- Portfolio Greeks calculator working
- Options chain viewer in center panel
- AI can analyze options positions

### Success Criteria
- Greeks accurate (match broker within 0.02 for Delta)
- Options chains load in <1 second
- AI explanations of Greeks are correct and helpful
- Beta testers with options positions find value

---

## Phase 6: Screenshot Analysis (Weeks 29-32)

### Objectives
- File upload in chat interface
- OpenAI Vision API integration
- Extract positions from broker screenshots
- Auto-populate position tracker

### Technical Components

**Frontend**:
- File upload component in chat
- Image preview before upload
- Multi-file support

**Backend**:
- OpenAI Vision API integration
- Image preprocessing (resize, enhance)
- Position extraction logic
- Confidence scoring

**Supported Brokers**:
- TastyTrade
- Thinkorswim
- Interactive Brokers
- Robinhood
- Webull

### Activities

**Week 29: Upload & Vision API**
- File upload to backend (secure storage)
- OpenAI Vision API integration
- Prompt engineering for position extraction
- Parse response into structured data

**Week 30: Position Extraction Logic**
- Extract: ticker, option type (call/put), strike, expiry, quantity, entry price, current price
- Handle multiple positions in one screenshot
- Confidence scoring (low confidence = ask user for clarification)
- Error handling (unreadable screenshot)

**Week 31: Auto-Population & Validation**
- Populate position tracker with extracted data
- User review screen: "We found these positions. Correct?"
- User can edit before confirming
- Fetch current Greeks for extracted positions

**Week 32: Multi-Broker Testing**
- Test with screenshots from 5 major brokers
- Refine prompts for accuracy
- Handle edge cases (partial positions, multi-leg spreads)
- Beta testing

### Deliverables
- File upload working in chat
- Position extraction from screenshots (80%+ accuracy)
- Auto-populated position tracker
- Works with 5 major brokers

### Success Criteria
- Extraction accuracy >80% (correct ticker, strike, expiry)
- Handles 3-5 positions per screenshot
- User confirmation flow smooth
- Beta testers successfully upload screenshots

---

## Phase 7: Trade Journal (Weeks 33-36)

### Objectives
- Build trade history database
- Manual entry & CSV import
- Performance analytics dashboard
- Basic pattern recognition

### Technical Components

**Backend**:
- Trade history schema
- CSV parser (common broker formats)
- Analytics engine (win rate, P&L, patterns)

**Frontend**:
- Trade entry form
- CSV import UI
- Analytics dashboard (center panel)
- Individual trade review page

### Activities

**Week 33: Database & Entry**
- Trade history schema (entry/exit, P&L, Greeks, tags)
- Manual trade entry form
- Validation and error handling
- Edit/delete functionality

**Week 34: CSV Import**
- Parse common broker export formats (TastyTrade, ToS, IBKR)
- Map columns to internal schema
- Duplicate detection
- Bulk import

**Week 35: Analytics Engine**
- Calculate metrics:
  - Win rate overall and by strategy
  - Average win/loss
  - Profit factor
  - Win rate by time of day
  - Win rate by underlying (SPX vs NDX)
- Pattern detection:
  - Best/worst time of day
  - Best/worst day of week
  - Winning vs losing strategies

**Week 36: Dashboard & AI Integration**
- Performance dashboard in center panel
- Charts: equity curve, win rate over time, heatmaps
- AI can query trade history
- AI provides insights: "You win 78% after 10:30am but only 45% in first 30 min"

### Deliverables
- Trade journal database
- Manual entry & CSV import working
- Performance analytics dashboard
- Basic pattern recognition
- AI can analyze trade history

### Success Criteria
- Import 100+ trades from CSV without errors
- Analytics accurate
- Pattern recognition provides actionable insights
- Beta testers find value in trade review

---

## Phase 8: Real-Time Alerts (Weeks 37-40)

### Objectives
- User-configurable price alerts
- Background monitoring service
- Multi-channel notifications
- Contextual alerts (not just "price hit")

### Technical Components

**Backend**:
- Alert configuration database
- Background monitoring worker (checks every 10 seconds)
- Notification service (push, email, in-chat)
- WebSocket for real-time in-chat alerts

**Frontend**:
- Alert configuration UI
- Active alerts dashboard
- Alert history

### Activities

**Week 37: Alert Configuration**
- UI to set alerts: "Alert me when SPX hits $5,930"
- Alert types:
  - Price crosses level
  - Price within X of level
  - Level tested N times
  - Volume spike at level
- Tier limits enforced (Pro: 5, Elite: unlimited)

**Week 38: Monitoring Service**
- Background worker subscribes to Massive.com WebSocket
- Checks all active alerts every 10 seconds
- Trigger logic (with hysteresis to avoid spam)
- Queue notifications

**Week 39: Notification Delivery**
- Push notifications (web push API)
- Email notifications (optional)
- In-chat alerts (WebSocket to frontend)
- Contextual alerts:
  - "SPX hit $5,930 (PDH) with 2M volume - 3rd test today"
  - Not just: "SPX hit $5,930"

**Week 40: Testing & Polish**
- Alert reliability testing (does it fire correctly?)
- No false positives (test with volatile markets)
- User preferences (notification channels)
- Snooze/dismiss functionality

### Deliverables
- Alert configuration UI
- Background monitoring service
- Multi-channel notifications
- Contextual alerts working

### Success Criteria
- Alerts fire within 30 seconds of trigger
- Zero false negatives (missed alerts) in testing
- <5% false positives
- Beta testers configure and rely on alerts

---

## Phase 9: Opportunity Scanner (Weeks 41-44)

### Objectives
- Scan for technical setups
- Options flow analysis
- User-defined filters
- AI presents opportunities with full context

### Technical Components

**Backend**:
- Scanning algorithms (technical + options-based)
- Scheduled jobs (cron or BullMQ)
- Opportunity scoring system
- Database for discovered opportunities

**Frontend**:
- Opportunity cards in chat
- Filter configuration UI
- Opportunity detail view (center panel)

### Scanning Algorithms

**Technical Setups**:
- Support/resistance bounces
- Breakout/breakdown from consolidation
- Moving average crossovers
- RSI divergence
- Volume spike with price confirmation

**Options-Based**:
- High IV rank (good for selling)
- Unusual options activity (volume >> open interest)
- IV crush opportunities (post-earnings)
- Spreads with high probability of profit

### Activities

**Week 41: Scanning Algorithms**
- Implement 5 technical scanners
- Implement 3 options scanners
- Test against historical data (do they find good setups?)
- Score opportunities (probability, risk/reward)

**Week 42: Scheduler & Database**
- Scheduled jobs:
  - Pro: Scan every hour
  - Elite: Scan every 5 minutes
- Store opportunities in database
- Expire old opportunities (if setup invalidated)
- Notify user of new opportunities

**Week 43: Frontend & AI Integration**
- Opportunity cards in chat
- Filter UI: "Only show iron condors", "Only SPX/NDX"
- Detail view: full analysis, chart, suggested entry
- AI explains why opportunity is good

**Week 44: Tuning & Testing**
- Reduce false positives (scan finds bad setups)
- User feedback loop (was this opportunity useful?)
- ML scoring model (learn from user feedback)
- Beta testing

### Deliverables
- 8 scanning algorithms operational
- Scheduled scanner running
- Opportunity cards showing in chat
- Filter configuration working

### Success Criteria
- Scanner finds 3-5 opportunities per day (average)
- False positive rate <20%
- Beta testers find at least 1 valuable opportunity per week
- Opportunities presented with full context (why it's good)

---

## Phase 10: Swing & LEAPS Module (Weeks 45-48)

### Objectives
- Multi-timeframe analysis (weekly, monthly)
- Long-term position tracking
- Macro context integration
- LEAPS-specific features

### Technical Components

**Backend**:
- Weekly/monthly historical data
- Macro data sources (economic calendar, Fed policy)
- LEAPS position calculator (long-term Greeks projection)

**Frontend**:
- Weekly/monthly chart views
- LEAPS dashboard (center panel)
- Macro context widget

### Activities

**Week 45: Multi-Timeframe Data**
- Fetch weekly/monthly aggregates from Massive.com
- Calculate weekly pivots, 50-week EMA, 200-week EMA
- Volume profile on longer timeframes
- Historical data (5+ years for LEAPS context)

**Week 46: LEAPS Position Tracker**
- Long-term position entry (6-18 months)
- Greeks projection over time (Theta minimal, Delta/Vega dominant)
- Quarterly performance tracking
- Roll calculator (when to roll strikes)

**Week 47: Macro Context Integration**
- Economic calendar API (major events)
- Fed policy tracker (rate expectations)
- Sector rotation analysis (tech vs broad market)
- Earnings season tracker

**Week 48: AI Integration & Polish**
- AI discusses long-term trends
- AI suggests LEAPS management strategies
- Swing trade multi-day tracking
- Beta testing with LEAPS holders

### Deliverables
- Weekly/monthly chart views
- LEAPS position tracker
- Macro context dashboard
- AI provides long-term analysis

### Success Criteria
- Charts render correctly for weekly/monthly data
- LEAPS position calculations accurate
- AI provides relevant long-term analysis
- Beta testers with LEAPS find it useful

---

## Phase 11: Beta Launch (Weeks 49-52)

### Objectives
- Invite 10-15 TITM traders to test
- Collect intensive feedback
- Fix critical bugs
- Optimize performance and costs
- Validate pricing model

### Activities

**Week 49: Beta Onboarding**
- Individual onboarding sessions (30 min each)
- Show key features
- Explain how to provide feedback
- Set expectations (bugs expected, rapid iteration)

**Week 50-51: Active Beta**
- Daily monitoring of usage
- Daily feedback collection (async + 2x weekly sync calls)
- Bug triage and fixes (critical bugs fixed within 24 hours)
- Performance monitoring (response times, API costs)
- Usage analytics (which features used most?)

**Week 52: Refinement & Analysis**
- Analyze feedback themes
- Prioritize feature improvements
- Calculate actual API costs per user
- Adjust pricing if needed
- Prepare for public launch

### Beta Success Metrics

| Metric | Target |
|--------|--------|
| Beta user satisfaction | 80%+ rate "valuable" or "very valuable" |
| Daily active usage | 60%+ of beta users active daily |
| Average queries per user per week | 50+ |
| Feature adoption (screenshots) | 50%+ try at least once |
| Feature adoption (trade journal) | 40%+ enter trades |
| Feature adoption (alerts) | 60%+ set at least one alert |
| Critical bugs | <5 remaining at end of beta |
| API cost per user | Within budget (<$40/month) |

### Deliverables
- Beta feedback report
- Bug fix backlog completed
- Performance optimization completed
- Cost analysis validated
- Public launch plan

### Success Criteria
- 80%+ beta users recommend AI Coach
- No critical bugs remaining
- API costs per user on target
- Pricing validated
- Ready for public launch

---

## Phase 12: Public Launch (Week 53+)

### Pre-Launch (Week 53-54)

**Marketing Prep**:
- Launch video (3-5 min demo)
- Feature highlight videos (30 sec each)
- Beta tester testimonials
- Landing page updates
- Email campaign to TITM members

**Technical Prep**:
- Infrastructure scaling (expect 50-100 signups in week 1)
- Monitoring dashboards (Datadog, Sentry)
- Support documentation (FAQ, tutorials)
- Support team training
- Launch checklist review

**Soft Launch**:
- Announce to TITM members only
- Limit signups initially (50 users, then remove cap)
- Monitor closely for issues

### Launch Week (Week 55)

**Day 1**: Announce via email + Discord
**Day 2-3**: Respond to questions, monitor signups
**Day 4-5**: Weekly sync with early users, collect feedback
**Day 6-7**: Review metrics, identify issues

### Post-Launch (Weeks 56+)

**Ongoing Activities**:
- Weekly metrics review
- Monthly user feedback sessions
- Continuous feature improvements
- Cost optimization
- Support scalability (hire support if needed)

**Iteration Priorities**:
1. Fix pain points identified in first month
2. Improve AI prompts based on real conversations
3. Optimize costs (caching, query optimization)
4. Add most-requested features from feedback

---

## Phase 13: Training Materials Integration (Months 6-12 post-launch)

### Objectives
- Integrate TITM courses into AI Coach
- AI recommends courses based on knowledge gaps
- Track user progress
- Gamification (quizzes, completion badges)

### Components

**Backend**:
- Course content database
- User progress tracking
- Recommendation engine (based on questions asked)

**Frontend**:
- In-chat course previews
- Progress dashboard
- Quiz interface

**AI Enhancements**:
- AI detects knowledge gaps: "You keep asking about theta"
- AI suggests relevant course: "Check out Options Greeks Mastery"
- AI references course material in explanations
- AI quizzes user to reinforce learning

### Timeline

**Month 6**: Planning & course database setup
**Month 7-8**: Recommendation engine development
**Month 9-10**: Frontend integration & testing
**Month 11**: Beta with course integration
**Month 12**: Public rollout of course integration

---

## Technology Decisions

### Frontend Stack (Recommended)
- **Framework**: Next.js 14+ (React, App Router)
- **Language**: TypeScript
- **State Management**: Zustand (lightweight) or React Context
- **Styling**: Tailwind CSS + shadcn/ui components
- **Charts**: TradingView Lightweight Charts (performant, professional)
- **Real-time**: Socket.io client
- **Testing**: Playwright (E2E), Vitest (unit)

### Backend Stack (Recommended)
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js or Fastify
- **API Style**: REST + WebSocket (Socket.io)
- **Task Queue**: BullMQ (Redis-backed, for alerts & scanning)
- **Testing**: Jest (unit), Supertest (integration)

**Alternative**: Python FastAPI (if team prefers Python)

### Database
- **Primary**: PostgreSQL 15+ (Supabase hosted or Railway)
- **Extensions**: TimescaleDB (for time-series trade data)
- **Cache**: Redis (Upstash or Railway)
- **Schema Management**: Prisma (TypeScript) or Drizzle

### Infrastructure
- **Frontend Hosting**: Vercel (Next.js optimized, edge functions)
- **Backend Hosting**: Railway or AWS ECS (containerized)
- **Database**: Supabase (Postgres) or Railway
- **Redis**: Upstash or Railway
- **WebSocket Server**: Dedicated instance (Railway or AWS EC2)
- **CDN**: Cloudflare or Vercel Edge Network
- **Monitoring**: Sentry (errors), Datadog (APM), LogRocket (session replay)
- **CI/CD**: GitHub Actions

### External Services
- **OpenAI**: ChatKit, GPT-4, Vision API
- **Massive.com**: Options, Stocks, Indices APIs + WebSocket
- **Authentication**: Supabase Auth (existing TITM auth)
- **Email**: SendGrid or Resend
- **Push Notifications**: OneSignal or Pusher

---

## Team Structure

### Development Team (Recommended)

**Technical Lead** (1 person):
- Architecture decisions
- Code reviews
- Performance optimization
- Team mentorship

**Frontend Developer** (1-2 people):
- React/Next.js development
- ChatKit integration
- Chart components
- Real-time UI updates

**Backend Developer** (1-2 people):
- API development
- Massive.com integration
- Database design
- WebSocket management

**Data/ML Engineer** (0.5-1 person, can be shared):
- Levels calculations
- Opportunity scanner algorithms
- Pattern recognition (trade journal)
- Performance optimization

**AI/Prompt Engineer** (0.5 person, can be PM):
- ChatKit prompt engineering
- Function calling design
- AI behavior tuning
- Testing AI responses

**QA/Tester** (1 person):
- Test plan execution
- Beta program management
- Bug reporting and tracking
- Acceptance testing

**Product Manager** (1 person):
- Roadmap management
- Stakeholder communication
- Feature prioritization
- User feedback coordination

**Minimum Viable Team**: 3 full-stack developers + 1 PM (longer timeline)
**Optimal Team**: 4 specialists + 1 PM + 1 QA (timeline as documented)

---

## Risk Management

### Critical Path Items

Items that could delay entire project:

1. **Massive.com API Reliability**: If Massive.com has frequent outages or poor data quality, entire product at risk
   - **Mitigation**: Test extensively in Phase 0, have backup data source discussions

2. **OpenAI ChatKit Changes**: If OpenAI changes pricing or deprecates features
   - **Mitigation**: Stay updated on OpenAI announcements, have migration plan to open-source LLMs

3. **Cost Overruns**: If API costs exceed projections
   - **Mitigation**: Monitor costs daily, implement aggressive caching, adjust pricing

4. **Low User Adoption**: If <10 users subscribe in first 3 months
   - **Mitigation**: Free trial period, extensive marketing, iterate on value prop

### Contingency Plans

**If timeline slips**:
- Cut scope (delay swings/LEAPS module, launch without trade journal)
- Add resources (hire contractors for specific components)
- Extend beta period (validate before public launch)

**If costs exceed budget**:
- Reduce query limits per tier
- Increase prices
- Optimize caching aggressively
- Delay features that increase API usage

**If technical blockers arise**:
- Pivot architecture (e.g., switch from ChatKit to custom LLM integration)
- Simplify features (e.g., basic charts instead of advanced TradingView)
- Hire specialist consultants

---

## Success Metrics by Phase

### Phase 1 (Levels Engine)
- ✅ Levels accuracy >99.5%
- ✅ API response time <500ms
- ✅ Unit test coverage >80%

### Phase 2 (Basic Chat)
- ✅ AI responds to 100 queries without error
- ✅ Response time <3 sec
- ✅ 3 beta testers successfully use it

### Phase 3 (Charts)
- ✅ Charts render <1 sec
- ✅ Real-time updates <2 sec latency
- ✅ Levels accurately placed

### Phase 4 (Card Widgets)
- ✅ Cards render without breaking layout
- ✅ Live updates work
- ✅ Beta testers prefer cards to text

### Phase 5 (Options Analysis)
- ✅ Greeks accurate (within 0.02 Delta)
- ✅ Options chain loads <1 sec
- ✅ AI explains Greeks correctly

### Phase 6 (Screenshots)
- ✅ Extraction accuracy >80%
- ✅ Works with 5 major brokers
- ✅ 3 beta testers successfully upload screenshots

### Phase 7 (Trade Journal)
- ✅ Import 100+ trades without error
- ✅ Analytics accurate
- ✅ Insights actionable

### Phase 8 (Alerts)
- ✅ Alerts fire within 30 sec
- ✅ Zero missed alerts in testing
- ✅ <5% false positives

### Phase 9 (Opportunity Scanner)
- ✅ Finds 3-5 opportunities/day
- ✅ False positive rate <20%
- ✅ Beta testers find 1+ valuable opportunity/week

### Phase 10 (Swings & LEAPS)
- ✅ Charts correct for weekly/monthly
- ✅ LEAPS calculations accurate
- ✅ Beta testers with LEAPS find value

### Phase 11 (Beta)
- ✅ 80%+ satisfaction
- ✅ 60%+ daily active
- ✅ API costs on target

### Phase 12 (Launch)
- ✅ 25 paying subscribers (Month 3)
- ✅ 70% retention
- ✅ Profitable (cover fixed costs)

---

## Related Documentation

- [Master Specification](./MASTER_SPEC.md)
- [Cost Analysis](./COST_ANALYSIS.md)
- [Architecture Overview](./architecture/SYSTEM_OVERVIEW.md)
- [Feature Specifications](./features/)
- [Testing Strategy](./testing/TEST_PLAN.md)
- [Deployment Plan](./deployment/ROLLOUT_PLAN.md)

---

**Document Version History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-03 | Nate | Initial implementation roadmap with 13 phases |
