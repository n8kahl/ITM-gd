import { randomUUID } from 'node:crypto'
import { canSendSignalInState, type AlertSendFields, type AlertSignalType, type AlertTradeState } from '@/lib/types/alerts'
import {
  getSupabaseAdmin,
  sendDiscordBotMessage,
  sendDiscordWebhookMessage,
  type DiscordConfigRow,
} from '@/app/api/admin/alerts/discord/_shared'
import type {
  DiscordSignalType,
  ParsedDiscordSignal,
  ParsedSignalFields,
} from '@/backend/src/services/discord/messageParser'

type DeliveryWebhookStatus = 'sent' | 'failed' | 'resent'

interface DiscordTradeSessionRow {
  id: string
  session_date: string
  channel_id: string
  session_end: string | null
  session_summary: string | null
  trade_count: number | null
  net_pnl_pct: number | null
}

interface DiscordParsedTradeRow {
  id: string
  trade_index: number
  symbol: string
  strike: number | null
  contract_type: string | null
  expiry: string | null
  entry_price: number | null
  entry_timestamp: string | null
  final_pnl_pct: number | null
  fully_exited: boolean
  lifecycle_events: unknown[] | null
}

export interface DiscordMessageRow {
  id: string
  discord_msg_id: string
  content: string
  sent_at: string
  signal_type: string | null
  webhook_status: DeliveryWebhookStatus | null
  source: string | null
  parsed_trade_id: string | null
}

export interface BuildAlertMessageResult {
  content: string
  signalType: DiscordSignalType
  fields: ParsedSignalFields
}

export interface AlertSendDeliveryResult {
  sent: boolean
  messageId: string
  webhookStatus: DeliveryWebhookStatus
  deliveryMethod: 'bot' | 'webhook'
  fallbackUsed: boolean
  errorMessage: string | null
}

function toNullableTrimmed(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function formatDecimal(value: number, maxFractionDigits = 2): string {
  const rounded = Number(value.toFixed(maxFractionDigits))
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(maxFractionDigits).replace(/\.?0+$/, '')
}

function formatPrice(value: number | null): string {
  if (value == null) return '0'
  return formatDecimal(value, 3)
}

function formatSignedPercent(value: number | null): string {
  const safe = value ?? 0
  const normalized = formatDecimal(Math.abs(safe), 2)
  if (safe < 0) return `-${normalized}%`
  return `+${normalized}%`
}

function formatUnsignedPercent(value: number | null): string {
  const safe = Math.abs(value ?? 0)
  return `${formatDecimal(safe, 2)}%`
}

function formatContractStrike(value: number | null): string {
  return formatDecimal(value ?? 0, 2)
}

function formatExpiration(value: string | null): string {
  if (!value) return ''
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!isoMatch) return value
  return `${isoMatch[2]}/${isoMatch[3]}`
}

function withMention(content: string, mentionEveryone: boolean): string {
  const trimmed = content.trim()
  if (!mentionEveryone) return trimmed
  if (trimmed.includes('@everyone')) return trimmed
  return `${trimmed} @everyone`
}

function mapAlertSignalToDiscordSignal(signalType: AlertSignalType): DiscordSignalType {
  if (signalType === 'session_recap') return 'commentary'
  return signalType
}

function validateRequiredFields(signalType: AlertSignalType, fields: AlertSendFields): string | null {
  const symbol = toNullableTrimmed(fields.symbol)
  const strike = toFiniteNumber(fields.strike)
  const optionType = fields.optionType
  const expiration = toNullableTrimmed(fields.expiration)
  const price = toFiniteNumber(fields.price)
  const percent = toFiniteNumber(fields.percent)
  const level = toFiniteNumber(fields.level)
  const commentary = toNullableTrimmed(fields.commentary)

  switch (signalType) {
    case 'prep':
      if (!symbol || strike == null || !optionType || !expiration) {
        return 'prep requires symbol, strike, optionType, and expiration'
      }
      return null
    case 'filled_avg':
      return price == null ? 'filled_avg requires price' : null
    case 'update':
      return percent == null ? 'update requires percent' : null
    case 'trim':
      return percent == null ? 'trim requires percent' : null
    case 'add':
      return price == null ? 'add requires price' : null
    case 'stops':
      return level == null && percent == null ? 'stops requires level or percent' : null
    case 'trail':
      return percent == null ? 'trail requires percent' : null
    case 'exit_above':
    case 'exit_below':
      return level == null ? `${signalType} requires level` : null
    case 'commentary':
    case 'session_recap':
      return commentary ? null : `${signalType} requires commentary text`
    default:
      return null
  }
}

