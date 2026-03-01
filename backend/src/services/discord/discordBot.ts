import { logger } from '../../lib/logger';

export interface DiscordBotMessagePayload {
  messageId: string;
  guildId: string;
  channelId: string;
  authorId: string;
  authorIsBot: boolean;
  content: string;
  createdAt: string;
  editedAt: string | null;
}

export type DiscordBotMessageHandler = (payload: DiscordBotMessagePayload) => void | Promise<void>;

interface DiscordMessageLike {
  id: string;
  guildId?: string | null;
  channelId: string;
  content: string;
  author: {
    id: string;
    bot?: boolean;
  };
  createdTimestamp: number;
  editedTimestamp: number | null;
}

interface DiscordClientLike {
  on(event: 'ready', listener: () => void): unknown;
  on(event: 'error', listener: (error: unknown) => void): unknown;
  on(event: 'messageCreate', listener: (message: DiscordMessageLike) => void): unknown;
  off(event: 'ready', listener: () => void): unknown;
  off(event: 'error', listener: (error: unknown) => void): unknown;
  off(event: 'messageCreate', listener: (message: DiscordMessageLike) => void): unknown;
  login(token: string): Promise<unknown>;
  destroy(): void;
  user?: {
    tag?: string | null;
  } | null;
}

interface DiscordBotLogger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
}

interface DiscordBotDependencies {
  env: NodeJS.ProcessEnv;
  logger: DiscordBotLogger;
  createClient: () => DiscordClientLike | null;
  onMessage: DiscordBotMessageHandler;
}

interface DiscordClientListeners {
  ready: () => void;
  error: (error: unknown) => void;
  messageCreate: (message: DiscordMessageLike) => void;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  return fallback;
}

function parseCsvIds(value: string | undefined): string[] {
  if (!value) return [];

  const ids = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return [...new Set(ids)];
}

