'use client'

import { useState, useCallback, useRef } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import {
  BrainCircuit,
  MessageSquare,
  CandlestickChart,
  Send,
  Loader2,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAICoachChat } from '@/hooks/use-ai-coach-chat'
import { ChatMessageBubble, TypingIndicator } from '@/components/ai-coach/chat-message'
import { ChatImageUpload, ChatDropOverlay } from '@/components/ai-coach/chat-image-upload'
import { CenterPanel } from '@/components/ai-coach/center-panel'
import { AICoachErrorBoundary } from '@/components/ai-coach/error-boundary'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { analyzeScreenshot as apiAnalyzeScreenshot } from '@/lib/api/ai-coach'
import { Button } from '@/components/ui/button'
import type { ChatMessage } from '@/hooks/use-ai-coach-chat'
import type { ChatSession } from '@/lib/api/ai-coach'

export default function AICoachPage() {
  const chat = useAICoachChat()
  const [mobileView, setMobileView] = useState<'chat' | 'center'>('chat')

  const handleSendPrompt = useCallback((prompt: string) => {
    chat.sendMessage(prompt)
    setMobileView('chat')
  }, [chat.sendMessage])

  return (
    <AICoachErrorBoundary fallbackTitle="AI Coach encountered an error">
      {/* Full-height container — fills available space inside member layout */}
      <div className="flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
        {/* Mobile View Toggle */}
        <div className="flex gap-1 p-1 mx-4 mt-2 rounded-lg bg-white/5 border border-white/10 lg:hidden">
          <button
            onClick={() => setMobileView('chat')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all',
              mobileView === 'chat'
                ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                : 'text-white/60 hover:text-white border border-transparent'
            )}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </button>
          <button
            onClick={() => setMobileView('center')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all',
              mobileView === 'center'
                ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                : 'text-white/60 hover:text-white border border-transparent'
            )}
          >
            <CandlestickChart className="w-4 h-4" />
            Chart
          </button>
        </div>

        {/* Main Content — full remaining height */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Desktop: Resizable Split Panels */}
          <div className="hidden lg:block h-full">
            <PanelGroup direction="horizontal">
              {/* Chat Panel (40% default, more room for messages) */}
              <Panel defaultSize={40} minSize={30} maxSize={55}>
                <ChatArea
                  messages={chat.messages}
                  sessions={chat.sessions}
                  currentSessionId={chat.currentSessionId}
                  isSending={chat.isSending}
                  isLoadingSessions={chat.isLoadingSessions}
                  isLoadingMessages={chat.isLoadingMessages}
                  error={chat.error}
                  rateLimitInfo={chat.rateLimitInfo}
                  onSendMessage={chat.sendMessage}
                  onNewSession={chat.newSession}
                  onSelectSession={chat.selectSession}
                  onDeleteSession={chat.deleteSession}
                  onClearError={chat.clearError}
                />
              </Panel>

              {/* Resize Handle */}
              <PanelResizeHandle className="w-1.5 bg-transparent hover:bg-emerald-500/20 active:bg-emerald-500/30 transition-colors cursor-col-resize relative group">
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/5 group-hover:bg-emerald-500/40 transition-colors" />
              </PanelResizeHandle>

              {/* Center Panel (60%) */}
              <Panel defaultSize={60} minSize={35}>
                <CenterPanel onSendPrompt={handleSendPrompt} chartRequest={chat.chartRequest} />
              </Panel>
            </PanelGroup>
          </div>

          {/* Mobile: Toggled View */}
          <div className="lg:hidden h-full">
            {mobileView === 'chat' ? (
              <ChatArea
                messages={chat.messages}
                sessions={chat.sessions}
                currentSessionId={chat.currentSessionId}
                isSending={chat.isSending}
                isLoadingSessions={chat.isLoadingSessions}
                isLoadingMessages={chat.isLoadingMessages}
                error={chat.error}
                rateLimitInfo={chat.rateLimitInfo}
                onSendMessage={chat.sendMessage}
                onNewSession={chat.newSession}
                onSelectSession={chat.selectSession}
                onDeleteSession={chat.deleteSession}
                onClearError={chat.clearError}
              />
            ) : (
              <CenterPanel onSendPrompt={handleSendPrompt} chartRequest={chat.chartRequest} />
            )}
          </div>
        </div>
      </div>
    </AICoachErrorBoundary>
  )
}

// ============================================
// CHAT AREA — The full chat panel with sessions, messages, input, image upload
// ============================================

interface ChatAreaProps {
  messages: ChatMessage[]
  sessions: ChatSession[]
  currentSessionId: string | null
  isSending: boolean
  isLoadingSessions: boolean
  isLoadingMessages: boolean
  error: string | null
  rateLimitInfo: { queryCount?: number; queryLimit?: number; resetDate?: string } | null
  onSendMessage: (text: string) => void
  onNewSession: () => void
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onClearError: () => void
}

