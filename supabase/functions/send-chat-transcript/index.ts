import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { conversationId, recipientEmail } = await req.json()

    if (!conversationId) {
      throw new Error('conversationId is required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      throw new Error(`Conversation not found: ${conversationId}`)
    }

    // 2. Get all messages for the conversation
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (msgError) {
      throw new Error(`Failed to fetch messages: ${msgError.message}`)
    }

    // Determine recipient email
    const emailTo = recipientEmail || conversation.visitor_email

    if (!emailTo) {
      throw new Error('No recipient email provided and visitor email not available')
    }

    // 3. Generate HTML email content
    const htmlContent = generateTranscriptHtml(conversation, messages || [])
    const plainTextContent = generateTranscriptPlainText(conversation, messages || [])

    // 4. Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'TradeITM Support <support@tradeitm.com>',
        to: emailTo,
        subject: `Your TradeITM Chat Transcript - ${new Date(conversation.created_at).toLocaleDateString()}`,
        html: htmlContent,
        text: plainTextContent
      })
    })

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json()
      throw new Error(`Resend API error: ${JSON.stringify(errorData)}`)
    }

    const emailResult = await emailResponse.json()

    // 5. Log the email send in the database (optional)
    await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'system',
        sender_name: 'TradeITM',
        message_text: `Chat transcript sent to ${emailTo}`,
        ai_generated: false
      })

    return new Response(
      JSON.stringify({
        success: true,
        emailId: emailResult.id,
        sentTo: emailTo
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

// Generate HTML email content
function generateTranscriptHtml(conversation: any, messages: any[]): string {
  const visitorName = conversation.visitor_name || 'Visitor'
  const chatDate = new Date(conversation.created_at).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const messagesHtml = messages.map(msg => {
    const isVisitor = msg.sender_type === 'visitor'
    const isSystem = msg.sender_type === 'system'
    const timestamp = new Date(msg.created_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })

    if (isSystem) {
      return `
        <div style="text-align: center; margin: 16px 0;">
          <span style="background: #f3f4f6; color: #6b7280; padding: 8px 16px; border-radius: 12px; font-size: 13px;">
            ${escapeHtml(msg.message_text)}
          </span>
        </div>
      `
    }

    const backgroundColor = isVisitor ? '#e8e4d9' : '#047857'
    const textColor = isVisitor ? '#1a1a1a' : '#ffffff'
    const alignment = isVisitor ? 'flex-end' : 'flex-start'

    return `
      <div style="display: flex; justify-content: ${alignment}; margin-bottom: 12px;">
        <div style="max-width: 70%; background: ${backgroundColor}; color: ${textColor}; padding: 12px 16px; border-radius: 16px;">
          <div style="font-size: 12px; opacity: 0.7; margin-bottom: 4px;">
            ${escapeHtml(msg.sender_name)} • ${timestamp}
            ${msg.ai_generated ? ' <span style="background: rgba(59,130,246,0.2); padding: 2px 6px; border-radius: 4px; font-size: 10px;">AI</span>' : ''}
          </div>
          <div style="white-space: pre-wrap; line-height: 1.5;">${escapeHtml(msg.message_text)}</div>
          ${msg.image_url ? `<img src="${escapeHtml(msg.image_url)}" alt="Shared image" style="max-width: 100%; margin-top: 8px; border-radius: 8px;" />` : ''}
        </div>
      </div>
    `
  }).join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Chat Transcript</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0b;">
      <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
          <img src="https://tradeitm.com/hero-logo.png" alt="TradeITM" style="height: 48px; margin-bottom: 16px;" />
          <h1 style="color: #e8e4d9; font-size: 24px; margin: 0 0 8px 0;">Your Chat Transcript</h1>
          <p style="color: #a0a0a0; font-size: 14px; margin: 0;">${chatDate}</p>
        </div>

        <!-- Chat Container -->
        <div style="background: #1a1a1b; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
          <div style="border-bottom: 1px solid #333; padding-bottom: 16px; margin-bottom: 16px;">
            <p style="color: #a0a0a0; font-size: 13px; margin: 0;">
              Conversation with <strong style="color: #e8e4d9;">${escapeHtml(visitorName)}</strong>
              ${conversation.visitor_email ? ` (${escapeHtml(conversation.visitor_email)})` : ''}
            </p>
          </div>

          <!-- Messages -->
          ${messagesHtml}
        </div>

        <!-- Footer -->
        <div style="text-align: center; color: #6b7280; font-size: 12px;">
          <p style="margin: 0 0 8px 0;">Thank you for chatting with TradeITM!</p>
          <p style="margin: 0;">
            Questions? Reply to this email or visit <a href="https://tradeitm.com" style="color: #047857;">tradeitm.com</a>
          </p>
          <p style="margin-top: 16px; opacity: 0.6;">
            © ${new Date().getFullYear()} TradeITM. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

// Generate plain text version
function generateTranscriptPlainText(conversation: any, messages: any[]): string {
  const visitorName = conversation.visitor_name || 'Visitor'
  const chatDate = new Date(conversation.created_at).toLocaleDateString()

  const header = `
TradeITM Chat Transcript
========================
Date: ${chatDate}
Visitor: ${visitorName}${conversation.visitor_email ? ` (${conversation.visitor_email})` : ''}

---

`

  const messagesText = messages.map(msg => {
    const timestamp = new Date(msg.created_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
    const aiTag = msg.ai_generated ? ' [AI]' : ''
    return `[${timestamp}] ${msg.sender_name}${aiTag}:\n${msg.message_text}\n`
  }).join('\n')

  const footer = `
---

Thank you for chatting with TradeITM!
Questions? Visit https://tradeitm.com

© ${new Date().getFullYear()} TradeITM. All rights reserved.
`

  return header + messagesText + footer
}

// Escape HTML entities
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
