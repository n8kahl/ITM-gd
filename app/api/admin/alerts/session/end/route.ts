import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminUser } from '@/lib/supabase-server'
import {
  buildAlertMessage,
  buildSessionRecapMessage,
  getSessionById,
  getSessionTrades,
  getTodaySessionForChannel,
  markSessionEnded,
  persistAndBroadcastAdminSignal,
  resolveSessionTradeState,
  sendDiscordAlertWithFallback,
  toEasternDateString,
} from '@/app/api/admin/alerts/_console'
import { getLatestDiscordConfigRow } from '@/app/api/admin/alerts/discord/_shared'

const endSessionSchema = z.object({
  sessionId: z.string().uuid().optional(),
  summary: z.string().trim().min(1).optional(),
  preview: z.boolean().default(false),
  mentionEveryone: z.boolean().default(true),
})

function toNullableTrimmed(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const parsedBody = endSessionSchema.safeParse(body)
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? 'Invalid request payload' },
        { status: 400 },
      )
    }

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

    const session = parsedBody.data.sessionId
      ? await getSessionById(parsedBody.data.sessionId)
      : await getTodaySessionForChannel(channelId)
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 },
      )
    }

    const todayEt = toEasternDateString()
    if (session.channel_id !== channelId || session.session_date !== todayEt) {
      return NextResponse.json(
        { error: "Session does not match today's configured alert channel" },
        { status: 409 },
      )
    }

    const tradeState = await resolveSessionTradeState(session.id)
    if (tradeState === 'ACTIVE' || tradeState === 'STAGED') {
      return NextResponse.json(
        { error: `Session cannot end while trade state is ${tradeState}. Close active trade first.` },
        { status: 409 },
      )
    }

    const trades = await getSessionTrades(session.id)
    const generatedSummary = parsedBody.data.summary ?? buildSessionRecapMessage(trades)

    if (parsedBody.data.preview) {
      return NextResponse.json({
        success: true,
        preview: true,
        sessionId: session.id,
        recap: {
          content: generatedSummary,
          closedTradeCount: trades.filter((trade) => trade.fully_exited).length,
        },
      })
    }

    const recapMessage = buildAlertMessage({
      signalType: 'session_recap',
      fields: {
        commentary: generatedSummary,
      },
      mentionEveryone: parsedBody.data.mentionEveryone,
    })

    const delivery = await sendDiscordAlertWithFallback({
      config,
      content: recapMessage.content,
    })

    const signalCreatedAt = new Date().toISOString()
    const persistence = await persistAndBroadcastAdminSignal({
      signal: {
        messageId: delivery.messageId,
        guildId,
        channelId,
        authorId: 'admin_console',
        authorIsBot: false,
        content: recapMessage.content,
        createdAt: signalCreatedAt,
        editedAt: null,
        signalType: recapMessage.signalType,
        fields: recapMessage.fields,
      },
      adminAlertId: randomUUID(),
      webhookStatus: delivery.webhookStatus,
    })

    const ended = await markSessionEnded({
      sessionId: session.id,
      summary: recapMessage.content,
    })

    return NextResponse.json({
      success: true,
      session: {
        id: ended.id,
        date: ended.session_date,
        channelId: ended.channel_id,
        sessionEnd: ended.session_end,
        summary: ended.session_summary,
        tradeCount: ended.trade_count,
        netPnlPct: ended.net_pnl_pct,
      },
      recap: {
        content: recapMessage.content,
        messageId: delivery.messageId,
      },
      delivery: {
        method: delivery.deliveryMethod,
        fallbackUsed: delivery.fallbackUsed,
        webhookStatus: delivery.webhookStatus,
      },
      persistence,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to end alert session' },
      { status: 500 },
    )
  }
}
