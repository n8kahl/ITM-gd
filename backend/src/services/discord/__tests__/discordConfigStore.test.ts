import type { Env } from '../../../config/env';
import {
  resolveDiscordRuntimeConfig,
  type DiscordRuntimeConfig,
} from '../discordConfigStore';

type DiscordConfigRow = {
  id?: unknown;
  bot_token?: unknown;
  bot_enabled?: unknown;
  guild_ids?: unknown;
  alert_channel_id?: unknown;
  delivery_method?: unknown;
  webhook_url?: unknown;
};

class InMemoryDiscordConfigDb {
  public row: DiscordConfigRow | null = null;
  public selectError: unknown | null = null;
  public insertError: unknown | null = null;
  public insertCalls: Record<string, unknown>[][] = [];

  from(table: string) {
    if (table !== 'discord_config') {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      select: (_columns: string) => ({
        order: (_column: string, _options: { ascending: boolean }) => ({
          limit: (_count: number) => ({
            maybeSingle: async () => ({
              data: this.row,
              error: this.selectError,
            }),
          }),
        }),
      }),
      insert: async (rows: Record<string, unknown>[]) => {
        this.insertCalls.push(rows);
        if (!this.insertError) {
          this.row = rows[0] ?? null;
        }
        return { error: this.insertError };
      },
    };
  }
}

function buildEnv(overrides?: Partial<Env>): Env {
  return {
    DISCORD_BOT_ENABLED: false,
    DISCORD_BOT_TOKEN: undefined,
    DISCORD_BOT_GUILD_IDS: '',
    DISCORD_BOT_CHANNEL_IDS: '',
    ...overrides,
  } as unknown as Env;
}

describe('services/discord/discordConfigStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefers discord_config row over environment bootstrap values', async () => {
    const db = new InMemoryDiscordConfigDb();
    db.row = {
      id: 'cfg-1',
      bot_token: 'bot-token',
      bot_enabled: true,
      guild_ids: ['guild-1'],
      alert_channel_id: 'channel-1',
      delivery_method: 'bot',
    };

    const config = await resolveDiscordRuntimeConfig({
      db: db as any,
      env: buildEnv({
        DISCORD_BOT_ENABLED: true,
        DISCORD_BOT_TOKEN: 'env-token',
        DISCORD_BOT_GUILD_IDS: 'env-guild',
        DISCORD_BOT_CHANNEL_IDS: 'env-channel',
      }),
      logger: { info: jest.fn(), warn: jest.fn() },
    });

    expect(config).toEqual<DiscordRuntimeConfig>({
      enabled: true,
      token: 'bot-token',
      guildIds: ['guild-1'],
      channelIds: ['channel-1'],
      deliveryMethod: 'bot',
      webhookUrl: null,
      source: 'database',
      configId: 'cfg-1',
    });
    expect(db.insertCalls).toHaveLength(0);
  });

  it('seeds discord_config from environment when table is empty', async () => {
    const db = new InMemoryDiscordConfigDb();
    const info = jest.fn();

    const config = await resolveDiscordRuntimeConfig({
      db: db as any,
      env: buildEnv({
        DISCORD_BOT_ENABLED: true,
        DISCORD_BOT_TOKEN: 'seed-token',
        DISCORD_BOT_GUILD_IDS: 'guild-1,guild-2',
        DISCORD_BOT_CHANNEL_IDS: 'channel-1',
      }),
      logger: { info, warn: jest.fn() },
    });

    expect(config.source).toBe('environment');
    expect(config.enabled).toBe(true);
    expect(config.token).toBe('seed-token');
    expect(config.guildIds).toEqual(['guild-1', 'guild-2']);
    expect(config.channelIds).toEqual(['channel-1']);
    expect(db.insertCalls).toHaveLength(1);
    expect(info).toHaveBeenCalledWith('Seeded discord_config from DISCORD_BOT_* bootstrap values');
  });

  it('returns disabled config when neither database nor env bootstrap values are available', async () => {
    const db = new InMemoryDiscordConfigDb();
    const config = await resolveDiscordRuntimeConfig({
      db: db as any,
      env: buildEnv(),
      logger: { info: jest.fn(), warn: jest.fn() },
    });

    expect(config).toEqual({
      enabled: false,
      token: null,
      guildIds: [],
      channelIds: [],
      deliveryMethod: 'bot',
      webhookUrl: null,
      source: 'disabled',
      configId: null,
    });
    expect(db.insertCalls).toHaveLength(0);
  });

  it('falls back to environment bootstrap when discord_config table is not present yet', async () => {
    const db = new InMemoryDiscordConfigDb();
    db.selectError = {
      code: '42P01',
      message: 'relation "discord_config" does not exist',
    };

    const config = await resolveDiscordRuntimeConfig({
      db: db as any,
      env: buildEnv({
        DISCORD_BOT_ENABLED: true,
        DISCORD_BOT_TOKEN: 'env-token',
        DISCORD_BOT_GUILD_IDS: 'guild-a',
        DISCORD_BOT_CHANNEL_IDS: 'channel-a',
      }),
      logger: { info: jest.fn(), warn: jest.fn() },
    });

    expect(config.source).toBe('environment');
    expect(config.enabled).toBe(true);
    expect(config.guildIds).toEqual(['guild-a']);
    expect(config.channelIds).toEqual(['channel-a']);
  });
});
