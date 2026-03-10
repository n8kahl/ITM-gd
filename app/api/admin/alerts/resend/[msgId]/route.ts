import { NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'
import { getLatestDiscordConfigRow, getSupabaseAdmin } from '@/app/api/admin/alerts/discord/_shared'
import { sendDiscordAlertWithFallback } from '@/app/api/admin/alerts/_console'

interface DiscordMessageForRetry {
  id: string
  discord_msg_id: string
  content: string
  source: string | null
  webhook_status: string | null
}

function toNullableTrimmed(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(_request: Request, ctx: { params: Promise<{ msgId: string }> }) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { msgId } = await ctx.params
    const normalizedMessageId = toNullableTrimmed(msgId)
    if (!normalizedMessageId) {
      return NextResponse.json({ error: 'Message id is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('discord_messages')
      .select('id,discord_msg_id,content,source,webhook_status')
      .eq('discord_msg_id', normalizedMessageId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const message = (data as DiscordMessageForRetry | null)
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    if (message.source !== 'admin_console') {
      return NextResponse.json({ error: 'Only admin console messages can be retried' }, { status: 400 })
    }
    if (message.webhook_status !== 'failed') {
      return NextResponse.json({ error: 'Message is not marked as failed' }, { status: 409 })
    }

    const config = await getLatestDiscordConfigRow()
    if (!config) {
      return NextResponse.json(
        { error: 'Discord configuration is not set up. Configure Discord first.' },
        { status: 400 },
      )
    }

    const delivery = await sendDiscordAlertWithFallback({
      config,
      content: message.content,
    })

    const { error: updateError } = await supabase
      .from('discord_messages')
      .update({
        webhook_status: 'resent',
      })
      .eq('id', message.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      retried: {
        previousMessageId: message.discord_msg_id,
        deliveryMessageId: delivery.messageId,
        deliveryMethod: delivery.deliveryMethod,
        fallbackUsed: delivery.fallbackUsed,
        webhookStatus: 'resent',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resend Discord alert' },
      { status: 500 },
    )
  }
}
