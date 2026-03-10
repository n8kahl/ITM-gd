import { supabase } from '../../config/database';
import type { Env } from '../../config/env';
import { logger } from '../../lib/logger';

type DiscordDeliveryMethod = 'bot' | 'webhook';

interface DiscordConfigRow {
  id?: unknown;
  bot_token?: unknown;
  bot_enabled?: unknown;
  guild_ids?: unknown;
  alert_channel_id?: unknown;
  delivery_method?: unknown;
  webhook_url?: unknown;
}

interface DiscordConfigStoreLogger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
}

interface DiscordConfigStoreDbClient {
  from: (table: string) => {
    select: (columns: string) => {
      order: (column: string, options: { ascending: boolean }) => {
        limit: (count: number) => {
          maybeSingle: () => Promise<{ data: DiscordConfigRow | null; error: unknown | null }>;
        };
      };
    };
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: unknown | null }>;
  };
}

interface ResolveDiscordRuntimeConfigDependencies {
  db: DiscordConfigStoreDbClient;
  env: Env;
  logger: DiscordConfigStoreLogger;
}

export interface DiscordRuntimeConfig {
  enabled: boolean;
  token: string | null;
  guildIds: string[];
  channelIds: string[];
  deliveryMethod: DiscordDeliveryMethod;
  webhookUrl: string | null;
  source: 'database' | 'environment' | 'disabled';
  configId: string | null;
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseCsvIds(raw: string): string[] {
  return [...new Set(raw.split(',').map((value) => value.trim()).filter((value) => value.length > 0))];
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0))];
  }
  if (typeof value === 'string') {
    return parseCsvIds(value);
  }
  return [];
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return code === '42P01' || message.toLowerCase().includes('relation "discord_config" does not exist');
}

function resolveDeliveryMethod(value: unknown): DiscordDeliveryMethod {
  return value === 'webhook' ? 'webhook' : 'bot';
}

function toDisabledRuntimeConfig(): DiscordRuntimeConfig {
  return {
    enabled: false,
    token: null,
    guildIds: [],
    channelIds: [],
    deliveryMethod: 'bot',
    webhookUrl: null,
    source: 'disabled',
    configId: null,
  };
}

function fromDatabaseRow(row: DiscordConfigRow): DiscordRuntimeConfig {
  const token = toNullableString(row.bot_token);
  const guildIds = parseStringArray(row.guild_ids);
  const channelId = toNullableString(row.alert_channel_id);
  const channelIds = channelId ? [channelId] : [];
  const enabled = row.bot_enabled === true && Boolean(token) && guildIds.length > 0 && channelIds.length > 0;

  return {
    enabled,
    token,
    guildIds,
    channelIds,
    deliveryMethod: resolveDeliveryMethod(row.delivery_method),
    webhookUrl: toNullableString(row.webhook_url),
    source: 'database',
    configId: toNullableString(row.id),
  };
}

function fromEnvironment(env: Env): DiscordRuntimeConfig {
  const token = toNullableString(env.DISCORD_BOT_TOKEN);
  const guildIds = parseCsvIds(env.DISCORD_BOT_GUILD_IDS);
  const channelIds = parseCsvIds(env.DISCORD_BOT_CHANNEL_IDS);
  const enabled = env.DISCORD_BOT_ENABLED && Boolean(token) && guildIds.length > 0 && channelIds.length > 0;

  return {
    enabled,
    token,
    guildIds,
    channelIds,
    deliveryMethod: 'bot',
    webhookUrl: null,
    source: 'environment',
    configId: null,
  };
}

function hasEnvironmentSeedData(config: DiscordRuntimeConfig): boolean {
  return Boolean(config.token) || config.guildIds.length > 0 || config.channelIds.length > 0;
}

async function seedDatabaseFromEnvironment(
  db: DiscordConfigStoreDbClient,
  envConfig: DiscordRuntimeConfig,
  log: DiscordConfigStoreLogger,
): Promise<void> {
  if (!hasEnvironmentSeedData(envConfig)) return;

  const { error } = await db.from('discord_config').insert([{
    bot_token: envConfig.token,
    bot_enabled: envConfig.enabled,
    guild_ids: envConfig.guildIds,
    alert_channel_id: envConfig.channelIds[0] ?? null,
    delivery_method: envConfig.deliveryMethod,
    webhook_url: envConfig.webhookUrl,
    connection_status: 'disconnected',
  }]);

  if (error) {
    log.warn('Failed to seed discord_config from environment bootstrap values; continuing', {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  log.info('Seeded discord_config from DISCORD_BOT_* bootstrap values');
}

export async function resolveDiscordRuntimeConfig(
  dependencies?: Partial<ResolveDiscordRuntimeConfigDependencies>,
): Promise<DiscordRuntimeConfig> {
  const deps: ResolveDiscordRuntimeConfigDependencies = {
    db: dependencies?.db ?? (supabase as unknown as DiscordConfigStoreDbClient),
    env: dependencies?.env ?? (process.env as unknown as Env),
    logger: dependencies?.logger ?? logger,
  };

  try {
    const { data, error } = await deps.db
      .from('discord_config')
      .select('id,bot_token,bot_enabled,guild_ids,alert_channel_id,delivery_method,webhook_url')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (!isMissingTableError(error)) {
        deps.logger.warn('Failed to query discord_config table; falling back to DISCORD_BOT_* env vars', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (data) {
      return fromDatabaseRow(data);
    }
  } catch (error) {
    deps.logger.warn('Discord config resolution failed against database; falling back to env bootstrap values', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const envConfig = fromEnvironment(deps.env);
  if (!hasEnvironmentSeedData(envConfig)) {
    return toDisabledRuntimeConfig();
  }

  await seedDatabaseFromEnvironment(deps.db, envConfig, deps.logger);
  return envConfig;
}
