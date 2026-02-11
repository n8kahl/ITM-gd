# Profile Hub

## Overview
The Profile Hub is the member identity and settings center at `/members/profile`.

It combines:
- Trading identity (name, avatar, tier, rank, XP)
- Verified trading transcript
- Academy progress and achievements
- Discord profile and role sync
- WHOP affiliate stats
- Privacy, notification, and AI preference controls

## Sections

### Trader Identity Card
- Displays avatar, display name, membership tier, and trader DNA tags.
- Uses profile data from `member_profiles` plus Discord metadata.

### Trading Transcript
- Displays verified trade stats from `get_trading_transcript` RPC.
- Includes win rate, profit factor, discipline score, grade distribution, and equity curve.

### Academy Progress
- Displays XP and rank progress from academy dashboard APIs.

### Discord Community
- Shows Discord username, avatar, and role sync status.
- Sync action uses the `sync-discord-roles` edge function.

### WHOP & Affiliate
- Shows referral conversion and earnings from `affiliate_referrals`.
- Uses profile `whop_affiliate_url` fallback links when needed.

### Settings
- Privacy settings (`privacy_settings`)
- Notification preferences (`notification_preferences`)
- AI coach preferences (`ai_preferences`)

## API Endpoints
- `GET /api/members/profile`
- `PATCH /api/members/profile`
- `GET /api/members/profile/[userId]`
- `GET /api/members/profile/transcript`
- `GET /api/members/profile/views`
- `GET /api/members/affiliate`

## Notes
- Transcript and profile visibility are enforced via privacy settings.
- Profile views are tracked when one member visits another member profile.
