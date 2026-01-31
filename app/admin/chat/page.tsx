'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { playLuxuryPlink, isSoundEnabled } from '@/lib/sounds'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  MessageSquare,
  Sparkles,
  User,
  X,
  Send,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  Bell,
  BellOff,
  Flame,
  ChevronDown,
  Zap,
  Mail,
  Loader2,
  Archive,
  Trash2
} from 'lucide-react'

// Canned responses for quick replies
const CANNED_RESPONSES = [
  {
    label: 'Pricing Overview',
    shortcut: '/pricing',
    text: `Our membership tiers:

• **Core Sniper ($199/mo)**: SPX day trades, morning watchlist, high-volume alerts
• **Pro Sniper ($299/mo)**: Everything in Core + LEAPS, advanced swing trades
• **Execute Sniper ($499/mo)**: Everything in Pro + NDX alerts, high-conviction LEAPS

All tiers include our 30-day money-back guarantee!`
  },
  {
    label: 'Win Rate Stats',
    shortcut: '/stats',
    text: `Our verified performance:

• 87% win rate over 8+ years
• Target 100%+ returns per trade
• 1-3 alerts daily during market hours (9:30am-4pm ET)
• Exact entries, stop losses, and take profits on every alert`
  },
  {
    label: 'How to Join',
    shortcut: '/join',
    text: `Here's how to get started:

1. Choose your tier at tradeitm.com
2. Complete checkout via Whop
3. Join our Discord community (invite sent automatically)
4. Start receiving alerts immediately!

Questions about which tier is right for you?`
  },
  {
    label: 'Money-Back Guarantee',
    shortcut: '/guarantee',
    text: `We stand behind our service with a 30-day action-based money-back guarantee.

If you follow our alerts and don't see results within 30 days, we'll refund your membership - no questions asked. We're confident you'll see the value from day one.`
  },
  {
    label: 'Execute Tier Details',
    shortcut: '/execute',
    text: `Execute Sniper ($499/mo) is our premium tier for serious traders:

• Real-time NDX alerts (our highest-conviction setups)
• High-conviction LEAPS positions
• Advanced trade commentary & risk scaling education
• Priority support from our team

This tier is designed for traders with larger accounts looking to maximize returns.`
  }
]

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
  const searchParams = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'resolved' | 'archived'>('active')
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    resolved: 0,
    archived: 0,
    escalated: 0
  })
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [showCannedResponses, setShowCannedResponses] = useState(false)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [sendingTranscript, setSendingTranscript] = useState(false)
  const [archivingResolved, setArchivingResolved] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const previousEscalatedIds = useRef<Set<string>>(new Set())
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousMessageCount = useRef(0)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Check notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission)
      setNotificationsEnabled(Notification.permission === 'granted')
    }
  }, [])

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Desktop notifications are not supported in this browser')
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    setNotificationsEnabled(permission === 'granted')
  }, [])

  // Broadcast typing status to the visitor
  const broadcastTypingStatus = useCallback(async (conversationId: string, isTyping: boolean) => {
    try {
      if (isTyping) {
        // Insert or update typing indicator
        await supabase
          .from('team_typing_indicators')
          .upsert({
            conversation_id: conversationId,
            user_id: '00000000-0000-0000-0000-000000000000', // Admin placeholder ID
            user_name: 'TradeITM',
            is_typing: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'conversation_id,user_id'
          })
      } else {
        // Remove typing indicator
        await supabase
          .from('team_typing_indicators')
          .delete()
          .eq('conversation_id', conversationId)
          .eq('user_id', '00000000-0000-0000-0000-000000000000')
      }
    } catch (error) {
      console.warn('Failed to broadcast typing status:', error)
    }
  }, [])

  // Show desktop notification for escalation or high-value leads
  const showEscalationNotification = useCallback((conv: Conversation, reason?: string) => {
    if (!notificationsEnabled || notificationPermission !== 'granted') return

    const isHighValue = conv.lead_score && conv.lead_score >= 7
    const title = isHighValue && !conv.escalation_reason
      ? '🔥 High-Value Lead!'
      : '🚨 Chat Escalated!'

    const body = conv.escalation_reason
      ? `${conv.visitor_name || 'Visitor'}: ${conv.escalation_reason}${isHighValue ? ` • Lead Score: ${conv.lead_score}` : ''}`
      : `${conv.visitor_name || 'Visitor'} ${reason || 'needs attention'}${isHighValue ? ` • Lead Score: ${conv.lead_score}` : ''}`

    const notification = new Notification(title, {
      body,
      icon: '/hero-logo.png',
      tag: `escalation-${conv.id}`,
      requireInteraction: true
    })

    notification.onclick = () => {
      window.focus()
      setSelectedConv(conv)
      notification.close()
    }

    // Play sound alert
    if (isSoundEnabled()) {
      playLuxuryPlink()
    }

    // Auto-close after 15 seconds for high-priority
    setTimeout(() => notification.close(), 15000)
  }, [notificationsEnabled, notificationPermission])

  // Track notified high-value leads to avoid duplicate notifications
  const previousHighValueIds = useRef<Set<string>>(new Set())

  // Load conversations
  useEffect(() => {
    loadConversations()

    // Subscribe to new conversations and escalations
    const channel = supabase
      .channel('admin-conversations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_conversations'
      }, (payload) => {
        loadConversations()

        // Check for escalations or high-value leads
        if (payload.eventType === 'UPDATE' && payload.new) {
          const updated = payload.new as Conversation

          // Notify on escalation
          if (updated.escalation_reason && !previousEscalatedIds.current.has(updated.id)) {
            previousEscalatedIds.current.add(updated.id)
            showEscalationNotification(updated)
          }

          // Notify on high lead score (>= 7) - separate from escalation
          if (updated.lead_score && updated.lead_score >= 7 && !previousHighValueIds.current.has(updated.id)) {
            previousHighValueIds.current.add(updated.id)
            if (!updated.escalation_reason) {
              // Only notify separately if not already escalated
              showEscalationNotification(updated, 'is a high-value prospect')
            }
          }
        }

        if (payload.eventType === 'INSERT' && payload.new) {
          const newConv = payload.new as Conversation

          // Track and notify on new escalated conversations
          if (newConv.escalation_reason) {
            previousEscalatedIds.current.add(newConv.id)
            showEscalationNotification(newConv)
          }

          // Track and notify on new high-value leads
          if (newConv.lead_score && newConv.lead_score >= 7) {
            previousHighValueIds.current.add(newConv.id)
            if (!newConv.escalation_reason) {
              showEscalationNotification(newConv, 'is a high-value prospect')
            }
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [showEscalationNotification])

  // Handle query parameter to auto-select conversation from Discord link
  useEffect(() => {
    const conversationId = searchParams.get('id')
    if (conversationId && conversations.length > 0 && !selectedConv) {
      const match = conversations.find(c => c.id === conversationId)
      if (match) {
        setSelectedConv(match)
      }
    }
  }, [searchParams, conversations, selectedConv])

  // Filter conversations by status
  useEffect(() => {
    const filtered = conversations.filter(c => {
      // Handle null/undefined status as 'active'
      const status = c.status || 'active'
      return status === statusFilter
    })
    setFilteredConversations(filtered)
  }, [conversations, statusFilter])

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
        const newMessage = payload.new as Message
        setMessages(prev => [...prev, newMessage])

        // Play sound for new visitor messages
        if (newMessage.sender_type === 'visitor' && isSoundEnabled()) {
          playLuxuryPlink()
        }
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

      // Track existing escalated and high-value IDs to avoid duplicate notifications
      data.forEach(conv => {
        if (conv.escalation_reason) {
          previousEscalatedIds.current.add(conv.id)
        }
        if (conv.lead_score && conv.lead_score >= 7) {
          previousHighValueIds.current.add(conv.id)
        }
      })

      // Calculate stats
      const stats = {
        total: data.length,
        active: data.filter(c => !c.status || c.status === 'active').length,
        resolved: data.filter(c => c.status === 'resolved').length,
        archived: data.filter(c => c.status === 'archived').length,
        escalated: data.filter(c => c.escalation_reason && (!c.status || c.status === 'active')).length
      }
      setStats(stats)
    }
  }

  function insertCannedResponse(text: string) {
    setInputValue(text)
    setShowCannedResponses(false)
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

  function handleResolveClick() {
    setShowResolveModal(true)
  }

  async function resolveChat(sendTranscript: boolean) {
    if (!selectedConv) return

    // If sending transcript, do that first
    if (sendTranscript && selectedConv.visitor_email) {
      setSendingTranscript(true)
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-chat-transcript`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              conversationId: selectedConv.id,
              recipientEmail: selectedConv.visitor_email
            })
          }
        )

        if (!response.ok) {
          const error = await response.json()
          console.error('Failed to send transcript:', error)
          alert('Failed to send transcript. Resolving chat anyway.')
        }
      } catch (error) {
        console.error('Failed to send transcript:', error)
        alert('Failed to send transcript. Resolving chat anyway.')
      }
      setSendingTranscript(false)
    }

    // Add system message
    await supabase
      .from('chat_messages')
      .insert({
        conversation_id: selectedConv.id,
        sender_type: 'system',
        sender_name: 'System',
        message_text: 'Conversation marked as resolved.',
        ai_generated: false
      })

    // Mark conversation as resolved
    await supabase
      .from('chat_conversations')
      .update({
        status: 'resolved'
      })
      .eq('id', selectedConv.id)

    setShowResolveModal(false)
    loadConversations()
    setSelectedConv(null)
  }

  async function archiveChat() {
    if (!selectedConv) return

    await supabase
      .from('chat_conversations')
      .update({
        status: 'archived'
      })
      .eq('id', selectedConv.id)

    setShowArchiveDialog(false)
    loadConversations()
    setSelectedConv(null)
  }

  async function clearResolvedChats() {
    setArchivingResolved(true)

    // Get all resolved conversations
    const { data: resolvedConvs } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('status', 'resolved')

    if (resolvedConvs && resolvedConvs.length > 0) {
      // Archive all resolved conversations
      await supabase
        .from('chat_conversations')
        .update({ status: 'archived' })
        .in('id', resolvedConvs.map(c => c.id))

      loadConversations()
    }

    setArchivingResolved(false)
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!inputValue.trim() || !selectedConv) return

    // Clear typing indicator immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    broadcastTypingStatus(selectedConv.id, false)

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-champagne mb-2">
            Chat Conversations
          </h1>
          <p className="text-platinum/60">
            Manage visitor conversations and AI escalations
          </p>
        </div>

        {/* Desktop Notifications Toggle */}
        <Button
          variant={notificationsEnabled ? 'default' : 'outline'}
          onClick={notificationsEnabled ? () => setNotificationsEnabled(false) : requestNotificationPermission}
          className={notificationsEnabled ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
        >
          {notificationsEnabled ? (
            <>
              <Bell className="w-4 h-4 mr-2" />
              Notifications On
            </>
          ) : (
            <>
              <BellOff className="w-4 h-4 mr-2" />
              Enable Notifications
            </>
          )}
        </Button>
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
              <MessageSquare className="w-3 h-3" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{stats.active}</div>
          </CardContent>
        </Card>

        <Card className="glass-card-heavy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Resolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{stats.resolved}</div>
          </CardContent>
        </Card>

        <Card className="glass-card-heavy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60 flex items-center gap-1">
              <Archive className="w-3 h-3" />
              Archived
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-platinum/40">{stats.archived}</div>
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

              {/* Status Filter Buttons */}
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant={statusFilter === 'active' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('active')}
                  className="text-xs"
                >
                  Active
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'resolved' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('resolved')}
                  className="text-xs"
                >
                  Resolved
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'archived' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('archived')}
                  className="text-xs"
                >
                  Archived
                </Button>
              </div>

              {/* Clear Resolved Button */}
              {statusFilter === 'resolved' && filteredConversations.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearResolvedChats}
                  disabled={archivingResolved}
                  className="mt-3 w-full text-xs text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
                >
                  {archivingResolved ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Archiving...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3 h-3 mr-1" />
                      Archive All Resolved ({filteredConversations.length})
                    </>
                  )}
                </Button>
              )}
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
                      {selectedConv.lead_score && selectedConv.lead_score > 0 && (
                        <>
                          <span className="text-platinum/40">•</span>
                          <LeadScoreFlames score={selectedConv.lead_score} />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedConv.status !== 'resolved' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResolveClick}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Resolve
                      </Button>
                    )}
                    {selectedConv.status !== 'archived' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowArchiveDialog(true)}
                        className="text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
                      >
                        <Archive className="w-4 h-4 mr-1" />
                        Archive
                      </Button>
                    )}
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
                {/* Canned Responses Dropdown */}
                <div className="relative mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCannedResponses(!showCannedResponses)}
                    className="text-xs"
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    Quick Responses
                    <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showCannedResponses ? 'rotate-180' : ''}`} />
                  </Button>

                  {showCannedResponses && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 bg-background/95 backdrop-blur border border-border/40 rounded-lg shadow-xl z-10 max-h-64 overflow-y-auto">
                      {CANNED_RESPONSES.map((response, i) => (
                        <button
                          key={i}
                          onClick={() => insertCannedResponse(response.text)}
                          className="w-full text-left px-3 py-2 hover:bg-accent/10 border-b border-border/20 last:border-0 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-ivory">{response.label}</span>
                            <span className="text-xs text-platinum/40 font-mono">{response.shortcut}</span>
                          </div>
                          <p className="text-xs text-platinum/60 mt-0.5 line-clamp-1">
                            {response.text.slice(0, 60)}...
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <form onSubmit={sendMessage} className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => {
                      const val = e.target.value
                      setInputValue(val)
                      // Check for canned response shortcuts
                      const matchedResponse = CANNED_RESPONSES.find(r => val === r.shortcut)
                      if (matchedResponse) {
                        setInputValue(matchedResponse.text)
                      }

                      // Broadcast typing status with debounce
                      if (selectedConv && val.trim()) {
                        broadcastTypingStatus(selectedConv.id, true)

                        // Clear previous timeout
                        if (typingTimeoutRef.current) {
                          clearTimeout(typingTimeoutRef.current)
                        }

                        // Stop typing indicator after 3 seconds of inactivity
                        typingTimeoutRef.current = setTimeout(() => {
                          if (selectedConv) {
                            broadcastTypingStatus(selectedConv.id, false)
                          }
                        }, 3000)
                      } else if (selectedConv && !val.trim()) {
                        // Input cleared, stop typing indicator
                        broadcastTypingStatus(selectedConv.id, false)
                      }
                    }}
                    placeholder="Type your response or use /shortcut..."
                    className="flex-1"
                  />
                  <Button type="submit" disabled={!inputValue.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
                <p className="text-xs text-platinum/40 mt-1">
                  Shortcuts: /pricing, /stats, /join, /guarantee, /execute
                </p>
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

      {/* Resolve Chat Modal */}
      {showResolveModal && selectedConv && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-background border border-border/40 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-ivory">Resolve Conversation</h3>
              <button
                onClick={() => setShowResolveModal(false)}
                className="p-1 hover:bg-accent/10 rounded"
              >
                <X className="w-5 h-5 text-platinum/60" />
              </button>
            </div>

            <p className="text-platinum/60 text-sm mb-6">
              Would you like to send a transcript of this conversation to the visitor?
            </p>

            {selectedConv.visitor_email ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Transcript will be sent to:</span>
                </div>
                <p className="text-ivory mt-1 font-medium">{selectedConv.visitor_email}</p>
              </div>
            ) : (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-orange-400">
                  <AlertCircle className="w-4 h-4" />
                  No email address available for this visitor
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => resolveChat(false)}
                disabled={sendingTranscript}
                className="flex-1"
              >
                Resolve Only
              </Button>

              {selectedConv.visitor_email && (
                <Button
                  onClick={() => resolveChat(true)}
                  disabled={sendingTranscript}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {sendingTranscript ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send & Resolve
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent className="bg-background border-border/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-ivory">
              <Archive className="w-5 h-5 text-orange-400" />
              Archive Conversation
            </AlertDialogTitle>
            <AlertDialogDescription className="text-platinum/60">
              This will move the conversation to the archives and hide it from your active list.
              The visitor can still reopen the conversation by sending a new message.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/40">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={archiveChat}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Lead Score flame indicator component
function LeadScoreFlames({ score }: { score: number }) {
  // Show flames based on score: 1-3 = 1 flame, 4-6 = 2 flames, 7-9 = 3 flames, 10 = 4 flames
  const flameCount = score >= 10 ? 4 : score >= 7 ? 3 : score >= 4 ? 2 : 1
  const flameColor = score >= 7 ? 'text-orange-500' : score >= 4 ? 'text-yellow-500' : 'text-platinum/40'

  return (
    <div className="flex items-center gap-0.5" title={`Lead Score: ${score}/10`}>
      {Array.from({ length: flameCount }).map((_, i) => (
        <Flame
          key={i}
          className={`w-3.5 h-3.5 ${flameColor} ${score >= 7 ? 'animate-pulse' : ''}`}
          fill={score >= 4 ? 'currentColor' : 'none'}
        />
      ))}
      <span className={`text-xs ml-1 ${flameColor}`}>{score}</span>
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
  const leadScore = conversation.lead_score || 0
  const status = conversation.status || 'active'
  const hasPendingEscalation = !!conversation.metadata?.pending_escalation
  const isHighPriority = status === 'active' && (isEscalated || leadScore >= 7 || hasPendingEscalation)
  const isArchived = status === 'archived'
  const isResolved = status === 'resolved'

  return (
    <div
      onClick={onClick}
      className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'bg-emerald-500/10 border-emerald-500/50'
          : isArchived
          ? 'bg-background/30 border-border/20 opacity-60 hover:opacity-80'
          : isResolved
          ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
          : isHighPriority
          ? 'bg-orange-500/5 border-orange-500/40 hover:bg-orange-500/10 animate-pulse-border'
          : 'bg-background/50 border-border/40 hover:bg-accent/10'
      }`}
      style={isHighPriority && !isSelected ? {
        animation: 'pulse-border 2s ease-in-out infinite',
        boxShadow: '0 0 0 0 rgba(249, 115, 22, 0.4)'
      } : undefined}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-medium text-sm truncate ${isArchived ? 'text-platinum/50' : 'text-ivory'}`}>
            {conversation.visitor_name || conversation.visitor_id.slice(0, 20)}
          </span>
          {leadScore > 0 && !isArchived && <LeadScoreFlames score={leadScore} />}
        </div>

        {isResolved ? (
          <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded flex-shrink-0">
            ✓ Resolved
          </span>
        ) : isArchived ? (
          <span className="text-xs px-2 py-0.5 bg-platinum/10 text-platinum/40 rounded flex-shrink-0">
            📦 Archived
          </span>
        ) : hasPendingEscalation ? (
          <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded animate-pulse flex-shrink-0">
            ✉️ Pending Email
          </span>
        ) : conversation.ai_handled ? (
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

      {isEscalated && status === 'active' && (
        <div className="text-xs text-orange-400 mb-2 truncate">
          ⚠️ {conversation.escalation_reason}
        </div>
      )}

      {hasPendingEscalation && status === 'active' && (
        <div className="text-xs text-yellow-400 mb-2 truncate">
          ⏳ {conversation.metadata.pending_escalation.reason}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Clock className={`w-3 h-3 ${isArchived ? 'text-platinum/30' : 'text-platinum/40'}`} />
        <span className={`text-xs ${isArchived ? 'text-platinum/40' : 'text-platinum/60'}`}>
          {new Date(conversation.last_message_at).toLocaleString()}
        </span>
      </div>

      {conversation.ai_handled && status === 'active' && (
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
