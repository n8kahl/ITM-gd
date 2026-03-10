import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerUser, isAdminUser } from '@/lib/supabase-server'
import {
  getLatestDiscordConfigRow,
  toDiscordConfigResponse,
  upsertDiscordConfigRow,
  validateDiscordBotToken,
  sanitizeGuildIds,
  updateDiscordConnectionStatus,
} from '@/app/api/admin/alerts/discord/_shared'

const updateSchema = z.object({
  botToken: z.string().trim().optional(),
  clearBotToken: z.boolean().optional(),
  botEnabled: z.boolean().optional(),
  guildIds: z.array(z.string()).optional(),
  alertChannelId: z.string().trim().nullable().optional(),
  alertChannelName: z.string().trim().nullable().optional(),
  deliveryMethod: z.enum(['bot', 'webhook']).optional(),
  webhookUrl: z.string().url().nullable().optional(),
})

export async function GET() {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const row = await getLatestDiscordConfigRow()
    return NextResponse.json({
      success: true,
      config: toDiscordConfigResponse(row),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Discord config' },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request payload' },
        { status: 400 },
      )
    }

    const user = await getServerUser()
    const existing = await getLatestDiscordConfigRow()
    const payload = parsed.data

    const nextToken = payload.clearBotToken
      ? null
      : payload.botToken !== undefined
        ? (payload.botToken || null)
        : existing?.bot_token ?? null
    const nextBotEnabled = payload.botEnabled ?? existing?.bot_enabled ?? false
    const nextGuildIds = payload.guildIds
      ? sanitizeGuildIds(payload.guildIds)
      : Array.isArray(existing?.guild_ids)
        ? existing.guild_ids
        : []
    const nextAlertChannelId =
      payload.alertChannelId !== undefined
        ? (payload.alertChannelId || null)
        : existing?.alert_channel_id ?? null
    const nextAlertChannelName =
      payload.alertChannelName !== undefined
        ? (payload.alertChannelName || null)
        : existing?.alert_channel_name ?? null
    const nextDeliveryMethod = payload.deliveryMethod ?? existing?.delivery_method ?? 'bot'
    const nextWebhookUrl =
      payload.webhookUrl !== undefined
        ? (payload.webhookUrl || null)
        : existing?.webhook_url ?? null

    if (nextBotEnabled && (!nextToken || nextGuildIds.length === 0 || !nextAlertChannelId)) {
      return NextResponse.json(
        { error: 'botEnabled requires botToken, at least one guildId, and alertChannelId' },
        { status: 400 },
      )
    }

    const saved = await upsertDiscordConfigRow({
      existingId: existing?.id ?? null,
      patch: {
        bot_token: nextToken,
        bot_enabled: nextBotEnabled,
        guild_ids: nextGuildIds,
        alert_channel_id: nextAlertChannelId,
        alert_channel_name: nextAlertChannelName,
        delivery_method: nextDeliveryMethod,
        webhook_url: nextWebhookUrl,
        configured_by: user?.id ?? existing?.configured_by ?? null,
      },
    })

    let finalRow = saved
    if (saved.bot_enabled && saved.bot_token) {
      try {
        await validateDiscordBotToken(saved.bot_token)
        finalRow = await updateDiscordConnectionStatus({
          id: saved.id,
          status: 'connected',
          connectedAt: new Date().toISOString(),
          errorMessage: null,
        })
      } catch (error) {
        finalRow = await updateDiscordConnectionStatus({
          id: saved.id,
          status: 'error',
          connectedAt: null,
          errorMessage: error instanceof Error ? error.message : 'Failed to validate Discord bot token',
        })
      }
    } else if (!saved.bot_enabled) {
      finalRow = await updateDiscordConnectionStatus({
        id: saved.id,
        status: 'disconnected',
        connectedAt: null,
        errorMessage: null,
      })
    }

    return NextResponse.json({
      success: true,
      config: toDiscordConfigResponse(finalRow),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update Discord config' },
      { status: 500 },
    )
  }
}
