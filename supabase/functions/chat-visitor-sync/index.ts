import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || 'https://www.tradeinthemoney.com').split(',')
const MAX_CONVERSATION_TOKEN_LENGTH = 256
const MAX_SYNC_MESSAGES = 200
const ALLOW_BOOTSTRAP_WITH_VISITOR_ID = Deno.env.get('CHAT_SYNC_ALLOW_BOOTSTRAP') === 'true'

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function validateConversationId(id: string | null | undefined): void {
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Invalid conversationId format')
  }
}

function validateConversationToken(token: string | null | undefined): void {
  if (!token) return
  if (typeof token !== 'string') {
    throw new Error('conversationToken is invalid')
  }
  if (token.length > MAX_CONVERSATION_TOKEN_LENGTH) {
    throw new Error('conversationToken is too long')
  }
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  return new Date(time).toISOString()
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function generateConversationToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID().replace(/-/g, '')}`
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const { conversationId, conversationToken, since, visitorId } = await req.json()

    validateConversationId(conversationId)
    validateConversationToken(conversationToken)
    const normalizedSince = normalizeTimestamp(since)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: conversation, error: conversationError } = await supabase
      .from('chat_conversations')
      .select('id, visitor_id, ai_handled, escalation_reason, status, updated_at, last_message_at, access_token_hash')
      .eq('id', conversationId)
      .maybeSingle()

    if (conversationError) throw conversationError
    if (!conversation) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    let issuedConversationToken: string | null = null

    if (conversationToken) {
      const providedTokenHash = await sha256Hex(conversationToken)
      if (!conversation.access_token_hash || providedTokenHash !== conversation.access_token_hash) {
        return new Response(
          JSON.stringify({ error: 'Invalid conversation token' }),
          { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
        )
      }

      if (typeof visitorId === 'string' && visitorId.length > 0 && conversation.visitor_id !== visitorId) {
        return new Response(
          JSON.stringify({ error: 'Conversation visitor mismatch' }),
          { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      if (!ALLOW_BOOTSTRAP_WITH_VISITOR_ID) {
        return new Response(
          JSON.stringify({ error: 'conversationToken is required' }),
          { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
        )
      }

      if (typeof visitorId !== 'string' || visitorId.length === 0 || conversation.visitor_id !== visitorId) {
        return new Response(
          JSON.stringify({ error: 'Conversation visitor mismatch' }),
          { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } }
        )
      }

      issuedConversationToken = generateConversationToken()
      const issuedTokenHash = await sha256Hex(issuedConversationToken)

      const { error: rotateError } = await supabase
        .from('chat_conversations')
        .update({
          access_token_hash: issuedTokenHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
        .eq('visitor_id', visitorId)

      if (rotateError) throw rotateError
      conversation.access_token_hash = issuedTokenHash
    }

    let messageQuery = supabase
      .from('chat_messages')
      .select('id, conversation_id, sender_type, sender_name, message_text, image_url, ai_generated, ai_confidence, created_at, read_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(MAX_SYNC_MESSAGES)

    if (normalizedSince) {
      messageQuery = messageQuery.gt('created_at', normalizedSince)
    }

    const { data: messages, error: messagesError } = await messageQuery
    if (messagesError) throw messagesError

    let teamTyping: string | null = null
    const { data: typingRows, error: typingError } = await supabase
      .from('team_typing_indicators')
      .select('user_name, is_typing, updated_at')
      .eq('conversation_id', conversationId)
      .eq('is_typing', true)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (!typingError && typingRows && typingRows.length > 0) {
      teamTyping = typingRows[0].user_name || null
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversation: {
          id: conversation.id,
          ai_handled: conversation.ai_handled,
          escalation_reason: conversation.escalation_reason,
          status: conversation.status,
          updated_at: conversation.updated_at,
          last_message_at: conversation.last_message_at,
        },
        messages: messages || [],
        teamTyping,
        conversationToken: issuedConversationToken,
        serverTime: new Date().toISOString(),
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('chat-visitor-sync error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  }
})
