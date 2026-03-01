import type { ParsedDiscordSignal, DiscordSignalType } from '../messageParser';
import {
  DiscordBroadcasterService,
  mapDiscordSignalToEventKind,
} from '../discordBroadcaster';

interface MockRealtimeChannel {
  send: jest.Mock<Promise<string>, [unknown]>;
}

interface MockRealtimeClient {
  channel: jest.Mock<MockRealtimeChannel, [string]>;
}

function createMockRealtime(sendImpl?: (input: unknown) => Promise<string>): {
  realtime: MockRealtimeClient;
  channel: MockRealtimeChannel;
} {
  const channel: MockRealtimeChannel = {
    send: jest.fn(sendImpl ?? (async () => 'ok')),
  };
  const realtime: MockRealtimeClient = {
    channel: jest.fn((_name: string) => channel),
  };
  return { realtime, channel };
}

function buildSignal(signalType: DiscordSignalType, overrides?: Partial<ParsedDiscordSignal>): ParsedDiscordSignal {
  return {
    messageId: 'msg-1',
    guildId: 'guild-1',
    channelId: 'channel-42',
    authorId: 'author-1',
    authorIsBot: false,
    content: 'payload',
    createdAt: '2026-03-01T15:00:00.000Z',
    editedAt: null,
    signalType,
    fields: {
      symbol: 'SPX',
      strike: 5400,
      optionType: 'call',
      price: 1.2,
      percent: null,
      level: null,
    },
    ...overrides,
  };
}

describe('services/discord/discordBroadcaster', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps parser signal types to expected realtime event kinds', () => {
    expect(mapDiscordSignalToEventKind('prep')).toBe('discord_prep');
    expect(mapDiscordSignalToEventKind('ptf')).toBe('discord_fill');
    expect(mapDiscordSignalToEventKind('filled_avg')).toBe('discord_fill');
    expect(mapDiscordSignalToEventKind('trim')).toBe('discord_trim');
    expect(mapDiscordSignalToEventKind('stops')).toBe('discord_stop');
    expect(mapDiscordSignalToEventKind('breakeven')).toBe('discord_stop');
    expect(mapDiscordSignalToEventKind('trail')).toBe('discord_stop');
    expect(mapDiscordSignalToEventKind('exit_above')).toBe('discord_exit');
    expect(mapDiscordSignalToEventKind('exit_below')).toBe('discord_exit');
    expect(mapDiscordSignalToEventKind('fully_out')).toBe('discord_exit');
    expect(mapDiscordSignalToEventKind('commentary')).toBe('discord_commentary');
  });

  it('uses discord_calls:{channelId} naming and sends expected broadcast payload', async () => {
    const { realtime, channel } = createMockRealtime();
    const service = new DiscordBroadcasterService({
      realtime,
      logger: { warn: jest.fn() },
    });

    await service.broadcast(buildSignal('prep'));

    expect(realtime.channel).toHaveBeenCalledWith('discord_calls:channel-42');
    expect(channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'discord_prep',
      payload: {
        messageId: 'msg-1',
        guildId: 'guild-1',
        channelId: 'channel-42',
        authorId: 'author-1',
        createdAt: '2026-03-01T15:00:00.000Z',
        signalType: 'prep',
        fields: {
          symbol: 'SPX',
          strike: 5400,
          optionType: 'call',
          price: 1.2,
          percent: null,
          level: null,
        },
      },
    });
  });

  it('logs and swallows send failure status', async () => {
    const warn = jest.fn();
    const { realtime } = createMockRealtime(async () => 'error');
    const service = new DiscordBroadcasterService({
      realtime,
      logger: { warn },
    });

    await expect(service.broadcast(buildSignal('trim'))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      'Discord broadcast returned non-ok status; continuing fail-open',
      expect.objectContaining({
        status: 'error',
        channelName: 'discord_calls:channel-42',
        eventKind: 'discord_trim',
      }),
    );
  });

  it('logs and swallows realtime transport errors', async () => {
    const warn = jest.fn();
    const { realtime } = createMockRealtime(async () => {
      throw new Error('realtime down');
    });
    const service = new DiscordBroadcasterService({
      realtime,
      logger: { warn },
    });

    await expect(service.broadcast(buildSignal('commentary'))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      'Discord broadcast failed; continuing fail-open',
      expect.objectContaining({
        error: 'realtime down',
        channelName: 'discord_calls:channel-42',
        eventKind: 'discord_commentary',
      }),
    );
  });
});
