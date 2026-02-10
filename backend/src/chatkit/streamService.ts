import { Response } from 'express';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { logger } from '../lib/logger';
import {
  openaiClient,
  CHAT_MODEL,
  MAX_TOKENS,
  MAX_TOTAL_TOKENS_PER_REQUEST,
  TEMPERATURE,
} from '../config/openai';
import { AI_FUNCTIONS } from './functions';
import { executeFunctionCall } from './functionHandlers';
import { openaiCircuit } from '../lib/circuitBreaker';
import { buildSystemPromptForUser } from './promptContext';
import {
  getConversationHistory,
  getOrCreateSession,
  saveMessage,
  updateSessionTitle,
} from './chatService';

/**
 * Streaming Chat Service
 * Uses Server-Sent Events (SSE) to stream AI responses token-by-token.
 *
 * Event types:
 *   status   — phase updates (thinking, calling functions, generating)
 *   token    — text deltas as they arrive from OpenAI
 *   done     — final message with metadata (messageId, functionCalls, tokensUsed)
 *   error    — error occurred
 */

interface StreamRequest {
  sessionId: string;
  message: string;
  userId: string;
  context?: {
    isMobile?: boolean;
  };
}

interface StreamToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

interface StreamToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface StreamIterationResult {
  content: string;
  toolCalls: StreamToolCall[];
  tokensUsed: number;
}

function sendSSE(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function runStreamingIteration(
  messages: ChatCompletionMessageParam[],
  res: Response,
): Promise<StreamIterationResult> {
  const stream = await openaiCircuit.execute(() => openaiClient.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    tools: AI_FUNCTIONS,
    tool_choice: 'auto',
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    stream: true,
    stream_options: {
      include_usage: true,
    },
  }));

  let content = '';
  let tokensUsed = 0;
  const toolCallsByIndex = new Map<number, StreamToolCallAccumulator>();

  for await (const chunk of stream) {
    if (typeof chunk.usage?.total_tokens === 'number') {
      tokensUsed = chunk.usage.total_tokens;
    }

    const choice = chunk.choices[0];
    if (!choice) continue;

    const delta = choice.delta;
    if (delta.content) {
      content += delta.content;
      sendSSE(res, 'token', { content: delta.content });
    }

    if (delta.tool_calls && delta.tool_calls.length > 0) {
      for (const toolCallDelta of delta.tool_calls) {
        const index = typeof toolCallDelta.index === 'number' ? toolCallDelta.index : 0;
        const existing = toolCallsByIndex.get(index) || { id: '', name: '', arguments: '' };

        if (typeof toolCallDelta.id === 'string') {
          existing.id = toolCallDelta.id;
        }
        if (typeof toolCallDelta.function?.name === 'string') {
          existing.name = toolCallDelta.function.name;
        }
        if (typeof toolCallDelta.function?.arguments === 'string') {
          existing.arguments += toolCallDelta.function.arguments;
        }

        toolCallsByIndex.set(index, existing);
      }
    }
  }

  const toolCalls: StreamToolCall[] = Array.from(toolCallsByIndex.values())
    .filter((toolCall) => toolCall.id && toolCall.name)
    .map((toolCall) => ({
      id: toolCall.id,
      type: 'function',
      function: {
        name: toolCall.name,
        arguments: toolCall.arguments || '{}',
      },
    }));

  return {
    content,
    toolCalls,
    tokensUsed,
  };
}

/**
 * Stream a chat response via SSE
 */
export async function streamChatMessage(request: StreamRequest, res: Response): Promise<void> {
  const startTime = Date.now();
  const { sessionId, message, userId, context } = request;

  const MAX_FUNCTION_CALL_ITERATIONS = 5;
  const functionCalls: Array<{ function: string; arguments: Record<string, unknown>; result: unknown }> = [];
  let cumulativeTokens = 0;

  try {
    // Get or create session
    await getOrCreateSession(sessionId, userId);

    // Get conversation history
    const history = await getConversationHistory(sessionId);

    const systemPrompt = await buildSystemPromptForUser(userId, {
      isMobile: context?.isMobile,
    });

    // Build messages array
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Save user message
    await saveMessage(sessionId, userId, 'user', message);

    // Auto-title session from first message
    if (history.length === 0) {
      await updateSessionTitle(sessionId, message);
    }

    sendSSE(res, 'status', { phase: 'thinking' });

    let iteration = 0;
    let finalContent: string | null = null;

    while (iteration <= MAX_FUNCTION_CALL_ITERATIONS) {
      sendSSE(res, 'status', { phase: 'generating' });

      const streamed = await runStreamingIteration(messages, res);
      cumulativeTokens += streamed.tokensUsed;

      if (!streamed.toolCalls.length) {
        finalContent = streamed.content || 'I apologize, but I was unable to generate a response.';
        break;
      }

      if (streamed.content.trim().length > 0) {
        sendSSE(res, 'status', { phase: 'thinking', resetContent: true });
      }

      messages.push({
        role: 'assistant',
        content: streamed.content || '',
        tool_calls: streamed.toolCalls as any,
      });

      for (const toolCall of streamed.toolCalls) {
        const functionName = toolCall.function.name;
        sendSSE(res, 'status', { phase: 'calling', function: functionName });

        try {
          const parsedArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          const result = await executeFunctionCall(
            { name: functionName, arguments: toolCall.function.arguments },
            { userId },
          );

          functionCalls.push({
            function: functionName,
            arguments: parsedArgs,
            result,
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          logger.error(`Function ${functionName} failed`, { error: errMsg });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              error: 'Function execution failed',
              message: errMsg,
            }),
          });
        }
      }

      if (cumulativeTokens > MAX_TOTAL_TOKENS_PER_REQUEST) {
        finalContent = 'I hit the response budget while gathering data. Please retry with a narrower request.';
        break;
      }

      iteration += 1;
      if (iteration > MAX_FUNCTION_CALL_ITERATIONS) {
        finalContent = 'I reached the function-call limit for this request. Please retry with a more specific question.';
        break;
      }

      sendSSE(res, 'status', { phase: 'thinking' });
    }

    const safeFinalContent = finalContent || 'I apologize, but I was unable to generate a response.';

    // Save assistant message to database
    const savedMessage = await saveMessage(
      sessionId,
      userId,
      'assistant',
      safeFinalContent,
      functionCalls.length > 0 ? JSON.stringify(functionCalls) : null,
      cumulativeTokens,
    );

    const responseTime = Date.now() - startTime;

    sendSSE(res, 'done', {
      messageId: savedMessage.id,
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      tokensUsed: cumulativeTokens,
      responseTime: responseTime / 1000,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Stream chat error', { error: errMsg });
    sendSSE(res, 'error', { message: 'Failed to process message. Please try again.' });
  }
}
