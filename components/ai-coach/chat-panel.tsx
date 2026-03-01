'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Plus,
  MessageSquare,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MessageBubble } from './message-bubble'
import type { ChatMessage } from '@/hooks/use-ai-coach-chat'
import type { ChatSession } from '@/lib/api/ai-coach'
import { Skeleton } from '@/components/ui/skeleton-loader'

// ============================================
// TYPES
// ============================================

interface ChatPanelProps {
  messages: ChatMessage[]
  sessions: ChatSession[]
  currentSessionId: string | null
  isSending: boolean
  isLoadingSessions: boolean
  isLoadingMessages: boolean
  error: string | null
  rateLimitInfo: {
    queryCount?: number
    queryLimit?: number
    resetDate?: string
  } | null
  onSendMessage: (text: string) => void
  onNewSession: () => void
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onClearError: () => void
}

// ============================================
// COMPONENT
// ============================================

export function ChatPanel({
  messages,
  sessions,
  currentSessionId,
  isSending,
  isLoadingSessions,
  isLoadingMessages,
  error,
  rateLimitInfo,
  onSendMessage,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onClearError,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSessions, setShowSessions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const previousMessageCount = useRef(0)

  // Auto-scroll on new messages
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior })
    }, 50)
  }, [])

  useEffect(() => {
    if (messages.length > previousMessageCount.current) {
      scrollToBottom()
    }
    previousMessageCount.current = messages.length
  }, [messages.length, scrollToBottom])

  // Focus input on mount and after sending
  useEffect(() => {
    if (!isSending) {
      inputRef.current?.focus()
    }
  }, [isSending])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isSending) return

    onSendMessage(inputValue.trim())
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="glass-card-heavy rounded-2xl border border-white/10 overflow-hidden flex h-full">
      {/* Sessions Sidebar (collapsible) */}
      <AnimatePresence>
        {showSessions && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 220, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-r border-white/5 overflow-hidden flex flex-col"
          >
            <div className="p-3 border-b border-white/5 flex items-center justify-between">
              <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                Sessions
              </span>
              <button
                onClick={onNewSession}
                className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-emerald-500 transition-colors"
                title="New session"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoadingSessions ? (
                <div className="space-y-2 py-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                      <Skeleton className="h-3 w-24 mb-2" />
                      <Skeleton className="h-2 w-12" />
                    </div>
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-4">
                  No sessions yet
                </p>
              ) : (
                sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={session.id === currentSessionId}
                    onSelect={() => onSelectSession(session.id)}
                    onDelete={() => onDeleteSession(session.id)}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="p-3 border-b border-white/5 flex items-center gap-2">
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
            title={showSessions ? 'Hide sessions' : 'Show sessions'}
          >
            {showSessions ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-white truncate">
              {currentSessionId
                ? sessions.find(s => s.id === currentSessionId)?.title || 'Chat'
                : 'New Conversation'}
            </h3>
          </div>

          <Button
            onClick={onNewSession}
            variant="ghost"
            size="sm"
            className="text-white/40 hover:text-emerald-500 h-8 px-2"
          >
            <Plus className="w-4 h-4 mr-1" />
            <span className="text-xs">New</span>
          </Button>
        </div>

        {/* Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400 flex-1">{error}</p>
                <button
                  type="button"
                  onClick={onClearError}
                  aria-label="Dismiss error"
                  className="text-red-400/60 hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rate Limit Banner */}
        <AnimatePresence>
          {rateLimitInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-400">
                  {rateLimitInfo.queryCount}/{rateLimitInfo.queryLimit} queries used
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoadingMessages ? (
            <div className="space-y-3">
              <div className="flex justify-start">
                <div className="w-full max-w-[72%] rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.03] p-3 space-y-2">
                  <Skeleton className="h-3 w-[90%]" />
                  <Skeleton className="h-3 w-[70%]" />
                </div>
              </div>
              <div className="flex justify-end">
                <div className="w-full max-w-[60%] rounded-2xl rounded-br-sm border border-white/10 bg-white/[0.03] p-3 space-y-2">
                  <Skeleton className="h-3 w-[85%]" />
                  <Skeleton className="h-3 w-[55%]" />
                </div>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {/* Thinking indicator */}
              {isSending && (
                <div className="flex items-center gap-2 text-white/40 text-sm">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-subtle" />
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-white/60">Thinking</span>
                      <span className="flex gap-0.5">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-white/5 bg-[#0A0A0B]/45">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isSending ? 'Waiting for response...' : 'Ask about levels, markets, options...'}
              disabled={isSending}
              maxLength={2000}
              className="flex-1 bg-[#0A0A0B]/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-champagne/30 focus:border-champagne/30 transition-all duration-500 disabled:opacity-50"
            />
            <Button
              type="submit"
              disabled={!inputValue.trim() || isSending}
              className="btn-premium bg-gradient-to-r from-emerald-700 to-emerald-500 hover:from-emerald-600 hover:to-emerald-400 px-4 py-2.5 rounded-xl h-auto hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-pulse-subtle" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse-subtle" style={{ animationDelay: '160ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse-subtle" style={{ animationDelay: '320ms' }} />
                </span>
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ============================================
// SESSION ITEM
// ============================================

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: ChatSession
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left w-full',
        isActive
          ? 'bg-emerald-500/10 border border-emerald-500/20 text-white'
          : 'hover:bg-white/5 text-white/60 hover:text-white border border-transparent'
      )}
      onClick={onSelect}
    >
      <MessageSquare className={cn(
        'w-3.5 h-3.5 shrink-0',
        isActive ? 'text-emerald-500' : 'text-white/40'
      )} />
      <div className="flex-1 min-w-0">
        <p className="text-xs truncate">{session.title}</p>
        <p className="text-[10px] text-white/30">
          {session.message_count} msg{session.message_count !== 1 ? 's' : ''}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="inline-flex h-11 w-11 items-center justify-center rounded text-white/30 transition-all hover:bg-red-500/10 hover:text-red-400 touch-manipulation opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        title="Delete session"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-xs">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-6 h-6 text-emerald-500" />
        </div>
        <h3 className="text-sm font-medium text-white mb-2">
          Start a Conversation
        </h3>
        <p className="text-xs text-white/40 leading-relaxed">
          Ask about key levels, market conditions, options data, or trading strategies.
        </p>
      </div>
    </div>
  )
}
