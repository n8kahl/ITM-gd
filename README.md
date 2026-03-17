# TradeITM Platform

TradeITM is a Next.js +
- **Supabase**: Backend database and real-time subscriptions
- **Massive.com**: Market data provider (Real-time prices, Options Chains, Greeks, Market Status)
- **OpenAI**: AI analysis and chat
- **Redis**: Caching layer for market data and sessions

## Core Features

- Member dashboard with role and tier-based access controls.
- Trade Journal V2 with analytics, grading, and sharing workflows.
- Academy training system with XP, ranks, and achievements.
- Profile Hub with trader identity, transcript, academy progress, Discord sync, and affiliate settings.
- Trade Social with feed, likes, achievements, highlights, and leaderboards.

## Market Data Services

The application integrates with Massive.com for:
- **Real-Time Prices**: Live trade/quote data with fallback.
- **Market Status**: Holiday calendars and market hours status.
- **Market Intelligence**: Top gainers/losers and stock splits.
- **Options Data**: Full option chains and real-time Greeks calculation.

See [Market Data Services Documentation](docs/MARKET_DATA_SERVICES.md) for details.

## Profile Hub + Trade Social

- Profile page: `/members/profile`
- Social page: `/members/social`
- Social APIs:
  - `/api/members/profile`
  - `/api/members/profile/[userId]`
  - `/api/members/profile/transcript`
  - `/api/members/profile/views`
  - `/api/members/affiliate`
  - `/api/social/feed`
  - `/api/social/feed/[itemId]/like`
  - `/api/social/leaderboard`
  - `/api/social/community-stats`
  - `/api/social/share-trade`
  - `/api/webhooks/whop`

## Local Development

```bash
pnpm install
pnpm dev
```

## Testing

```bash
pnpm typecheck
pnpm lint:journal:release
pnpm test:coverage
pnpm test:backend:journal-contract
pnpm test:journal:e2e
pnpm test:journal:release
pnpm trade-journal:release:preflight
pnpm trade-journal:release:run
pnpm test:unit
pnpm test:e2e
```

Trade Journal QE docs:
- `docs/trade-journal/TRADE_JOURNAL_QE_TRACEABILITY_MATRIX_2026-03-17.md`
- `docs/trade-journal/TRADE_JOURNAL_STAGING_GATE_RUNBOOK_2026-03-17.md`
- `docs/trade-journal/TRADE_JOURNAL_RELEASE_EVIDENCE_TEMPLATE_2026-03-17.md`
