import { Response } from 'express';
import { streamChatMessage } from '../streamService';

const mockCircuitExecute = jest.fn();
const mockBuildSystemPromptForUser = jest.fn();
const mockExecuteFunctionCall = jest.fn();
const mockGetOrCreateSession = jest.fn();
const mockGetConversationHistory = jest.fn();
const mockSaveMessage = jest.fn();
const mockUpdateSessionTitle = jest.fn();

jest.mock('../../lib/circuitBreaker', () => ({
  openaiCircuit: {
    execute: (...args: any[]) => mockCircuitExecute(...args),
  },
}));

jest.mock('../../config/openai', () => ({
  openaiClient: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
  CHAT_MODEL: 'gpt-4o',
  MAX_TOKENS: 1000,
  MAX_TOTAL_TOKENS_PER_REQUEST: 4000,
  TEMPERATURE: 0.7,
}));

jest.mock('../promptContext', () => ({
  buildSystemPromptForUser: (...args: any[]) => mockBuildSystemPromptForUser(...args),
}));

jest.mock('../functionHandlers', () => ({
  executeFunctionCall: (...args: any[]) => mockExecuteFunctionCall(...args),
}));

jest.mock('../chatService', () => ({
  getOrCreateSession: (...args: any[]) => mockGetOrCreateSession(...args),
  getConversationHistory: (...args: any[]) => mockGetConversationHistory(...args),
  saveMessage: (...args: any[]) => mockSaveMessage(...args),
  updateSessionTitle: (...args: any[]) => mockUpdateSessionTitle(...args),
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function createAsyncStream(chunks: unknown[]): AsyncIterable<unknown> {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

function createResponseMock() {
  const writes: string[] = [];
  const res = {
    write: jest.fn((value: string) => {
      writes.push(value);
      return true;
    }),
  } as unknown as Response;

  return { res, writes };
}

function parseSseWrites(writes: string[]): Array<{ event: string; data: any }> {
  const events: Array<{ event: string; data: any }> = [];
  for (const write of writes) {
    const lines = write
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const eventLine = lines.find((line) => line.startsWith('event: '));
    const dataLine = lines.find((line) => line.startsWith('data: '));
    if (!eventLine || !dataLine) continue;

    events.push({
      event: eventLine.slice('event: '.length),
      data: JSON.parse(dataLine.slice('data: '.length)),
    });
  }
  return events;
}

describe('streamService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOrCreateSession.mockResolvedValue({});
    mockGetConversationHistory.mockResolvedValue([]);
    mockBuildSystemPromptForUser.mockResolvedValue('system prompt');
    mockUpdateSessionTitle.mockResolvedValue(undefined);
    mockSaveMessage.mockImplementation(async (_sessionId: string, _userId: string, role: string) => ({
      id: role === 'assistant' ? 'assistant-msg-id' : 'user-msg-id',
    }));
  });

  it('streams token deltas and emits done payload', async () => {
    mockCircuitExecute.mockResolvedValueOnce(createAsyncStream([
      {
        choices: [{ delta: { content: 'Hel' } }],
      },
      {
        choices: [{ delta: { content: 'lo' } }],
      },
      {
        choices: [],
        usage: { total_tokens: 123 },
      },
    ]));

    const { res, writes } = createResponseMock();

    await streamChatMessage({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      message: 'Hello',
      userId: '11111111-1111-4111-8111-111111111111',
    }, res);

    const events = parseSseWrites(writes);
    const tokenEvents = events.filter((event) => event.event === 'token');
    const doneEvent = events.find((event) => event.event === 'done');

    expect(tokenEvents.map((event) => event.data.content).join('')).toBe('Hello');
    expect(doneEvent).toBeDefined();
    expect(doneEvent?.data.tokensUsed).toBe(123);
    expect(mockSaveMessage).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      '11111111-1111-4111-8111-111111111111',
      'assistant',
      'Hello',
      null,
      123,
    );
  });

  it('handles tool call iteration before final response', async () => {
    mockCircuitExecute
      .mockResolvedValueOnce(createAsyncStream([
        {
          choices: [{
            delta: {
              tool_calls: [{
                index: 0,
                id: 'call_1',
                function: { name: 'get_current_price', arguments: '{\"symbol\":\"SPY\"}' },
              }],
            },
          }],
        },
        {
          choices: [],
          usage: { total_tokens: 80 },
        },
      ]))
      .mockResolvedValueOnce(createAsyncStream([
        {
          choices: [{ delta: { content: 'Done' } }],
        },
        {
          choices: [],
          usage: { total_tokens: 40 },
        },
      ]));

    mockExecuteFunctionCall.mockResolvedValue({ symbol: 'SPY', price: 450.12 });

    const { res, writes } = createResponseMock();

    await streamChatMessage({
      sessionId: '550e8400-e29b-41d4-a716-446655440001',
      message: 'Price check',
      userId: '11111111-1111-4111-8111-111111111112',
    }, res);

    const events = parseSseWrites(writes);
    const callingEvent = events.find((event) => event.event === 'status' && event.data.phase === 'calling');
    const doneEvent = events.find((event) => event.event === 'done');

    expect(mockExecuteFunctionCall).toHaveBeenCalledTimes(1);
    expect(callingEvent).toBeDefined();
    expect(doneEvent?.data.tokensUsed).toBe(120);
    expect(doneEvent?.data.functionCalls).toHaveLength(1);
  });
});
