# AI-Powered Chat System with Human Escalation
## TradeITM Custom Implementation

---

## System Overview

**Hybrid AI + Human Chat System**

```
Visitor asks question
        ↓
┌───────────────────────┐
│   AI Agent (GPT-4)    │ ← Answers 80-90% of questions
│   + Knowledge Base    │   24/7 availability
└───────┬───────────────┘   Instant responses
        │
        ├─→ Simple question? → AI responds immediately
        │
        ├─→ Complex question? → AI + human review
        │
        └─→ High-value lead? → Escalate to team
                ↓
        ┌───────────────────┐
        │   Human Team      │ ← Handles 10-20% of chats
        │   (You + Team)    │   High-touch, conversions
        └───────────────────┘
```

**Benefits:**
- ✅ AI handles repetitive questions 24/7 (pricing, features, how it works)
- ✅ Team focuses on high-value leads and complex questions
- ✅ Instant responses even when team is sleeping/trading
- ✅ Knowledge base ensures consistent, accurate answers
- ✅ Seamless handoff from AI → human when needed
- ✅ AI learns from human responses over time

---

## Architecture

### Tech Stack

```
┌─────────────────────────────────────────────────────┐
│                 Landing Page Widget                  │
│              (Visitor types message)                 │
└────────────────────┬────────────────────────────────┘
                     ↓
┌────────────────────────────────────────────────────┐
│              Supabase Edge Function                 │
│                                                     │
│  1. Receive message                                │
│  2. Check if AI should handle or escalate          │
│  3. If AI: Call OpenAI with context                │
│  4. If human needed: Notify team + set flag        │
└────────────┬───────────────────────────────────────┘
             ↓
    ┌────────┴────────┐
    ↓                 ↓
┌─────────────┐  ┌──────────────────┐
│   OpenAI    │  │  Supabase DB     │
│   GPT-4o    │  │                  │
│             │  │  • Messages      │
│  Responds   │  │  • Knowledge Base│
│  using KB   │  │  • Conversations │
└─────────────┘  └──────────────────┘
                          ↓
                 ┌────────────────┐
                 │ Team Dashboard │
                 │                │
                 │ See all chats, │
                 │ AI-handled or  │
                 │ escalated      │
                 └────────────────┘
```

---

## Database Schema Updates

Add to your existing schema:

### 1. `knowledge_base`
```sql
create table knowledge_base (
  id uuid primary key default uuid_generate_v4(),
  category text not null,              -- 'pricing', 'features', 'proof', 'faq'
  question text not null,               -- Common question variants
  answer text not null,                 -- Approved answer
  context text,                         -- Additional context for AI
  image_urls text[],                    -- Win screenshots, etc.
  metadata jsonb,                       -- Tags, priority, etc.
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Full text search index
create index idx_kb_question_search on knowledge_base
  using gin(to_tsvector('english', question || ' ' || coalesce(context, '')));

-- Example entries
insert into knowledge_base (category, question, answer, image_urls) values
(
  'pricing',
  'What is the difference between Core, Pro, and Executive tiers?',
  'Core ($199/mo) includes SPX day trade setups and morning watchlist. Pro ($299/mo) adds LEAPS and swing trades with position building logic. Executive ($499/mo) includes everything plus NDX real-time alerts and high-conviction LEAPS framework. Most serious traders choose Executive for maximum edge.',
  null
),
(
  'proof',
  'Do you have proof of your wins? Can I see recent results?',
  'Absolutely! Our verified win rate is 87% over 8+ years. Here are some recent wins from this week:',
  ARRAY['https://...nvda-win-203.jpg', 'https://...tsla-win-156.jpg']
),
(
  'features',
  'What do I get when I join? How does it work?',
  'You get instant Discord access with real-time trade alerts including exact entry, stop loss, and take profit levels. Alerts come 1-3x daily during market hours (9:30am-4pm ET). Plus educational commentary explaining the rationale behind each trade.',
  null
);
```

