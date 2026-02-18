import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'
import { logAdminActivity } from '@/lib/admin/audit-log'
import {
  resolveTargetSubscriptions,
  sendBatchNotifications,
} from '@/lib/web-push-service'
import type {
  NotificationPayload,
  SendNotificationRequest,
} from '@/lib/types/notifications'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

// ---------------------------------------------------------------------------
// GET — List broadcast history
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = Math.min(Number(searchParams.get('limit') || 20), 100)
    const offset = Number(searchParams.get('offset') || 0)

    let query = supabase
      .from('notification_broadcasts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data ?? [], total: count ?? 0 })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// POST — Create and optionally send a notification broadcast
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: SendNotificationRequest = await request.json()

    // Validation
    if (!body.title?.trim()) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })
    }
    if (!body.body?.trim()) {
      return NextResponse.json({ success: false, error: 'Body is required' }, { status: 400 })
    }
    if (!['all', 'tier', 'individual'].includes(body.targetType)) {
      return NextResponse.json({ success: false, error: 'Invalid target type' }, { status: 400 })
    }
    if (body.targetType === 'tier' && (!body.targetTiers || body.targetTiers.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'At least one tier must be selected' },
        { status: 400 },
      )
    }
    if (body.targetType === 'individual' && (!body.targetUserIds || body.targetUserIds.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'At least one user must be selected' },
        { status: 400 },
      )
    }

    const supabase = getSupabaseAdmin()

    // Determine if scheduled for later
    const isScheduled = body.scheduleAt && new Date(body.scheduleAt) > new Date()

    // Get admin user ID for created_by
    const { createServerSupabaseClient } = await import('@/lib/supabase-server')
    const serverSupabase = await createServerSupabaseClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    const createdBy = user?.id ?? 'unknown-admin'

    // Insert broadcast record
    const { data: broadcast, error: insertError } = await supabase
      .from('notification_broadcasts')
      .insert({
        title: body.title.trim(),
        body: body.body.trim(),
        url: body.url?.trim() || '/members',
        tag: body.tag?.trim() || null,
        require_interaction: body.requireInteraction ?? false,
        target_type: body.targetType,
        target_tiers: body.targetTiers ?? null,
        target_user_ids: body.targetUserIds ?? null,
        status: isScheduled ? 'scheduled' : 'sending',
        scheduled_at: isScheduled ? body.scheduleAt : null,
        created_by: createdBy,
      })
      .select()
      .single()

    if (insertError || !broadcast) {
      return NextResponse.json(
        { success: false, error: insertError?.message ?? 'Failed to create broadcast' },
        { status: 500 },
      )
    }

    // If scheduled for later, just return the record
    if (isScheduled) {
      await logAdminActivity({
        action: 'notification_broadcast',
        targetType: 'notification_broadcast',
        targetId: broadcast.id,
        details: {
          status: 'scheduled',
          target_type: body.targetType,
          scheduled_at: body.scheduleAt,
        },
      })
      return NextResponse.json({ success: true, data: broadcast })
    }

    // --- Send immediately ---
    const subscriptions = await resolveTargetSubscriptions(
      body.targetType,
      body.targetTiers,
      body.targetUserIds,
    )

    // Update total_targeted count
    await supabase
      .from('notification_broadcasts')
      .update({ total_targeted: subscriptions.length })
      .eq('id', broadcast.id)

    if (subscriptions.length === 0) {
      await supabase
        .from('notification_broadcasts')
        .update({ status: 'sent', sent_at: new Date().toISOString(), total_targeted: 0 })
        .eq('id', broadcast.id)

      await logAdminActivity({
        action: 'notification_broadcast',
        targetType: 'notification_broadcast',
        targetId: broadcast.id,
        details: {
          status: 'sent',
          targeted: 0,
          delivered: 0,
          failed: 0,
        },
      })

      return NextResponse.json({
        success: true,
        data: { ...broadcast, status: 'sent', total_targeted: 0 },
        stats: { targeted: 0, delivered: 0, failed: 0 },
      })
    }

    const payload: NotificationPayload = {
      title: broadcast.title,
      body: broadcast.body,
      url: broadcast.url ?? '/members',
      tag: broadcast.tag ?? undefined,
      icon: '/hero-logo.png',
      badge: '/favicon.png',
      requireInteraction: broadcast.require_interaction,
    }

    const stats = await sendBatchNotifications(subscriptions, payload)

    // Update broadcast with delivery results
    const finalStatus = stats.delivered > 0 ? 'sent' : 'failed'
    const { data: updatedBroadcast } = await supabase
      .from('notification_broadcasts')
      .update({
        status: finalStatus,
        sent_at: new Date().toISOString(),
        delivered_count: stats.delivered,
        failed_count: stats.failed,
        total_targeted: stats.targeted,
      })
      .eq('id', broadcast.id)
      .select()
      .single()

    await logAdminActivity({
      action: 'notification_broadcast',
      targetType: 'notification_broadcast',
      targetId: broadcast.id,
      details: {
        status: finalStatus,
        targeted: stats.targeted,
        delivered: stats.delivered,
        failed: stats.failed,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedBroadcast ?? broadcast,
      stats,
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
