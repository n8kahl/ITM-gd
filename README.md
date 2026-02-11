# TradeITM Platform

TradeITM is a Next.js + Supabase member platform for trader education, journaling, and community engagement.

## Core Features

- Member dashboard with role and tier-based access controls.
- Trade Journal V2 with analytics, grading, and sharing workflows.
- Academy training system with XP, ranks, and achievements.
- Profile Hub with trader identity, transcript, academy progress, Discord sync, and affiliate settings.
- Trade Social with feed, likes, achievements, highlights, and leaderboards.

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
pnpm test:unit
pnpm test:e2e
```
