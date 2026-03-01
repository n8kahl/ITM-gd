import {
  buildReplayJournalEntries,
  type ReplayJournalBuildInput,
  type ReplaySessionMessage,
  type ReplaySessionSnapshot,
  type ReplaySessionTrade,
} from '../replayJournalBuilder';

function makeTrade(overrides: Partial<ReplaySessionTrade> = {}): ReplaySessionTrade {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    tradeIndex: 1,
    contract: {
      symbol: 'SPX',
      strike: 6030,
      type: 'call',
      expiry: '2026-03-01',
    },
    entry: {
      direction: 'long',
      price: 1.2,
      timestamp: '2026-03-01T14:35:00.000Z',
      sizing: 'starter',
    },
    stop: { initial: 0.9 },
    targets: { target1: 1.8, target2: 2.4 },
    thesis: {
      text: 'Break over opening range high.',
      entryCondition: 'Hold above 6028.',
    },
    lifecycle: {
      events: [{ type: 'trim', at: '2026-03-01T14:42:00.000Z' }],
    },
    outcome: {
      finalPnlPct: 12.5,
      isWinner: true,
      fullyExited: true,
      exitTimestamp: '2026-03-01T14:58:00.000Z',
    },
    entrySnapshotId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    ...overrides,
  };
}

function makeMessages(overrides: ReplaySessionMessage[] = []): ReplaySessionMessage[] {
  return [
    {
      id: 'msg-1',
      content: 'Thesis: hold 6028 then press calls.',
      sentAt: '2026-03-01T14:31:00.000Z',
      signalType: 'thesis',
      parsedTradeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
    {
      id: 'msg-2',
      content: 'Filled AVG 1.20',
      sentAt: '2026-03-01T14:35:00.000Z',
      signalType: 'filled_avg',
      parsedTradeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
    {
      id: 'msg-3',
      content: 'Trim 25%',
      sentAt: '2026-03-01T14:42:00.000Z',
      signalType: 'trim',
      parsedTradeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
    {
      id: 'msg-4',
      content: 'Fully out +12.5%',
      sentAt: '2026-03-01T14:58:00.000Z',
      signalType: 'exit_above',
      parsedTradeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
    ...overrides,
  ];
}

function makeSnapshots(overrides: ReplaySessionSnapshot[] = []): ReplaySessionSnapshot[] {
  return [
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      symbol: 'SPX',
      captured_at: '2026-03-01T14:34:00.000Z',
      rr_ratio: 1.4,
      ev_r: 0.55,
      mtf_composite: 0.7,
      mtf_aligned: true,
      regime: 'trending',
      regime_direction: 'bullish',
      env_gate_passed: true,
      vix_value: 18.2,
      memory_setup_type: 'orb_breakout',
      spx_price: 6031.5,
    },
    {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      symbol: 'SPX',
      captured_at: '2026-03-01T14:43:00.000Z',
      rr_ratio: 1.8,
      ev_r: 0.8,
      mtf_composite: 0.9,
      mtf_aligned: true,
      regime: 'trending',
      regime_direction: 'bullish',
      env_gate_passed: true,
      vix_value: 18.4,
      memory_setup_type: 'orb_breakout',
      spx_price: 6034.1,
    },
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      symbol: 'SPX',
      captured_at: '2026-03-01T14:58:00.000Z',
      rr_ratio: 2.1,
      ev_r: 1.1,
      mtf_composite: 1.2,
      mtf_aligned: true,
      regime: 'trending',
      regime_direction: 'bullish',
      env_gate_passed: true,
      vix_value: 18.6,
      memory_setup_type: 'orb_breakout',
      spx_price: 6041.2,
    },
    ...overrides,
  ];
}

function makeInput(overrides: Partial<ReplayJournalBuildInput> = {}): ReplayJournalBuildInput {
  return {
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    session: {
      sessionId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      sessionDate: '2026-03-01',
      symbol: 'SPX',
      channelId: 'channel-1',
      channelName: 'SPX Premium',
      caller: 'Nate',
      sessionStart: '2026-03-01T14:30:00.000Z',
      sessionEnd: '2026-03-01T15:10:00.000Z',
      sessionSummary: 'Strong trend continuation.',
    },
    trades: [makeTrade()],
    messages: makeMessages(),
    snapshots: makeSnapshots(),
    ...overrides,
  };
}

describe('replayJournalBuilder', () => {
  it('builds deterministic replay journal payloads with replay backlinks', () => {
    const input = makeInput();
    const first = buildReplayJournalEntries(input);
    const second = buildReplayJournalEntries(input);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0]?.payload.id).toBe(second[0]?.payload.id);
    expect(first[0]?.payload.import_id).toBe(second[0]?.payload.import_id);
    expect(first[0]?.payload.symbol).toBe('SPX');
    expect(first[0]?.payload.direction).toBe('long');
    expect(first[0]?.payload.contract_type).toBe('call');
    expect(first[0]?.payload.pnl_percentage).toBe(12.5);
    expect(first[0]?.payload.is_open).toBe(false);
    expect(first[0]?.replayBacklink).toContain('sessionId=ffffffff-ffff-4fff-8fff-ffffffffffff');
    expect(first[0]?.replayBacklink).toContain('parsedTradeId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(first[0]?.payload.execution_notes).toContain('Replay backlink:');
    expect(first[0]?.payload.execution_notes).toContain('Entry confluence:');
    expect(first[0]?.payload.setup_type).toBe('orb_breakout');
    expect(first[0]?.payload.underlying_at_entry).toBe(6031.5);
    expect(first[0]?.payload.underlying_at_exit).toBe(6041.2);
  });

  it('handles missing thesis and partial snapshots without throwing', () => {
    const input = makeInput({
      trades: [
        makeTrade({
          thesis: {
            text: null,
            entryCondition: null,
          },
          entrySnapshotId: null,
        }),
      ],
      snapshots: [
        {
          id: 'snap-partial',
          symbol: 'SPX',
          captured_at: '2026-03-01T14:35:00.000Z',
          rr_ratio: null,
          ev_r: null,
          mtf_composite: null,
          mtf_aligned: null,
          spx_price: null,
        },
      ],
    });

    const built = buildReplayJournalEntries(input);
    expect(built).toHaveLength(1);
    expect(built[0]?.payload.setup_notes).toContain('Transcript thesis context');
    expect(built[0]?.payload.execution_notes).toContain('Entry confluence:');
    expect(built[0]?.payload.execution_notes).toContain('rr=n/a');
    expect(built[0]?.payload.setup_type).toBeNull();
    expect(built[0]?.payload.underlying_at_entry).toBeNull();
    expect(built[0]?.payload.underlying_at_exit).toBeNull();
  });

  it('remains null-safe when confluence snapshots are missing entirely', () => {
    const input = makeInput({
      snapshots: [],
      messages: [],
      trades: [
        makeTrade({
          thesis: undefined,
          lifecycle: { events: [] },
          outcome: {
            finalPnlPct: null,
            isWinner: null,
            fullyExited: false,
            exitTimestamp: null,
          },
        }),
      ],
    });

    const built = buildReplayJournalEntries(input);
    expect(built).toHaveLength(1);
    expect(built[0]?.payload.pnl).toBeNull();
    expect(built[0]?.payload.exit_price).toBeNull();
    expect(built[0]?.payload.execution_notes).toContain('Entry confluence: capturedAt=n/a');
    expect(built[0]?.payload.execution_notes).toContain('Management confluence: capturedAt=n/a');
    expect(built[0]?.payload.execution_notes).toContain('Exit confluence: capturedAt=n/a');
    expect(built[0]?.payload.market_context).toEqual({
      replay_session: {
        session_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        session_date: '2026-03-01',
        channel_id: 'channel-1',
        channel_name: 'SPX Premium',
        caller: 'Nate',
      },
      confluence: {
        entry: expect.objectContaining({ rrRatio: null, evR: null }),
        management: expect.objectContaining({ rrRatio: null, evR: null }),
        exit: expect.objectContaining({ rrRatio: null, evR: null }),
      },
    });
  });
});
