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
    const { conversationId, visitorMessage, visitorId } = await req.json()

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Get or create conversation
    let conversation
    if (conversationId) {
      const { data } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', conversationId)
        .single()
      conversation = data

      // Check if conversation needs to be reopened
      if (conversation && (conversation.status === 'resolved' || conversation.status === 'archived')) {
        const previousStatus = conversation.status

        // Reactivate the conversation
        await supabase
          .from('chat_conversations')
          .update({
            status: 'active',
            ai_handled: true, // Reset to AI handling on reopen
            escalation_reason: null, // Clear previous escalation
            updated_at: new Date().toISOString()
          })
          .eq('id', conversation.id)

        // Add system message about reopening
        await supabase
          .from('chat_messages')
          .insert({
            conversation_id: conversation.id,
            sender_type: 'system',
            sender_name: 'System',
            message_text: previousStatus === 'archived'
              ? 'Visitor returned. Conversation reactivated from archive.'
              : 'Visitor reopened the conversation.',
            ai_generated: false
          })

        // Update local conversation object
        conversation.status = 'active'
        conversation.ai_handled = true
        conversation.escalation_reason = null

        // Fetch message history for Discord notification
        const { data: reopenHistory } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: true })
          .limit(10)

        // Notify team via Discord about reopened conversation
        await sendDiscordNotification(
          supabase,
          conversation.id,
          `Conversation reopened (was ${previousStatus})`,
          conversation.visitor_name,
          5,
          reopenHistory || [],
          conversation.visitor_email
        )
      }
    } else {
      // Create new conversation
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          visitor_id: visitorId,
          status: 'active',
          ai_handled: true,
          metadata: {
            user_agent: req.headers.get('user-agent'),
            created_at: new Date().toISOString()
          }
        })
        .select()
        .single()

      if (error) throw error
      conversation = data

      // Notify team about new conversation
      await sendDiscordNotification(
        supabase,
        conversation.id,
        'New conversation started',
        undefined, // Visitor name not known yet
        3 // Lower priority for new conversations
      )
    }

    // 2. Extract visitor info (name/email) from message
    const visitorInfo = extractVisitorInfo(visitorMessage)

    // Update conversation with extracted name/email if found
    if (visitorInfo.name || visitorInfo.email) {
      const updateData: Record<string, string> = {}
      if (visitorInfo.name && !conversation.visitor_name) {
        updateData.visitor_name = visitorInfo.name
      }
      if (visitorInfo.email && !conversation.visitor_email) {
        updateData.visitor_email = visitorInfo.email
      }

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('chat_conversations')
          .update({
            ...updateData,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversation.id)

        // Update local conversation object
        Object.assign(conversation, updateData)
      }
    }

    // 2a. Check if there's a pending escalation and email was just provided
    if (visitorInfo.email && conversation.metadata?.pending_escalation) {
      // Fetch message history for Discord notification
      const { data: pendingHistory } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
        .limit(10)

      const escalationCompleted = await checkPendingEscalation(
        supabase,
        conversation,
        visitorInfo.email,
        pendingHistory || []
      )

      if (escalationCompleted) {
        // Save the visitor message first
        await supabase
          .from('chat_messages')
          .insert({
            conversation_id: conversation.id,
            sender_type: 'visitor',
            sender_name: conversation.visitor_name || visitorInfo.name || 'Visitor',
            message_text: visitorMessage
          })

        return new Response(
          JSON.stringify({
            success: true,
            escalated: true,
            conversationId: conversation.id,
            reason: conversation.metadata.pending_escalation.reason
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 3. Save visitor message
    const { error: messageSaveError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversation.id,
        sender_type: 'visitor',
        sender_name: conversation.visitor_name || visitorInfo.name || 'Visitor',
        message_text: visitorMessage
      })
      .select()
      .single()

    if (messageSaveError) throw messageSaveError

    // 4. Get message history
    const { data: messageHistory } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(10)

    // 5. Analyze sentiment using GPT-4o
    const sentimentResult = await analyzeSentiment(
      visitorMessage,
      messageHistory || [],
      openaiKey
    )

    // 5a. If frustrated or angry, escalate (gated by email)
    if (sentimentResult.sentiment === 'frustrated' || sentimentResult.sentiment === 'angry') {
      const escalationResult = await handleGatedEscalation(
        supabase,
        conversation,
        `Sentiment detected: ${sentimentResult.sentiment} - ${sentimentResult.reasoning}`,
        sentimentResult.sentiment === 'angry' ? 8 : 7,
        "I understand this is important to you. Let me connect you with one of our team members who can give you the personal attention you deserve. They'll be with you shortly.",
        messageHistory || []
      )

      return new Response(
        JSON.stringify({
          success: true,
          escalated: !escalationResult.needsEmail,
          pendingEmail: escalationResult.needsEmail,
          conversationId: conversation.id,
          reason: `Sentiment detected: ${sentimentResult.sentiment}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Check other escalation triggers
    const escalationCheck = checkEscalationTriggers(
      visitorMessage,
      conversation,
      messageHistory || []
    )

    if (escalationCheck.shouldEscalate) {
      // Escalate to human (gated by email)
      const escalationResult = await handleGatedEscalation(
        supabase,
        conversation,
        escalationCheck.reason,
        escalationCheck.leadScore || 5,
        'Let me connect you with someone from our team who can help you better. One moment...',
        messageHistory || []
      )

      return new Response(
        JSON.stringify({
          success: true,
          escalated: !escalationResult.needsEmail,
          pendingEmail: escalationResult.needsEmail,
          conversationId: conversation.id,
          reason: escalationCheck.reason
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Search knowledge base using PostgreSQL Full-Text Search
    const relevantKnowledge = await searchKnowledgeBaseRPC(supabase, visitorMessage)

    // 8. Generate AI response
    const aiResponse = await generateAIResponse(
      visitorMessage,
      messageHistory || [],
      relevantKnowledge,
      openaiKey
    )

    // 9. If low confidence, escalate instead of answering (gated by email)
    if (aiResponse.confidence < 0.7) {
      const escalationResult = await handleGatedEscalation(
        supabase,
        conversation,
        'Low AI confidence - human verification needed',
        6,
        "I want to be 100% accurate for you—let me pull in a team member to confirm. Someone from our team will be with you shortly!",
        messageHistory || []
      )

      return new Response(
        JSON.stringify({
          success: true,
          escalated: !escalationResult.needsEmail,
          pendingEmail: escalationResult.needsEmail,
          conversationId: conversation.id,
          reason: 'Low AI confidence - human verification needed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 10. Save AI response (only if confidence is high enough)
    const { data: aiMessage } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversation.id,
        sender_type: 'team',
        sender_name: 'TradeITM AI',
        message_text: aiResponse.text,
        image_url: aiResponse.imageUrl,
        ai_generated: true,
        ai_confidence: aiResponse.confidence,
        knowledge_base_refs: relevantKnowledge.map((k: any) => k.id)
      })
      .select()
      .single()

    return new Response(
      JSON.stringify({
        success: true,
        message: aiMessage,
        conversationId: conversation.id,
        confidence: aiResponse.confidence
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

// ============================================
// HELPER FUNCTIONS
// ============================================

// Send Discord notification for escalations
async function sendDiscordNotification(
  supabase: any,
  conversationId: string,
  reason: string,
  visitorName?: string,
  leadScore?: number,
  messageHistory?: any[],
  visitorEmail?: string
): Promise<void> {
  try {
    // Get Discord webhook URL from app_settings
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'discord_webhook_url')
      .single()

    const webhookUrl = setting?.value
    if (!webhookUrl) {
      console.log('Discord webhook URL not configured - skipping notification')
      return
    }

    const name = visitorName || 'Visitor'
    const isHighValue = leadScore && leadScore >= 7
    const isNewConversation = reason.includes('New conversation')
    const isReopened = reason.includes('reopened')

    // Different colors: orange for high-value, blue for new, green for escalations
    const embedColor = isHighValue ? 16744256 : isNewConversation ? 3447003 : 5763719

    // Determine title based on notification type
    let title: string
    if (isHighValue) {
      title = '🚨 High-Value Chat Escalated'
    } else if (isNewConversation) {
      title = '💬 New Chat Started'
    } else if (isReopened) {
      title = '🔄 Chat Reopened'
    } else {
      title = '👋 Chat Escalated'
    }

    // Generate magic link token for one-click access
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes

    await supabase
      .from('admin_access_tokens')
      .insert({
        token,
        conversation_id: conversationId,
        expires_at: expiresAt
      })

    // Build description with visitor info and magic link
    const chatUrl = `https://trade-itm-prod.up.railway.app/admin/chat?id=${conversationId}&token=${token}`
    let description = `**${name}** - ${reason}`
    if (visitorEmail) {
      description += `\n📧 ${visitorEmail}`
    }
    description += `\n\n🔗 [**View & Respond**](${chatUrl})`

    // Build fields array
    const fields: { name: string; value: string; inline?: boolean }[] = []

    // Add lead score if significant
    if (leadScore && leadScore > 3) {
      fields.push({ name: 'Lead Score', value: `${leadScore}/10`, inline: true })
    }

    // Generate conversation recap from last 4 messages (if available)
    if (messageHistory && messageHistory.length > 0) {
      const recentMessages = messageHistory
        .filter(msg => msg.sender_type !== 'system') // Exclude system messages
        .slice(-4) // Last 4 non-system messages
        .map(msg => {
          const sender = msg.sender_type === 'visitor' ? 'Visitor' : 'AI'
          // Truncate long messages
          const text = msg.message_text.length > 150
            ? msg.message_text.substring(0, 147) + '...'
            : msg.message_text
          return `${sender}: ${text}`
        })
        .join('\n')

      // Limit recap to 1024 characters for Discord embed field limits
      const recap = recentMessages.length > 1024
        ? recentMessages.substring(0, 1021) + '...'
        : recentMessages

      if (recap) {
        fields.push({ name: '💬 Recent History', value: recap, inline: false })
      }
    }

    const payload = {
      embeds: [{
        title,
        description,
        color: embedColor,
        fields,
        timestamp: new Date().toISOString()
      }]
      // Note: Discord webhooks don't support interactive components (buttons)
      // The link is included in the description instead
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      console.error('Discord webhook failed:', await response.text())
    } else {
      console.log('Discord notification sent successfully')
    }
  } catch (error) {
    console.error('Discord notification error:', error)
  }
}

// Gated escalation: requires email before escalating to team
// Returns true if escalation was handled (either completed or email requested)
async function handleGatedEscalation(
  supabase: any,
  conversation: any,
  reason: string,
  leadScore: number,
  handoffMessage: string,
  messageHistory?: any[]
): Promise<{ handled: boolean; needsEmail: boolean }> {
  const hasEmail = !!conversation.visitor_email

  if (!hasEmail) {
    // Store pending escalation in metadata and ask for email
    const currentMetadata = conversation.metadata || {}
    await supabase
      .from('chat_conversations')
      .update({
        metadata: {
          ...currentMetadata,
          pending_escalation: {
            reason,
            lead_score: leadScore,
            handoff_message: handoffMessage,
            requested_at: new Date().toISOString()
          }
        },
        lead_score: leadScore,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation.id)

    // Ask for email instead of escalating
    await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversation.id,
        sender_type: 'team',
        sender_name: 'TradeITM AI',
        message_text: "I'd love to get a team member to help you with that. What's the best email address to reach you at in case we get disconnected?",
        ai_generated: true,
        ai_confidence: 1.0
      })

    return { handled: true, needsEmail: true }
  }

  // Email exists - proceed with full escalation
  await supabase
    .from('chat_conversations')
    .update({
      ai_handled: false,
      escalation_reason: reason,
      lead_score: leadScore,
      metadata: {
        ...(conversation.metadata || {}),
        pending_escalation: null // Clear any pending escalation
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', conversation.id)

  // Add system message about email-verified escalation
  await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversation.id,
      sender_type: 'system',
      sender_name: 'System',
      message_text: 'Visitor provided email; escalating to team.',
      ai_generated: false
    })

  // Send handoff message
  await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversation.id,
      sender_type: 'system',
      sender_name: 'TradeITM',
      message_text: handoffMessage,
      ai_generated: true,
      ai_confidence: 1.0
    })

  // Notify team via Discord
  await sendDiscordNotification(
    supabase,
    conversation.id,
    reason,
    conversation.visitor_name,
    leadScore,
    messageHistory,
    conversation.visitor_email
  )

  return { handled: true, needsEmail: false }
}

// Check and complete pending escalation if email was just provided
async function checkPendingEscalation(
  supabase: any,
  conversation: any,
  visitorEmail: string | null,
  messageHistory?: any[]
): Promise<boolean> {
  const pending = conversation.metadata?.pending_escalation
  if (!pending || !visitorEmail) return false

  // Email was just provided - complete the pending escalation
  await supabase
    .from('chat_conversations')
    .update({
      ai_handled: false,
      escalation_reason: pending.reason,
      lead_score: pending.lead_score,
      metadata: {
        ...(conversation.metadata || {}),
        pending_escalation: null
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', conversation.id)

  // Add system message
  await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversation.id,
      sender_type: 'system',
      sender_name: 'System',
      message_text: 'Visitor provided email; escalating to team.',
      ai_generated: false
    })

  // Send the original handoff message
  await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversation.id,
      sender_type: 'system',
      sender_name: 'TradeITM',
      message_text: pending.handoff_message,
      ai_generated: true,
      ai_confidence: 1.0
    })

  // Notify team via Discord
  await sendDiscordNotification(
    supabase,
    conversation.id,
    pending.reason,
    conversation.visitor_name,
    pending.lead_score,
    messageHistory,
    visitorEmail || undefined
  )

  return true
}

// Extract visitor name and email from message content
function extractVisitorInfo(message: string): { name?: string; email?: string } {
  const result: { name?: string; email?: string } = {}

  // Email regex - standard email pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
  const emailMatch = message.match(emailRegex)
  if (emailMatch) {
    result.email = emailMatch[0].toLowerCase()
  }

  // Name extraction patterns
  const namePatterns = [
    /(?:my name is|i'm|i am|this is|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:name[:\s]+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+here/i,
  ]

  for (const pattern of namePatterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      // Basic validation: name should be 2-50 chars, not common words
      const potentialName = match[1].trim()
      const commonWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out']
      if (potentialName.length >= 2 && potentialName.length <= 50 && !commonWords.includes(potentialName.toLowerCase())) {
        result.name = potentialName
        break
      }
    }
  }

  return result
}

function checkEscalationTriggers(message: string, conversation: any, history: any[]) {
  const messageLower = message.toLowerCase()
  let shouldEscalate = false
  let reason = ''
  let leadScore = 5

  // 1. Explicit human request
  const humanKeywords = [
    'speak to human', 'talk to person', 'talk with someone', 'speak with someone',
    'real person', 'agent', 'representative', 'customer service',
    'contact someone', 'talk to someone', 'get help from', 'connect me with'
  ]
  if (humanKeywords.some(kw => messageLower.includes(kw))) {
    shouldEscalate = true
    reason = 'Visitor requested human agent'
  }

  // 2. High-value indicators
  const highValueKeywords = ['executive tier', '$499', 'ready to join', 'sign up now', 'how do i start', 'want to buy', 'ready to subscribe']
  if (highValueKeywords.some(kw => messageLower.includes(kw))) {
    shouldEscalate = true
    reason = 'High-value lead ready to purchase'
    leadScore = 9
  }

  // 3. Executive tier interest
  const executiveKeywords = ['executive', 'serious trader', '6 figure', 'large account', 'professional']
  if (executiveKeywords.some(kw => messageLower.includes(kw))) {
    shouldEscalate = true
    reason = 'Executive tier interest - high-value lead'
    leadScore = 8
  }

  // 3.5 Precision Cohort / Annual Mentorship interest (HIGHEST VALUE)
  const cohortKeywords = ['mentorship', 'cohort', 'annual', 'mentoring', 'precision', 'yearly program', '1500', '$1,500', 'yearly mentorship']
  if (cohortKeywords.some(kw => messageLower.includes(kw))) {
    shouldEscalate = true
    reason = 'Precision Cohort interest - highest-value lead'
    leadScore = 10
  }

  // 4. Frustrated sentiment
  const frustrationKeywords = ['frustrated', 'disappointed', 'terrible', 'scam', 'fake', 'waste']
  if (frustrationKeywords.some(kw => messageLower.includes(kw))) {
    shouldEscalate = true
    reason = 'Negative sentiment detected'
    leadScore = 7
  }

  // 5. Repeated conversation
  const visitorMessages = history.filter(m => m.sender_type === 'visitor')
  if (visitorMessages.length > 4) {
    shouldEscalate = true
    reason = 'Extended conversation - human touch needed'
  }

  // 6. Billing/refund
  if (messageLower.includes('refund') || messageLower.includes('cancel') || messageLower.includes('billing')) {
    shouldEscalate = true
    reason = 'Billing/retention concern'
    leadScore = 8
  }

  return { shouldEscalate, reason, leadScore }
}

// Search knowledge base using PostgreSQL Full-Text Search via RPC
async function searchKnowledgeBaseRPC(supabase: any, query: string): Promise<any[]> {
  // Try FTS search first
  const { data: ftsResults, error: ftsError } = await supabase
    .rpc('search_knowledge_base', {
      search_query: query,
      match_limit: 5
    })

  if (!ftsError && ftsResults && ftsResults.length > 0) {
    return ftsResults
  }

  // Fallback to keyword search if FTS returns no results
  const { data: fallbackResults } = await supabase
    .rpc('search_knowledge_base_fallback', {
      search_query: query,
      match_limit: 3
    })

  if (fallbackResults && fallbackResults.length > 0) {
    return fallbackResults
  }

  // Ultimate fallback: get top priority entries
  const { data: defaultEntries } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .limit(3)

  return defaultEntries || []
}

// Analyze sentiment using GPT-4o
async function analyzeSentiment(
  message: string,
  messageHistory: any[],
  openaiKey: string
): Promise<{ sentiment: 'positive' | 'neutral' | 'frustrated' | 'angry'; confidence: number; reasoning: string }> {
  const historyContext = messageHistory
    .slice(-4)
    .map(m => `${m.sender_type}: ${m.message_text}`)
    .join('\n')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a sentiment analyzer. Analyze the visitor's message sentiment in the context of their conversation with a trading signals company.

Classify the sentiment as ONE of:
- "positive": Interested, excited, ready to buy, happy
- "neutral": Asking questions, gathering information, undecided
- "frustrated": Disappointed, annoyed, skeptical, expressing doubt
- "angry": Very upset, using harsh language, threatening, accusing

Respond in JSON format only:
{"sentiment": "positive|neutral|frustrated|angry", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`
        },
        {
          role: 'user',
          content: `Conversation history:\n${historyContext}\n\nLatest message to analyze:\n"${message}"`
        }
      ],
      temperature: 0.1,
      max_tokens: 150,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    // Default to neutral if analysis fails
    return { sentiment: 'neutral', confidence: 0.5, reasoning: 'Analysis failed' }
  }

  const data = await response.json()
  try {
    const result = JSON.parse(data.choices[0].message.content)
    return {
      sentiment: result.sentiment || 'neutral',
      confidence: result.confidence || 0.5,
      reasoning: result.reasoning || ''
    }
  } catch {
    return { sentiment: 'neutral', confidence: 0.5, reasoning: 'Parse error' }
  }
}

async function generateAIResponse(
  visitorMessage: string,
  messageHistory: any[],
  knowledgeBase: any[],
  openaiKey: string
) {
  const SYSTEM_PROMPT = `You are an AI assistant for TradeITM, a premium options trading signals service.

## Your Role
- Help potential customers understand our service
- Answer questions about pricing, features, and results
- Share proof of recent wins when asked
- Qualify leads and escalate high-value prospects to human team
- Maintain a professional but friendly tone matching our luxury brand

## CRITICAL: Data Integrity Rules - ZERO TOLERANCE FOR HALLUCINATION
**ABSOLUTE RESTRICTIONS - NEVER fabricate or estimate:**
- Win rates, success percentages, or any performance metrics
- Specific trade results, P&L numbers, or returns (except verified facts below)
- Member testimonials, reviews, or success stories
- Number of members, subscribers, or customers
- Any statistics not explicitly in the Knowledge Base or Verified Facts

**SOURCE VERIFICATION REQUIREMENT:**
Before stating ANY fact, mentally verify it exists in:
1. The "Relevant Knowledge Base" section below (your primary source)
2. The "Verified Facts" section in this prompt (your secondary source)

If information is NOT in these sources, respond with: "I want to make sure you get accurate information on that - let me connect you with our team who can share the latest verified details."

## Verified Facts About TradeITM (ONLY use these exact numbers)
- Win rate: 87% verified over 8+ years (DO NOT round up or modify)
- Target: 100%+ returns per trade
- Alerts: 1-3 daily during market hours (9:30am-4pm ET)
- Delivery: Instant Discord notifications with exact entries, stop losses, and take profits
- Tiers: Core ($199/mo), Pro ($299/mo), Executive ($499/mo)
- Guarantee: 30-day action-based money-back guarantee

## Pricing Tiers (use exact amounts)
- **Core Sniper ($199/mo)**: SPX day trades, morning watchlist, high-volume alerts, educational commentary
- **Pro Sniper ($299/mo)**: Everything in Core + LEAPS, advanced swing trades, position building logic, market structure insights
- **Executive Sniper ($499/mo)**: Everything in Pro + NDX real-time alerts, high-conviction LEAPS, advanced trade commentary, risk scaling education

## Billing Options
- **Monthly billing**: Core ($199/mo), Pro ($299/mo), Executive ($499/mo)
- **Annual billing**: Core ($1,990/yr), Pro ($2,990/yr), Executive ($4,990/yr)
- Annual billing = 2 MONTHS FREE (pay for 10 months, get 12 months of access)
- Annual savings: Core saves $398/yr, Pro saves $598/yr, Executive saves $998/yr
- IMPORTANT: When a user asks about discounts, savings, or long-term access, ALWAYS mention the annual billing option and its savings FIRST before suggesting the Precision Cohort mentorship

## Mentorship Facts (Precision Cohort)
- **Annual Investment**: $1,500/year (paid annually - NOT monthly)
- **Maximum cohort size**: 20 traders only (this scarcity is real, not marketing)
- **Philosophy**: "Mentorship, not Signals" - we teach traders to develop their OWN edge
- **Four Pillars**: Live Strategy Sessions, Trade Architecture, Portfolio Engineering, Mindset Mastery
- **Target audience**: Serious traders committed to transformation, not just alerts
- **Difference from monthly tiers**: Monthly = follow our trades. Cohort = learn to think like us.

## Cohort Qualification Behavior
When a visitor expresses interest in the Precision Cohort, annual mentorship, or $1,500 program:
1. Acknowledge their interest warmly and emphasize exclusivity
2. FIRST respond with: "The Precision Cohort is our most exclusive path, limited to 20 traders. It requires an application to ensure a fit. Would you like to see the application requirements or speak with a team member about it?"
3. If they want requirements, ask about their trading experience: "How long have you been actively trading?"
4. If they're new (<1 year experience), gently guide them: "Our monthly tiers (Core/Pro/Executive) would be a great foundation first. The Cohort is designed for traders with established experience looking to take the next step."
5. If experienced (1+ years), proceed with connecting to team: "That sounds like a great fit for the Cohort. Let me connect you with our team to discuss your application."
6. Always emphasize: This is "Mentorship, not Signals"—we develop traders, we don't just send alerts.

## Brand Voice
- Confident but not arrogant
- Results-focused, no fluff
- Luxury positioning (we're premium, not cheap)
- Transparent about wins AND the work required
- Educational, not just "buy signals"

## Response Guidelines
- Keep responses concise (2-3 short paragraphs max)
- Use bullet points for clarity when listing features
- Always mention the 30-day guarantee when discussing pricing
- If you're not confident about something, acknowledge it and offer to connect them with a team member
- Be direct and helpful
- ONLY cite statistics that EXACTLY match the Knowledge Base or Verified Facts
- When uncertain, default to escalating rather than guessing

## Handling Escalation Requests
- If a user is frustrated or asks for a human, always be empathetic first
- Acknowledge their feelings and validate their request before asking for anything
- When connecting them with the team, warmly explain that you need their email so a member of our trade desk can follow up personally
- Example tone: "I completely understand - let me get you connected with our team right away. To make sure someone can follow up with you directly, what's the best email to reach you at?"

## Knowledge Base Reference Tracking
The Knowledge Base entries below are your authoritative source. When you use information from them:
- You may cite the answer content directly
- If an entry has image_urls, you may reference them as proof
- If no relevant Knowledge Base entry exists for the question, acknowledge uncertainty

## Confidence Signaling (REQUIRED)
At the end of your response, include a confidence indicator in this exact format on a new line:
[CONFIDENCE: HIGH/MEDIUM/LOW]

Use HIGH (0.95): ONLY when directly citing Knowledge Base content or Verified Facts word-for-word
Use MEDIUM (0.75): When making reasonable inferences from available data
Use LOW (0.5): When the question requires information not in your sources - this will trigger human escalation`

  // Build knowledge base context
  const kbContext = knowledgeBase.map(kb =>
    `Q: ${kb.question.split('|')[0]}\nA: ${kb.answer}${kb.image_urls ? `\nProof: ${kb.image_urls.join(', ')}` : ''}`
  ).join('\n\n')

  // Build conversation history
  const conversationContext = messageHistory
    .slice(-6) // Last 6 messages for context
    .map(msg => `${msg.sender_type === 'visitor' ? 'Visitor' : 'AI'}: ${msg.message_text}`)
    .join('\n')

  const messages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    },
    {
      role: 'system',
      content: `Relevant Knowledge Base:\n${kbContext}`
    }
  ]

  if (conversationContext) {
    messages.push({
      role: 'system',
      content: `Previous conversation:\n${conversationContext}`
    })
  }

  messages.push({
    role: 'user',
    content: visitorMessage
  })

  // Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 500
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  let aiText = data.choices[0].message.content

  // Parse confidence from AI's self-reported indicator
  let confidence = 0.8 // Default to medium-high
  const confidenceMatch = aiText.match(/\[CONFIDENCE:\s*(HIGH|MEDIUM|LOW)\]/i)
  if (confidenceMatch) {
    const level = confidenceMatch[1].toUpperCase()
    confidence = level === 'HIGH' ? 0.95 : level === 'MEDIUM' ? 0.75 : 0.5
    // Remove the confidence tag from the response
    aiText = aiText.replace(/\[CONFIDENCE:\s*(HIGH|MEDIUM|LOW)\]/gi, '').trim()
  } else {
    // Fallback: if no confidence tag, use completion status
    confidence = data.choices[0].finish_reason === 'stop' ? 0.75 : 0.5
  }

  // Additional confidence reduction if knowledge base was empty
  if (knowledgeBase.length === 0) {
    confidence = Math.min(confidence, 0.6)
  }

  // Extract image URL if AI referenced proof
  let imageUrl = null
  const imageMatch = aiText.match(/Proof: (https?:\/\/[^\s]+)/)
  if (imageMatch) {
    imageUrl = imageMatch[1]
  }

  return {
    text: aiText.replace(/Proof: https?:\/\/[^\s]+/, '').trim(),
    imageUrl,
    confidence
  }
}
