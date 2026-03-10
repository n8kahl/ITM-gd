import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerUser, isAdminUser } from '@/lib/supabase-server'
import {
  buildAlertMessage,
  ensureSignalAllowedInState,
  persistAndBroadcastAdminSignal,
  resolveSessionTradeState,
  resolveTradeStateForTrade,
  sendDiscordAlertWithFallback,
  startOrResumeTodaySession,
  toEasternDateString,
  getSessionById,
  type BuildAlertMessageResult,
} from '@/app/api/admin/alerts/_console'
import { getLatestDiscordConfigRow } from '@/app/api/admin/alerts/discord/_shared'
import type { ParsedDiscordSignal } from '@/backend/src/services/discord/messageParser'

const alertSendSchema = z.object({
  sessionId: z.string().uuid().optional(),
  tradeId: z.string().uuid().optional(),
  signalType: z.enum([
    'prep',
    'ptf',
    'filled_avg',
    'update',
    'trim',
    'add',
    'stops',
    'breakeven',
    'trail',
    'exit_above',
    'exit_below',
    'fully_out',
    'commentary',
    'session_recap',
  ]),
  fields: z.object({
    symbol: z.string().trim().optional(),
    strike: z.number().optional(),
    optionType: z.enum(['call', 'put']).optional(),
    expiration: z.string().trim().optional(),
    price: z.number().optional(),
    percent: z.number().optional(),
    level: z.number().optional(),
    sizeTag: z.enum(['full', 'light', 'lotto']).optional(),
    commentary: z.string().trim().optional(),
  }).default({}),
  mentionEveryone: z.boolean().default(true),
})

function toNullableTrimmed(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function createParsedSignal(input: {
  messageId: string
  guildId: string
  channelId: string
  authorId: string
  builtMessage: BuildAlertMessageResult
  createdAt: string
}): ParsedDiscordSignal {
  return {
    messageId: input.messageId,
    guildId: input.guildId,
    channelId: input.channelId,
    authorId: input.authorId,
    authorIsBot: false,
    content: input.builtMessage.content,
    createdAt: input.createdAt,
    editedAt: null,
    signalType: input.builtMessage.signalType,
    fields: input.builtMessage.fields,
  }
}

export async function POST(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await request.json().catch(() => ({}))
    const parsed = alertSendSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request payload' },
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

    const user = await getServerUser()
    const actorId = user?.id ?? 'admin_console'

    const activeSession = parsed.data.sessionId
      ? await getSessionById(parsed.data.sessionId)
      : await startOrResumeTodaySession({
          channelId,
          channelName: toNullableTrimmed(config.alert_channel_name),
          guildId,
          callerName: actorId,
        })

    if (!activeSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 },
      )
    }

    const todayEt = toEasternDateString()
    if (activeSession.channel_id !== channelId || activeSession.session_date !== todayEt) {
      return NextResponse.json(
        { error: "Session does not match today's configured alert channel" },
        { status: 409 },
      )
    }

    const targetTradeId = parsed.data.signalType === 'prep' ? null : parsed.data.tradeId
    const currentState = await resolveTradeStateForTrade({
      sessionId: activeSession.id,
      tradeId: targetTradeId,
    })
    ensureSignalAllowedInState(currentState, parsed.data.signalType)

    const builtMessage = buildAlertMessage({
      signalType: parsed.data.signalType,
      fields: parsed.data.fields,
      mentionEveryone: parsed.data.mentionEveryone,
    })

    const adminAlertId = randomUUID()
    const createdAt = new Date().toISOString()

    let deliveryResult
    try {
      deliveryResult = await sendDiscordAlertWithFallback({
        config,
        content: builtMessage.content,
      })
    } catch (deliveryError) {
      const failedSignal = createParsedSignal({
        messageId: `failed_${randomUUID()}`,
        guildId,
        channelId,
        authorId: actorId,
        builtMessage,
        createdAt,
      })

      const persistence = await persistAndBroadcastAdminSignal({
        signal: failedSignal,
        adminAlertId,
        webhookStatus: 'failed',
        targetTradeId,
      })

      return NextResponse.json(
        {
          error: deliveryError instanceof Error ? deliveryError.message : 'Discord delivery failed',
          sessionId: activeSession.id,
          tradeState: currentState,
          alert: {
            signalType: parsed.data.signalType,
            content: builtMessage.content,
          },
          persistence,
        },
        { status: 502 },
      )
    }

    const signal = createParsedSignal({
      messageId: deliveryResult.messageId,
      guildId,
      channelId,
      authorId: actorId,
      builtMessage,
      createdAt,
    })

    const persistence = await persistAndBroadcastAdminSignal({
      signal,
      adminAlertId,
      webhookStatus: deliveryResult.webhookStatus,
      targetTradeId,
    })

    const [nextSessionState, nextTradeState] = await Promise.all([
      resolveSessionTradeState(activeSession.id),
      resolveTradeStateForTrade({
        sessionId: activeSession.id,
        tradeId: targetTradeId,
      }),
    ])

    return NextResponse.json({
      success: true,
      sessionId: activeSession.id,
      tradeState: nextSessionState,
      targetTradeState: nextTradeState,
      tradeId: targetTradeId,
      alert: {
        signalType: parsed.data.signalType,
        content: builtMessage.content,
        messageId: deliveryResult.messageId,
      },
      delivery: {
        method: deliveryResult.deliveryMethod,
        fallbackUsed: deliveryResult.fallbackUsed,
        webhookStatus: deliveryResult.webhookStatus,
      },
      persistence,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send admin alert' },
      { status: 500 },
    )
  }
}