export function buildAlertMessage(input: {
  signalType: AlertSignalType
  fields: AlertSendFields
  mentionEveryone: boolean
}): BuildAlertMessageResult {
  const { signalType, fields, mentionEveryone } = input
  const validationError = validateRequiredFields(signalType, fields)
  if (validationError) {
    throw new Error(validationError)
  }

  const symbol = toNullableTrimmed(fields.symbol)?.toUpperCase() ?? null
  const strike = toFiniteNumber(fields.strike)
  const optionType = fields.optionType ?? null
  const price = toFiniteNumber(fields.price)
  const percent = toFiniteNumber(fields.percent)
  const level = toFiniteNumber(fields.level)
  const commentary = toNullableTrimmed(fields.commentary)
  const expirationRaw = toNullableTrimmed(fields.expiration)
  const expiration = formatExpiration(expirationRaw)
  const sizeTag = (fields.sizeTag ?? 'full').toUpperCase()

  let content = ''
  switch (signalType) {
    case 'prep': {
      const contract = `${symbol} ${formatContractStrike(strike)}${optionType === 'put' ? 'P' : 'C'}`
      const prefix = `PREP ${contract} ${expiration}`.trim()
      content = withMention(`${prefix} ${sizeTag}`.trim(), mentionEveryone)
      break
    }
    case 'ptf':
      content = withMention('PTF', mentionEveryone)
      break
    case 'filled_avg': {
      const stopSuffix = level != null
        ? ` Stops ${formatPrice(level)}`
        : percent != null
          ? ` Stops (-${formatUnsignedPercent(percent)})`
          : ''
      content = withMention(`Filled AVG ${formatPrice(price)}${stopSuffix}`, mentionEveryone)
      break
    }
    case 'update':
      content = withMention(`${formatSignedPercent(percent)} here`, mentionEveryone)
      break
    case 'trim':
      content = withMention(`${formatSignedPercent(percent)} here trim`, mentionEveryone)
      break
    case 'add': {
      const lead = symbol ? `Added to ${symbol}, new AVG ${formatPrice(price)}` : `Added, new AVG ${formatPrice(price)}`
      content = withMention(lead, mentionEveryone)
      break
    }
    case 'stops': {
      if (level != null && percent != null) {
        content = withMention(
          `Stops ${formatPrice(level)} or (-${formatUnsignedPercent(percent)})`,
          mentionEveryone,
        )
      } else if (level != null) {
        content = withMention(`Stops ${formatPrice(level)}`, mentionEveryone)
      } else {
        content = withMention(`Stops (-${formatUnsignedPercent(percent)})`, mentionEveryone)
      }
      break
    }
    case 'breakeven':
      content = withMention('B/E stops', mentionEveryone)
      break
    case 'trail':
      content = withMention(`Move trails on runners to +${formatUnsignedPercent(percent)}`, mentionEveryone)
      break
    case 'exit_above':
      content = withMention(`Use above ${formatPrice(level)} as exits`, mentionEveryone)
      break
    case 'exit_below':
      content = withMention(`Use below ${formatPrice(level)} as exits`, mentionEveryone)
      break
    case 'fully_out':
      content = withMention('Fully out', mentionEveryone)
      break
    case 'commentary':
    case 'session_recap':
      content = withMention(commentary ?? '', mentionEveryone)
      break
    default:
      content = withMention(commentary ?? '', mentionEveryone)
      break
  }

  return {
    content,
    signalType: mapAlertSignalToDiscordSignal(signalType),
    fields: {
      symbol,
      strike,
      optionType,
      expiration: expirationRaw,
      price,
      percent,
      level,
    },
  }
}

export function toEasternDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export async function getTodaySessionForChannel(channelId: string): Promise<DiscordTradeSessionRow | null> {
  const supabase = getSupabaseAdmin()
  const todayEt = toEasternDateString()

  const { data, error } = await supabase
    .from('discord_trade_sessions')
    .select('id,session_date,channel_id,session_end,session_summary,trade_count,net_pnl_pct')
    .eq('session_date', todayEt)
    .eq('channel_id', channelId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as DiscordTradeSessionRow | null) ?? null
}

export async function getSessionById(sessionId: string): Promise<DiscordTradeSessionRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('discord_trade_sessions')
    .select('id,session_date,channel_id,session_end,session_summary,trade_count,net_pnl_pct')
    .eq('id', sessionId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  return (data as DiscordTradeSessionRow | null) ?? null
}

