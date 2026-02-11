'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Loader2,
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AiTutorPanelProps {
  lessonId: string
  lessonTitle: string
  className?: string
}

export function AiTutorPanel({
  lessonId,
  lessonTitle,
  className,
}: AiTutorPanelProps) {
  const { session } = useMemberAuth()
  const [isMounted, setIsMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/academy/tutor/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          lesson_id: lessonId,
          initial_question: trimmed,
          session_id: sessionId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const payload = await response.json()
      const data = payload?.data || null
      if (data?.session_id && typeof data.session_id === 'string') {
        setSessionId(data.session_id)
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data?.reply || 'I could not generate a response. Please try again.',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'Sorry, I encountered an error. Please try again in a moment.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, lessonId, session?.access_token, sessionId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isMounted || typeof document === 'undefined') return null

  return createPortal(
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed z-40',
          'bottom-24 right-4 lg:bottom-6 lg:right-6',
          'w-12 h-12 rounded-full',
          'bg-emerald-500 hover:bg-emerald-600 text-white',
          'shadow-lg shadow-emerald-500/25',
          'flex items-center justify-center',
          'transition-all duration-200',
          isOpen && 'hidden'
        )}
        aria-label="Open AI Tutor"
      >
        <MessageCircle className="w-5 h-5" />
      </button>

      {/* Panel overlay (mobile) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 lg:bg-transparent lg:pointer-events-none"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'fixed z-50',
              // Mobile: bottom sheet style
              'bottom-0 left-0 right-0 h-[75vh]',
              // Desktop: right sidebar
              'lg:top-6 lg:right-6 lg:left-auto lg:bottom-6 lg:h-auto lg:max-h-[calc(100dvh-3rem)] lg:w-[380px]',
              'flex flex-col',
              'bg-[#0A0A0B] border-l border-t lg:border-t-0 border-white/10',
              'rounded-t-2xl lg:rounded-2xl',
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">AI Tutor</h3>
                  <p className="text-[10px] text-white/40 truncate max-w-[200px]">
                    {lessonTitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile drag indicator */}
            <div className="lg:hidden flex justify-center py-1">
              <div className="w-8 h-1 rounded-full bg-white/20" />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
              {messages.length === 0 && (
                <div className="text-center py-8 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                    <Bot className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white/70">
                      Ask me anything about this lesson
                    </p>
                    <p className="text-xs text-white/40 mt-1">
                      I can explain concepts, provide examples, and answer questions.
                    </p>
                  </div>

                  {/* Suggested prompts */}
                  <div className="space-y-2 pt-2">
                    {[
                      'Explain the key concepts',
                      'Give me a real-world example',
                      'What should I focus on?',
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => {
                          setInput(prompt)
                          setTimeout(() => inputRef.current?.focus(), 0)
                        }}
                        className="block w-full text-left px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white/80 hover:border-white/20 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-2.5',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                  )}

                  <div
                    className={cn(
                      'max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-emerald-500/20 text-white border border-emerald-500/20'
                        : 'bg-white/5 text-white/80 border border-white/5'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-white/60" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="px-4 py-3 border-t border-white/5 shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask the AI tutor..."
                  rows={1}
                  className={cn(
                    'flex-1 resize-none px-3 py-2.5 rounded-lg text-sm text-white',
                    'bg-white/5 border border-white/10',
                    'placeholder:text-white/30',
                    'focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20',
                    'transition-colors',
                    'max-h-24 scrollbar-thin scrollbar-thumb-white/10'
                  )}
                  style={{
                    height: 'auto',
                    minHeight: '40px',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = `${Math.min(target.scrollHeight, 96)}px`
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
                    'transition-all duration-200',
                    input.trim() && !isLoading
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'bg-white/5 text-white/20'
                  )}
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  )
}