### 2. Update `chat_conversations`
```sql
alter table chat_conversations add column ai_handled boolean default true;
alter table chat_conversations add column escalation_reason text;
alter table chat_conversations add column lead_score int; -- 1-10 based on AI analysis
alter table chat_conversations add column sentiment text; -- 'positive', 'neutral', 'frustrated'
```

### 3. Update `chat_messages`
```sql
alter table chat_messages add column ai_generated boolean default false;
alter table chat_messages add column ai_confidence float; -- 0.0 to 1.0
alter table chat_messages add column knowledge_base_refs uuid[]; -- Which KB entries were used
```

---

## AI Agent Implementation

### Supabase Edge Function: `handle-chat-message`

**File**: `supabase/functions/handle-chat-message/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://deno.land/x/openai@v4.20.1/mod.ts'

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

serve(async (req) => {
  try {
    const { conversationId, visitorMessage } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Get conversation context
    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('*, metadata')
      .eq('id', conversationId)
      .single()

    // 2. Get recent message history
    const { data: messageHistory } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10)

    // 3. Check if should escalate to human
    const shouldEscalate = await checkEscalationTriggers(
      visitorMessage,
      conversation,
      messageHistory
    )

    if (shouldEscalate.escalate) {
      // Escalate to human
      await escalateToHuman(supabase, conversationId, shouldEscalate.reason)

      return new Response(JSON.stringify({
        escalated: true,
        reason: shouldEscalate.reason
      }))
    }

    // 4. Search knowledge base
    const relevantKnowledge = await searchKnowledgeBase(supabase, visitorMessage)

    // 5. Call OpenAI with context
    const aiResponse = await generateAIResponse(
      visitorMessage,
      messageHistory,
      relevantKnowledge,
      conversation.metadata
    )

    // 6. Save AI response to database
    const { data: newMessage } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
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

    // 7. Check if low confidence → flag for human review
    if (aiResponse.confidence < 0.7) {
      await flagForReview(supabase, conversationId, 'Low AI confidence')
    }

    return new Response(JSON.stringify({
      success: true,
      message: newMessage
    }))

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500
    })
  }
})
```

---

## AI Prompt Engineering

### System Prompt

```typescript
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
- Tiers: Core ($199), Pro ($299), Executive ($499)
- Guarantee: 30-day action-based money-back guarantee

## Pricing Tiers
- **Core Sniper ($199/mo)**: SPX day trades, morning watchlist, high-volume alerts, educational commentary
- **Pro Sniper ($299/mo)**: Everything in Core + LEAPS, advanced swing trades, position building logic, market structure insights
- **Executive Sniper ($499/mo)**: Everything in Pro + NDX real-time alerts, high-conviction LEAPS, advanced trade commentary, risk scaling education

## Brand Voice
- Confident but not arrogant
- Results-focused, no fluff
- Luxury positioning (we're premium, not cheap)
- Transparent about wins AND the work required
- Educational, not just "buy signals"

## When to Escalate to Human
1. Visitor explicitly asks to speak with a person
2. Questions about very specific trades or technical analysis beyond your knowledge
3. Complaints or concerns about the service
4. High-value indicators (mentions large account size, serious about Executive tier, ready to buy)
5. Complex questions requiring nuanced human judgment

## Response Guidelines
- Keep responses concise (2-3 paragraphs max)
- Use bullet points for clarity when listing features
- Share win screenshot URLs when discussing proof
- Always mention the 30-day guarantee when discussing pricing
- If you don't know something specific, say so and offer to connect them with the team

## Example Tone
"Our Executive tier is designed for serious traders targeting maximum returns. You'll get real-time NDX alerts with our highest-conviction setups - the same trades our founder takes personally. Here's what one member said: 'Turned $2,500 into $11,200 in my first month.' Want to see some recent wins from this week?"
`

