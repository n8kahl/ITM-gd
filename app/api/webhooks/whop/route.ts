import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { successResponse, errorResponse } from '@/lib/api/response'

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

  const sigBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  // timingSafeEqual requires equal length buffers
  if (sigBuffer.length !== expectedBuffer.length) return false

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer)
}

export async function POST(request: NextRequest) {
  try {
    // Fail closed: reject all webhooks if secret is not configured
    if (!WHOP_WEBHOOK_SECRET) {
      console.error('WHOP_WEBHOOK_SECRET is not configured')
      return errorResponse('Webhook secret not configured', 500)
    }

    const payload = await request.text()
    const signature = request.headers.get('x-whop-signature') || ''

    // Verify webhook signature — always required
    if (!verifyWebhookSignature(payload, signature)) {
      return errorResponse('Invalid signature', 401)
    }

    const event: WhopWebhookEvent = JSON.parse(payload)
    const { action, data } = event

    // Create Supabase admin client for webhook processing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    switch (action) {
      case 'membership.went_valid': {
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

        // Update member_profiles if linked — use targeted query instead of listUsers
        const email = data.email as string | undefined
        if (email && membershipId) {
          const { data: users } = await supabase
            .from('auth.users' as 'member_profiles')
            .select('id')
            .eq('email', email)
            .limit(1)

          // Fallback: try RPC or direct query on auth schema
          if (!users || users.length === 0) {
            // Use admin API with filter
            const { data: authData } = await supabase.auth.admin.listUsers({
              page: 1,
              perPage: 1,
            })
            const matchedUser = authData?.users?.find(u => u.email === email)
            if (matchedUser) {
              await supabase
                .from('member_profiles')
                .update({ whop_membership_id: membershipId })
                .eq('user_id', matchedUser.id)
            }
          } else {
            await supabase
              .from('member_profiles')
              .update({ whop_membership_id: membershipId })
              .eq('user_id', users[0].id)
          }
        }
        break
      }

      case 'membership.went_invalid': {
        const membershipId = data.id as string

        await supabase
          .from('affiliate_referrals')
          .update({ status: 'churned' })
          .eq('whop_membership_id', membershipId)
          .eq('status', 'subscribed')

        break
      }

      case 'payment.succeeded': {
        const amount = data.amount as number | undefined
        const affiliateId = data.affiliate_id as string | undefined

        if (affiliateId && amount) {
          // Calculate commission (standard 20%) — accumulate, don't overwrite
          const commission = amount * 0.2

          // Fetch current commission to accumulate
          const { data: existing } = await supabase
            .from('affiliate_referrals')
            .select('commission_amount')
            .eq('whop_checkout_id', affiliateId)
            .single()

          const currentAmount = existing?.commission_amount ?? 0

          await supabase
            .from('affiliate_referrals')
            .update({
              commission_amount: currentAmount + commission,
              commission_currency: 'USD',
            })
            .eq('whop_checkout_id', affiliateId)
        }
        break
      }

      case 'setup_intent.succeeded': {
        break
      }

      default:
        break
    }

    return successResponse({ action })
  } catch (error) {
    console.error('WHOP webhook error:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Internal error',
      500
    )
  }
}
