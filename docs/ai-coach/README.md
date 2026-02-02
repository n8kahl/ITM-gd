# AI Coach Documentation

**Welcome to the TITM AI Coach comprehensive specification and implementation guide.**

This documentation covers every aspect of the AI Coach product, from initial concept through launch and beyond.

---

## 📋 Quick Links

### Core Documents
- **[MASTER_SPEC.md](./MASTER_SPEC.md)** - 🎯 START HERE: Complete product overview, vision, metrics
- **[IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)** - Detailed phase-by-phase implementation plan (48-52 weeks)
- **[COST_ANALYSIS.md](./COST_ANALYSIS.md)** - Financial projections, pricing strategy, unit economics

### UI/UX Design
- **[CENTER_COLUMN_DESIGN.md](./ui-ux/CENTER_COLUMN_DESIGN.md)** - ⭐ Critical: Primary data visualization canvas (10 component types)
- [MEMBER_DASHBOARD_REDESIGN.md](./ui-ux/MEMBER_DASHBOARD_REDESIGN.md) - Overall dashboard with AI Coach tab
- [CARD_WIDGETS_LIBRARY.md](./ui-ux/CARD_WIDGETS_LIBRARY.md) - Embedded mini-dashboards in chat
- [CHAT_INTERFACE.md](./ui-ux/CHAT_INTERFACE.md) - ChatKit customization and layout

### Architecture
- [SYSTEM_OVERVIEW.md](./architecture/SYSTEM_OVERVIEW.md) - High-level technical architecture
- [DATA_FLOW.md](./architecture/DATA_FLOW.md) - How data moves through the system
- [WEBSOCKET_ARCHITECTURE.md](./architecture/WEBSOCKET_ARCHITECTURE.md) - Real-time data delivery
- [CACHING_STRATEGY.md](./architecture/CACHING_STRATEGY.md) - Performance optimization

### Features
- [Levels Engine](./features/levels-engine/SPEC.md) - PDH, PMH, pivots, VWAP, ATR calculations
- [Options Analysis](./features/options-analysis/SPEC.md) - Greeks, IV, options chains
- [Trade Companion](./features/trade-companion/SPEC.md) - Conversational AI behavior
- [Trade Journal](./features/trade-journal/SPEC.md) - Historical performance & pattern recognition
- [Opportunity Scanner](./features/opportunity-scanner/SPEC.md) - Proactive setup discovery
- [SPX/NDX Specialization](./features/spx-ndx-specialization/SPEC.md) - Index-specific features

### Integrations
- [MASSIVE_API_REFERENCE.md](./integrations/MASSIVE_API_REFERENCE.md) - Options, Stocks, Indices APIs
- [OPENAI_CHATKIT_SETUP.md](./integrations/OPENAI_CHATKIT_SETUP.md) - ChatKit configuration & prompts

### Permissions & Access
- [SUBSCRIPTION_TIERS.md](./permissions/SUBSCRIPTION_TIERS.md) - Lite, Pro, Elite tier details
- [ACCESS_CONTROL_SPEC.md](./permissions/ACCESS_CONTROL_SPEC.md) - Permission enforcement
- [USAGE_LIMITS.md](./permissions/USAGE_LIMITS.md) - Rate limiting & fair use

### AI Configuration
- [SYSTEM_PROMPT.md](./ai-prompts/SYSTEM_PROMPT.md) - Master AI Coach personality & behavior
- [Feature Prompts](./ai-prompts/feature-prompts/) - Prompt templates per feature

### Testing & Deployment
- [TEST_PLAN.md](./testing/TEST_PLAN.md) - QA strategy, acceptance criteria
- [BETA_PROGRAM.md](./testing/BETA_PROGRAM.md) - Beta user selection & feedback
- [ROLLOUT_PLAN.md](./deployment/ROLLOUT_PLAN.md) - Phased deployment strategy

---

## 🚀 Getting Started

### For Product Managers
1. Read **[MASTER_SPEC.md](./MASTER_SPEC.md)** to understand product vision
2. Review **[IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)** for timeline
3. Validate **[COST_ANALYSIS.md](./COST_ANALYSIS.md)** for budgeting

### For Developers
1. Read [SYSTEM_OVERVIEW.md](./architecture/SYSTEM_OVERVIEW.md) for architecture
2. Review feature specs in `/features/` for your assigned components
3. Check [DATA_FLOW.md](./architecture/DATA_FLOW.md) to understand data pipelines

