# Social API Reference

## Response Envelope
Most endpoints return:

```json
{
  "success": true,
  "data": {}
}
```

Error responses return:

```json
{
  "success": false,
  "error": "message"
}
```

## Authentication
All endpoints require an authenticated member context.

## Profile Endpoints

### `GET /api/members/profile`
Returns current user's profile, creating a default profile row if missing.

### `PATCH /api/members/profile`
Updates profile fields including privacy, notification, and AI preferences.

### `GET /api/members/profile/[userId]`
Returns a member profile with privacy-aware field filtering.

### `GET /api/members/profile/transcript`
Returns transcript stats for current user or `?userId=` target (privacy checked).

### `GET /api/members/profile/views`
Returns profile view analytics for current user.

### `GET /api/members/affiliate`
Returns affiliate summary and recent referrals.

## Social Endpoints

### `GET /api/social/feed`
Query params:
- `type`: `all|trade_card|achievement|milestone|highlight`
- `sort`: `latest|most_liked|top_pnl`
- `featured_only`: `true|false`
- `cursor`: ISO date-time string
- `limit`: `1-50`

### `POST /api/social/feed`
Creates a new feed item for supported reference tables.

### `POST /api/social/feed/[itemId]/like`
Creates a like record for current user.

### `DELETE /api/social/feed/[itemId]/like`
Removes current user's like record.

### `GET /api/social/leaderboard`
Query params:
- `period`: `weekly|monthly|all_time`
- `category`: `win_rate|total_pnl|longest_streak|academy_xp|discipline_score|trade_count`
- `limit`: `1-100`

### `GET /api/social/community-stats`
Returns aggregate community counters.

### `POST /api/social/share-trade`
Creates a shareable trade card from a journal entry and posts it to the social feed.

Request fields:
- `journal_entry_id` (UUID, required)
- `template` (`dark-elite|emerald-gradient|champagne-premium|minimal|story`)
- `format` (`landscape|story|square`)
- `visibility` (`public|members|private`)
- `share_to_discord` (boolean)

## Webhook Endpoint

### `POST /api/webhooks/whop`
Receives WHOP membership and payment webhooks for affiliate/referral lifecycle updates.
