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

    // 5a. If frustrated or angry, escalate immediately
    if (sentimentResult.sentiment === 'frustrated' || sentimentResult.sentiment === 'angry') {
      await supabase
        .from('chat_conversations')
        .update({
          ai_handled: false,
          escalation_reason: `Sentiment detected: ${sentimentResult.sentiment} - ${sentimentResult.reasoning}`,
          lead_score: sentimentResult.sentiment === 'angry' ? 8 : 7,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.id)

      // Send empathetic handoff message
      await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversation.id,
          sender_type: 'system',
          sender_name: 'TradeITM',
          message_text: "I understand this is important to you. Let me connect you with one of our team members who can give you the personal attention you deserve. They'll be with you shortly.",
          ai_generated: true,
          ai_confidence: 1.0
        })

      // Notify team
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            conversationId: conversation.id,
            reason: `Sentiment: ${sentimentResult.sentiment}`,
            leadScore: sentimentResult.sentiment === 'angry' ? 8 : 7,
            visitorId: conversation.visitor_id
          })
        })
      } catch (err) {
        console.error('Push notification failed:', err)
      }

      return new Response(
        JSON.stringify({
          success: true,
          escalated: true,
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
      // Escalate to human
      await supabase
        .from('chat_conversations')
        .update({
          ai_handled: false,
          escalation_reason: escalationCheck.reason,
          lead_score: escalationCheck.leadScore || 5,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.id)

      // Send handoff message
      await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversation.id,
          sender_type: 'system',
          sender_name: 'TradeITM',
          message_text: 'Let me connect you with someone from our team who can help you better. One moment...',
          ai_generated: true,
          ai_confidence: 1.0
        })

      // Send push notifications
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            conversationId: conversation.id,
            reason: escalationCheck.reason,
            leadScore: escalationCheck.leadScore,
            visitorId: conversation.visitor_id
          })
        })
      } catch (err) {
        console.error('Push notification failed:', err)
        // Don't fail the request if push fails
      }

      // Send notification webhook (optional - set NOTIFICATION_WEBHOOK_URL in secrets)
      const webhookUrl = Deno.env.get('NOTIFICATION_WEBHOOK_URL')
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'chat_escalated',
              conversationId: conversation.id,
              reason: escalationCheck.reason,
              leadScore: escalationCheck.leadScore,
              visitorId: conversation.visitor_id,
              timestamp: new Date().toISOString(),
              adminUrl: `${supabaseUrl.replace('.supabase.co', '.vercel.app')}/admin/chat?conversation=${conversation.id}`
            })
          })
        } catch (err) {
          console.error('Webhook notification failed:', err)
          // Don't fail the request if webhook fails
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          escalated: true,
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

    // 9. If low confidence, escalate instead of answering
    if (aiResponse.confidence < 0.7) {
      await supabase
        .from('chat_conversations')
        .update({
          ai_handled: false,
          escalation_reason: 'Low AI confidence - human verification needed',
          lead_score: 6,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.id)

      // Send human handoff message instead of uncertain AI response
      await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversation.id,
          sender_type: 'system',
          sender_name: 'TradeITM',
          message_text: "I'm not 100% sure about that, let me get a human expert to confirm for you. Someone from our team will be with you shortly!",
          ai_generated: true,
          ai_confidence: aiResponse.confidence
        })

      // Notify team
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            conversationId: conversation.id,
            reason: 'Low AI confidence',
            leadScore: 6,
            visitorId: conversation.visitor_id
          })
        })
      } catch (err) {
        console.error('Push notification failed:', err)
      }

      return new Response(
        JSON.stringify({
          success: true,
          escalated: true,
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
  const highValueKeywords = ['execute tier', '$499', 'ready to join', 'sign up now', 'how do i start', 'want to buy', 'ready to subscribe']
  if (highValueKeywords.some(kw => messageLower.includes(kw))) {
    shouldEscalate = true
    reason = 'High-value lead ready to purchase'
    leadScore = 9
  }

  // 3. Execute tier interest
  const executeKeywords = ['execute', 'serious trader', '6 figure', 'large account', 'professional']
  if (executeKeywords.some(kw => messageLower.includes(kw))) {
    shouldEscalate = true
    reason = 'Execute tier interest - high-value lead'
    leadScore = 8
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

## CRITICAL: Data Integrity Rules
**NEVER make up or fabricate:**
- Win rates or success percentages
- Specific trade results or P&L numbers
- Member testimonials or reviews
- Performance statistics of any kind
- Number of members or subscribers

**ONLY cite statistics that are:**
1. Explicitly provided in the Knowledge Base below
2. Part of the verified facts in this prompt

If asked about specific performance data you don't have, say: "I'd want to give you accurate numbers - let me connect you with our team who can share the latest verified results."

## Verified Facts About TradeITM (ONLY use these)
- Win rate: 87% verified over 8+ years
- Target: 100%+ returns per trade
- Alerts: 1-3 daily during market hours (9:30am-4pm ET)
- Delivery: Instant Discord notifications with exact entries, stop losses, and take profits
- Tiers: Core ($199), Pro ($299), Execute ($499)
- Guarantee: 30-day action-based money-back guarantee

## Pricing Tiers
- **Core Sniper ($199/mo)**: SPX day trades, morning watchlist, high-volume alerts, educational commentary
- **Pro Sniper ($299/mo)**: Everything in Core + LEAPS, advanced swing trades, position building logic, market structure insights
- **Execute Sniper ($499/mo)**: Everything in Pro + NDX real-time alerts, high-conviction LEAPS, advanced trade commentary, risk scaling education

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
- When citing any statistic, ensure it matches the Knowledge Base or Verified Facts above

## Confidence Signaling
At the end of your response, include a confidence indicator in this exact format on a new line:
[CONFIDENCE: HIGH/MEDIUM/LOW]

Use HIGH only when you're directly citing Knowledge Base content or Verified Facts.
Use MEDIUM when making reasonable inferences from available data.
Use LOW when the question requires information not in your knowledge base.`

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
