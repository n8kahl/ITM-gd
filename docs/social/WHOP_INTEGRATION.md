# WHOP Integration

## Purpose
WHOP integration powers affiliate tracking and membership-related referral lifecycle updates.

## Required Environment Variables
- `WHOP_API_KEY`
- `WHOP_WEBHOOK_SECRET`
- `WHOP_COMPANY_ID`

## Webhook Endpoint
- `POST /api/webhooks/whop`

## Security
- Incoming webhook payloads are HMAC-verified using `WHOP_WEBHOOK_SECRET`.
- Invalid signatures return `401`.

## Supported Events
- `membership.went_valid`
  - Marks referrals as subscribed
  - Updates `whop_membership_id`
- `membership.went_invalid`
  - Marks subscribed referrals as churned
- `payment.succeeded`
  - Adds commission to matching referral row
- `setup_intent.succeeded`
  - Reserved no-op for future billing workflow enhancements

## Data Tables
- `affiliate_referrals`
- `member_profiles`

## Operational Notes
- Affiliate stats shown in Profile Hub read from `affiliate_referrals` and `member_profiles`.
- If a webhook includes customer email, user linkage can be backfilled to `referred_user_id`.
