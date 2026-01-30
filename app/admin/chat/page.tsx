'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MessageSquare,
  Users,
  Sparkles,
  User,
  X,
  Send,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  Filter
} from 'lucide-react'

interface Conversation {
  id: string
  visitor_id: string
  visitor_name: string | null
  visitor_email: string | null
  status: string
  ai_handled: boolean
  escalation_reason: string | null
  lead_score: number | null
  last_message_at: string
  created_at: string
  metadata: any
}

interface Message {
  id: string
  conversation_id: string
  sender_type: string
  sender_name: string
  message_text: string
  image_url: string | null
  ai_generated: boolean
  ai_confidence: number | null
  created_at: string
}

export default function ChatManagementPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [filter, setFilter] = useState<'all' | 'ai' | 'human' | 'escalated'>('all')
  const [stats, setStats] = useState({
    total: 0,
    aiHandled: 0,
    humanHandled: 0,
    escalated: 0,
    highValue: 0
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load conversations
  useEffect(() => {
    loadConversations()

    // Subscribe to new conversations
    const channel = supabase
      .channel('admin-conversations')
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

  // Filter conversations
  useEffect(() => {
    let filtered = conversations

    switch (filter) {
      case 'ai':
        filtered = conversations.filter(c => c.ai_handled === true)
        break
      case 'human':
        filtered = conversations.filter(c => c.ai_handled === false && !c.escalation_reason)
        break
      case 'escalated':
        filtered = conversations.filter(c => c.escalation_reason !== null)
        break
    }

    setFilteredConversations(filtered)
  }, [conversations, filter])

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConv) return

    loadMessages(selectedConv.id)

    // Subscribe to new messages
    const channel = supabase
      .channel(`admin-conv-${selectedConv.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${selectedConv.id}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedConv])

  async function loadConversations() {
    const { data } = await supabase
      .from('chat_conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(100)

    if (data) {
      setConversations(data)

      // Calculate stats
      const stats = {
        total: data.length,
        aiHandled: data.filter(c => c.ai_handled).length,
        humanHandled: data.filter(c => !c.ai_handled && !c.escalation_reason).length,
        escalated: data.filter(c => c.escalation_reason).length,
        highValue: data.filter(c => c.lead_score && c.lead_score >= 7).length
      }
      setStats(stats)
    }
  }

  async function loadMessages(conversationId: string) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (data) {
      setMessages(data)
    }
  }

  async function takeOverChat(convId: string) {
    await supabase
      .from('chat_conversations')
      .update({
        ai_handled: false,
        escalation_reason: 'Manually claimed by admin'
      })
      .eq('id', convId)

    loadConversations()
  }

  async function resolveChat(convId: string) {
    await supabase
      .from('chat_conversations')
      .update({
        status: 'resolved'
      })
      .eq('id', convId)

    loadConversations()
    setSelectedConv(null)
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!inputValue.trim() || !selectedConv) return

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: selectedConv.id,
        sender_type: 'team',
        sender_name: 'Admin',
        message_text: inputValue.trim(),
        ai_generated: false
      })

    if (!error) {
      setInputValue('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gradient-champagne mb-2">
          Chat Conversations
        </h1>
        <p className="text-platinum/60">
          Manage visitor conversations and AI escalations
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="glass-card-heavy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60">
              Total Chats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-ivory">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="glass-card-heavy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI Handled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{stats.aiHandled}</div>
            <p className="text-xs text-platinum/40 mt-1">
              {stats.total > 0 ? Math.round((stats.aiHandled / stats.total) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card-heavy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60 flex items-center gap-1">
              <User className="w-3 h-3" />
              Human
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{stats.humanHandled}</div>
          </CardContent>
        </Card>

        <Card className="glass-card-heavy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Escalated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">{stats.escalated}</div>
          </CardContent>
        </Card>

        <Card className="glass-card-heavy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              High Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-champagne">{stats.highValue}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Chat Interface */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <div className="lg:col-span-1">
          <Card className="glass-card-heavy">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Conversations
                </CardTitle>
              </div>

              {/* Filter Buttons */}
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilter('all')}
                  className="text-xs"
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'ai' ? 'default' : 'outline'}
                  onClick={() => setFilter('ai')}
                  className="text-xs"
                >
                  AI
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'escalated' ? 'default' : 'outline'}
                  onClick={() => setFilter('escalated')}
                  className="text-xs"
                >
                  Escalated
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="space-y-2 max-h-[calc(100vh-450px)] overflow-y-auto p-4">
                {filteredConversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedConv?.id === conv.id}
                    onClick={() => setSelectedConv(conv)}
                    onTakeOver={() => takeOverChat(conv.id)}
                  />
                ))}

                {filteredConversations.length === 0 && (
                  <div className="text-center py-8 text-platinum/40">
                    No conversations found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chat Window */}
        <div className="lg:col-span-2">
          {selectedConv ? (
            <Card className="glass-card-heavy h-[calc(100vh-250px)] flex flex-col">
              {/* Header */}
              <CardHeader className="border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {selectedConv.visitor_name || 'Anonymous Visitor'}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-platinum/60 mt-1">
                      {selectedConv.ai_handled ? (
                        <span className="flex items-center gap-1 text-blue-400">
                          <Sparkles className="w-3 h-3" />
                          AI Handled
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <User className="w-3 h-3" />
                          Human
                        </span>
                      )}
                      {selectedConv.escalation_reason && (
                        <>
                          <span className="text-platinum/40">•</span>
                          <span className="text-orange-400">
                            {selectedConv.escalation_reason}
                          </span>
                        </>
                      )}
                      {selectedConv.lead_score && selectedConv.lead_score >= 7 && (
                        <>
                          <span className="text-platinum/40">•</span>
                          <span className="text-champagne">🔥 Lead Score: {selectedConv.lead_score}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resolveChat(selectedConv.id)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Resolve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedConv(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-background/50 to-background/80">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border/40 bg-background/50">
                <form onSubmit={sendMessage} className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type your response..."
                    className="flex-1"
                  />
                  <Button type="submit">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </Card>
          ) : (
            <Card className="glass-card-heavy h-[calc(100vh-250px)] flex flex-col items-center justify-center">
              <MessageSquare className="w-16 h-16 text-platinum/20 mb-4" />
              <p className="text-platinum/60">
                Select a conversation to view messages
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function ConversationItem({
  conversation,
  isSelected,
  onClick,
  onTakeOver
}: {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  onTakeOver: () => void
}) {
  const isEscalated = conversation.escalation_reason !== null

  return (
    <div
      onClick={onClick}
      className={`p-3 border rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-background/50 border-border/40 hover:bg-accent/10'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm text-ivory truncate">
          {conversation.visitor_name || conversation.visitor_id.slice(0, 20)}
        </span>

        {conversation.ai_handled ? (
          <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded flex-shrink-0">
            🤖 AI
          </span>
        ) : isEscalated ? (
          <span className="text-xs px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded animate-pulse flex-shrink-0">
            👋 Escalated
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded flex-shrink-0">
            ✓ Human
          </span>
        )}
      </div>

      {isEscalated && (
        <div className="text-xs text-orange-400 mb-2 truncate">
          ⚠️ {conversation.escalation_reason}
        </div>
      )}

      {conversation.lead_score && conversation.lead_score >= 7 && (
        <div className="text-xs text-champagne mb-2">
          🔥 High-value lead (Score: {conversation.lead_score})
        </div>
      )}

      <div className="flex items-center gap-2">
        <Clock className="w-3 h-3 text-platinum/40" />
        <span className="text-xs text-platinum/60">
          {new Date(conversation.last_message_at).toLocaleString()}
        </span>
      </div>

      {conversation.ai_handled && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onTakeOver()
          }}
          className="mt-2 text-xs text-champagne hover:underline"
        >
          Take over this chat
        </button>
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isVisitor = message.sender_type === 'visitor'
  const isSystem = message.sender_type === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-platinum/5 border border-platinum/10 rounded-lg px-3 py-2 text-xs text-platinum/60 max-w-[80%] text-center">
          {message.message_text}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isVisitor ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] ${
        isVisitor
          ? 'bg-champagne/10 border-champagne/30'
          : 'bg-emerald-500/10 border-emerald-500/30'
      } border rounded-lg px-4 py-2`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-platinum/60">
            {message.sender_name}
          </span>
          {message.ai_generated && (
            <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">
              AI {message.ai_confidence && `(${Math.round(message.ai_confidence * 100)}%)`}
            </span>
          )}
        </div>
        <p className="text-sm text-ivory whitespace-pre-wrap">{message.message_text}</p>
        {message.image_url && (
          <img src={message.image_url} alt="Shared" className="mt-2 rounded max-w-full" />
        )}
        <span className="text-xs text-platinum/40 mt-1 block">
          {new Date(message.created_at).toLocaleTimeString()}
        </span>
      </div>
    </div>
  )
}
