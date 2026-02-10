import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import {
  deletePushSubscriptionSchema,
  pushSubscriptionSchema,
} from '@/lib/validation/journal-api'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    const userId = auth?.user.id ?? null

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized - please log in' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint,is_active,updated_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const active = Array.isArray(data) && data.length > 0 ? data[0] : null
    return NextResponse.json({
      success: true,
      data: {
        subscribed: Boolean(active),
        endpoint: active?.endpoint ?? null,
        updated_at: active?.updated_at ?? null,
      },
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    const userId = auth?.user.id ?? null

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized - please log in' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = pushSubscriptionSchema.parse(body)
    const { subscription } = parsed

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        subscription,
        user_agent: request.headers.get('user-agent'),
        is_active: true,
        last_error: null,
      }, { onConflict: 'endpoint' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        subscribed: true,
        endpoint: subscription.endpoint,
      },
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        error: 'Invalid push subscription payload',
        details: error.issues,
      }, { status: 400 })
    }

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    const userId = auth?.user.id ?? null

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized - please log in' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = deletePushSubscriptionSchema.parse(body)

    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)

    if (parsed.endpoint) {
      query = query.eq('endpoint', parsed.endpoint)
    }

    const { error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        error: 'Invalid push unsubscribe payload',
        details: error.issues,
      }, { status: 400 })
    }

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}