async function generateAIResponse(
  visitorMessage: string,
  messageHistory: any[],
  knowledgeBase: any[],
  visitorContext: any
) {
  // Build context from knowledge base
  const kbContext = knowledgeBase.map(kb =>
    `Q: ${kb.question}\nA: ${kb.answer}${kb.image_urls ? `\nProof: ${kb.image_urls.join(', ')}` : ''}`
  ).join('\n\n')

  // Build conversation history
  const conversationContext = messageHistory.map(msg =>
    `${msg.sender_type === 'visitor' ? 'Visitor' : 'AI'}: ${msg.message_text}`
  ).join('\n')

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        role: 'system',
        content: `Relevant Knowledge Base:\n${kbContext}\n\nVisitor Context: Pages viewed: ${visitorContext.pagesViewed?.join(', ')}, Time on site: ${visitorContext.timeOnSite}s`
      },
      {
        role: 'user',
        content: `Previous conversation:\n${conversationContext}\n\nVisitor's latest message: ${visitorMessage}`
      }
    ],
    temperature: 0.7,
    max_tokens: 500
  })

  const response = completion.choices[0].message.content

  // Calculate confidence based on completion metadata
  const confidence = completion.choices[0].finish_reason === 'stop' ? 0.9 : 0.6

  // Extract image URL if AI referenced proof
  let imageUrl = null
  const imageMatch = response.match(/Proof: (https?:\/\/[^\s]+)/)
  if (imageMatch) {
    imageUrl = imageMatch[1]
  }

  return {
    text: response.replace(/Proof: https?:\/\/[^\s]+/, '').trim(),
    imageUrl,
    confidence
  }
}
```

---

## Escalation Logic

### Smart Triggers

```typescript
async function checkEscalationTriggers(
  message: string,
  conversation: any,
  history: any[]
) {
  const triggers = []

  // 1. Explicit human request
  const humanKeywords = ['speak to human', 'talk to person', 'real person', 'agent', 'representative']
  if (humanKeywords.some(kw => message.toLowerCase().includes(kw))) {
    triggers.push('Visitor requested human agent')
  }

  // 2. Frustrated sentiment
  const frustrationKeywords = ['frustrated', 'disappointed', 'terrible', 'scam', 'fake', 'waste']
  if (frustrationKeywords.some(kw => message.toLowerCase().includes(kw))) {
    triggers.push('Negative sentiment detected')
  }

  // 3. High-value indicators
  const valueKeywords = ['executive tier', '$499', 'ready to join', 'sign up now', '6 figure', 'serious trader']
  if (valueKeywords.some(kw => message.toLowerCase().includes(kw))) {
    triggers.push('High-value lead detected')
  }

  // 4. Repeated questions (AI couldn't answer satisfactorily)
  const visitorMessages = history.filter(m => m.sender_type === 'visitor')
  if (visitorMessages.length > 4) {
    triggers.push('Extended conversation - human touch needed')
  }

  // 5. Technical questions beyond AI scope
  const technicalKeywords = ['specific entry', 'why did you exit', 'what indicator', 'fibonacci level']
  if (technicalKeywords.some(kw => message.toLowerCase().includes(kw))) {
    triggers.push('Technical question requiring expert')
  }

  // 6. Complaints or refund mentions
  if (message.toLowerCase().includes('refund') || message.toLowerCase().includes('cancel')) {
    triggers.push('Billing/retention concern')
  }

  return {
    escalate: triggers.length > 0,
    reason: triggers.join('; ')
  }
}

