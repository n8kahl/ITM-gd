import type { DiscordBotMessagePayload } from '../discordBot';
import {
  classifyDiscordMessage,
  DiscordTradeStateMachine,
  parseDiscordMessage,
  parseDiscordMessageWithFallback,
  type DiscordSignalType,
} from '../messageParser';

function buildPayload(content: string, overrides?: Partial<DiscordBotMessagePayload>): DiscordBotMessagePayload {
  return {
    messageId: 'msg-1',
    guildId: 'guild-1',
    channelId: 'channel-1',
    authorId: 'user-1',
    authorIsBot: false,
    content,
    createdAt: '2026-03-01T15:00:00.000Z',
    editedAt: null,
    ...overrides,
  };
}

describe('services/discord/messageParser', () => {
  it('classifies supported pattern messages deterministically', () => {
    const cases: Array<{ text: string; expected: DiscordSignalType }> = [
      { text: 'prep SPX 5400c @ 1.20', expected: 'prep' },
      { text: 'ptf @ 1.35', expected: 'ptf' },
      { text: 'pft @ 1.35', expected: 'ptf' },
      { text: 'filled avg 1.28', expected: 'filled_avg' },
      { text: 'trim 25%', expected: 'trim' },
      { text: 'stops 0.95', expected: 'stops' },
      { text: 'move to b/e 1.10', expected: 'breakeven' },
      { text: 'trail 1.30', expected: 'trail' },
      { text: 'exit above 5420', expected: 'exit_above' },
      { text: 'exit below 5380', expected: 'exit_below' },
      { text: 'fully out', expected: 'fully_out' },
      { text: 'fully sold', expected: 'fully_out' },
    ];

    for (const testCase of cases) {
      expect(classifyDiscordMessage(testCase.text)).toBe(testCase.expected);
    }
  });

  it('extracts symbol/strike/type/price/percent/level when present', () => {
    const prepSignal = parseDiscordMessage(buildPayload('prep SPX 5400c @ 1.25'));
    expect(prepSignal.fields.symbol).toBe('SPX');
    expect(prepSignal.fields.strike).toBe(5400);
    expect(prepSignal.fields.optionType).toBe('call');
    expect(prepSignal.fields.price).toBe(1.25);

    const trimSignal = parseDiscordMessage(buildPayload('trim 33%'));
    expect(trimSignal.fields.percent).toBe(33);

    const exitSignal = parseDiscordMessage(buildPayload('exit above 5421.5'));
    expect(exitSignal.fields.level).toBe(5421.5);
  });

  it('invokes fallback for unsupported phrasing and uses validated fallback output', async () => {
    const fallbackRunner = jest.fn(async () => ({
      signalType: 'prep',
      fields: {
        symbol: 'SPX',
        strike: '5405',
        optionType: 'call',
        price: '1.34',
        percent: null,
        level: null,
      },
    }));

    const parsed = await parseDiscordMessageWithFallback(
      buildPayload('looking to stage this one around 1.34 on spx 5405c'),
      {
        runFallback: fallbackRunner,
        logger: { warn: jest.fn() },
      },
    );

    expect(fallbackRunner).toHaveBeenCalledTimes(1);
    expect(parsed.signalType).toBe('prep');
    expect(parsed.fields.symbol).toBe('SPX');
    expect(parsed.fields.strike).toBe(5405);
    expect(parsed.fields.optionType).toBe('call');
    expect(parsed.fields.price).toBe(1.34);
  });

  it('does not invoke fallback when deterministic parser already classifies message', async () => {
    const fallbackRunner = jest.fn(async () => ({
      signalType: 'commentary',
      fields: {},
    }));

    const parsed = await parseDiscordMessageWithFallback(
      buildPayload('prep SPX 5400c @ 1.20'),
      {
        runFallback: fallbackRunner,
        logger: { warn: jest.fn() },
      },
    );

    expect(parsed.signalType).toBe('prep');
    expect(fallbackRunner).not.toHaveBeenCalled();
  });

  it('handles invalid fallback schema response safely and returns deterministic output', async () => {
    const fallbackRunner = jest.fn(async () => ({
      unknown: true,
      payload: 'bad-shape',
    }));
    const warn = jest.fn();
    const payload = buildPayload('watching this tape for a cleaner entry');

    const parsed = await parseDiscordMessageWithFallback(payload, {
      runFallback: fallbackRunner,
      logger: { warn },
    });

    expect(fallbackRunner).toHaveBeenCalledTimes(1);
    expect(parsed.signalType).toBe('commentary');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('handles fallback transport errors safely and returns deterministic output', async () => {
    const fallbackRunner = jest.fn(async () => {
      throw new Error('timeout');
    });
    const warn = jest.fn();
    const payload = buildPayload('monitoring this one for confirmation');

    const parsed = await parseDiscordMessageWithFallback(payload, {
      runFallback: fallbackRunner,
      logger: { warn },
    });

    expect(fallbackRunner).toHaveBeenCalledTimes(1);
    expect(parsed.signalType).toBe('commentary');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('supports valid IDLE -> STAGED -> ACTIVE -> CLOSED lifecycle transitions', () => {
    const machine = new DiscordTradeStateMachine();

    const staged = machine.ingest(parseDiscordMessage(buildPayload('prep SPX 5400c @ 1.20')));
    expect(staged.previousState).toBe('IDLE');
    expect(staged.nextState).toBe('STAGED');
    expect(staged.transition).toBe('staged');

    const active = machine.ingest(parseDiscordMessage(buildPayload('ptf @ 1.25')));
    expect(active.previousState).toBe('STAGED');
    expect(active.nextState).toBe('ACTIVE');
    expect(active.transition).toBe('activated');

    const mutated = machine.ingest(parseDiscordMessage(buildPayload('trim 20%')));
    expect(mutated.previousState).toBe('ACTIVE');
    expect(mutated.nextState).toBe('ACTIVE');
    expect(mutated.transition).toBe('mutated');

    const closed = machine.ingest(parseDiscordMessage(buildPayload('fully out')));
    expect(closed.previousState).toBe('ACTIVE');
    expect(closed.nextState).toBe('CLOSED');
    expect(closed.transition).toBe('closed');
  });

  it('implicitly closes active trade when a new PREP arrives', () => {
    const machine = new DiscordTradeStateMachine();
    machine.ingest(parseDiscordMessage(buildPayload('prep SPX 5400c @ 1.20')));
    machine.ingest(parseDiscordMessage(buildPayload('filled avg 1.22')));

    const result = machine.ingest(parseDiscordMessage(buildPayload('prep SPX 5410p @ 1.10')));
    expect(result.previousState).toBe('ACTIVE');
    expect(result.nextState).toBe('STAGED');
    expect(result.transition).toBe('implicit_close_and_staged');
    expect(result.implicitlyClosedTrade).toBe(true);
  });

  it('treats unknown text as commentary and does not throw', () => {
    const payload = buildPayload('just watching price action here');

    expect(() => parseDiscordMessage(payload)).not.toThrow();
    const parsed = parseDiscordMessage(payload);
    expect(parsed.signalType).toBe('commentary');

    const machine = new DiscordTradeStateMachine();
    expect(() => machine.ingest(parsed)).not.toThrow();
    const result = machine.ingest(parsed);
    expect(result.transition).toBe('ignored');
    expect(result.nextState).toBe('IDLE');
  });
});