function ChatArea({
  messages, sessions, currentSessionId, isSending, isLoadingSessions,
  isLoadingMessages, error, rateLimitInfo, onSendMessage, onNewSession,
  onSelectSession, onDeleteSession, onClearError,
}: ChatAreaProps) {
  const { session } = useMemberAuth()
  const [inputValue, setInputValue] = useState('')
  const [showSessions, setShowSessions] = useState(false)
  const [stagedImage, setStagedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const previousMessageCount = useRef(0)

  // Auto-scroll on new messages
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }, [])

  // Effect for auto-scrolling
  if (messages.length > previousMessageCount.current) {
    previousMessageCount.current = messages.length
    setTimeout(() => scrollToBottom(), 50)
  }
  previousMessageCount.current = messages.length

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = inputValue.trim()
    if ((!text && !stagedImage) || isSending) return

    if (stagedImage) {
      // Send image for analysis through the chat
      handleImageAnalysis(text)
    } else {
      onSendMessage(text)
    }
    setInputValue('')
  }

  const handleImageAnalysis = async (userMessage: string) => {
    if (!stagedImage || !session?.access_token) return

    const msg = userMessage || 'Analyze this screenshot'
    onSendMessage(msg)

    // Clear staged image after sending
    setStagedImage(null)

    // TODO: The backend screenshot analysis could be integrated
    // into the streaming chat flow. For now, the image upload
    // through the screenshot-upload component handles this.
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleImageReady = useCallback((base64: string, mimeType: string) => {
    const preview = `data:${mimeType};base64,${base64}`
    setStagedImage({ base64, mimeType, preview })
  }, [])

  const handleFileDrop = useCallback((file: File) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      if (!dataUrl) return
      const base64 = dataUrl.split(',')[1]
      setStagedImage({ base64, mimeType: file.type, preview: dataUrl })
    }
    reader.readAsDataURL(file)
  }, [])

  return (
    <div className="flex h-full bg-[#0A0A0B]" ref={chatContainerRef}>
      {/* Sessions Sidebar */}
      <AnimatePresence>
        {showSessions && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-r border-white/5 overflow-hidden flex flex-col bg-[#0A0A0B]"
          >
            <div className="p-3 border-b border-white/5 flex items-center justify-between">
              <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Sessions</span>
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
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-4">No sessions yet</p>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      'group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left w-full',
                      s.id === currentSessionId
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-white'
                        : 'hover:bg-white/5 text-white/50 hover:text-white border border-transparent'
                    )}
                    onClick={() => onSelectSession(s.id)}
                  >
                    <MessageSquare className={cn('w-3.5 h-3.5 shrink-0', s.id === currentSessionId ? 'text-emerald-500' : 'text-white/30')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{s.title}</p>
                      <p className="text-[10px] text-white/25">{s.message_count} msg{s.message_count !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id) }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Drop overlay */}
        <ChatDropOverlay containerRef={chatContainerRef} onFileDrop={handleFileDrop} />

        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
          >
            {showSessions ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <BrainCircuit className="w-5 h-5 text-emerald-500 shrink-0" />
            <h3 className="text-sm font-medium text-white truncate">
              {currentSessionId ? sessions.find(s => s.id === currentSessionId)?.title || 'Chat' : 'AI Coach'}
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

        {/* Error / Rate Limit Banners */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400 flex-1">{error}</p>
                <button onClick={onClearError} className="text-red-400/60 hover:text-red-400"><X className="w-3 h-3" /></button>
              </div>
            </motion.div>
          )}
          {rateLimitInfo && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-400">{rateLimitInfo.queryCount}/{rateLimitInfo.queryLimit} queries used</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} />
              ))}
              {isSending && !messages.some(m => m.isStreaming) && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="relative px-4 py-3 border-t border-white/5 bg-[#0A0A0B]">
          {/* Image preview strip */}
          <ChatImageUpload
            onImageReady={handleImageReady}
            onClear={() => setStagedImage(null)}
            isSending={isSending}
            stagedPreview={stagedImage?.preview || null}
          />

          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isSending ? 'Waiting for response...' : 'Ask about any ticker, levels, options...'}
              disabled={isSending}
              maxLength={2000}
              rows={1}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all disabled:opacity-40 resize-none min-h-[44px] max-h-[120px]"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <Button
              type="submit"
              disabled={(!inputValue.trim() && !stagedImage) || isSending}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-xl transition-all disabled:opacity-20 disabled:cursor-not-allowed h-[44px]"
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
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
// EMPTY STATE
// ============================================

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center mx-auto mb-5">
          <BrainCircuit className="w-7 h-7 text-emerald-500" />
        </div>
        <h3 className="text-base font-medium text-white mb-2">
          What can I help you with?
        </h3>
        <p className="text-sm text-white/40 leading-relaxed mb-6">
          Ask about any ticker — SPX, AAPL, TSLA, QQQ — levels, options chains, macro outlook, or trade analysis.
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            'SPX levels today',
            'AAPL options chain',
            'What\'s TGT trading at?',
            'Macro outlook',
          ].map((prompt) => (
            <button
              key={prompt}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
