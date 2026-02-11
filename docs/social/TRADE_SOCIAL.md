# Trade Social

## Overview

Trade Social is the community engagement layer at `/members/social`. It provides a social feed, leaderboards, achievement gallery, and community highlights.

## Features

### Social Feed
- View shared trade cards, achievements, milestones, and admin highlights
- Filter by type: All, Trades, Achievements, Milestones, Highlights
- Sort by: Latest, Most Liked, Top P&L
- Toggle to show only featured items
- Cursor-based infinite scroll pagination
- Like/unlike feed items with optimistic UI

### Trade Card Sharing
From the Journal, you can share any closed trade to the community:
1. Open a closed trade's detail view
2. Click "Share" button
3. Choose a template (Dark Elite, Emerald Gradient, Champagne Premium, Minimal, Story)
4. Select visibility (Public, Members Only, Private)
5. Click "Share" to publish to the feed

**Requirements for sharing:**
- Trade must be closed (`is_open = false`)
- Trade must have P&L data
- Trade cannot be shared more than once

### Leaderboards
Community leaderboards updated daily with multiple categories:

| Category | Description | Minimum Trades |
|----------|-------------|---------------|
| Win Rate | Percentage of winning trades | 10 |
| Total P&L | Sum of all P&L | 5 |
| Longest Streak | Consecutive winning trades | 5 |
| Academy XP | Total XP earned | N/A |
| Discipline Score | Average discipline rating | 10 |
| Trade Count | Total number of trades | 0 |

**Periods:** Weekly, Monthly, All Time

You can opt out of leaderboards via Privacy Settings.

### Achievement Gallery
A community wall showcasing recent achievements earned by members.

### Community Highlights
Admin-curated featured content including:
- Trade of the Week
- Member Spotlights
- Community Notes

## Feed Item Types

### Trade Card
Shared from journal entries. Displays symbol, direction, P&L, percentage, AI grade, and strategy.

### Achievement
Automatically posted when a member earns an academy achievement. Shows title, XP earned, and tier.

### Milestone
Posted for significant events like win streaks, rank promotions, and trade count milestones.

### Highlight
Admin-curated featured content with custom titles, descriptions, and spotlight types.

## API Endpoints

- `GET /api/social/feed` — Fetch feed items with filters and pagination
- `POST /api/social/feed` — Create a new feed item
- `POST /api/social/feed/[itemId]/like` — Like a feed item
- `DELETE /api/social/feed/[itemId]/like` — Unlike a feed item
- `GET /api/social/leaderboard` — Fetch leaderboard data
- `POST /api/social/share-trade` — Share a journal entry to the feed
