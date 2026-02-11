# Profile Hub

## Overview

The Profile Hub is your comprehensive trading identity center. It consolidates all member data into a single, premium dashboard accessible at `/members/profile`.

## Sections

### 1. Trader Identity Card
- Discord avatar with tier-colored gradient ring
- Display name, tagline, and bio
- Membership tier badge (Core, Pro, Executive)
- Academy rank and XP progress bar
- Trader DNA tags (top symbols, strategy, trading style)
- Member since date

### 2. Trading Transcript
- Verified statistics computed from your journal entries
- Total trades, win rate, profit factor, total P&L
- Best month, average discipline score, average AI grade
- AI grade distribution bar (A/B/C/D/F)
- Mini equity curve sparkline
- Privacy-controlled: you can hide this from other members

### 3. Academy Progress & Credentials
- Current rank and XP
- Progress bar to next rank
- Achievement count
- Course completion data

### 4. Discord & Community
- Discord username and avatar display
- Discord server roles with color-coded badges
- Role sync button
- Direct link to Discord server

### 5. WHOP & Affiliate Hub
- Your affiliate referral URL (copy to clipboard)
- Referral statistics: total, active, earnings
- Conversion rate tracking
- Commission tracking

### 6. Settings & Preferences
Access via the Settings button in the top-right corner:
- **Privacy Settings**: Control who can see your transcript, academy data, trades, and profile
- **Notification Preferences**: Toggle notifications for likes, comments, leaderboard changes, achievements, and weekly digest
- **AI Coach Preferences**: Set risk tolerance, preferred symbols, trading notes, and account size range

## Privacy Controls

| Setting | Description | Default |
|---------|-------------|---------|
| Show Transcript | Allow others to view your trading stats | On |
| Show Academy | Allow others to see your academy progress | On |
| Show Trades in Feed | Allow your shared trades to appear in the social feed | On |
| Show on Leaderboard | Include your stats in community leaderboards | On |
| Show Discord Roles | Display your Discord roles on your profile | On |
| Profile Visibility | Who can view your profile: Public, Members, Private | Public |

## API Endpoints

- `GET /api/members/profile` — Fetch your extended profile
- `PATCH /api/members/profile` — Update profile fields
- `GET /api/members/profile/[userId]` — View another member's public profile
- `GET /api/members/profile/transcript` — Fetch trading transcript
- `GET /api/members/profile/views` — Profile view analytics
