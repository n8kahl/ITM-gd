import { logger } from '../lib/logger';
import { openaiClient, CHAT_MODEL, MAX_TOKENS, MAX_TOTAL_TOKENS_PER_REQUEST, TEMPERATURE } from '../config/openai';
import { AI_FUNCTIONS } from './functions';
import { executeFunctionCall } from './functionHandlers';
import { supabase } from '../config/database';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { openaiCircuit } from '../lib/circuitBreaker';
import { buildSystemPromptForUser } from './promptContext';

/**
 * Chat Service
 * Handles OpenAI API calls, function calling, and session management
 */

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  sessionId: string;
  message: string;
  userId: string;
  context?: {
    isMobile?: boolean;
  };
}

interface ChatResponse {
  messageId: string;
  role: 'assistant';
  content: string;
  functionCalls?: any[];
  tokensUsed: number;
  responseTime: number;
}

/**
 * Send a chat message and get AI response
 */
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const startTime = Date.now();
  const { sessionId, message, userId, context } = request;

  try {
    // Get or create session
    logger.info('getOrCreateSession', { sessionId, userId });
    await getOrCreateSession(sessionId, userId);

    // Get conversation history
    const history = await getConversationHistory(sessionId);
    logger.info('History loaded', { messageCount: history.length });

    // Build messages array
    const systemPrompt = await buildSystemPromptForUser(userId, {
      isMobile: context?.isMobile,
    });
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Save user message to database
    await saveMessage(sessionId, userId, 'user', message);

    // Auto-title session from first user message
    if (history.length === 0) {
      await updateSessionTitle(sessionId, message);
    }

    // Call OpenAI API with function calling via circuit breaker
    let completion = await openaiCircuit.execute(() => openaiClient.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      tools: AI_FUNCTIONS,
      tool_choice: 'auto',
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE
    }));

    const functionCalls: any[] = [];
    let assistantMessage = completion.choices[0].message;

    // Track cumulative token usage to enforce budget
    let cumulativeTokens = completion.usage?.total_tokens || 0;
    const MAX_TOTAL_TOKENS = MAX_TOTAL_TOKENS_PER_REQUEST; // Hard budget per request

    // Handle function calling loop (max 5 iterations to prevent runaway costs)
    const MAX_FUNCTION_CALL_ITERATIONS = 5;
    let iterations = 0;

    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      iterations++;
      if (iterations > MAX_FUNCTION_CALL_ITERATIONS) {
        logger.warn(`Function calling loop exceeded ${MAX_FUNCTION_CALL_ITERATIONS} iterations, breaking`);
        break;
      }

      // Push assistant message with tool_calls ONCE before processing results
      messages.push({
        role: 'assistant',
        content: assistantMessage.content || '',
        tool_calls: assistantMessage.tool_calls
      });

      // Execute all function calls and push tool results
      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = toolCall.function.arguments;

        logger.info(`Executing function: ${functionName}`, { functionArgs });

        try {
          const args = JSON.parse(functionArgs);

          const functionResult = await executeFunctionCall({
            name: functionName,
            arguments: functionArgs
          }, { userId });

          functionCalls.push({
            function: functionName,
            arguments: args,
            result: functionResult
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(functionResult)
          });
        } catch (error: any) {
          logger.error(`Function ${functionName} failed`, { error: error?.message || String(error) });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              error: 'Function execution failed',
              message: error.message
            })
          });
        }
      }

      // Call OpenAI again with function results
      completion = await openaiCircuit.execute(() => openaiClient.chat.completions.create({
        model: CHAT_MODEL,
        messages,
        tools: AI_FUNCTIONS,
        tool_choice: 'auto',
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE
      }));

      assistantMessage = completion.choices[0].message;

      // Track cumulative tokens
      cumulativeTokens += completion.usage?.total_tokens || 0;
      if (cumulativeTokens > MAX_TOTAL_TOKENS) {
        logger.warn(`Token budget exceeded: ${cumulativeTokens}/${MAX_TOTAL_TOKENS}`);
        break;
      }
    }

    // Extract final response
    const finalContent = assistantMessage.content || 'I apologize, but I was unable to generate a response.';

    // Save assistant message to database
    const savedMessage = await saveMessage(
      sessionId,
      userId,
      'assistant',
      finalContent,
      functionCalls.length > 0 ? JSON.stringify(functionCalls) : null,
      cumulativeTokens
    );

    const responseTime = Date.now() - startTime;

    return {
      messageId: savedMessage.id,
      role: 'assistant',
      content: finalContent,
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      tokensUsed: cumulativeTokens,
      responseTime: responseTime / 1000 // Convert to seconds
    };
  } catch (error: any) {
    logger.error('Chat service error', {
      name: error.name,
      message: error?.message || String(error),
      status: error.status,
      code: error.code,
      type: error.type,
    });
    throw error; // Re-throw original error so route can inspect it properly
  }
}

