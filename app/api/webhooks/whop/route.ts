import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const WHOP_WEBHOOK_SECRET = process.env.WHOP_WEBHOOK_SECRET || ''

interface WhopWebhookEvent {
  action: string
  data: Record<string, unknown>
}

function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!WHOP_WEBHOOK_SECRET) return false

  const hmac = crypto.createHmac('sha256', WHOP_WEBHOOK_SECRET)
  hmac.update(payload)
  const expectedSignature = hmac.digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()
    const signature = request.headers.get('x-whop-signature') || ''

    // Verify webhook signature
    if (WHOP_WEBHOOK_SECRET && !verifyWebhookSignature(payload, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event: WhopWebhookEvent = JSON.parse(payload)
    const { action, data } = event

    // Create Supabase admin client for webhook processing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    switch (action) {
      case 'membership.went_valid': {
        // Referral converted to subscriber
        const membershipId = data.id as string
        const affiliateId = data.affiliate_id as string | undefined

        if (affiliateId) {
          await supabase
            .from('affiliate_referrals')
            .update({
              status: 'subscribed',
              whop_membership_id: membershipId,
              subscribed_at: new Date().toISOString(),
            })
            .eq('whop_checkout_id', affiliateId)
        }

        // Update member_profiles if linked
        const email = data.email as string | undefined
        if (email && membershipId) {
          const { data: authUsers } = await supabase.auth.admin.listUsers()
          const matchedUser = authUsers?.users?.find(u => u.email === email)

          if (matchedUser) {
            await supabase
              .from('member_profiles')
              .update({
                whop_membership_id: membershipId,
              })
              .eq('user_id', matchedUser.id)
          }
        }
        break
      }

      case 'membership.went_invalid': {
        // Subscriber churned
        const membershipId = data.id as string

        await supabase
          .from('affiliate_referrals')
          .update({ status: 'churned' })
          .eq('whop_membership_id', membershipId)
          .eq('status', 'subscribed')

        break
      }

      case 'payment.succeeded': {
        // Commission earned
        const membershipId = data.membership_id as string
        const amount = data.amount as number | undefined
        const affiliateId = data.affiliate_id as string | undefined

        if (affiliateId && amount) {
          // Calculate commission (standard 20%)
          const commission = amount * 0.2

          await supabase
            .from('affiliate_referrals')
            .update({
              commission_amount: commission,
              commission_currency: 'USD',
            })
            .eq('whop_checkout_id', affiliateId)
        }
        break
      }

      case 'setup_intent.succeeded': {
        // Payment method saved — no action needed currently
        break
      }

      default:
        // Unknown event type — acknowledge but take no action
        break
    }

    return NextResponse.json({ success: true, action })
  } catch (error) {
    console.error('WHOP webhook error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
