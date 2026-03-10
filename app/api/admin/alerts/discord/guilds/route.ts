import { NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'
import { fetchDiscordGuilds, getLatestDiscordConfigRow } from '@/app/api/admin/alerts/discord/_shared'

export async function GET() {
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

    const guilds = await fetchDiscordGuilds(config.bot_token)
    return NextResponse.json({
      success: true,
      guilds,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Discord guilds' },
      { status: 502 },
    )
  }
}
