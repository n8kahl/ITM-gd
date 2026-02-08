import { Response } from 'express';
import { logger } from '../lib/logger';
import { openaiClient, CHAT_MODEL, MAX_TOKENS, TEMPERATURE } from '../config/openai';
import { getSystemPrompt } from './systemPrompt';
import { AI_FUNCTIONS } from './functions';
import { executeFunctionCall } from './functionHandlers';
import { supabase } from '../config/database';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * Streaming Chat Service
 * Uses Server-Sent Events (SSE) to stream AI responses token-by-token.
 *
 * Event types:
 *   status   — phase updates (thinking, calling functions, generating)
 *   token    — individual text tokens as they arrive
 *   done     — final message with metadata (messageId, functionCalls, tokensUsed)
 *   error    — error occurred
 */

interface StreamRequest {
  sessionId: string;
  message: string;
  userId: string;
}

function sendSSE(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Stream a chat response via SSE
 */
export async function streamChatMessage(request: StreamRequest, res: Response): Promise<void> {
  const startTime = Date.now();
  const { sessionId, message, userId } = request;

  try {
    // Get or create session
    await getOrCreateSession(sessionId, userId);

    // Get conversation history
    const history = await getConversationHistory(sessionId);

    // Build messages array
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: getSystemPrompt() },
      ...history.map(msg => ({
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

    // First call — may include function calls
    let completion = await openaiClient.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      tools: AI_FUNCTIONS,
      tool_choice: 'auto',
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    let assistantMessage = completion.choices[0].message;
    const functionCalls: Array<{ function: string; arguments: Record<string, unknown>; result: unknown }> = [];
    let cumulativeTokens = completion.usage?.total_tokens || 0;

    // Handle function calling loop (max 5 iterations)
    let iterations = 0;
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      iterations++;
      if (iterations > 5) break;

      messages.push({
        role: 'assistant',
        content: assistantMessage.content || '',
        tool_calls: assistantMessage.tool_calls,
      });

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        sendSSE(res, 'status', { phase: 'calling', function: functionName });

        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await executeFunctionCall(
            { name: functionName, arguments: toolCall.function.arguments },
            { userId },
          );

          functionCalls.push({ function: functionName, arguments: args, result });
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
            content: JSON.stringify({ error: 'Function execution failed', message: errMsg }),
          });
        }
      }

      // Continue the conversation with function results
      completion = await openaiClient.chat.completions.create({
        model: CHAT_MODEL,
        messages,
        tools: AI_FUNCTIONS,
        tool_choice: 'auto',
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      });

      assistantMessage = completion.choices[0].message;
      cumulativeTokens += completion.usage?.total_tokens || 0;
      if (cumulativeTokens > 4000) break;
    }

    // Now stream the final response
    sendSSE(res, 'status', { phase: 'generating' });

    // If we already have the final content (from non-streaming call), stream it in chunks
    const finalContent = assistantMessage.content || 'I apologize, but I was unable to generate a response.';

    // Stream content in word-sized chunks for smooth rendering
    const words = finalContent.split(/(\s+)/);
    for (const word of words) {
      sendSSE(res, 'token', { content: word });
    }

    // Save assistant message to database
    const savedMessage = await saveMessage(
      sessionId,
      userId,
      'assistant',
      finalContent,
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

// ---- DB helpers (duplicated from chatService to keep streaming self-contained) ----

async function getOrCreateSession(sessionId: string, userId: string) {
  await supabase
    .from('ai_coach_sessions')
    .upsert(
      { id: sessionId, user_id: userId, title: 'New Conversation', message_count: 0 },
      { onConflict: 'id', ignoreDuplicates: true },
    );

  const { data: session, error } = await supabase
    .from('ai_coach_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !session) throw new Error('Session not found or access denied');
  return session;
}

async function getConversationHistory(sessionId: string, limit: number = 20) {
  const { data: messages } = await supabase
    .from('ai_coach_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);

  return messages || [];
}

async function saveMessage(
  sessionId: string,
  userId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  functionCall?: string | null,
  tokensUsed?: number,
) {
  const { data, error } = await supabase
    .from('ai_coach_messages')
    .insert({
      session_id: sessionId,
      user_id: userId,
      role,
      content,
      function_call: functionCall ? JSON.parse(functionCall) : null,
      tokens_used: tokensUsed || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save message: ${error.message}`);
  return data;
}

async function updateSessionTitle(sessionId: string, firstMessage: string) {
  const title = firstMessage.length > 60 ? firstMessage.substring(0, 57) + '...' : firstMessage;
  await supabase.from('ai_coach_sessions').update({ title }).eq('id', sessionId);
}
