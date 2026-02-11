# Privacy Controls

## Overview

All social features respect user privacy settings. Members have granular control over what data is visible to others.

## Privacy Settings

All settings are stored in `member_profiles.privacy_settings` as JSONB.

### Profile Visibility
Controls who can view your profile page:
- **Public** — Visible to all authenticated members
- **Members** — Visible to all authenticated members (same as public currently)
- **Private** — Only you can see your profile

### Individual Toggles

| Setting | What It Controls |
|---------|-----------------|
| `show_transcript` | Trading stats (win rate, P&L, etc.) visibility |
| `show_academy` | Academy progress, achievements, XP visibility |
| `show_trades_in_feed` | Whether your shared trades appear in the social feed |
| `show_on_leaderboard` | Whether you're included in community leaderboards |
| `show_discord_roles` | Whether your Discord roles are shown on your profile |

### Defaults
All toggles default to `true` (public). New members start with full visibility.

## How Privacy Is Enforced

### API Level
- `GET /api/members/profile/[userId]` checks `profile_visibility` before returning data
- `GET /api/members/profile/transcript?userId=X` checks `show_transcript`
- Leaderboard computation only includes users with `show_on_leaderboard = true`

### Database Level (RLS)
- `member_profiles` has RLS policies that restrict reads based on `profile_visibility`
- Users always have full access to their own data
- Service role bypasses all restrictions
- Admin users can read all profiles

### Component Level
- Profile components check `isOwnProfile` to show/hide edit controls
- Privacy toggles are only visible on your own profile
- Transcript card shows "Hidden" state when privacy is disabled

## Data Retention
- Profile view analytics are stored indefinitely
- Users can export their data via the Settings panel
- Deleting your account cascades to remove all profile and social data