export async function startOrResumeTodaySession(input: {
  channelId: string
  channelName: string | null
  guildId: string
  callerName: string | null
}): Promise<DiscordTradeSessionRow> {
  const supabase = getSupabaseAdmin()
  const nowIso = new Date().toISOString()
  const todayEt = toEasternDateString()

  const existing = await getTodaySessionForChannel(input.channelId)
  if (existing) {
    const { data, error } = await supabase
      .from('discord_trade_sessions')
      .update({
        channel_name: input.channelName ?? input.channelId,
        guild_id: input.guildId,
        caller_name: input.callerName,
        source: 'admin_console',
        session_end: null,
        updated_at: nowIso,
      })
      .eq('id', existing.id)
      .select('id,session_date,channel_id,session_end,session_summary,trade_count,net_pnl_pct')
      .single()

    if (error) {
      throw new Error(error.message)
    }
    return data as DiscordTradeSessionRow
  }

  const { data, error } = await supabase
    .from('discord_trade_sessions')
    .insert({
      session_date: todayEt,
      channel_id: input.channelId,
      channel_name: input.channelName ?? input.channelId,
      guild_id: input.guildId,
      caller_name: input.callerName,
      source: 'admin_console',
      session_start: nowIso,
      session_end: null,
      updated_at: nowIso,
    })
    .select('id,session_date,channel_id,session_end,session_summary,trade_count,net_pnl_pct')
    .single()

  if (error) {
    throw new Error(error.message)
  }
  return data as DiscordTradeSessionRow
}

export async function getSessionTrades(sessionId: string): Promise<DiscordParsedTradeRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('discord_parsed_trades')
    .select('id,trade_index,symbol,strike,contract_type,expiry,entry_price,entry_timestamp,final_pnl_pct,fully_exited,lifecycle_events')
    .eq('session_id', sessionId)
    .order('trade_index', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data as DiscordParsedTradeRow[] | null) ?? []
}

export function resolveTradeStateFromRow(row: {
  entry_timestamp: string | null
  fully_exited: boolean | null
} | null): AlertTradeState {
  if (!row) return 'IDLE'
  if (row.fully_exited === true) return 'CLOSED'
  if (row.entry_timestamp) return 'ACTIVE'
  return 'STAGED'
}

export async function resolveSessionTradeState(sessionId: string): Promise<AlertTradeState> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('discord_parsed_trades')
    .select('id,trade_index,entry_timestamp,fully_exited')
    .eq('session_id', sessionId)
    .order('trade_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const row = data as { entry_timestamp: string | null; fully_exited: boolean | null } | null
  return resolveTradeStateFromRow(row)
}

