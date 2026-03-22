import { EventEmitter } from 'events';
import type { DiscordBotMessagePayload } from '../discordBot';
import { DiscordBotService } from '../discordBot';

class MockDiscordClient extends EventEmitter {
  login = jest.fn(async (_token: string) => 'logged_in');
  destroy = jest.fn(() => undefined);
  send = jest.fn(async (_payload: string | { content: string }) => undefined);
  channels = {
    fetch: jest.fn(async (_channelId: string) => ({ send: this.send })),
  };
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

function createEnabledService(overrides?: {
  client?: MockDiscordClient;
  onMessage?: (payload: DiscordBotMessagePayload) => void | Promise<void>;
  warn?: jest.Mock;
  info?: jest.Mock;
}) {
  const client = overrides?.client ?? new MockDiscordClient();
  const warn = overrides?.warn ?? jest.fn();
  const info = overrides?.info ?? jest.fn();

  const service = new DiscordBotService({
    env: {
      DISCORD_BOT_ENABLED: 'true',
      DISCORD_BOT_TOKEN: 'token',
      DISCORD_BOT_GUILD_IDS: 'guild-1',
      DISCORD_BOT_CHANNEL_IDS: 'channel-1',
    },
    createClient: () => client,
    logger: { info, warn },
    onMessage: overrides?.onMessage,
  });

  return { service, client, warn, info };
}

describe('services/discord/discordBot — edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────
  // Rate Limiting Edge Cases
  // ──────────────────────────────────────────────────

  describe('rate limiting', () => {
    it('sendMessage handles channel.send rejection (simulated 429 rate limit)', async () => {
      const { service, client, warn } = createEnabledService();
      client.send.mockRejectedValueOnce(new Error('Rate limited (429): You are being rate limited'));

      await service.start();
      const result = await service.sendMessage('channel-1', 'test message');

      expect(result).toBe(false);
      expect(warn).toHaveBeenCalledWith(
        'Discord outbound send failed; continuing fail-open',
        expect.objectContaining({
          error: expect.stringContaining('Rate limited'),
        }),
      );
    });

    it('sendMessage succeeds after a previous rate limit failure', async () => {
      const { service, client } = createEnabledService();
      client.send
        .mockRejectedValueOnce(new Error('Rate limited (429)'))
        .mockResolvedValueOnce(undefined);

      await service.start();
      const first = await service.sendMessage('channel-1', 'msg1');
      const second = await service.sendMessage('channel-1', 'msg2');

      expect(first).toBe(false);
      expect(second).toBe(true);
    });

    it('handles rapid successive messages without throwing', async () => {
      const { service, client } = createEnabledService();
      await service.start();

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          service.sendMessage('channel-1', `rapid message ${i}`),
        ),
      );

      expect(results.every(r => r === true)).toBe(true);
      expect(client.send).toHaveBeenCalledTimes(10);
    });

    it('handles channel.fetch rejection gracefully (channel permission denied)', async () => {
      const { service, client, warn } = createEnabledService();
      client.channels.fetch.mockRejectedValueOnce(new Error('Missing Access'));

      await service.start();
      const result = await service.sendMessage('channel-1', 'test');

      expect(result).toBe(false);
      expect(warn).toHaveBeenCalledWith(
        'Discord outbound send failed; continuing fail-open',
        expect.objectContaining({ error: 'Missing Access' }),
      );
    });

    it('handles channel.fetch returning null (channel deleted/inaccessible)', async () => {
      const { service, client, warn } = createEnabledService();
      client.channels.fetch.mockResolvedValueOnce(null as unknown as { send: jest.Mock });

      await service.start();
      const result = await service.sendMessage('channel-1', 'test');

      expect(result).toBe(false);
      expect(warn).toHaveBeenCalledWith(
        'Discord outbound send skipped because target channel is unavailable',
        expect.objectContaining({ channelId: 'channel-1' }),
      );
    });
  });

  // ──────────────────────────────────────────────────
  // Reconnection Edge Cases
  // ──────────────────────────────────────────────────

  describe('reconnection', () => {
    it('handles login failure gracefully (token revoked)', async () => {
      const client = new MockDiscordClient();
      client.login.mockRejectedValueOnce(new Error('TOKEN_INVALID'));

      const warn = jest.fn();
      const service = new DiscordBotService({
        env: {
          DISCORD_BOT_ENABLED: 'true',
          DISCORD_BOT_TOKEN: 'revoked-token',
          DISCORD_BOT_GUILD_IDS: 'guild-1',
          DISCORD_BOT_CHANNEL_IDS: 'channel-1',
        },
        createClient: () => client,
        logger: { info: jest.fn(), warn },
      });

      await expect(service.start()).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        'Discord bot failed to start; continuing fail-open',
        expect.objectContaining({ error: 'TOKEN_INVALID' }),
      );
      expect(client.destroy).toHaveBeenCalledTimes(1);
    });

    it('concurrent start() calls are deduplicated', async () => {
      const client = new MockDiscordClient();
      let loginResolve: () => void;
      client.login.mockImplementation(() =>
        new Promise<string>((resolve) => {
          loginResolve = () => resolve('logged_in');
        }),
      );

      const { service } = createEnabledService({ client });

      const p1 = service.start();
      const p2 = service.start();

      // Both should reference the same in-flight promise
      loginResolve!();
      await Promise.all([p1, p2]);

      expect(client.login).toHaveBeenCalledTimes(1);
    });

    it('can restart after stop()', async () => {
      const client1 = new MockDiscordClient();
      const client2 = new MockDiscordClient();
      let callCount = 0;

      const service = new DiscordBotService({
        env: {
          DISCORD_BOT_ENABLED: 'true',
          DISCORD_BOT_TOKEN: 'token',
          DISCORD_BOT_GUILD_IDS: 'guild-1',
          DISCORD_BOT_CHANNEL_IDS: 'channel-1',
        },
        createClient: () => (callCount++ === 0 ? client1 : client2),
        logger: { info: jest.fn(), warn: jest.fn() },
      });

      await service.start();
      expect(client1.login).toHaveBeenCalledTimes(1);

      await service.stop();
      expect(client1.destroy).toHaveBeenCalledTimes(1);

      await service.start();
      expect(client2.login).toHaveBeenCalledTimes(1);
    });

    it('emitting error event is handled fail-open', async () => {
      const { service, client, warn } = createEnabledService();
      await service.start();

      client.emit('error', new Error('WebSocket connection reset'));

      expect(warn).toHaveBeenCalledWith(
        'Discord bot runtime error (fail-open)',
        expect.objectContaining({ error: 'WebSocket connection reset' }),
      );
    });

    it('emitting error event with non-Error value is handled', async () => {
      const { service, client, warn } = createEnabledService();
      await service.start();

      client.emit('error', 'string error value');

      expect(warn).toHaveBeenCalledWith(
        'Discord bot runtime error (fail-open)',
        expect.objectContaining({ error: 'string error value' }),
      );
    });

    it('stop() waits for in-flight start() to finish before stopping', async () => {
      const client = new MockDiscordClient();
      let loginResolve: () => void;
      client.login.mockImplementation(() =>
        new Promise<string>((resolve) => {
          loginResolve = () => resolve('logged_in');
        }),
      );

      const { service } = createEnabledService({ client });

      const startPromise = service.start();
      const stopPromise = service.stop();

      loginResolve!();
      await startPromise;
      await stopPromise;

      expect(client.login).toHaveBeenCalledTimes(1);
      expect(client.destroy).toHaveBeenCalledTimes(1);
    });

    it('createClient returning null prevents start without error', async () => {
      const warn = jest.fn();
      const service = new DiscordBotService({
        env: {
          DISCORD_BOT_ENABLED: 'true',
          DISCORD_BOT_TOKEN: 'token',
          DISCORD_BOT_GUILD_IDS: 'guild-1',
          DISCORD_BOT_CHANNEL_IDS: 'channel-1',
        },
        createClient: () => null,
        logger: { info: jest.fn(), warn },
      });

      await expect(service.start()).resolves.toBeUndefined();
      // No error logged — null client is a valid fail-open path
    });
  });

  // ──────────────────────────────────────────────────
  // Role Sync / Config Failure Edge Cases
  // ──────────────────────────────────────────────────

  describe('config and permission failures', () => {
    it('warns when guild IDs are empty', async () => {
      const warn = jest.fn();
      const clientFactory = jest.fn(() => new MockDiscordClient());
      const service = new DiscordBotService({
        env: {
          DISCORD_BOT_ENABLED: 'true',
          DISCORD_BOT_TOKEN: 'token',
          DISCORD_BOT_GUILD_IDS: '',
          DISCORD_BOT_CHANNEL_IDS: 'channel-1',
        },
        createClient: clientFactory,
        logger: { info: jest.fn(), warn },
      });

      await service.start();
      expect(clientFactory).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        'Discord bot enabled but guild/channel config invalid; continuing fail-open',
        expect.objectContaining({ guildCount: 0, channelCount: 1 }),
      );
    });

    it('warns when channel IDs are empty', async () => {
      const warn = jest.fn();
      const clientFactory = jest.fn(() => new MockDiscordClient());
      const service = new DiscordBotService({
        env: {
          DISCORD_BOT_ENABLED: 'true',
          DISCORD_BOT_TOKEN: 'token',
          DISCORD_BOT_GUILD_IDS: 'guild-1',
          DISCORD_BOT_CHANNEL_IDS: '',
        },
        createClient: clientFactory,
        logger: { info: jest.fn(), warn },
      });

      await service.start();
      expect(clientFactory).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        'Discord bot enabled but guild/channel config invalid; continuing fail-open',
        expect.objectContaining({ guildCount: 1, channelCount: 0 }),
      );
    });

    it('runtime config with enabled=false prevents start', async () => {
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

      service.setRuntimeConfig({
        enabled: false,
        token: 'token',
        guildIds: ['guild-1'],
        channelIds: ['channel-1'],
      });

      await service.start();
      expect(client.login).not.toHaveBeenCalled();
    });

    it('runtime config with null token prevents start', async () => {
      const warn = jest.fn();
      const client = new MockDiscordClient();
      const service = new DiscordBotService({
        env: {
          DISCORD_BOT_ENABLED: 'false',
          DISCORD_BOT_TOKEN: '',
          DISCORD_BOT_GUILD_IDS: '',
          DISCORD_BOT_CHANNEL_IDS: '',
        },
        createClient: () => client,
        logger: { info: jest.fn(), warn },
      });

      service.setRuntimeConfig({
        enabled: true,
        token: null,
        guildIds: ['guild-1'],
        channelIds: ['channel-1'],
      });

      await service.start();
      expect(client.login).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith('Discord bot enabled but token missing; continuing fail-open');
    });

    it('setRuntimeConfig(null) reverts to env-based config', async () => {
      const client = new MockDiscordClient();
      const service = new DiscordBotService({
        env: {
          DISCORD_BOT_ENABLED: 'true',
          DISCORD_BOT_TOKEN: 'env-token',
          DISCORD_BOT_GUILD_IDS: 'guild-1',
          DISCORD_BOT_CHANNEL_IDS: 'channel-1',
        },
        createClient: () => client,
        logger: { info: jest.fn(), warn: jest.fn() },
      });

      service.setRuntimeConfig({
        enabled: false,
        token: 'db-token',
        guildIds: ['guild-1'],
        channelIds: ['channel-1'],
      });

      // Runtime config disables — should not start
      await service.start();
      expect(client.login).not.toHaveBeenCalled();

      // Clear runtime config, reverts to env (enabled=true)
      service.setRuntimeConfig(null);
      await service.start();
      expect(client.login).toHaveBeenCalledWith('env-token');

      await service.stop();
    });

    it('runtime config deduplicates guild and channel IDs', async () => {
      const callback = jest.fn<void, [DiscordBotMessagePayload]>();
      const client = new MockDiscordClient();
      const service = new DiscordBotService({
        env: {
          DISCORD_BOT_ENABLED: 'false',
          DISCORD_BOT_TOKEN: '',
          DISCORD_BOT_GUILD_IDS: '',
          DISCORD_BOT_CHANNEL_IDS: '',
        },
        createClient: () => client,
        logger: { info: jest.fn(), warn: jest.fn() },
        onMessage: callback,
      });

      service.setRuntimeConfig({
        enabled: true,
        token: 'token',
        guildIds: ['guild-1', 'guild-1', ' guild-1 '],
        channelIds: ['channel-1', 'channel-1'],
      });

      await service.start();
      client.emit('messageCreate', buildMessage());

      expect(callback).toHaveBeenCalledTimes(1);
      await service.stop();
    });

    it('sendMessage with empty channel ID is rejected', async () => {
      const { service, warn } = createEnabledService();
      await service.start();

      const result = await service.sendMessage('', 'hello');
      expect(result).toBe(false);
      expect(warn).toHaveBeenCalledWith('Discord outbound send skipped because channel id is missing');
    });

    it('sendMessage with empty content is rejected', async () => {
      const { service, warn } = createEnabledService();
      await service.start();

      const result = await service.sendMessage('channel-1', '   ');
      expect(result).toBe(false);
      expect(warn).toHaveBeenCalledWith(
        'Discord outbound send skipped because message content is empty',
        expect.objectContaining({ channelId: 'channel-1' }),
      );
    });

    it('sendMessage returns false when bot is not connected', async () => {
      const { service, warn } = createEnabledService();
      // Don't call start() — bot is not connected

      const result = await service.sendMessage('channel-1', 'hello');
      expect(result).toBe(false);
      expect(warn).toHaveBeenCalledWith('Discord outbound send skipped because bot is not connected');
    });
  });

  // ──────────────────────────────────────────────────
  // Message Handler Edge Cases
  // ──────────────────────────────────────────────────

  describe('message handler resilience', () => {
    it('async message handler failure is caught fail-open', async () => {
      const warn = jest.fn();
      const asyncHandler = jest.fn().mockRejectedValue(new Error('handler crashed'));

      const { service, client } = createEnabledService({ onMessage: asyncHandler, warn });
      await service.start();

      client.emit('messageCreate', buildMessage());

      // Allow microtask to settle
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(asyncHandler).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        'Discord message async handler failed; continuing fail-open',
        expect.objectContaining({ error: 'handler crashed' }),
      );
    });

    it('handles malformed message objects without throwing', async () => {
      const callback = jest.fn();
      const { service, client } = createEnabledService({ onMessage: callback });
      await service.start();

      // null message — filtered out
      client.emit('messageCreate', null as unknown);
      // missing fields (no guildId) — filtered out
      client.emit('messageCreate', {} as unknown);
      // wrong guild — filtered out
      client.emit('messageCreate', { id: 'x', guildId: 'wrong-guild', channelId: 'channel-1', content: '', author: { id: 'u1' }, createdTimestamp: 0, editedTimestamp: null } as unknown);

      expect(callback).not.toHaveBeenCalled();
      await service.stop();
    });

    it('message with matching guild/channel but missing author defaults gracefully', async () => {
      const callback = jest.fn<void, [DiscordBotMessagePayload]>();
      const { service, client } = createEnabledService({ onMessage: callback });
      await service.start();

      // Missing author object — code defaults to empty authorId
      client.emit('messageCreate', { id: 'x', guildId: 'guild-1', channelId: 'channel-1', content: 'test', author: { id: '' }, createdTimestamp: 0, editedTimestamp: null } as unknown);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: '', authorIsBot: false }),
      );
      await service.stop();
    });

    it('bot messages from allowed channels are delivered (authorIsBot = true)', async () => {
      const callback = jest.fn<void, [DiscordBotMessagePayload]>();
      const { service, client } = createEnabledService({ onMessage: callback });
      await service.start();

      client.emit('messageCreate', buildMessage({ author: { id: 'bot-1', bot: true } }));

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ authorIsBot: true }),
      );
      await service.stop();
    });

    it('messages with very long content are delivered (truncation is on send, not receive)', async () => {
      const callback = jest.fn<void, [DiscordBotMessagePayload]>();
      const { service, client } = createEnabledService({ onMessage: callback });
      await service.start();

      const longContent = 'x'.repeat(5000);
      client.emit('messageCreate', buildMessage({ content: longContent }));

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].content).toBe(longContent);
      await service.stop();
    });

    it('sendMessage truncates outbound messages over 2000 chars', async () => {
      const { service, client } = createEnabledService();
      await service.start();

      const longMessage = 'A'.repeat(2500);
      await service.sendMessage('channel-1', longMessage);

      expect(client.send).toHaveBeenCalledTimes(1);
      const sentContent = (client.send.mock.calls[0][0] as { content: string }).content;
      expect(sentContent.length).toBe(2000);
      expect(sentContent.endsWith('...')).toBe(true);

      await service.stop();
    });

    it('setMessageHandler replaces the handler for subsequent messages', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const { service, client } = createEnabledService({ onMessage: handler1 });
      await service.start();

      client.emit('messageCreate', buildMessage({ id: 'msg-1' }));
      expect(handler1).toHaveBeenCalledTimes(1);

      service.setMessageHandler(handler2);
      client.emit('messageCreate', buildMessage({ id: 'msg-2' }));
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler1).toHaveBeenCalledTimes(1);

      await service.stop();
    });

    it('destroy failure during stop is caught fail-open', async () => {
      const client = new MockDiscordClient();
      client.destroy.mockImplementation(() => {
        throw new Error('destroy error');
      });

      const warn = jest.fn();
      const { service } = createEnabledService({ client, warn });
      await service.start();

      await expect(service.stop()).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        'Discord bot client destroy failed; continuing fail-open',
        expect.objectContaining({ error: 'destroy error' }),
      );
    });
  });
});
