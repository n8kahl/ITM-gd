# Custom Multi-User Chat Widget - Technical Plan
## For TradeITM Landing Page

---

## Overview

Building a custom live chat system where multiple team members can respond from their phones/computers to visitor inquiries on your landing page.

**Key Features:**
- ✅ Multiple team members can view and respond
- ✅ Mobile-responsive team dashboard
- ✅ Real-time messaging (instant delivery)
- ✅ Visitor sees "Team is online" when someone's available
- ✅ Team coordination (see who's typing, who claimed the chat)
- ✅ Chat history and analytics
- ✅ Inline image sharing (send win screenshots)
- ✅ Matches your luxury brand aesthetic

---

## Tech Stack (Using What You Already Have)

### Frontend
- **Landing Page Widget**: React component with framer-motion animations
- **Team Dashboard**: Next.js app route (can access from phone browser)
- **Styling**: Your existing Tailwind + glass-morphism aesthetic

### Backend
- **Database**: Supabase PostgreSQL (you already have this)
- **Real-time**: Supabase Realtime subscriptions (WebSocket built-in)
- **Auth**: Supabase Auth for team members
- **Storage**: Supabase Storage for inline images

### Mobile
- **Progressive Web App (PWA)**: Team dashboard works offline, can be added to home screen
- **Push Notifications**: Web Push API for new message alerts

**No external dependencies needed** - your existing stack handles everything!

---

## Database Schema

### Tables to Create in Supabase

#### 1. `chat_conversations`
```sql
create table chat_conversations (
  id uuid primary key default uuid_generate_v4(),
  visitor_id text not null,           -- Anonymous ID from browser
  visitor_name text,                  -- Optional: "John" or anonymous
  visitor_email text,                 -- Collected if they provide it
  status text default 'active',       -- 'active', 'resolved', 'archived'
  assigned_to uuid references auth.users(id), -- Team member handling it
  created_at timestamp default now(),
  updated_at timestamp default now(),
  last_message_at timestamp default now(),
  metadata jsonb                      -- Store browser info, page visited, etc.
);

-- Index for fast lookups
create index idx_conversations_status on chat_conversations(status);
create index idx_conversations_assigned on chat_conversations(assigned_to);
create index idx_conversations_visitor on chat_conversations(visitor_id);
```

#### 2. `chat_messages`
```sql
create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references chat_conversations(id) on delete cascade,
  sender_type text not null,          -- 'visitor' or 'team'
  sender_id uuid,                     -- Team member ID if team message
  sender_name text,                   -- Display name
  message_text text,
  image_url text,                     -- For inline screenshots
  created_at timestamp default now(),
  read_at timestamp,                  -- When visitor/team read it
  metadata jsonb                      -- Attachments, reactions, etc.
);

-- Index for fast message retrieval
create index idx_messages_conversation on chat_messages(conversation_id, created_at);
```

#### 3. `team_members`
```sql
create table team_members (
  id uuid primary key references auth.users(id),
  display_name text not null,
  avatar_url text,
  role text default 'agent',          -- 'admin', 'agent'
  status text default 'offline',      -- 'online', 'away', 'offline'
  last_seen_at timestamp default now(),
  notification_settings jsonb,        -- Preferences for alerts
  created_at timestamp default now()
);
```

#### 4. `team_typing_indicators`
```sql
create table team_typing_indicators (
  conversation_id uuid references chat_conversations(id) on delete cascade,
  team_member_id uuid references team_members(id),
  is_typing boolean default true,
  updated_at timestamp default now(),
  primary key (conversation_id, team_member_id)
);

-- Auto-expire typing indicators older than 5 seconds
-- (You'd handle this in your app logic)
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     LANDING PAGE                             │
│                                                              │
│  Visitor browses → Chat widget appears → Clicks to start    │
│         ↓                                                    │
│    Messages sent via Supabase client                        │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
                    ┌──────────────┐
                    │   SUPABASE   │
                    │              │
                    │  PostgreSQL  │ ← Stores all messages
                    │  Realtime    │ ← WebSocket subscriptions
                    │  Storage     │ ← Image uploads
                    │  Auth        │ ← Team login
                    └──────┬───────┘
                           ↓
┌──────────────────────────┴──────────────────────────────────┐
│                   TEAM DASHBOARD                             │
│                   (Mobile/Desktop)                           │
│                                                              │
│  Team members see all active chats                          │
│  Can claim a chat, respond, send images                     │
│  Get real-time notifications                                │
│  Works on phone browser (PWA)                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Landing Page Widget

**File**: `components/ui/chat-widget.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { MessageCircle, X, Send, Image as ImageIcon } from 'lucide-react'

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [teamOnline, setTeamOnline] = useState(false)

  // Initialize conversation when widget opens
  useEffect(() => {
    if (isOpen && !conversationId) {
      initializeConversation()
    }
  }, [isOpen])

  // Subscribe to real-time messages
  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  // Check if team is online
  useEffect(() => {
    const checkTeamStatus = async () => {
      const { data } = await supabase
        .from('team_members')
        .select('status')
        .eq('status', 'online')
        .limit(1)

      setTeamOnline(!!data?.length)
    }

    checkTeamStatus()
    const interval = setInterval(checkTeamStatus, 30000) // Check every 30s

    return () => clearInterval(interval)
  }, [])

  return (
    <>
      {/* Minimized Widget - Bottom Right */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50"
          >
            {/* Glass-morphism bubble matching your design */}
            <div className="relative">
              {/* Pulsing glow when team online */}
              {teamOnline && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-emerald-500/30"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}

              <div className="relative glass-card-heavy border-emerald-500/30 p-4 rounded-full hover:border-champagne-500/50 transition-all">
                <MessageCircle className="w-6 h-6 text-champagne" />

                {/* Online indicator */}
                {teamOnline && (
                  <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
                )}
              </div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 w-[90vw] sm:w-[400px] h-[600px] sm:h-[650px] z-50"
          >
            <div className="glass-card-heavy border-emerald-500/30 rounded-2xl overflow-hidden flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b border-border/40 bg-gradient-to-r from-emerald-500/10 to-champagne-500/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-ivory">TradeITM Support</h3>
                    <p className="text-xs text-platinum/60">
                      {teamOnline ? (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                          Team is online
                        </span>
                      ) : (
                        "We'll respond soon"
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-platinum/60 hover:text-ivory transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-border/40">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 bg-background/50 border border-border/40 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-2 rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
```

---

### 2. Team Dashboard

**File**: `app/team/chat/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Users, Clock } from 'lucide-react'

export default function TeamChatDashboard() {
  const [conversations, setConversations] = useState([])
  const [selectedConv, setSelectedConv] = useState(null)
  const [teamMembers, setTeamMembers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)

  // Load active conversations
  useEffect(() => {
    loadConversations()

    // Subscribe to new conversations
    const channel = supabase
      .channel('all-conversations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_conversations'
      }, () => {
        loadConversations()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Update team member status to online
  useEffect(() => {
    const updateStatus = async () => {
      if (!currentUser) return

      await supabase
        .from('team_members')
        .update({
          status: 'online',
          last_seen_at: new Date().toISOString()
        })
        .eq('id', currentUser.id)
    }

    updateStatus()
    const interval = setInterval(updateStatus, 60000) // Update every minute

    // Set offline on unmount
    return () => {
      clearInterval(interval)
      if (currentUser) {
        supabase
          .from('team_members')
          .update({ status: 'offline' })
          .eq('id', currentUser.id)
      }
    }
  }, [currentUser])

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gradient-champagne">
          Team Chat Dashboard
        </h1>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Conversations List */}
          <div className="lg:col-span-1">
            <Card className="glass-card-heavy p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Active Chats ({conversations.length})
              </h2>

              <div className="space-y-2">
                {conversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedConv?.id === conv.id}
                    onClick={() => setSelectedConv(conv)}
                  />
                ))}
              </div>
            </Card>

            {/* Team Status */}
            <Card className="glass-card-heavy p-4 mt-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team ({teamMembers.filter(m => m.status === 'online').length} online)
              </h2>

              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <TeamMemberStatus key={member.id} member={member} />
                ))}
              </div>
            </Card>
          </div>

          {/* Chat Window */}
          <div className="lg:col-span-2">
            {selectedConv ? (
              <ChatWindow conversation={selectedConv} />
            ) : (
              <Card className="glass-card-heavy p-8 text-center">
                <MessageSquare className="w-16 h-16 mx-auto text-platinum/20 mb-4" />
                <p className="text-platinum/60">
                  Select a conversation to start chatting
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## Key Features Implementation

### 1. **Real-Time Message Delivery**

Using Supabase Realtime:

```typescript
// Both visitor and team subscribe to the same conversation
const channel = supabase
  .channel(`conversation:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'chat_messages',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => {
    // New message arrives instantly
    addMessage(payload.new)
  })
  .subscribe()
```

**Result**: Messages appear instantly (< 100ms) on both sides.

---

### 2. **Team Coordination - "Claim" a Chat**

```typescript
async function claimConversation(conversationId, teamMemberId) {
  const { data, error } = await supabase
    .from('chat_conversations')
    .update({
      assigned_to: teamMemberId,
      updated_at: new Date().toISOString()
    })
    .eq('id', conversationId)
    .is('assigned_to', null) // Only if not already claimed
    .select()

  if (data?.length) {
    // Successfully claimed!
    return { success: true }
  } else {
    // Someone else claimed it first
    return { success: false, message: 'Already claimed by another team member' }
  }
}
```

**UX**:
- Unclaimed chats show in everyone's dashboard
- First person to click "Claim" gets assigned
- Other team members see "Nathan is handling this"
- Prevents duplicate responses

---

### 3. **Typing Indicators**

```typescript
// Visitor sees "Nathan is typing..."
function handleTyping(conversationId, teamMemberId, displayName) {
  // Upsert typing indicator
  supabase
    .from('team_typing_indicators')
    .upsert({
      conversation_id: conversationId,
      team_member_id: teamMemberId,
      is_typing: true,
      updated_at: new Date().toISOString()
    })

  // Auto-remove after 3 seconds of no activity
  setTimeout(() => {
    supabase
      .from('team_typing_indicators')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('team_member_id', teamMemberId)
  }, 3000)
}

// Subscribe to typing indicators
supabase
  .channel(`typing:${conversationId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'team_typing_indicators',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => {
    // Show/hide typing indicator
  })
  .subscribe()
```

---

### 4. **Inline Image Sharing**

```typescript
async function sendImageMessage(conversationId, file, teamMemberId) {
  // 1. Upload to Supabase Storage
  const fileName = `${conversationId}/${Date.now()}-${file.name}`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('chat-images')
    .upload(fileName, file)

  if (uploadError) throw uploadError

  // 2. Get public URL
  const { data: urlData } = supabase.storage
    .from('chat-images')
    .getPublicUrl(fileName)

  // 3. Send message with image URL
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'team',
      sender_id: teamMemberId,
      sender_name: 'Nathan',
      message_text: '',
      image_url: urlData.publicUrl
    })
    .select()

  return data[0]
}
```

**Use Case**: Team member sends today's NVDA +203% win screenshot directly in chat.

---

### 5. **Mobile PWA Setup**

**File**: `public/manifest.json`

```json
{
  "name": "TradeITM Team Chat",
  "short_name": "TITM Chat",
  "description": "Respond to customer inquiries",
  "start_url": "/team/chat",
  "display": "standalone",
  "background_color": "#0a0a0b",
  "theme_color": "#047857",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**File**: `app/layout.tsx` (add to `<head>`)

```typescript
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#047857" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

**Result**:
- Team members can add chat dashboard to phone home screen
- Works offline (shows cached conversations)
- Looks like a native app

---

### 6. **Push Notifications**

```typescript
// Request permission
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

// Send notification when new message arrives (and user not actively viewing)
function notifyNewMessage(message) {
  if (document.hidden && 'Notification' in window) {
    new Notification('New chat message', {
      body: message.message_text || 'New image received',
      icon: '/icon-192.png',
      badge: '/badge-icon.png',
      tag: message.conversation_id, // Prevents duplicate notifications
      vibrate: [200, 100, 200]
    })
  }
}
```

**Result**: Team members get alerts on their phone even when browser is in background.

---

## Mobile Team Interface Design

### Responsive Layout

**Desktop (>1024px):**
```
┌──────────────────┬────────────────────────────┐
│                  │                            │
│  Conversations   │    Chat Window             │
│  List            │                            │
│                  │    [Messages...]           │
│  [Chat 1]        │                            │
│  [Chat 2]        │                            │
│  [Chat 3]        │                            │
│                  │    [Input box]             │
│  Team Status     │                            │
│  • Nathan (you)  │                            │
│  • Mike          │                            │
│  • Sarah         │                            │
│                  │                            │
└──────────────────┴────────────────────────────┘
```

**Mobile (<768px):**
```
View 1: Conversation List
┌───────────────────────┐
│  ← TradeITM Chat      │
├───────────────────────┤
│  🟢 3 Active Chats    │
├───────────────────────┤
│  [Chat 1] New         │
│  John D. - 2m ago     │
│  "What's the diff..." │
├───────────────────────┤
│  [Chat 2] Claimed     │
│  Sarah M. - 5m ago    │
│  "Is this legit?"     │
├───────────────────────┤
│  [Chat 3] New         │
│  Anonymous - 8m ago   │
│  "Pricing question"   │
└───────────────────────┘
         ↓ Tap chat
View 2: Chat Window
┌───────────────────────┐
│  ← Back    John D.    │
├───────────────────────┤
│                       │
│  [Messages...]        │
│                       │
│  Visitor: What's the  │
│  difference between   │
│  Pro and Executive?   │
│                       │
│  You: Great question! │
│  Executive tier gets..│
│                       │
├───────────────────────┤
│  [Type message...]    │
│  📷 [Send]            │
└───────────────────────┘
```

**Swipe gestures:**
- Swipe right on chat → Claim it
- Swipe left on chat → Mark as resolved
- Pull down to refresh conversations

---

## Smart Features for Your Use Case

### 1. **Pre-Qualification Questions**

Before starting chat, ask visitor:

```typescript
const preQualQuestions = [
  {
    id: 'interest',
    question: 'What brings you to TradeITM today?',
    options: [
      'Interested in joining',
      'Questions about pricing',
      'Want to see proof/results',
      'Technical support'
    ]
  },
  {
    id: 'tier',
    question: 'Which tier are you considering?',
    options: ['Core ($199)', 'Pro ($299)', 'Execute ($499)', 'Not sure yet']
  }
]
```

**Benefits:**
- Team knows context before responding
- Can prioritize high-value leads
- Stored in conversation metadata

---

### 2. **Canned Responses**

```typescript
const cannedResponses = {
  winRate: "Our verified win rate is 87% over 8+ years of trading. Every trade includes exact entry, stop loss, and take profit levels.",

  difference: "Core ($199) = SPX day trades + watchlist. Pro ($299) adds LEAPS + swing trades. Execute ($499) adds NDX real-time alerts + high-conviction setups. Most serious traders choose Execute.",

  guarantee: "We offer a 30-day action-based money-back guarantee. Follow our alerts for 30 days - if you don't see value, we'll refund you. Terms apply.",

  timing: "Alerts come throughout the trading day (9:30am-4pm ET). Average 1-3 high-quality setups daily. You get instant Discord notifications.",

  proof: "[Would you like to see today's actual wins? Let me grab a screenshot...]"
}
```

**UX**:
- Team dashboard has quick-reply buttons
- One tap to send common answers
- Speeds up response time

---

### 3. **Conversation Context Panel**

Show team members:

```
┌─────────────────────────────────┐
│ Visitor Context                 │
├─────────────────────────────────┤
│ 📍 Location: New York, NY       │
│ 🌐 Referrer: Google Search      │
│ ⏱️  Time on site: 4m 23s        │
│ 📄 Pages viewed: 3              │
│    → Landing page               │
│    → Pricing (spent 2m here)    │
│    → Testimonials               │
│ 💰 Interested in: Executive tier│
│ ❓ Pre-qual: "Want to see proof"│
└─────────────────────────────────┘
```

**How to capture:**

```typescript
// Store visitor metadata when conversation starts
const metadata = {
  location: await getLocationFromIP(),
  referrer: document.referrer,
  pagesViewed: getPageHistory(),
  timeOnSite: calculateTimeOnSite(),
  interestedTier: preQualAnswers.tier,
  primaryQuestion: preQualAnswers.interest
}

await supabase
  .from('chat_conversations')
  .insert({
    visitor_id: visitorId,
    metadata: metadata
  })
```

**Benefit**: Team can personalize responses based on visitor's journey.

---

### 4. **Auto-Responses for After Hours**

```typescript
async function checkIfTeamOnline() {
  const { data: onlineTeam } = await supabase
    .from('team_members')
    .select('id')
    .eq('status', 'online')
    .limit(1)

  if (!data?.length) {
    // No one online - send auto-response
    await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'team',
        sender_name: 'TradeITM Team',
        message_text: "Thanks for reaching out! We're currently away from the desk (trading hours: 9am-6pm ET). Leave your question and email - we'll respond within a few hours. Or join our Discord for 24/7 community support!"
      })
  }
}
```

---

### 5. **Analytics Dashboard**

Track in separate table:

```sql
create table chat_analytics (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  total_conversations int default 0,
  conversations_to_signup int default 0,
  avg_response_time_seconds int,
  avg_conversation_length_minutes int,
  busiest_hour int,
  metadata jsonb,
  created_at timestamp default now()
);
```

**Metrics to track:**
- Conversion rate (chat → signup)
- Average response time
- Busiest hours (know when to be online)
- Common questions (improve FAQ)
- Which team member converts best

---

## Security Considerations

### 1. **Row Level Security (RLS)**

```sql
-- Team members can only see conversations
alter table chat_conversations enable row level security;

create policy "Team members can view all conversations"
  on chat_conversations for select
  using (auth.uid() in (select id from team_members));

create policy "Team members can update assigned conversations"
  on chat_conversations for update
  using (auth.uid() in (select id from team_members));

-- Visitors can only see their own conversation
create policy "Visitors can view own conversation"
  on chat_conversations for select
  using (visitor_id = current_setting('app.visitor_id'));

-- Messages: similar policies
alter table chat_messages enable row level security;

create policy "Anyone in conversation can view messages"
  on chat_messages for select
  using (
    conversation_id in (
      select id from chat_conversations
      where visitor_id = current_setting('app.visitor_id')
      or auth.uid() in (select id from team_members)
    )
  );
```

### 2. **Rate Limiting**

```typescript
// Prevent spam - max 5 messages per minute from visitor
const rateLimiter = new Map()

function checkRateLimit(visitorId) {
  const now = Date.now()
  const userLimit = rateLimiter.get(visitorId) || { count: 0, resetAt: now + 60000 }

  if (now > userLimit.resetAt) {
    userLimit.count = 0
    userLimit.resetAt = now + 60000
  }

  if (userLimit.count >= 5) {
    throw new Error('Too many messages. Please wait a moment.')
  }

  userLimit.count++
  rateLimiter.set(visitorId, userLimit)
}
```

### 3. **Input Sanitization**

```typescript
import DOMPurify from 'isomorphic-dompurify'

function sanitizeMessage(text) {
  // Remove any HTML/scripts
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] })
}
```

---

## Development Phases

### Phase 1: MVP (Week 1)
- ✅ Database schema setup
- ✅ Basic landing page widget (open/close, send message)
- ✅ Team dashboard (view conversations, send replies)
- ✅ Real-time message delivery
- ✅ Basic styling matching your brand

**Deliverable**: Functional chat between visitor and team.

### Phase 2: Team Features (Week 2)
- ✅ Multiple team member support
- ✅ Claim/assign conversations
- ✅ Team online/offline status
- ✅ Typing indicators
- ✅ Mobile-responsive team dashboard

**Deliverable**: Multiple team members can collaborate.

### Phase 3: Polish (Week 3)
- ✅ Image upload/sharing
- ✅ Canned responses
- ✅ Pre-qualification questions
- ✅ Visitor context panel
- ✅ Push notifications
- ✅ PWA setup for mobile

**Deliverable**: Production-ready with all features.

### Phase 4: Analytics (Week 4)
- ✅ Conversion tracking
- ✅ Response time metrics
- ✅ Team performance dashboard
- ✅ A/B test different pre-qual questions

**Deliverable**: Data-driven optimization.

---

## Estimated Development Time

**If building yourself:**
- Phase 1 (MVP): 12-16 hours
- Phase 2 (Team features): 8-12 hours
- Phase 3 (Polish): 10-14 hours
- Phase 4 (Analytics): 6-8 hours

**Total**: 36-50 hours (~1-2 weeks at 4-6 hrs/day)

**If hiring a developer:**
- At $75-150/hr: $2,700 - $7,500
- But you own it forever, no monthly fees

---

## Cost Comparison: Custom vs Third-Party

### Third-Party (Intercom/Crisp)
- **Setup**: $0 (30 min)
- **Monthly**: $25-75/mo
- **Year 1**: $300-900
- **5 Years**: $1,500-4,500

### Custom Build
- **Development**: $0 (if you build) or $3,000-7,500 (hired)
- **Monthly**: ~$5 (Supabase bandwidth)
- **Year 1**: $3,060 - $7,560
- **5 Years**: $3,300 - $7,800

**Break-even**: Year 2-3

**But you get:**
- Complete customization
- No visitor limits
- Integrated with your database
- Can add any feature you want
- No third-party branding
- Own all data

---

## Next Steps

Would you like me to:

1. **Build the initial database schema** - I can generate the SQL migrations for Supabase
2. **Create starter components** - Build the basic widget and team dashboard
3. **Set up authentication** - Configure team member login
4. **Design mockups** - Create high-fidelity designs matching your aesthetic
5. **Build a prototype** - Working demo you can test

Which would be most helpful to get started?
