import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import type { ParsedDiscordSignal, DiscordSignalType, ParsedSignalFields } from './messageParser';

export type DiscordBroadcastEventKind =
  | 'discord_prep'
  | 'discord_fill'
  | 'discord_trim'
  | 'discord_stop'
  | 'discord_exit'
  | 'discord_commentary';

export interface DiscordBroadcastPayload {
  messageId: string;
  guildId: string;
  channelId: string;
  authorId: string;
  createdAt: string;
  signalType: DiscordSignalType;
  fields: ParsedSignalFields;
}

interface RealtimeSendInput {
  type: 'broadcast';
  event: DiscordBroadcastEventKind;
  payload: DiscordBroadcastPayload;
}

interface DiscordRealtimeChannel {
  send: (input: RealtimeSendInput) => Promise<string>;
}

interface DiscordRealtimeClient {
  channel: (name: string) => DiscordRealtimeChannel;
}

interface DiscordBroadcasterLogger {
  warn: (message: string, meta?: Record<string, unknown>) => void;
}

interface DiscordBroadcasterDependencies {
  realtime: DiscordRealtimeClient;
  logger: DiscordBroadcasterLogger;
}

export function mapDiscordSignalToEventKind(signalType: DiscordSignalType): DiscordBroadcastEventKind {
  switch (signalType) {
    case 'prep':
      return 'discord_prep';
    case 'ptf':
    case 'filled_avg':
      return 'discord_fill';
    case 'trim':
      return 'discord_trim';
    case 'stops':
    case 'breakeven':
    case 'trail':
      return 'discord_stop';
    case 'exit_above':
    case 'exit_below':
    case 'fully_out':
      return 'discord_exit';
    case 'commentary':
    default:
      return 'discord_commentary';
  }
}

function toBroadcastPayload(signal: ParsedDiscordSignal): DiscordBroadcastPayload {
  return {
    messageId: signal.messageId,
    guildId: signal.guildId,
    channelId: signal.channelId,
    authorId: signal.authorId,
    createdAt: signal.createdAt,
    signalType: signal.signalType,
    fields: signal.fields,
  };
}

export class DiscordBroadcasterService {
  private readonly deps: DiscordBroadcasterDependencies;

  constructor(dependencies?: Partial<DiscordBroadcasterDependencies>) {
    this.deps = {
      realtime: dependencies?.realtime ?? (supabase as unknown as DiscordRealtimeClient),
      logger: dependencies?.logger ?? logger,
    };
  }

  async broadcast(signal: ParsedDiscordSignal): Promise<void> {
    const channelName = `discord_calls:${signal.channelId}`;
    const eventKind = mapDiscordSignalToEventKind(signal.signalType);
    const payload = toBroadcastPayload(signal);

    try {
      const status = await this.deps.realtime
        .channel(channelName)
        .send({
          type: 'broadcast',
          event: eventKind,
          payload,
        });

      if (status !== 'ok') {
        this.deps.logger.warn('Discord broadcast returned non-ok status; continuing fail-open', {
          status,
          channelName,
          eventKind,
          signalType: signal.signalType,
        });
      }
    } catch (error) {
      this.deps.logger.warn('Discord broadcast failed; continuing fail-open', {
        error: error instanceof Error ? error.message : String(error),
        channelName,
        eventKind,
        signalType: signal.signalType,
      });
    }
  }
}

export const discordBroadcaster = new DiscordBroadcasterService();
