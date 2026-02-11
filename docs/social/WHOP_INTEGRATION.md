# WHOP Integration

## Overview

WHOP provides membership management and affiliate tracking for the ITM trading community. The integration handles:
- Affiliate referral URL management
- Referral tracking and status updates
- Commission calculation and tracking
- Webhook event processing

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `WHOP_API_KEY` | WHOP Company API key | `whop_sk_...` |
| `WHOP_WEBHOOK_SECRET` | Webhook signing secret for verification | `whsec_...` |
| `WHOP_COMPANY_ID` | Your WHOP Company ID | `biz_...` |
| `WHOP_DEFAULT_AFFILIATE_PLAN` | Default affiliate plan ID | `plan_...` |

## Webhook Setup

### 1. Configure in WHOP Dashboard
1. Go to your WHOP Company Dashboard
2. Navigate to Developer > Webhooks
3. Add endpoint: `https://your-domain.com/api/webhooks/whop`
4. Select events: `membership.went_valid`, `membership.went_invalid`, `payment.succeeded`
5. Copy the webhook secret to `WHOP_WEBHOOK_SECRET`

### 2. Webhook Events

#### `membership.went_valid`
Triggered when a membership becomes active (new subscriber).
- Updates `affiliate_referrals.status` to `subscribed`
- Links WHOP membership ID to member profile
- Records subscription timestamp

#### `membership.went_invalid`
Triggered when a membership expires or is cancelled.
- Updates `affiliate_referrals.status` to `churned`

#### `payment.succeeded`
Triggered when a payment is processed.
- Calculates commission (20% default)
- Updates `affiliate_referrals.commission_amount`

## Affiliate Flow

1. **Member gets referral URL** — Displayed on Profile Hub in the WHOP & Affiliate card
2. **Prospect clicks URL** — WHOP tracks the click with affiliate ID
3. **Prospect signs up** — Webhook fires `membership.went_valid`
4. **Payment processed** — Webhook fires `payment.succeeded`, commission recorded
5. **Member views stats** — Affiliate stats fetched from `/api/members/affiliate`

## Database Tables

### `affiliate_referrals`
Tracks individual referral events and their lifecycle.

| Column | Type | Description |
|--------|------|-------------|
| referrer_id | UUID | The member who made the referral |
| referred_email | TEXT | Email of the referred person |
| status | TEXT | pending, signed_up, subscribed, churned, expired |
| referral_code | TEXT | Unique referral code |
| commission_amount | NUMERIC | Earned commission in USD |
| commission_paid | BOOLEAN | Whether commission has been paid out |

### `member_profiles` (WHOP fields)
| Column | Type | Description |
|--------|------|-------------|
| whop_user_id | TEXT | WHOP user identifier |
| whop_affiliate_url | TEXT | Member's affiliate referral URL |
| whop_membership_id | TEXT | Active WHOP membership ID |

## Security

- All webhooks are verified using HMAC-SHA256 signature validation
- The `x-whop-signature` header is compared against the expected hash
- Timing-safe comparison prevents timing attacks
- Database operations use service role for webhook processing
