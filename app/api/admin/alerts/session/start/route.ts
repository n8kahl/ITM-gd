import { NextResponse } from 'next/server'
import { getServerUser, isAdminUser } from '@/lib/supabase-server'
import {
  resolveSessionTradeState,
  startOrResumeTodaySession,
} from '@/app/api/admin/alerts/_console'
import { getLatestDiscordConfigRow } from '@/app/api/admin/alerts/discord/_shared'

function toNullableTrimmed(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST() {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const config = await getLatestDiscordConfigRow()
    if (!config) {
      return NextResponse.json(
        { error: 'Discord configuration is not set up. Configure Discord first.' },
        { status: 400 },
      )
    }

    const channelId = toNullableTrimmed(config.alert_channel_id)
    const guildId = Array.isArray(config.guild_ids) ? toNullableTrimmed(config.guild_ids[0]) : null
    if (!channelId || !guildId) {
      return NextResponse.json(
        { error: 'Discord guild/channel is not configured' },
        { status: 400 },
      )
    }

    const user = await getServerUser()
    const session = await startOrResumeTodaySession({
      channelId,
      channelName: toNullableTrimmed(config.alert_channel_name),
      guildId,
      callerName: user?.id ?? 'admin_console',
    })
    const tradeState = await resolveSessionTradeState(session.id)

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        date: session.session_date,
        channelId: session.channel_id,
        sessionEnd: session.session_end,
        tradeCount: session.trade_count ?? 0,
        netPnlPct: session.net_pnl_pct,
      },
      tradeState,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start alert session' },
      { status: 500 },
    )
  }
}

