import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/response'

const WHOP_WEBHOOK_SECRET = process.env.WHOP_WEBHOOK_SECRET

interface WhopWebhookEvent {
  action?: string
  type?: string
  data?: Record<string, unknown>
}

function normalizeSignature(signature: string): string {
  const trimmed = signature.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('sha256=')) {
    return trimmed.slice('sha256='.length)
  }
  return trimmed
}

function safeCompare(expected: string, received: string): boolean {
  if (!expected || !received) return false

  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(received)

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
}

function verifyWebhookSignature(payload: string, signatureHeader: string): boolean {
  if (!WHOP_WEBHOOK_SECRET) {
    return false
  }

  const normalizedReceived = normalizeSignature(signatureHeader)
  if (!normalizedReceived) {
    return false
  }

  const expectedHex = crypto
    .createHmac('sha256', WHOP_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')

  const expectedBase64 = crypto
    .createHmac('sha256', WHOP_WEBHOOK_SECRET)
    .update(payload)
    .digest('base64')

  return (
    safeCompare(expectedHex, normalizedReceived)
    || safeCompare(expectedBase64, normalizedReceived)
  )
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

function normalizeCurrency(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim().toUpperCase()
  }
  return 'USD'
}

function getAction(event: WhopWebhookEvent): string {
  if (typeof event.action === 'string') return event.action
  if (typeof event.type === 'string') return event.type
  return ''
}

function getDataRecord(event: WhopWebhookEvent): Record<string, unknown> {
  if (event.data && typeof event.data === 'object' && !Array.isArray(event.data)) {
    return event.data
  }

  return {}
}

function getDataString(data: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return null
}

async function findUserIdByEmail(
  supabaseAdmin: any,
  email: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })

    if (error) {
      return null
    }

    const normalizedEmail = email.toLowerCase()
    const matchedUser = data.users.find(
      (candidate: { email?: string; id: string }) => candidate.email?.toLowerCase() === normalizedEmail,
    )

    return matchedUser?.id ?? null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  if (!WHOP_WEBHOOK_SECRET) {
    return errorResponse('Webhook secret not configured', 500)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse('Supabase service role not configured', 500)
  }

  let payload = ''
  try {
    payload = await request.text()
  } catch {
    return errorResponse('Invalid payload', 400)
  }

  const signature = request.headers.get('x-whop-signature') || ''
  if (!verifyWebhookSignature(payload, signature)) {
    return errorResponse('Invalid signature', 401)
  }

  let event: WhopWebhookEvent
  try {
    event = JSON.parse(payload) as WhopWebhookEvent
  } catch {
    return errorResponse('Invalid JSON payload', 400)
  }

  const action = getAction(event)
  if (!action) {
    return errorResponse('Missing webhook action', 400)
  }

  const data = getDataRecord(event)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  try {
    if (action === 'membership.went_valid') {
      const membershipId = getDataString(data, ['id', 'membership_id'])
      const checkoutId = getDataString(data, ['affiliate_id', 'checkout_id', 'referral_id'])
      const email = getDataString(data, ['email', 'customer_email'])

      if (checkoutId) {
        await supabaseAdmin
          .from('affiliate_referrals')
          .update({
            status: 'subscribed',
            whop_membership_id: membershipId,
            signed_up_at: new Date().toISOString(),
            subscribed_at: new Date().toISOString(),
          })
          .eq('whop_checkout_id', checkoutId)
      }

      if (email && membershipId) {
        const matchedUserId = await findUserIdByEmail(supabaseAdmin, email)
        if (matchedUserId) {
          await supabaseAdmin
            .from('member_profiles')
            .update({ whop_membership_id: membershipId })
            .eq('user_id', matchedUserId)

          await supabaseAdmin
            .from('affiliate_referrals')
            .update({
              referred_user_id: matchedUserId,
              status: 'subscribed',
              whop_membership_id: membershipId,
              subscribed_at: new Date().toISOString(),
            })
            .eq('referred_email', email)
            .in('status', ['pending', 'signed_up'])
        }
      }
    }

    if (action === 'membership.went_invalid') {
      const membershipId = getDataString(data, ['id', 'membership_id'])

      if (membershipId) {
        await supabaseAdmin
          .from('affiliate_referrals')
          .update({
            status: 'churned',
          })
          .eq('whop_membership_id', membershipId)
          .eq('status', 'subscribed')
      }
    }

    if (action === 'payment.succeeded') {
      const checkoutId = getDataString(data, ['affiliate_id', 'checkout_id', 'referral_id'])
      const currency = normalizeCurrency(data.currency)

      const amountDollars = (() => {
        const decimalAmount = toFiniteNumber(data.amount_decimal)
        if (decimalAmount != null) return decimalAmount

        const amount = toFiniteNumber(data.amount)
        if (amount == null) return null

        const amountIsLikelyCents = Number.isInteger(amount) && amount >= 1000
        return amountIsLikelyCents ? amount / 100 : amount
      })()

      if (checkoutId && amountDollars != null) {
        const commissionAmount = Number((amountDollars * 0.2).toFixed(2))

        const { data: existingReferral } = await supabaseAdmin
          .from('affiliate_referrals')
          .select('commission_amount')
          .eq('whop_checkout_id', checkoutId)
          .maybeSingle()

        const existingCommission = toFiniteNumber(existingReferral?.commission_amount) ?? 0

        await supabaseAdmin
          .from('affiliate_referrals')
          .update({
            commission_amount: Number((existingCommission + commissionAmount).toFixed(2)),
            commission_currency: currency,
          })
          .eq('whop_checkout_id', checkoutId)
      }
    }

    if (action === 'setup_intent.succeeded') {
      // Intentional no-op for now.
    }

    return successResponse({
      received: true,
      action,
    })
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Webhook processing failed',
      500,
    )
  }
}
