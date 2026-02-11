# Social API Reference

All endpoints require authentication via Supabase session cookies.

## Profile Endpoints

### GET /api/members/profile
Fetch the authenticated user's extended profile. Creates a profile with defaults if none exists.

**Response:** `{ success: true, data: MemberProfile }`

### PATCH /api/members/profile
Update profile fields.

**Body:**
```json
{
  "display_name": "string | null",
  "bio": "string | null",
  "tagline": "string | null",
  "trading_style": "scalper | day_trader | swing_trader | position_trader | null",
  "whop_affiliate_url": "string (URL) | null",
  "privacy_settings": { ... },
  "notification_preferences": { ... },
  "ai_preferences": { ... }
}
```

**Response:** `{ success: true, data: MemberProfile }`

### GET /api/members/profile/[userId]
Fetch another user's public profile. Records a profile view.

**Response:** `{ success: true, data: PublicProfile }` or `403` if private.

### GET /api/members/profile/transcript
Fetch trading transcript stats.

**Query Params:**
- `userId` (optional) — Target user's ID. Defaults to authenticated user.

**Response:** `{ success: true, data: TradingTranscript }`

### GET /api/members/profile/views
Fetch profile view analytics for the authenticated user.

**Response:**
```json
{
  "success": true,
  "data": {
    "total_views": 142,
    "views_this_week": 23,
    "views_this_month": 67,
    "unique_viewers_this_month": 45
  }
}
```

## Social Feed Endpoints

### GET /api/social/feed
Fetch feed items with cursor-based pagination.

**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| type | string | "all" | Filter: all, trade_card, achievement, milestone, highlight |
| sort | string | "latest" | Sort: latest, most_liked, top_pnl |
| featured_only | boolean | false | Show only featured items |
| cursor | ISO datetime | - | Cursor for pagination |
| limit | number | 20 | Items per page (1-50) |

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "next_cursor": "2026-02-10T12:00:00.000Z",
    "has_more": true
  }
}
```

### POST /api/social/feed
Create a new feed item.

**Body:**
```json
{
  "item_type": "trade_card | achievement | milestone",
  "reference_id": "uuid",
  "reference_table": "shared_trade_cards",
  "display_data": { ... },
  "visibility": "public | members | private"
}
```

### POST /api/social/feed/[itemId]/like
Like a feed item. Idempotent — returns success even if already liked.

**Response:** `{ success: true, data: { liked: true } }`

### DELETE /api/social/feed/[itemId]/like
Unlike a feed item.

**Response:** `{ success: true, data: { liked: false } }`

## Leaderboard Endpoints

### GET /api/social/leaderboard
Fetch leaderboard rankings.

**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| period | string | "weekly" | weekly, monthly, all_time |
| category | string | "win_rate" | win_rate, total_pnl, longest_streak, academy_xp, discipline_score, trade_count |
| limit | number | 10 | Max entries (1-100) |

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "weekly",
    "category": "win_rate",
    "entries": [...],
    "user_entry": { ... },
    "snapshot_date": "2026-02-11"
  }
}
```

## Trade Sharing Endpoints

### POST /api/social/share-trade
Share a journal entry to the social feed.

**Body:**
```json
{
  "journal_entry_id": "uuid",
  "template": "dark-elite | emerald-gradient | champagne-premium | minimal | story",
  "visibility": "public | members | private",
  "share_to_discord": false
}
```

**Response:** `{ success: true, data: { feed_item, trade_card, image_url } }`

## Affiliate Endpoints

### GET /api/members/affiliate
Fetch affiliate stats and recent referrals.

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total_referrals": 15,
      "active_referrals": 8,
      "total_earnings": 450.00,
      "unpaid_earnings": 120.00,
      "conversion_rate": 53.3,
      "referral_code": "abc12345",
      "affiliate_url": "https://whop.com/..."
    },
    "recent_referrals": [...]
  }
}
```

## Webhook Endpoints

### POST /api/webhooks/whop
WHOP webhook handler for membership and payment events.

**Events handled:**
- `membership.went_valid` — Referral converted
- `membership.went_invalid` — Subscriber churned
- `payment.succeeded` — Commission earned
- `setup_intent.succeeded` — Payment method saved

**Security:** Verified via `x-whop-signature` header using HMAC-SHA256.