function toIsoTimestamp(timestamp: number | null | undefined): string | null {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function createDiscordClient(loggerInstance: DiscordBotLogger): DiscordClientLike | null {
  try {
    const discordModule = require('discord.js') as {
      Client?: new (options: { intents: number[] }) => DiscordClientLike;
      GatewayIntentBits?: Record<string, number>;
    };

    if (!discordModule?.Client || !discordModule?.GatewayIntentBits) {
      loggerInstance.warn('Discord bot runtime unavailable; continuing fail-open', {
        reason: 'discord_js_exports_missing',
      });
      return null;
    }

    const intents = [
      discordModule.GatewayIntentBits.Guilds,
      discordModule.GatewayIntentBits.GuildMessages,
      discordModule.GatewayIntentBits.MessageContent,
    ];

    return new discordModule.Client({ intents });
  } catch (error) {
    loggerInstance.warn('Discord bot runtime unavailable; continuing fail-open', {
      reason: 'discord_js_not_installed',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function isDiscordBotEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return parseBooleanEnv(env.DISCORD_BOT_ENABLED, false);
}

export class DiscordBotService {
  private readonly deps: DiscordBotDependencies;
  private client: DiscordClientLike | null = null;
  private listeners: DiscordClientListeners | null = null;
  private startInFlight: Promise<void> | null = null;
  private messageHandler: DiscordBotMessageHandler;

  constructor(dependencies?: Partial<DiscordBotDependencies>) {
    const resolvedLogger = dependencies?.logger ?? logger;
    this.deps = {
      env: dependencies?.env ?? process.env,
      logger: resolvedLogger,
      createClient: dependencies?.createClient ?? (() => createDiscordClient(resolvedLogger)),
      onMessage: dependencies?.onMessage ?? (() => undefined),
    };
    this.messageHandler = this.deps.onMessage;
  }

  setMessageHandler(handler: DiscordBotMessageHandler): void {
    this.messageHandler = handler;
  }

  async start(): Promise<void> {
    if (this.startInFlight) {
      return this.startInFlight;
    }

    this.startInFlight = this.startInternal().finally(() => {
      this.startInFlight = null;
    });

    return this.startInFlight;
  }

  async stop(): Promise<void> {
    if (this.startInFlight) {
      await this.startInFlight;
    }

    this.stopInternal();
  }

  private async startInternal(): Promise<void> {
    if (!isDiscordBotEnabled(this.deps.env)) {
      return;
    }

    if (this.client) {
      return;
    }

    const token = (this.deps.env.DISCORD_BOT_TOKEN || '').trim();
    const guildIds = parseCsvIds(this.deps.env.DISCORD_BOT_GUILD_IDS);
    const channelIds = parseCsvIds(this.deps.env.DISCORD_BOT_CHANNEL_IDS);

    if (!token) {
      this.deps.logger.warn('Discord bot enabled but token missing; continuing fail-open');
      return;
    }

    if (guildIds.length === 0 || channelIds.length === 0) {
      this.deps.logger.warn('Discord bot enabled but guild/channel config invalid; continuing fail-open', {
        guildCount: guildIds.length,
        channelCount: channelIds.length,
      });
      return;
    }

    const client = this.deps.createClient();
    if (!client) {
      return;
    }

    const allowedGuildIds = new Set(guildIds);
    const allowedChannelIds = new Set(channelIds);
    const listeners: DiscordClientListeners = {
      ready: () => {
        this.deps.logger.info('Discord bot connected', {
          userTag: client.user?.tag || 'unknown',
          guildCount: allowedGuildIds.size,
          channelCount: allowedChannelIds.size,
        });
      },
      error: (error) => {
        this.deps.logger.warn('Discord bot runtime error (fail-open)', {
          error: error instanceof Error ? error.message : String(error),
        });
      },
      messageCreate: (message) => {
        this.handleMessageCreate(message, allowedGuildIds, allowedChannelIds);
      },
    };

    this.client = client;
    this.listeners = listeners;

    try {
      client.on('ready', listeners.ready);
      client.on('error', listeners.error);
      client.on('messageCreate', listeners.messageCreate);
      await client.login(token);
    } catch (error) {
      this.deps.logger.warn('Discord bot failed to start; continuing fail-open', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.detachListeners(client);
      this.safeDestroyClient(client);
      if (this.client === client) this.client = null;
      this.listeners = null;
    }
  }

  private stopInternal(): void {
    const client = this.client;
    if (!client) {
      return;
    }

    this.detachListeners(client);
    this.client = null;
    this.listeners = null;
    this.safeDestroyClient(client);
  }

  private detachListeners(client: DiscordClientLike): void {
    if (!this.listeners) {
      return;
    }

    client.off('ready', this.listeners.ready);
    client.off('error', this.listeners.error);
    client.off('messageCreate', this.listeners.messageCreate);
  }

  private safeDestroyClient(client: DiscordClientLike): void {
    try {
      client.destroy();
    } catch (error) {
      this.deps.logger.warn('Discord bot client destroy failed; continuing fail-open', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private handleMessageCreate(
    message: DiscordMessageLike,
    allowedGuildIds: Set<string>,
    allowedChannelIds: Set<string>,
  ): void {
    try {
      if (!message || typeof message !== 'object') return;
      const guildId = typeof message.guildId === 'string' ? message.guildId : '';
      if (!guildId || !allowedGuildIds.has(guildId)) return;

      const channelId = typeof message.channelId === 'string' ? message.channelId : '';
      if (!channelId || !allowedChannelIds.has(channelId)) return;

      const payload: DiscordBotMessagePayload = {
        messageId: String(message.id),
        guildId,
        channelId,
        authorId: String(message.author?.id || ''),
        authorIsBot: Boolean(message.author?.bot),
        content: typeof message.content === 'string' ? message.content : '',
        createdAt: toIsoTimestamp(message.createdTimestamp) ?? new Date().toISOString(),
        editedAt: toIsoTimestamp(message.editedTimestamp),
      };

      const maybePromise = this.messageHandler(payload);
      void Promise.resolve(maybePromise).catch((error) => {
        this.deps.logger.warn('Discord message async handler failed; continuing fail-open', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } catch (error) {
      this.deps.logger.warn('Discord message handler failed; continuing fail-open', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const discordBot = new DiscordBotService();
