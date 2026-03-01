import { EventEmitter } from 'events';
import type { DiscordBotMessagePayload } from '../discordBot';
import { DiscordBotService } from '../discordBot';

class MockDiscordClient extends EventEmitter {
  login = jest.fn(async (_token: string) => 'logged_in');
  destroy = jest.fn(() => undefined);
  user: { tag?: string | null } | null = { tag: 'test-bot#0001' };
}

function buildMessage(overrides?: Partial<{
  id: string;
  guildId: string | null;
  channelId: string;
  content: string;
  author: { id: string; bot?: boolean };
  createdTimestamp: number;
  editedTimestamp: number | null;
}>): {
  id: string;
  guildId: string | null;
  channelId: string;
  content: string;
  author: { id: string; bot?: boolean };
  createdTimestamp: number;
  editedTimestamp: number | null;
} {
  return {
    id: 'msg-1',
    guildId: 'guild-1',
    channelId: 'channel-1',
    content: 'hello world',
    author: { id: 'user-1', bot: false },
    createdTimestamp: Date.parse('2026-03-01T15:00:00.000Z'),
    editedTimestamp: null,
    ...overrides,
  };
}

describe('services/discord/discordBot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('start no-ops when DISCORD_BOT_ENABLED is false', async () => {
    const clientFactory = jest.fn(() => new MockDiscordClient());
    const service = new DiscordBotService({
      env: {
        DISCORD_BOT_ENABLED: 'false',
        DISCORD_BOT_TOKEN: 'token',
        DISCORD_BOT_GUILD_IDS: 'guild-1',
        DISCORD_BOT_CHANNEL_IDS: 'channel-1',
      },
      createClient: clientFactory,
      logger: { info: jest.fn(), warn: jest.fn() },
    });

    await expect(service.start()).resolves.toBeUndefined();
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it('start warns and does not throw when token is missing', async () => {
    const warn = jest.fn();
    const clientFactory = jest.fn(() => new MockDiscordClient());
    const service = new DiscordBotService({
      env: {
        DISCORD_BOT_ENABLED: 'true',
        DISCORD_BOT_TOKEN: '',
        DISCORD_BOT_GUILD_IDS: 'guild-1',
        DISCORD_BOT_CHANNEL_IDS: 'channel-1',
      },
      createClient: clientFactory,
      logger: { info: jest.fn(), warn },
    });

    await expect(service.start()).resolves.toBeUndefined();
    expect(clientFactory).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('Discord bot enabled but token missing; continuing fail-open');
  });

  it('filters messageCreate events by configured guild/channel ids', async () => {
    const callback = jest.fn<void, [DiscordBotMessagePayload]>();
    const client = new MockDiscordClient();
    const service = new DiscordBotService({
      env: {
        DISCORD_BOT_ENABLED: 'true',
        DISCORD_BOT_TOKEN: 'token',
        DISCORD_BOT_GUILD_IDS: 'guild-1,guild-2',
        DISCORD_BOT_CHANNEL_IDS: 'channel-1,channel-2',
      },
      createClient: () => client,
      logger: { info: jest.fn(), warn: jest.fn() },
      onMessage: callback,
    });

    await service.start();

    client.emit('messageCreate', buildMessage({ guildId: 'guild-x', channelId: 'channel-1' }));
    client.emit('messageCreate', buildMessage({ guildId: 'guild-1', channelId: 'channel-x' }));
    client.emit('messageCreate', buildMessage({ guildId: null, channelId: 'channel-1' }));
    client.emit('messageCreate', buildMessage({ guildId: 'guild-2', channelId: 'channel-2', id: 'msg-valid' }));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({
      messageId: 'msg-valid',
      guildId: 'guild-2',
      channelId: 'channel-2',
      authorId: 'user-1',
      authorIsBot: false,
      content: 'hello world',
      createdAt: '2026-03-01T15:00:00.000Z',
      editedAt: null,
    });

    await service.stop();
  });

  it('stop destroys client and detaches listeners', async () => {
    const client = new MockDiscordClient();
    const service = new DiscordBotService({
      env: {
        DISCORD_BOT_ENABLED: 'true',
        DISCORD_BOT_TOKEN: 'token',
        DISCORD_BOT_GUILD_IDS: 'guild-1',
        DISCORD_BOT_CHANNEL_IDS: 'channel-1',
      },
      createClient: () => client,
      logger: { info: jest.fn(), warn: jest.fn() },
    });

    await service.start();
    expect(client.listenerCount('messageCreate')).toBe(1);
    expect(client.listenerCount('ready')).toBe(1);
    expect(client.listenerCount('error')).toBe(1);

    await service.stop();

    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(client.listenerCount('messageCreate')).toBe(0);
    expect(client.listenerCount('ready')).toBe(0);
    expect(client.listenerCount('error')).toBe(0);

    await expect(service.stop()).resolves.toBeUndefined();
    expect(client.destroy).toHaveBeenCalledTimes(1);
  });
});
