import { createClient } from '@supabase/supabase-js'

export type DiscordDeliveryMethod = 'bot' | 'webhook'
export type DiscordConnectionStatus = 'connected' | 'disconnected' | 'error' | 'reconnecting'

const DISCORD_API_BASE = 'https://discord.com/api/v10'
const DISCORD_TEXT_CHANNEL_TYPES = new Set([0, 5])

export interface DiscordConfigRow {
  id: string
  bot_token: string | null
  bot_enabled: boolean
  guild_ids: string[] | null
  alert_channel_id: string | null
  alert_channel_name: string | null
  delivery_method: DiscordDeliveryMethod
  webhook_url: string | null
  connection_status: DiscordConnectionStatus
  last_connected_at: string | null
  last_error: string | null
  configured_by: string | null
  created_at: string
  updated_at: string
}

export interface DiscordConfigResponse {
  id: string | null
  botTokenSet: boolean
  botEnabled: boolean
  guildIds: string[]
  alertChannelId: string | null
  alertChannelName: string | null
  deliveryMethod: DiscordDeliveryMethod
  webhookUrl: string | null
  connectionStatus: DiscordConnectionStatus
  lastConnectedAt: string | null
  lastError: string | null
  configuredBy: string | null
  updatedAt: string | null
}

export interface DiscordGuild {
  id: string
  name: string
}

export interface DiscordChannel {
  id: string
  name: string
  type: number
  position: number
}

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key)
}

export function sanitizeGuildIds(input: unknown): string[] {
  if (!Array.isArray(input)) return []

  return Array.from(
    new Set(
      input
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0),
    ),
  )
}

function toNullOrString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function toDiscordConfigResponse(row: DiscordConfigRow | null): DiscordConfigResponse {
  if (!row) {
    return {
      id: null,
      botTokenSet: false,
      botEnabled: false,
      guildIds: [],
      alertChannelId: null,
      alertChannelName: null,
      deliveryMethod: 'bot',
      webhookUrl: null,
      connectionStatus: 'disconnected',
      lastConnectedAt: null,
      lastError: null,
      configuredBy: null,
      updatedAt: null,
    }
  }

  return {
    id: row.id,
    botTokenSet: Boolean(toNullOrString(row.bot_token)),
    botEnabled: row.bot_enabled === true,
    guildIds: Array.isArray(row.guild_ids) ? row.guild_ids : [],
    alertChannelId: row.alert_channel_id,
    alertChannelName: row.alert_channel_name,
    deliveryMethod: row.delivery_method === 'webhook' ? 'webhook' : 'bot',
    webhookUrl: row.webhook_url,
    connectionStatus:
      row.connection_status === 'connected' ||
      row.connection_status === 'reconnecting' ||
      row.connection_status === 'error'
        ? row.connection_status
        : 'disconnected',
    lastConnectedAt: row.last_connected_at,
    lastError: row.last_error,
    configuredBy: row.configured_by,
    updatedAt: row.updated_at,
  }
}

export async function getLatestDiscordConfigRow(): Promise<DiscordConfigRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('discord_config')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as DiscordConfigRow | null) ?? null
}

export async function upsertDiscordConfigRow(input: {
  existingId: string | null
  patch: Partial<DiscordConfigRow>
}): Promise<DiscordConfigRow> {
  const supabase = getSupabaseAdmin()
  const nowIso = new Date().toISOString()

  if (input.existingId) {
    const { data, error } = await supabase
      .from('discord_config')
      .update({
        ...input.patch,
        updated_at: nowIso,
      })
      .eq('id', input.existingId)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return data as DiscordConfigRow
  }

  const { data, error } = await supabase
    .from('discord_config')
    .insert({
      bot_enabled: false,
      delivery_method: 'bot',
      connection_status: 'disconnected',
      ...input.patch,
      updated_at: nowIso,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as DiscordConfigRow
}

export async function updateDiscordConnectionStatus(input: {
  id: string
  status: DiscordConnectionStatus
  errorMessage?: string | null
  connectedAt?: string | null
}): Promise<DiscordConfigRow> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('discord_config')
    .update({
      connection_status: input.status,
      last_error: input.errorMessage ?? null,
      last_connected_at: input.connectedAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as DiscordConfigRow
}

async function discordRequest<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Discord API ${response.status}: ${text || response.statusText}`)
  }

  return (text ? JSON.parse(text) : {}) as T
}

export async function validateDiscordBotToken(token: string): Promise<void> {
  await discordRequest<{ id: string; username: string }>(token, '/users/@me')
}

export async function fetchDiscordGuilds(token: string): Promise<DiscordGuild[]> {
  const guilds = await discordRequest<Array<{ id: string; name: string }>>(token, '/users/@me/guilds')

  return guilds
    .map((guild) => ({ id: String(guild.id), name: String(guild.name) }))
    .filter((guild) => guild.id.length > 0 && guild.name.length > 0)
}

export async function fetchDiscordChannels(token: string, guildId: string): Promise<DiscordChannel[]> {
  const channels = await discordRequest<Array<{ id: string; name: string; type: number; position?: number }>>(
    token,
    `/guilds/${guildId}/channels`,
  )

  return channels
    .map((channel) => ({
      id: String(channel.id),
      name: String(channel.name || ''),
      type: Number(channel.type),
      position: Number(channel.position ?? 0),
    }))
    .filter((channel) => channel.id.length > 0 && DISCORD_TEXT_CHANNEL_TYPES.has(channel.type))
    .sort((a, b) => a.position - b.position)
}

export async function sendDiscordBotMessage(input: {
  token: string
  channelId: string
  content: string
}): Promise<{ messageId: string }> {
  const payload = await discordRequest<{ id: string }>(input.token, `/channels/${input.channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content: input.content,
    }),
  })

  return { messageId: payload.id }
}

export async function sendDiscordWebhookMessage(input: {
  webhookUrl: string
  content: string
}): Promise<{ messageId: string | null }> {
  const webhookUrl = input.webhookUrl.trim()
  if (!webhookUrl) {
    throw new Error('Discord webhook URL is required')
  }

  const separator = webhookUrl.includes('?') ? '&' : '?'
  const response = await fetch(`${webhookUrl}${separator}wait=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: input.content,
    }),
    cache: 'no-store',
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Discord webhook ${response.status}: ${text || response.statusText}`)
  }

  try {
    const payload = text ? (JSON.parse(text) as { id?: string }) : {}
    return { messageId: typeof payload.id === 'string' ? payload.id : null }
  } catch {
    return { messageId: null }
  }
}
