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

    // 2. Save visitor message
    const { data: savedMessage, error: messageSaveError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversation.id,
        sender_type: 'visitor',
        sender_name: conversation.visitor_name || 'Visitor',
        message_text: visitorMessage
      })
      .select()
      .single()

    if (messageSaveError) throw messageSaveError

    // 3. Get message history
    const { data: messageHistory } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(10)

    // 4. Check if should escalate
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

    // 5. Search knowledge base
    const { data: kbEntries } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })

    const relevantKnowledge = searchKnowledgeBase(visitorMessage, kbEntries || [])

    // 6. Generate AI response
    const aiResponse = await generateAIResponse(
      visitorMessage,
      messageHistory || [],
      relevantKnowledge,
      conversation.metadata || {},
      openaiKey
    )

    // 7. Save AI response
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
        knowledge_base_refs: relevantKnowledge.map(k => k.id)
      })
      .select()
      .single()

    // 8. Flag for review if low confidence
    if (aiResponse.confidence < 0.7) {
      await supabase
        .from('chat_conversations')
        .update({
          metadata: {
            ...(conversation.metadata || {}),
            flagged_for_review: true,
            flag_reason: 'Low AI confidence'
          }
        })
        .eq('id', conversation.id)
    }

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
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

// ============================================
// HELPER FUNCTIONS
// ============================================

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

function searchKnowledgeBase(query: string, kbEntries: any[]) {
  const queryLower = query.toLowerCase()
  const relevant: any[] = []

  for (const entry of kbEntries) {
    const questions = entry.question.toLowerCase().split('|').map((q: string) => q.trim())
    const score = questions.reduce((max: number, q: string) => {
      // Simple keyword matching
      const keywords = q.split(' ').filter((w: string) => w.length > 3)
      const matches = keywords.filter((kw: string) => queryLower.includes(kw)).length
      return Math.max(max, matches)
    }, 0)

    if (score > 0) {
      relevant.push({ ...entry, score })
    }
  }

  // Sort by score and priority, return top 3
  return relevant
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.priority - a.priority
    })
    .slice(0, 3)
}

async function generateAIResponse(
  visitorMessage: string,
  messageHistory: any[],
  knowledgeBase: any[],
  visitorContext: any,
  openaiKey: string
) {
  const SYSTEM_PROMPT = `You are an AI assistant for TradeITM, a premium options trading signals service.

## Your Role
- Help potential customers understand our service
- Answer questions about pricing, features, and results
- Share proof of recent wins when asked
- Qualify leads and escalate high-value prospects to human team
- Maintain a professional but friendly tone matching our luxury brand

## Key Facts About TradeITM
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
- If you don't know something specific, acknowledge it
- Be direct and helpful

## Example Tone
"Our Execute tier is designed for serious traders targeting maximum returns. You'll get real-time NDX alerts with our highest-conviction setups - the same trades our founder takes personally. Want to see some recent wins?"`

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
  const aiText = data.choices[0].message.content

  // Calculate confidence
  const confidence = data.choices[0].finish_reason === 'stop' ? 0.9 : 0.6

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
