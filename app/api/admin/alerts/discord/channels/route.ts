import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'
import { fetchDiscordChannels, getLatestDiscordConfigRow } from '@/app/api/admin/alerts/discord/_shared'

export async function GET(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const config = await getLatestDiscordConfigRow()
    if (!config?.bot_token) {
      return NextResponse.json(
        { error: 'Discord bot token is not configured' },
        { status: 400 },
      )
    }

    const { searchParams } = new URL(request.url)
    const guildId = (searchParams.get('guildId') || '').trim()
    if (!guildId) {
      return NextResponse.json(
        { error: 'guildId query param is required' },
        { status: 400 },
      )
    }

    const channels = await fetchDiscordChannels(config.bot_token, guildId)
    return NextResponse.json({
      success: true,
      channels,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Discord channels' },
      { status: 502 },
    )
  }
}
