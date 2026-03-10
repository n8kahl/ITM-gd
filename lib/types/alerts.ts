export type AlertSignalType =
  | 'prep'
  | 'ptf'
  | 'filled_avg'
  | 'update'
  | 'trim'
  | 'add'
  | 'stops'
  | 'breakeven'
  | 'trail'
  | 'exit_above'
  | 'exit_below'
  | 'fully_out'
  | 'commentary'
  | 'session_recap'

export type AlertTradeState = 'IDLE' | 'STAGED' | 'ACTIVE' | 'CLOSED'
export type AlertSizeTag = 'full' | 'light' | 'lotto'

export type DiscordAlertSource = 'discord_bot' | 'admin_console'
export type DiscordWebhookStatus = 'sent' | 'failed' | 'resent'
export type DiscordDeliveryMethod = 'bot' | 'webhook'
export type DiscordConnectionStatus = 'connected' | 'disconnected' | 'error' | 'reconnecting'

export interface AlertSendFields {
  symbol?: string
  strike?: number
  optionType?: 'call' | 'put'
  expiration?: string
  price?: number
  percent?: number
  level?: number
  sizeTag?: AlertSizeTag
  commentary?: string
}

export interface AlertSendPayload {
  sessionId: string
  tradeId?: string
  signalType: AlertSignalType
  fields: AlertSendFields
  mentionEveryone: boolean
}

export interface AlertTradeContract {
  symbol: string
  strike: number
  optionType: 'call' | 'put'
  expiration: string
}

export interface AlertTrade {
  id: string
  state: AlertTradeState
  contract: AlertTradeContract
  sizeTag: AlertSizeTag
  entryPrice: number | null
  latestPrice: number | null
  pnlPercent: number | null
  createdAt: string
  updatedAt: string
}

export interface DiscordRuntimeConfig {
  enabled: boolean
  token: string | null
  guildIds: string[]
  channelIds: string[]
  deliveryMethod: DiscordDeliveryMethod
  webhookUrl: string | null
  source: 'database' | 'environment' | 'disabled'
}

const stateActions: Record<AlertTradeState, ReadonlyArray<AlertSignalType>> = {
  IDLE: ['prep', 'commentary'],
  STAGED: ['ptf', 'filled_avg', 'commentary'],
  ACTIVE: [
    'prep',
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
  ],
  CLOSED: ['prep', 'session_recap', 'commentary'],
}

export function canSendSignalInState(
  state: AlertTradeState,
  signalType: AlertSignalType,
): boolean {
  return stateActions[state].includes(signalType)
}