### For Designers
1. Read **[CENTER_COLUMN_DESIGN.md](./ui-ux/CENTER_COLUMN_DESIGN.md)** for primary canvas
2. Review [CARD_WIDGETS_LIBRARY.md](./ui-ux/CARD_WIDGETS_LIBRARY.md) for chat widgets
3. Check [MEMBER_DASHBOARD_REDESIGN.md](./ui-ux/MEMBER_DASHBOARD_REDESIGN.md) for layout

### For QA/Testers
1. Read [TEST_PLAN.md](./testing/TEST_PLAN.md) for testing strategy
2. Review [BETA_PROGRAM.md](./testing/BETA_PROGRAM.md) for beta management
3. Check feature specs for acceptance criteria

---

## 📁 Documentation Structure

```
/docs/ai-coach/
├── MASTER_SPEC.md                    # 🎯 Start here
├── IMPLEMENTATION_ROADMAP.md         # Timeline & phases
├── COST_ANALYSIS.md                  # Financial projections
│
├── /architecture                     # Technical architecture
│   ├── SYSTEM_OVERVIEW.md
│   ├── DATA_FLOW.md
│   ├── CHATKIT_INTEGRATION.md
│   ├── MASSIVE_API_INTEGRATION.md
│   ├── WEBSOCKET_ARCHITECTURE.md
│   ├── CACHING_STRATEGY.md
│   └── SECURITY_MODEL.md
│
├── /features                         # Feature specifications
│   ├── /levels-engine
│   │   ├── SPEC.md
│   │   ├── CALCULATIONS.md
│   │   ├── DATA_REQUIREMENTS.md
│   │   └── TEST_CASES.md
│   ├── /options-analysis
│   │   ├── SPEC.md
│   │   ├── GREEKS_ENGINE.md
│   │   └── TEST_CASES.md
│   ├── /trade-companion
│   ├── /trade-journal
│   ├── /opportunity-scanner
│   ├── /swings-leaps-module
│   └── /spx-ndx-specialization
│
├── /ui-ux                            # UI/UX specifications
│   ├── CENTER_COLUMN_DESIGN.md       # ⭐ Critical
│   ├── MEMBER_DASHBOARD_REDESIGN.md
│   ├── CARD_WIDGETS_LIBRARY.md
│   ├── CHAT_INTERFACE.md
│   └── /wireframes
│
├── /permissions                      # Access control
│   ├── SUBSCRIPTION_TIERS.md
│   ├── ACCESS_CONTROL_SPEC.md
│   └── USAGE_LIMITS.md
│
├── /integrations                     # External services
│   ├── MASSIVE_API_REFERENCE.md
│   ├── OPENAI_CHATKIT_SETUP.md
│   └── FUTURE_INTEGRATIONS.md
│
├── /data-models                      # Database schemas
│   ├── USER_PROFILE.md
│   ├── TRADE_HISTORY.md
│   ├── POSITION_TRACKING.md
│   └── CONVERSATION_CONTEXT.md
│
├── /ai-prompts                       # AI configuration
│   ├── SYSTEM_PROMPT.md
│   ├── /feature-prompts
│   └── PROMPT_ENGINEERING_GUIDE.md
│
├── /testing                          # QA & testing
│   ├── TEST_PLAN.md
│   ├── BETA_PROGRAM.md
│   └── USER_ACCEPTANCE_TESTS.md
│
├── /deployment                       # Launch & operations
│   ├── ROLLOUT_PLAN.md
│   ├── MONITORING.md
│   └── ROLLBACK_PLAN.md
│
└── /future-enhancements             # Phase 2+
    ├── TRAINING_MATERIALS_INTEGRATION.md
    ├── VOICE_MODE.md
    └── COMMUNITY_INTELLIGENCE.md
```

---

## 📊 Project Status

### ✅ Completed
- Master specification document
- Implementation roadmap (13 phases, 48-52 weeks)
- Cost analysis & financial projections
- Center column UI design (10 component types)

### 🚧 In Progress
- Architecture documentation
- Feature specifications (levels engine, options analysis, etc.)
- UI/UX wireframes
- Permissions & access control specs