export async function resolveTradeStateForTrade(input: {
  sessionId: string
  tradeId?: string | null
}): Promise<AlertTradeState> {
  const tradeId = toNullableTrimmed(input.tradeId)
  if (!tradeId) {
    return resolveSessionTradeState(input.sessionId)
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('discord_parsed_trades')
    .select('entry_timestamp,fully_exited')
    .eq('session_id', input.sessionId)
    .eq('id', tradeId)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const row = data as { entry_timestamp: string | null; fully_exited: boolean | null } | null
  return resolveTradeStateFromRow(row)
}

export async function getSessionMessages(input: {
  sessionId: string
  limit?: number
}): Promise<DiscordMessageRow[]> {
  const supabase = getSupabaseAdmin()
  const maxRows = Number.isFinite(input.limit) ? Math.max(1, Math.min(300, Math.trunc(input.limit ?? 150))) : 150
  const { data, error } = await supabase
    .from('discord_messages')
    .select('id,discord_msg_id,content,sent_at,signal_type,webhook_status,source,parsed_trade_id')
    .eq('session_id', input.sessionId)
    .order('sent_at', { ascending: false })
    .limit(maxRows)

  if (error) {
    throw new Error(error.message)
  }

  return (data as DiscordMessageRow[] | null) ?? []
}

export function ensureSignalAllowedInState(state: AlertTradeState, signalType: AlertSignalType): void {
  if (!canSendSignalInState(state, signalType)) {
    throw new Error(`Signal ${signalType} is not allowed while trade state is ${state}`)
  }
}

function toOrdinal(index: number): string {
  if (index % 100 >= 11 && index % 100 <= 13) return `${index}th`
  const mod = index % 10
  if (mod === 1) return `${index}st`
  if (mod === 2) return `${index}nd`
  if (mod === 3) return `${index}rd`
  return `${index}th`
}

function resolveTradePnlPct(row: DiscordParsedTradeRow): number | null {
  if (row.final_pnl_pct != null && Number.isFinite(row.final_pnl_pct)) {
    return row.final_pnl_pct
  }

  const lifecycleEvents = Array.isArray(row.lifecycle_events) ? row.lifecycle_events : []
  for (let index = lifecycleEvents.length - 1; index >= 0; index -= 1) {
    const event = lifecycleEvents[index]
    if (!event || typeof event !== 'object') continue
    const candidate = toFiniteNumber((event as { percent?: unknown }).percent)
    if (candidate != null) return candidate
  }

  return null
}

export function buildSessionRecapMessage(trades: DiscordParsedTradeRow[]): string {
  const closedTrades = trades.filter((trade) => trade.fully_exited)
  if (closedTrades.length === 0) {
    return 'No closed trades in this session. Manage risk and reset tomorrow @everyone'
  }

  const parts = closedTrades.map((trade, index) => {
    const pnl = resolveTradePnlPct(trade)
    const label = `${toOrdinal(index + 1)} trade`
    if (pnl == null) return `${label} flat`
    return `${label} ${formatDecimal(pnl, 2)}%`
  })

  return `${parts.join(' ')} Solid day see you tomorrow @everyone`
}

export async function markSessionEnded(input: {
  sessionId: string
  summary: string
}): Promise<DiscordTradeSessionRow> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('discord_trade_sessions')
    .update({
      session_end: new Date().toISOString(),
      session_summary: input.summary,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.sessionId)
    .select('id,session_date,channel_id,session_end,session_summary,trade_count,net_pnl_pct')
    .single()

  if (error) {
    throw new Error(error.message)
  }
  return data as DiscordTradeSessionRow
}

export async function sendDiscordAlertWithFallback(input: {
  config: DiscordConfigRow
  content: string
}): Promise<AlertSendDeliveryResult> {
  const { config, content } = input
  const channelId = toNullableTrimmed(config.alert_channel_id)
  const webhookUrl = toNullableTrimmed(config.webhook_url)
  const botToken = toNullableTrimmed(config.bot_token)

  if (!channelId) {
    throw new Error('Discord alert channel is not configured')
  }

  let botError: string | null = null
  if (config.delivery_method === 'bot') {
    if (!botToken) {
      botError = 'Discord bot token is not configured'
    } else {
      try {
        const result = await sendDiscordBotMessage({
          token: botToken,
          channelId,
          content,
        })
        return {
          sent: true,
          messageId: result.messageId,
          webhookStatus: 'sent',
          deliveryMethod: 'bot',
          fallbackUsed: false,
          errorMessage: null,
        }
      } catch (error) {
        botError = error instanceof Error ? error.message : 'Discord bot delivery failed'
      }
    }
  }

  if (webhookUrl) {
    try {
      const result = await sendDiscordWebhookMessage({
        webhookUrl,
        content,
      })
      return {
        sent: true,
        messageId: result.messageId ?? `webhook_${randomUUID()}`,
        webhookStatus: config.delivery_method === 'bot' ? 'resent' : 'sent',
        deliveryMethod: 'webhook',
        fallbackUsed: config.delivery_method === 'bot',
        errorMessage: botError,
      }
    } catch (error) {
      const webhookError = error instanceof Error ? error.message : 'Discord webhook delivery failed'
      throw new Error(botError ? `${botError}; fallback webhook failed: ${webhookError}` : webhookError)
    }
  }

  if (botError) {
    throw new Error(botError)
  }

  throw new Error('Discord delivery is not configured. Set bot credentials or webhook URL.')
}

export async function persistAndBroadcastAdminSignal(input: {
  signal: ParsedDiscordSignal
  adminAlertId: string
  webhookStatus: DeliveryWebhookStatus
  targetTradeId?: string | null
}): Promise<{ persisted: boolean; broadcasted: boolean; persistenceError: string | null; broadcastError: string | null }> {
  const { signal, adminAlertId, webhookStatus, targetTradeId } = input

  let persisted = true
  let broadcasted = true
  let persistenceError: string | null = null
  let broadcastError: string | null = null

  try {
    const { discordPersistence } = await import('@/backend/src/services/discord/discordPersistence')
    await discordPersistence.persistDiscordMessage(signal, {
      source: 'admin_console',
      adminAlertId,
      webhookStatus,
      targetTradeId: toNullableTrimmed(targetTradeId),
    })
  } catch (error) {
    persisted = false
    persistenceError = error instanceof Error ? error.message : 'Failed to persist admin alert'
  }

  try {
    const { discordBroadcaster } = await import('@/backend/src/services/discord/discordBroadcaster')
    await discordBroadcaster.broadcast(signal)
  } catch (error) {
    broadcasted = false
    broadcastError = error instanceof Error ? error.message : 'Failed to broadcast admin alert'
  }

  return {
    persisted,
    broadcasted,
    persistenceError,
    broadcastError,
  }
}
