import { openaiClient, CHAT_MODEL, MAX_TOKENS, TEMPERATURE } from '../config/openai';
import { getSystemPrompt } from './systemPrompt';
import { AI_FUNCTIONS } from './functions';
import { executeFunctionCall } from './functionHandlers';
import { supabase } from '../config/database';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

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
  const { sessionId, message, userId } = request;

  try {
    // Get or create session
    const session = await getOrCreateSession(sessionId, userId);

    // Get conversation history
    const history = await getConversationHistory(sessionId);

    // Build messages array
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: getSystemPrompt() },
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

    // Call OpenAI API with function calling
    let completion = await openaiClient.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      tools: AI_FUNCTIONS,
      tool_choice: 'auto',
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE
    });

    const functionCalls: any[] = [];
    let assistantMessage = completion.choices[0].message;

    // Handle function calling loop (max 5 iterations to prevent runaway costs)
    const MAX_FUNCTION_CALL_ITERATIONS = 5;
    let iterations = 0;

    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      iterations++;
      if (iterations > MAX_FUNCTION_CALL_ITERATIONS) {
        console.warn(`Function calling loop exceeded ${MAX_FUNCTION_CALL_ITERATIONS} iterations, breaking`);
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

        console.log(`Executing function: ${functionName}`, functionArgs);

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
          console.error(`Function ${functionName} failed:`, error);

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
      completion = await openaiClient.chat.completions.create({
        model: CHAT_MODEL,
        messages,
        tools: AI_FUNCTIONS,
        tool_choice: 'auto',
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE
      });

      assistantMessage = completion.choices[0].message;
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
      completion.usage?.total_tokens || 0
    );

    const responseTime = Date.now() - startTime;

    return {
      messageId: savedMessage.id,
      role: 'assistant',
      content: finalContent,
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      tokensUsed: completion.usage?.total_tokens || 0,
      responseTime: responseTime / 1000 // Convert to seconds
    };
  } catch (error: any) {
    console.error('Chat service error:', error);
    throw new Error(`Failed to process chat message: ${error.message}`);
  }
}

/**
 * Get or create a chat session
 */
async function getOrCreateSession(sessionId: string, userId: string) {
  // Try to get existing session
  const { data: existingSession, error: fetchError } = await supabase
    .from('ai_coach_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (existingSession) {
    return existingSession;
  }

  // Create new session
  const { data: newSession, error: createError } = await supabase
    .from('ai_coach_sessions')
    .insert({
      id: sessionId,
      user_id: userId,
      title: 'New Conversation', // Will be updated later with first message summary
      message_count: 0
    })
    .select()
    .single();

  if (createError) {
    throw new Error(`Failed to create session: ${createError.message}`);
  }

  return newSession;
}

/**
 * Get conversation history for a session
 */
async function getConversationHistory(sessionId: string, limit: number = 20): Promise<ChatMessage[]> {
  const { data: messages, error } = await supabase
    .from('ai_coach_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch conversation history:', error);
    return [];
  }

  return messages || [];
}

/**
 * Save a message to the database
 */
async function saveMessage(
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
  // Generate title from first message (truncate to 60 chars)
  const title = firstMessage.length > 60
    ? firstMessage.substring(0, 57) + '...'
    : firstMessage;

  const { error } = await supabase
    .from('ai_coach_sessions')
    .update({ title })
    .eq('id', sessionId);

  if (error) {
    console.error('Failed to update session title:', error);
  }
}

/**
 * Delete a session and all its messages
 */
export async function deleteSession(sessionId: string, userId: string) {
  // Verify session belongs to user
  const { data: session, error: fetchError } = await supabase
    .from('ai_coach_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !session) {
    throw new Error('Session not found or access denied');
  }

  // Delete session (CASCADE will delete messages)
  const { error: deleteError } = await supabase
    .from('ai_coach_sessions')
    .delete()
    .eq('id', sessionId);

  if (deleteError) {
    throw new Error(`Failed to delete session: ${deleteError.message}`);
  }

  return { success: true };
}
