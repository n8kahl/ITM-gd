import { NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'
import {
  getLatestDiscordConfigRow,
  toDiscordConfigResponse,
  updateDiscordConnectionStatus,
  validateDiscordBotToken,
} from '@/app/api/admin/alerts/discord/_shared'

export async function POST() {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const config = await getLatestDiscordConfigRow()
    if (!config?.id || !config.bot_token) {
      return NextResponse.json(
        { error: 'Discord bot token is not configured' },
        { status: 400 },
      )
    }

    await updateDiscordConnectionStatus({
      id: config.id,
      status: 'reconnecting',
      connectedAt: config.last_connected_at,
      errorMessage: null,
    })

    try {
      await validateDiscordBotToken(config.bot_token)
      const connected = await updateDiscordConnectionStatus({
        id: config.id,
        status: 'connected',
        connectedAt: new Date().toISOString(),
        errorMessage: null,
      })

      return NextResponse.json({
        success: true,
        config: toDiscordConfigResponse(connected),
      })
    } catch (error) {
      const errored = await updateDiscordConnectionStatus({
        id: config.id,
        status: 'error',
        connectedAt: null,
        errorMessage: error instanceof Error ? error.message : 'Discord reconnect failed',
      })

      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Discord reconnect failed',
          config: toDiscordConfigResponse(errored),
        },
        { status: 502 },
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to restart Discord connection' },
      { status: 500 },
    )
  }
}
