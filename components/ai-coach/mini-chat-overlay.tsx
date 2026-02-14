'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Maximize2, MessageSquare, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/hooks/use-ai-coach-chat'

interface MiniChatOverlayProps {
  messages: ChatMessage[]
  isSending: boolean
  onSendMessage: (text: string) => void
  onExpand: () => void
}

export function MiniChatOverlay({
  messages,
  isSending,
  onSendMessage,
  onExpand,
}: MiniChatOverlayProps) {
  const [inputValue, setInputValue] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const recentMessages = messages.slice(-5)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length])

  const handleSubmit = useCallback((event?: React.FormEvent) => {
    event?.preventDefault()
    const text = inputValue.trim()
    if (!text || isSending) return
    onSendMessage(text)
    setInputValue('')
  }, [inputValue, isSending, onSendMessage])

  if (isMinimized) {
    return (
      <motion.button
        type="button"
        drag
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-4 left-4 z-40 hidden lg:flex items-center gap-2 rounded-full border border-emerald-500/40 bg-[#0F1013]/95 backdrop-blur-md px-3 py-2 shadow-[0_8px_30px_rgba(16,185,129,0.2)] cursor-move"
        onClick={() => setIsMinimized(false)}
        aria-label="Expand mini chat"
      >
        <MessageSquare className="w-4 h-4 text-emerald-400" />
        <span className="text-xs text-white/70">{messages.length > 0 ? `${messages.length} messages` : 'Chat'}</span>
        {isSending && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
      </motion.button>
    )
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="fixed bottom-4 left-4 z-40 hidden lg:flex flex-col h-[400px] w-[320px] rounded-2xl border border-white/10 bg-[#0D0F13]/95 backdrop-blur-xl shadow-[0_16px_60px_rgba(0,0,0,0.4)] overflow-hidden cursor-move"
      role="complementary"
      aria-label="Mini chat overlay"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-white">AI Coach</span>
          {isSending && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onExpand}
            className="p-1 rounded text-white/30 hover:text-white/60 transition-colors"
            aria-label="Expand to full chat panel"
            title="Expand (Ctrl/Cmd+B)"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded text-white/30 hover:text-white/60 transition-colors"
            aria-label="Minimize mini chat"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {recentMessages.length === 0 ? (
          <p className="text-xs text-white/25 text-center pt-8">No messages yet</p>
        ) : (
          recentMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'text-xs leading-relaxed rounded-lg px-2.5 py-1.5 max-w-[90%]',
                message.role === 'user'
                  ? 'ml-auto bg-emerald-500/15 text-white/80 border border-emerald-500/20'
                  : 'bg-white/5 text-white/70 border border-white/5',
              )}
            >
              {message.content.length > 220 ? `${message.content.slice(0, 220)}...` : message.content}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-white/5 flex items-center gap-2">
        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder={isSending ? 'Processing...' : 'Ask anything...'}
          disabled={isSending}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-500/40 disabled:opacity-40"
          aria-label="Mini chat input"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isSending}
          className="bg-emerald-500 hover:bg-emerald-600 text-white p-1.5 rounded-lg disabled:opacity-20 transition-colors"
          aria-label="Send mini chat message"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </motion.div>
  )
}