### ⏳ To Do
- AI prompt templates
- Testing strategy & beta program plan
- Deployment & monitoring setup
- Data model schemas

---

## 🎯 Key Milestones

| Milestone | Target Date | Status |
|-----------|-------------|--------|
| Specifications Complete | Week 6 | 🚧 In Progress |
| Phase 1: Levels Engine MVP | Week 12 | ⏳ Not Started |
| Phase 2: Basic AI Chat | Week 16 | ⏳ Not Started |
| Phase 3: Charts | Week 20 | ⏳ Not Started |
| Phase 4: Card Widgets | Week 24 | ⏳ Not Started |
| Phase 5: Options Analysis | Week 28 | ⏳ Not Started |
| Beta Launch | Week 48 | ⏳ Not Started |
| Public Launch | Week 52+ | ⏳ Not Started |

---

## 💡 Key Design Decisions

### Why SPX/NDX Focus?
- TITM community specialization
- Cash-settled, European-style options (unique considerations)
- High liquidity, institutional-grade data available from Massive.com

### Why Massive.com?
- Institutional-grade data (20+ years historical, real-time)
- Full Greeks, IV, options chains for SPX/NDX
- Flat pricing ($597/mo unlimited calls vs per-call pricing)
- WebSocket support for real-time updates

### Why OpenAI ChatKit?
- Pre-built conversational UI (faster to market)
- Function calling for tool integration (get_key_levels, analyze_position)
- Vision API for screenshot analysis
- GPT-4 Turbo for high-quality responses

### Why Spec-First Approach?
- Complex integration (Massive.com + OpenAI + real-time data)
- High cost per user ($35/month variable) requires precise planning
- Multiple stakeholders need alignment
- Enables AI-assisted development with clear requirements

---

## 🔐 Security & Compliance

### Data Privacy
- User trade data encrypted at rest and in transit
- No sharing of individual trades without explicit consent
- GDPR/CCPA compliant data handling
- User can export or delete all data

### Financial Compliance
- Clear disclaimers: NOT financial advice
- AI phrasing: "Here's the data" not "You should do X"
- No trade execution (analysis only)
- Educational framing throughout

### API Security
- Rate limiting per tier (Lite: 100/mo, Pro: 500/mo, Elite: unlimited)
- Usage tracking and billing integration
- Secure API key storage (encrypted)
- Prevent abuse with tier enforcement

---

## 📈 Success Metrics

### Product KPIs (Month 12 Targets)
- 150 paying subscribers
- 75% daily active usage (DAU)
- 25 messages per user per day
- 70% screenshot upload adoption
- 60%+ NPS score

### Financial KPIs (Month 12 Targets)
- $22,500 monthly recurring revenue
- <8% churn rate
- <$30 API cost per user per month
- >82% gross margin

### Quality KPIs (Ongoing)
- >99.5% AI accuracy on levels calculations
- <3 second end-to-end response time (p95)
- >99.5% WebSocket uptime
- <0.5% error rate

---

## 🤝 Contributing

### Updating Documentation
1. All changes require review before merge
2. Use version history table at bottom of each document
3. Keep docs in sync with implementation
4. Update README if structure changes

### Asking Questions
- Product questions: Tag @Nate
- Technical questions: Tag @TechnicalLead (TBD)
- Design questions: Tag @Designer (TBD)

### Feedback Loop
- Weekly spec reviews during Phase 0
- Beta feedback incorporated into specs
- Post-launch: Monthly spec updates based on learnings

---

## 📚 Additional Resources

### External Documentation
- [Massive.com API Docs](https://massive.com/docs)
- [OpenAI ChatKit Documentation](https://platform.openai.com/docs/guides/chatkit)
- [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/)

### Learning Resources
- Options Trading Basics: [TITM Course Library]
- SPX/NDX Mechanics: [Internal Wiki TBD]
- AI Prompt Engineering: [OpenAI Guide](https://platform.openai.com/docs/guides/prompt-engineering)

---

## 📞 Contact

**Product Owner**: Nate (kahl.nathan@gmail.com)
**Repository**: [Your Repo URL]
**Project Management**: [Tool Link TBD]

---

## ⚖️ License

This documentation is proprietary to TITM Community. Internal use only.

---

**Last Updated**: 2026-02-03
**Document Version**: 1.0
**Status**: 🚧 Active Development