/**
 * Get or create a chat session using upsert to prevent race conditions
 */
export async function getOrCreateSession(sessionId: string, userId: string) {
  // Use upsert: INSERT ... ON CONFLICT DO NOTHING then SELECT
  const { error: upsertError } = await supabase
    .from('ai_coach_sessions')
    .upsert(
      {
        id: sessionId,
        user_id: userId,
        title: 'New Conversation',
        message_count: 0,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );

  if (upsertError) {
    throw new Error(`Failed to create/find session: ${upsertError.message}`);
  }

  // Now fetch the session (guaranteed to exist)
  const { data: session, error: fetchError } = await supabase
    .from('ai_coach_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    logger.error('Error fetching session', { error: fetchError.message });
    throw new Error(`Failed to fetch session: ${fetchError.message}`);
  }

  if (!session) {
    throw new Error('Session not found or access denied');
  }

  return session;
}

/**
 * Get conversation history for a session
 */
export async function getConversationHistory(sessionId: string, limit: number = 20): Promise<ChatMessage[]> {
  const { data: messages, error } = await supabase
    .from('ai_coach_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch conversation history', { error: error?.message || String(error) });
    return [];
  }

  return messages || [];
}

/**
 * Save a message to the database
 */
export async function saveMessage(
  sessionId: string,
  userId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  functionCall?: string | null,
  tokensUsed?: number
) {
  const { data, error } = await supabase
    .from('ai_coach_messages')
    .insert({
      session_id: sessionId,
      user_id: userId,
      role,
      content,
      function_call: functionCall ? JSON.parse(functionCall) : null,
      tokens_used: tokensUsed || null
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save message: ${error.message}`);
  }

  return data;
}

/**
 * Get recent sessions for a user
 */
export async function getUserSessions(userId: string, limit: number = 10) {
  const { data: sessions, error } = await supabase
    .from('ai_coach_sessions')
    .select('id, title, message_count, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  return sessions || [];
}

/**
 * Get messages for a specific session
 */
export async function getSessionMessages(
  sessionId: string,
  userId: string,
  limit: number = 50,
  offset: number = 0
) {
  // Verify session belongs to user
  const { data: session, error: sessionError } = await supabase
    .from('ai_coach_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (sessionError || !session) {
    throw new Error('Session not found or access denied');
  }

  const { data: messages, error, count } = await supabase
    .from('ai_coach_messages')
    .select('id, role, content, function_call, tokens_used, created_at', { count: 'exact' })
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  return {
    messages: (messages || []).map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      functionCalls: msg.function_call || undefined,
      tokensUsed: msg.tokens_used,
      timestamp: msg.created_at,
    })),
    total: count || 0,
    hasMore: (count || 0) > offset + limit,
  };
}

/**
 * Update session title based on first user message
 */
export async function updateSessionTitle(sessionId: string, firstMessage: string) {
  const title = firstMessage.length > 60
    ? firstMessage.substring(0, 57) + '...'
    : firstMessage;

  const { error } = await supabase
    .from('ai_coach_sessions')
    .update({ title })
    .eq('id', sessionId);

  if (error) {
    logger.error('Failed to update session title', { error: error?.message || String(error) });
  }
}

/**
 * Delete a session and all its messages
 */
export async function deleteSession(sessionId: string, userId: string) {
  const { data: session, error: fetchError } = await supabase
    .from('ai_coach_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !session) {
    throw new Error('Session not found or access denied');
  }

  const { error: deleteError } = await supabase
    .from('ai_coach_sessions')
    .delete()
    .eq('id', sessionId);

  if (deleteError) {
    throw new Error(`Failed to delete session: ${deleteError.message}`);
  }

  return { success: true };
}
