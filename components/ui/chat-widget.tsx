'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { playLuxuryPlink, isSoundEnabled } from '@/lib/sounds'
import { MessageCircle, X, Send, Loader2, User, Sparkles, Clock } from 'lucide-react'
import { Button } from './button'

interface Message {
  id: string
  sender_type: 'visitor' | 'team' | 'system'
  sender_name: string
  message_text: string
  image_url?: string
  ai_generated?: boolean
  created_at: string
}

interface Conversation {
  id: string
  ai_handled: boolean
  escalation_reason?: string
  visitor_name?: string
  visitor_email?: string
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [teamOnline, setTeamOnline] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isWaitingForAI, setIsWaitingForAI] = useState(false)
  const [isEscalated, setIsEscalated] = useState(false)
  const [teamTyping, setTeamTyping] = useState<string | null>(null)
  const [visitorId] = useState(() => {
    // Generate or retrieve visitor ID from localStorage
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('tradeitm_visitor_id')
      if (!id) {
        id = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        localStorage.setItem('tradeitm_visitor_id', id)
      }
      return id
    }
    return `visitor_${Date.now()}`
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const previousMessageCount = useRef(0)

  // Auto-scroll to bottom when new messages arrive (with image loading support)
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    // Small delay to allow images to start loading
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior })
    }, 50)
  }, [])

  useEffect(() => {
    // Only scroll and play sound if messages were added (not on initial load)
    if (messages.length > previousMessageCount.current && previousMessageCount.current > 0) {
      scrollToBottom()
      // Play sound for non-visitor messages (team/system responses)
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.sender_type !== 'visitor' && isSoundEnabled()) {
        playLuxuryPlink()
      }
    }
    previousMessageCount.current = messages.length
  }, [messages, scrollToBottom])

  // Load existing messages when conversation exists
  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })

    if (data && data.length > 0) {
      setMessages(data as Message[])
    }
  }, [])

  // Load conversation state (for escalation tracking)
  const loadConversation = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('chat_conversations')
      .select('id, ai_handled, escalation_reason, visitor_name, visitor_email')
      .eq('id', convId)
      .single()

    if (data) {
      setConversation(data as Conversation)
      setIsEscalated(!data.ai_handled)
    }
  }, [])

  // Initialize: show greeting when widget opens (no conversation yet)
  useEffect(() => {
    if (isOpen && !conversationId && messages.length === 0) {
      // Show local greeting - will be replaced by DB messages once conversation starts
      const initialMessage: Message = {
        id: 'greeting',
        sender_type: 'team',
        sender_name: 'TradeITM',
        message_text: "Hi! 👋 I'm here to help answer your questions about our trading signals service. What brings you to TradeITM today?",
        ai_generated: true,
        created_at: new Date().toISOString()
      }
      setMessages([initialMessage])
    }
  }, [isOpen, conversationId, messages.length])

  // Subscribe to real-time messages, conversation changes, AND typing indicators
  useEffect(() => {
    if (!conversationId) return

    // Load existing messages and conversation state
    loadMessages(conversationId)
    loadConversation(conversationId)

    // Single channel for all real-time updates
    const channel = supabase
      .channel(`chat:${conversationId}`)
      // Listen to ALL message inserts (visitor, team, system)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        const newMessage = payload.new as Message
        // Add message if not already in state (dedupe by id)
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) {
            return prev
          }
          return [...prev, newMessage]
        })
        // Clear typing indicator when message received
        setTeamTyping(null)
      })
      // Listen to conversation updates (for escalation state)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_conversations',
        filter: `id=eq.${conversationId}`
      }, (payload) => {
        const updated = payload.new as Conversation
        setConversation(updated)
        setIsEscalated(!updated.ai_handled)
      })
      // Listen to typing indicators
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_typing_indicators',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setTeamTyping(null)
        } else if (payload.new) {
          const indicator = payload.new as { user_name: string; is_typing: boolean }
          if (indicator.is_typing) {
            setTeamTyping(indicator.user_name)
          } else {
            setTeamTyping(null)
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, loadMessages, loadConversation])

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!inputValue.trim() || isSending) return

    const messageText = inputValue.trim()
    setInputValue('')
    setIsSending(true)

    try {
      const functionUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1/handle-chat-message'

      // Show "Sending..." state, then "Thinking..." once message is sent
      setIsWaitingForAI(false)

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          conversationId,
          visitorMessage: messageText,
          visitorId
        })
      })

      // Message sent to server, now waiting for AI response
      setIsWaitingForAI(true)

      const result = await response.json()

      if (result.success) {
        // Set conversation ID if this was first message
        // This triggers the useEffect to subscribe to Realtime and load messages
        if (!conversationId && result.conversationId) {
          setConversationId(result.conversationId)
          // Clear the local greeting - DB messages will load via subscription
          setMessages([])
        }

        // Escalation state is handled via Realtime subscription on chat_conversations
        if (result.escalated) {
          setIsEscalated(true)
        }
      } else {
        throw new Error(result.error || 'Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      // Show error message locally (not persisted)
      const errorMsg: Message = {
        id: `error_${Date.now()}`,
        sender_type: 'system',
        sender_name: 'System',
        message_text: 'Sorry, there was an error sending your message. Please try again.',
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsSending(false)
      setIsWaitingForAI(false)
    }
  }

  return (
    <>
      {/* Minimized Widget - Bottom Right */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 group"
          >
            {/* Glass-morphism bubble matching TradeITM design */}
            <div className="relative">
              {/* Pulsing glow when team online OR AI active */}
              <motion.div
                className="absolute inset-0 rounded-full bg-emerald-500/30"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />

              {/* Main button */}
              <div className="relative bg-gradient-to-br from-emerald-500/10 to-champagne-500/10 backdrop-blur-xl border border-emerald-500/30 p-4 rounded-full hover:border-champagne-500/50 transition-all duration-300 shadow-lg hover:shadow-emerald-500/20">
                <MessageCircle className="w-6 h-6 text-champagne group-hover:scale-110 transition-transform" />

                {/* Online indicator */}
                <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
              </div>

              {/* Tooltip */}
              <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-background/95 backdrop-blur border border-border/40 rounded-lg px-3 py-2 text-sm text-ivory whitespace-nowrap shadow-xl">
                  Questions? Chat with us
                  {teamOnline && <span className="text-emerald-400 ml-2">● Team online</span>}
                </div>
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
            transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            className="fixed bottom-6 right-6 w-[90vw] sm:w-[400px] h-[600px] sm:h-[650px] z-50"
          >
            <div className="bg-background/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl overflow-hidden flex flex-col h-full shadow-2xl">
              {/* Header */}
              <div className="border-b border-border/40">
                <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-champagne-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-ivory">TradeITM Support</h3>
                        <p className="text-xs text-platinum/60 flex items-center gap-1">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                          {isEscalated ? 'Team notified' : 'AI + Team available'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="text-platinum/60 hover:text-ivory transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Escalation Banner */}
                <AnimatePresence>
                  {isEscalated && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 py-2.5 bg-champagne/10 border-t border-champagne/20 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-champagne animate-pulse" />
                        <span className="text-sm text-champagne font-medium">
                          Waiting for Team Member...
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Messages Area */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-background/50 to-background/80"
              >
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} onImageLoad={scrollToBottom} />
                ))}

                {/* Typing Indicator */}
                <AnimatePresence>
                  {teamTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2"
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-platinum/60">{teamTyping} is typing</span>
                          <span className="flex gap-0.5">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {(isSending || isWaitingForAI) && !teamTyping && (
                  <div className="flex items-center gap-2 text-platinum/60 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isSending && !isWaitingForAI ? 'Sending...' : 'Thinking...'}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-border/40 bg-background/50">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={isSending ? 'Sending...' : 'Type your message...'}
                    disabled={isSending}
                    className="flex-1 bg-background/50 border border-border/40 rounded-lg px-4 py-2.5 text-sm text-ivory placeholder:text-platinum/40 focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50"
                  />
                  <Button
                    type="submit"
                    disabled={!inputValue.trim() || isSending}
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-4 py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </form>

                <p className="text-xs text-platinum/40 mt-2 text-center">
                  Powered by AI • {teamOnline && 'Team available'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Individual message component
function ChatMessage({ message, onImageLoad }: { message: Message; onImageLoad?: () => void }) {
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
      <div className={`flex gap-2 max-w-[85%] ${isVisitor ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isVisitor
            ? 'bg-champagne/20 border border-champagne/30'
            : 'bg-emerald-500/20 border border-emerald-500/30'
        }`}>
          {isVisitor ? (
            <User className="w-4 h-4 text-champagne" />
          ) : (
            <Sparkles className="w-4 h-4 text-emerald-400" />
          )}
        </div>

        {/* Message bubble */}
        <div className="flex flex-col gap-1">
          <div className={`rounded-2xl px-4 py-2.5 ${
            isVisitor
              ? 'bg-gradient-to-br from-champagne/20 to-champagne/10 border border-champagne/30 text-ivory'
              : 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 text-platinum'
          }`}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.message_text}</p>

            {message.image_url && (
              <img
                src={message.image_url}
                alt="Shared content"
                className="mt-2 rounded-lg max-w-full"
                onLoad={onImageLoad}
              />
            )}
          </div>

          {/* Timestamp */}
          <span className="text-xs text-platinum/40 px-2">
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {message.ai_generated && (
              <span className="ml-1 opacity-60">• AI</span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
