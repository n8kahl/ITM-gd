import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminUser } from '@/lib/supabase-server'
import {
  getLatestDiscordConfigRow,
  sendDiscordBotMessage,
  toDiscordConfigResponse,
  updateDiscordConnectionStatus,
} from '@/app/api/admin/alerts/discord/_shared'

const testSchema = z.object({
  channelId: z.string().trim().optional(),
  content: z.string().trim().optional(),
})

const DEFAULT_TEST_MESSAGE = '✅ TradeITM Alert Console connected.'

export async function POST(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const parsed = testSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request payload' },
        { status: 400 },
      )
    }

    const config = await getLatestDiscordConfigRow()
    if (!config?.id || !config.bot_token) {
      return NextResponse.json(
        { error: 'Discord bot token is not configured' },
        { status: 400 },
      )
    }

    const channelId = parsed.data.channelId || config.alert_channel_id
    if (!channelId) {
      return NextResponse.json(
        { error: 'No alert channel is configured' },
        { status: 400 },
      )
    }

    const testContent = parsed.data.content || DEFAULT_TEST_MESSAGE

    try {
      const result = await sendDiscordBotMessage({
        token: config.bot_token,
        channelId,
        content: testContent,
      })

      const updated = await updateDiscordConnectionStatus({
        id: config.id,
        status: 'connected',
        connectedAt: new Date().toISOString(),
        errorMessage: null,
      })

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        config: toDiscordConfigResponse(updated),
      })
    } catch (error) {
      const updated = await updateDiscordConnectionStatus({
        id: config.id,
        status: 'error',
        connectedAt: null,
        errorMessage: error instanceof Error ? error.message : 'Discord send failed',
      })

      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Discord send failed',
          config: toDiscordConfigResponse(updated),
        },
        { status: 502 },
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send test message' },
      { status: 500 },
    )
  }
}