async function escalateToHuman(supabase, conversationId, reason) {
  // 1. Update conversation
  await supabase
    .from('chat_conversations')
    .update({
      ai_handled: false,
      escalation_reason: reason,
      updated_at: new Date().toISOString()
    })
    .eq('id', conversationId)

  // 2. Send handoff message
  await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'team',
      sender_name: 'TradeITM AI',
      message_text: 'Let me connect you with someone from our team who can help you better. One moment...',
      ai_generated: true,
      ai_confidence: 1.0
    })

  // 3. Notify team (push notification, email, SMS, etc.)
  await notifyTeam({
    conversationId,
    reason,
    priority: reason.includes('High-value') ? 'high' : 'normal'
  })
}
```

---

## Knowledge Base Management

### Admin Interface for Team

**File**: `app/team/knowledge-base/page.tsx`

```typescript
export default function KnowledgeBaseAdmin() {
  const [entries, setEntries] = useState([])

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Knowledge Base Management</h1>

      <div className="grid gap-6">
        {/* Add New Entry */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Add New Entry</h2>
          <form onSubmit={handleAddEntry}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <select className="w-full p-2 border rounded">
                  <option value="pricing">Pricing</option>
                  <option value="features">Features</option>
                  <option value="proof">Proof/Results</option>
                  <option value="faq">FAQ</option>
                  <option value="technical">Technical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Question (variations separated by | )
                </label>
                <input
                  type="text"
                  placeholder="What's the win rate? | How accurate are you? | Success rate?"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Answer</label>
                <textarea
                  rows={4}
                  placeholder="Our verified win rate is 87% over 8+ years..."
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Image URLs (for proof screenshots)
                </label>
                <input
                  type="text"
                  placeholder="https://... (comma separated)"
                  className="w-full p-2 border rounded"
                />
              </div>

              <Button type="submit">Add to Knowledge Base</Button>
            </div>
          </form>
        </Card>

        {/* Existing Entries */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Existing Entries ({entries.length})</h2>
          <div className="space-y-4">
            {entries.map(entry => (
              <KnowledgeBaseEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
```

---

## Team Dashboard with AI/Human Handoff

### Chat View Updates

```typescript
function ConversationItem({ conversation }) {
  const isAiHandled = conversation.ai_handled
  const isEscalated = !conversation.ai_handled && conversation.escalation_reason

  return (
    <div className="p-4 border rounded-lg hover:bg-accent/10 cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {conversation.visitor_name || 'Anonymous'}
          </span>

          {/* AI/Human Badge */}
          {isAiHandled ? (
            <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded">
              🤖 AI
            </span>
          ) : isEscalated ? (
            <span className="text-xs px-2 py-1 bg-orange-500/10 text-orange-400 rounded animate-pulse">
              👋 Needs Human
            </span>
          ) : (
            <span className="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded">
              ✓ Human
            </span>
          )}

          {/* Lead Score */}
          {conversation.lead_score >= 7 && (
            <span className="text-xs px-2 py-1 bg-champagne-500/10 text-champagne-400 rounded">
              🔥 Hot Lead
            </span>
          )}
        </div>

        <span className="text-xs text-muted-foreground">
          {formatTimeAgo(conversation.last_message_at)}
        </span>
      </div>

      {/* Escalation Reason */}
      {isEscalated && (
        <div className="text-xs text-orange-400 mb-2">
          ⚠️ {conversation.escalation_reason}
        </div>
      )}

      {/* Last Message Preview */}
      <p className="text-sm text-muted-foreground truncate">
        {conversation.last_message_preview}
      </p>

      {/* Take Over Button */}
      {isAiHandled && (
        <button
          onClick={() => takeOverFromAI(conversation.id)}
          className="mt-2 text-xs text-champagne-400 hover:underline"
        >
          Take over this chat
        </button>
      )}
    </div>
  )
}
```

---

## AI Learning from Human Responses

### Capture Team Responses as Training Data

```typescript
async function captureHumanResponse(messageId, conversationId) {
  // When team member sends a message, check if it answered a visitor question
  const { data: recentMessages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(5)

  // Find the visitor question that preceded this human answer
  const visitorQuestion = recentMessages.find(
    m => m.sender_type === 'visitor' && m.created_at < currentMessage.created_at
  )

  if (visitorQuestion) {
    // Suggest adding to knowledge base
    await supabase
      .from('suggested_kb_entries')
      .insert({
        question: visitorQuestion.message_text,
        answer: currentMessage.message_text,
        source_conversation_id: conversationId,
        status: 'pending_review'
      })

    // Notify admin: "Add this Q&A to knowledge base?"
  }
}
```

### Weekly AI Performance Review

```sql
-- Query: Questions AI couldn't handle well (low confidence or escalated)
select
  cm.message_text as question,
  cm.ai_confidence,
  cc.escalation_reason,
  count(*) as frequency
from chat_messages cm
join chat_conversations cc on cm.conversation_id = cc.id
where
  cm.ai_generated = true
  and (cm.ai_confidence < 0.7 or cc.escalation_reason is not null)
group by cm.message_text, cm.ai_confidence, cc.escalation_reason
order by frequency desc
limit 20;
```

**Use this to improve knowledge base weekly.**

---

## Cost Analysis

### OpenAI API Costs

**GPT-4o Pricing (as of 2026):**
- Input: $5 per 1M tokens
- Output: $15 per 1M tokens

**Estimated per conversation:**
- Average prompt: ~800 tokens (system + KB + history + question)
- Average response: ~200 tokens
- Cost per message: ~$0.007 (less than 1 cent)

**Monthly estimates:**
- 500 conversations/month
- Average 5 messages per conversation = 2,500 messages
- Cost: 2,500 × $0.007 = **$17.50/month**

**Compared to:**
- Intercom: $74/month
- Team member time: $20/hr × 10hrs/month = $200+

**ROI**: Massive savings + 24/7 availability!

---

## Hybrid Mode: Best of Both Worlds

### Workflow

```
Visitor initiates chat
        ↓
┌───────────────────────────────────┐
│ AI handles initial greeting       │
│ "Hi! I'm here to help. What       │
│  brings you to TradeITM today?"   │
└─────────────┬─────────────────────┘
              ↓
     Visitor asks question
              ↓
┌───────────────────────────────────┐
│ AI searches knowledge base        │
│ High confidence (>80%)?           │
├─────────────┬─────────────────────┤
│ YES         │ NO                  │
│ AI responds │ Check if team       │
│ instantly   │ online              │
│             ├──────┬──────────────┤
│             │ YES  │ NO           │
│             │ Hand │ AI responds  │
│             │ off  │ + flag for   │
│             │ now  │ review       │
└─────────────┴──────┴──────────────┘
```

**Example conversation:**

```
Visitor: What's your win rate?
AI: Our verified win rate is 87% over 8+ years of trading...
    [Confidence: 95% - AI handled]

Visitor: Can you show me yesterday's trades?
AI: Let me connect you with our team who can share the latest wins...
    [Confidence: 40% - Escalated to human]

Nathan: Hey! Here's yesterday's NVDA call: +203% [screenshot]
         And our TSLA put: +156% [screenshot]
         Want me to walk you through the setups?

Visitor: Yes please!
Nathan: [Continues conversation...]
```

---

## Implementation Phases

### Phase 1: AI Foundation (Week 1)
- ✅ Set up knowledge base table
- ✅ Create 20-30 initial KB entries covering common questions
- ✅ Build Supabase Edge Function for AI responses
- ✅ Integrate OpenAI API
- ✅ Test AI responses quality

### Phase 2: Escalation Logic (Week 2)
- ✅ Implement escalation triggers
- ✅ Build team notification system
- ✅ Add AI/Human badges to dashboard
- ✅ Create "take over" functionality

### Phase 3: Knowledge Base Management (Week 3)
- ✅ Build admin interface for KB entries
- ✅ Add image upload for win screenshots
- ✅ Implement search/categorization
- ✅ Create suggested entries from human responses

### Phase 4: Optimization (Week 4)
- ✅ A/B test AI vs human conversion rates
- ✅ Fine-tune escalation triggers
- ✅ Add lead scoring
- ✅ Build analytics dashboard

---

## Sample Knowledge Base Entries

```sql
-- Pricing questions
insert into knowledge_base (category, question, answer) values
(
  'pricing',
  'How much does it cost? | What are your prices? | Pricing? | Monthly cost?',
  'We offer three tiers: Core Sniper ($199/mo) for SPX day trades and watchlist. Pro Sniper ($299/mo) adds LEAPS and swing trades. Executive Sniper ($499/mo) includes everything plus NDX real-time alerts and our highest-conviction setups. All tiers include our 30-day action-based money-back guarantee.',
  null
);

-- Proof/Results
insert into knowledge_base (category, question, answer, image_urls) values
(
  'proof',
  'Show me proof | Recent wins | Do you have results? | Track record?',
  'Absolutely! Our verified win rate is 87% over 8+ years. Here are some recent wins from our Executive tier members:',
  ARRAY[
    'https://tradeitm.com/wins/nvda-203.jpg',
    'https://tradeitm.com/wins/tsla-156.jpg',
    'https://tradeitm.com/wins/amd-167.jpg'
  ]
);

-- How it works
insert into knowledge_base (category, question, answer) values
(
  'features',
  'How does it work? | What do I get? | How do you send alerts?',
  'Here''s how it works: (1) You join and get instant Discord access. (2) We send 1-3 high-quality trade alerts daily during market hours. (3) Each alert includes exact entry price, stop loss, and take profit levels. (4) You receive instant notifications via Discord on your phone/desktop. (5) We provide educational commentary explaining the rationale. You can follow along, learn the strategy, and execute the trades.',
  null
);

-- Guarantee
insert into knowledge_base (category, question, answer) values
(
  'faq',
  'Money back guarantee? | Can I get a refund? | Risk free?',
  'Yes! We offer a 30-day action-based money-back guarantee. Follow our trade alerts for 30 days. If you don''t see value, we''ll refund you. We''re confident in our edge - our members consistently hit 100%+ returns per trade. Terms and conditions apply.',
  null
);

-- Escalation triggers
insert into knowledge_base (category, question, answer) values
(
  'escalation',
  'Speak to human | Talk to person | Real person | Agent',
  '[ESCALATE] The visitor has requested to speak with a human team member.',
  null
);
```

---

## Monitoring & Analytics

### Key Metrics Dashboard

```typescript
// Metrics to track
interface ChatMetrics {
  // AI Performance
  aiHandledRate: number        // % of chats fully handled by AI
  avgAiConfidence: number       // Average confidence score
  escalationRate: number        // % of chats escalated to human

  // Conversion
  aiToSignupRate: number        // Conversion from AI-only chats
  humanToSignupRate: number     // Conversion from human chats
  overallConversionRate: number

  // Response Time
  avgAiResponseTime: number     // Should be <1 second
  avgHumanResponseTime: number  // Track team performance

  // Lead Quality
  avgLeadScore: number
  hotLeadsGenerated: number

  // Knowledge Base
  kbCoverageRate: number        // % of questions answered from KB
  topMissingQuestions: string[] // Questions AI struggled with
}
```

### Weekly Report

```sql
-- Weekly AI chat performance
with weekly_stats as (
  select
    count(*) filter (where ai_handled = true) as ai_only_chats,
    count(*) filter (where ai_handled = false) as human_chats,
    avg(lead_score) as avg_lead_score,
    count(*) filter (where escalation_reason is not null) as escalations
  from chat_conversations
  where created_at >= now() - interval '7 days'
)
select * from weekly_stats;

-- Top escalation reasons (areas to improve AI)
select
  escalation_reason,
  count(*) as frequency
from chat_conversations
where escalation_reason is not null
  and created_at >= now() - interval '7 days'
group by escalation_reason
order by frequency desc;
```

---

## Next Steps

Want me to:

1. **Build the knowledge base** - Create initial 30-40 entries covering your common questions?
2. **Set up the Edge Function** - Write the Supabase function for AI handling?
3. **Create database migrations** - Generate SQL for all tables?
4. **Build the widget** - Create the chat component with AI integration?
5. **Design the admin KB interface** - So you can easily add/edit knowledge base entries?

This system will save your team HOURS while providing instant 24/7 support. The AI handles routine questions, and you focus on closing high-value leads.

What should we tackle first?
