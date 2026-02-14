import { NextRequest } from 'next/server'
import { z, ZodError } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
}).passthrough()

const postBodySchema = z.object({
  subscription: pushSubscriptionSchema,
})

const deleteBodySchema = z.object({
  endpoint: z.string().url().max(2048).optional(),
}).default({})

function toValidationError(error: ZodError) {
  return errorResponse('Invalid request', 400, error.flatten())
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Unauthorized', 401)

  try {
    const parsed = postBodySchema.parse(await request.json())
    const endpoint = parsed.subscription.endpoint

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint,
        subscription: parsed.subscription,
        user_agent: request.headers.get('user-agent'),
        is_active: true,
      }, { onConflict: 'endpoint' })

    if (error) {
      console.error('Failed to persist push subscription:', error)
      return errorResponse('Failed to save push subscription', 500)
    }

    return successResponse({ endpoint, active: true })
  } catch (error) {
    if (error instanceof ZodError) return toValidationError(error)
    console.error('Push subscription POST failed:', error)
    return errorResponse('Internal server error', 500)
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Unauthorized', 401)

  try {
    const rawBody = await request.text()
    let payload: unknown = {}
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody)
      } catch {
        return errorResponse('Invalid request', 400)
      }
    }
    const parsed = deleteBodySchema.parse(payload)

    let query = supabase
      .from('push_subscriptions')
      .update({ is_active: false, last_error: null })
      .eq('user_id', user.id)

    if (parsed.endpoint) {
      query = query.eq('endpoint', parsed.endpoint)
    }

    const { error } = await query

    if (error) {
      console.error('Failed to deactivate push subscription(s):', error)
      return errorResponse('Failed to remove push subscription', 500)
    }

    return successResponse({ active: false })
  } catch (error) {
    if (error instanceof ZodError) return toValidationError(error)
    console.error('Push subscription DELETE failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
