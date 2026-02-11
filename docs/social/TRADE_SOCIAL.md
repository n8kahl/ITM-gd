# Trade Social

## Overview
Trade Social is the community layer at `/members/social`.

It includes:
- Community feed of trades, achievements, milestones, and highlights
- Like/unlike interactions
- Leaderboard snapshots
- Achievement gallery
- Community highlights and summary stats

## Feed

### Feed Item Types
- `trade_card`
- `achievement`
- `milestone`
- `highlight`

### Feed Controls
- Type filters: all, trades, achievements, milestones, highlights
- Sorting: latest, most liked, top P&L
- Featured-only toggle

### Feed APIs
- `GET /api/social/feed`
- `POST /api/social/feed`
- `POST /api/social/feed/[itemId]/like`
- `DELETE /api/social/feed/[itemId]/like`

## Trade Sharing Flow
- Journal entry detail sheet exposes a share action for closed trades with P&L.
- Share requests are sent to `POST /api/social/share-trade`.
- Share formats: `landscape`, `story`, `square`.
- Successful share creates:
  - `shared_trade_cards` row
  - `social_feed_items` row

## Leaderboards
- Served by `GET /api/social/leaderboard`.
- Backed by `leaderboard_snapshots`.
- Snapshot data is computed by `supabase/functions/compute-leaderboards`.

## Community Sidebar
- Stats: `GET /api/social/community-stats`
- Leaderboard widget: `GET /api/social/leaderboard`
- Achievement wall: `GET /api/social/feed?type=achievement`
- Highlights: `GET /api/social/feed?featured_only=true`
