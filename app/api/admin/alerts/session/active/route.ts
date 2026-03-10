import { NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'
import {
  buildSessionRecapMessage,
  getSessionMessages,
  getSessionTrades,
  getTodaySessionForChannel,
  resolveTradeStateFromRow,
  resolveSessionTradeState,
} from '@/app/api/admin/alerts/_console'
import { getLatestDiscordConfigRow } from '@/app/api/admin/alerts/discord/_shared'

function toNullableTrimmed(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function GET() {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const config = await getLatestDiscordConfigRow()
    const channelId = config ? toNullableTrimmed(config.alert_channel_id) : null
    if (!channelId) {
      return NextResponse.json({
        success: true,
        session: null,
        tradeState: 'IDLE',
        trades: [],
        messages: [],
        recap: { generatedSummary: '' },
      })
    }

    const session = await getTodaySessionForChannel(channelId)
    if (!session) {
      return NextResponse.json({
        success: true,
        session: null,
        tradeState: 'IDLE',
        trades: [],
        messages: [],
        recap: { generatedSummary: '' },
      })
    }

    const [tradeState, trades, messages] = await Promise.all([
      resolveSessionTradeState(session.id),
      getSessionTrades(session.id),
      getSessionMessages({ sessionId: session.id, limit: 150 }),
    ])

    const generatedRecap = buildSessionRecapMessage(trades)

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        date: session.session_date,
        channelId: session.channel_id,
        sessionEnd: session.session_end,
        summary: session.session_summary,
        tradeCount: session.trade_count ?? trades.length,
        netPnlPct: session.net_pnl_pct,
      },
      tradeState,
      trades: trades.map((trade) => ({
        id: trade.id,
        tradeIndex: trade.trade_index,
        symbol: trade.symbol,
        strike: trade.strike,
        contractType: trade.contract_type,
        expiration: trade.expiry,
        entryPrice: trade.entry_price,
        entryTimestamp: trade.entry_timestamp,
        finalPnlPct: trade.final_pnl_pct,
        fullyExited: trade.fully_exited,
        state: resolveTradeStateFromRow({
          entry_timestamp: trade.entry_timestamp,
          fully_exited: trade.fully_exited,
        }),
      })),
      messages: messages.map((message) => ({
        id: message.id,
        messageId: message.discord_msg_id,
        content: message.content,
        sentAt: message.sent_at,
        signalType: message.signal_type,
        webhookStatus: message.webhook_status,
        source: message.source,
        parsedTradeId: message.parsed_trade_id,
      })),
      recap: {
        generatedSummary: generatedRecap,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load active alert session' },
      { status: 500 },
    )
  }
}
