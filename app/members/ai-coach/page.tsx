'use client'

import { useState, useCallback } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { BrainCircuit, MessageSquare, CandlestickChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAICoachChat } from '@/hooks/use-ai-coach-chat'
import { ChatPanel } from '@/components/ai-coach/chat-panel'
import { CenterPanel } from '@/components/ai-coach/center-panel'

export default function AICoachPage() {
  const chat = useAICoachChat()
  const [mobileView, setMobileView] = useState<'chat' | 'center'>('chat')

  // Handle example prompts from center panel
  const handleSendPrompt = useCallback((prompt: string) => {
    chat.sendMessage(prompt)
    setMobileView('chat') // Switch to chat on mobile after sending
  }, [chat.sendMessage])

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BrainCircuit className="w-8 h-8 text-emerald-500" />
            AI Coach
          </h1>
          <p className="text-white/60 mt-1">
            Your AI-powered trading assistant
          </p>
        </div>
        <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
          Beta
        </span>
      </div>

      {/* Mobile View Toggle */}
      <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10 lg:hidden">
        <button
          onClick={() => setMobileView('chat')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all',
            mobileView === 'chat'
              ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
              : 'text-white/60 hover:text-white'
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
              : 'text-white/60 hover:text-white'
          )}
        >
          <CandlestickChart className="w-4 h-4" />
          Chart
        </button>
      </div>

      {/* Main Content Area */}
      <div className="glass-card-heavy border-emerald-500/10 rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Desktop: Resizable Split Panels */}
        <div className="hidden lg:block h-full">
          <PanelGroup direction="horizontal">
            {/* Left Panel: Chat (30%) */}
            <Panel defaultSize={30} minSize={25} maxSize={45}>
              <ChatPanel
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

            {/* Right Panel: Center (70%) */}
            <Panel defaultSize={70} minSize={40}>
              <CenterPanel onSendPrompt={handleSendPrompt} chartRequest={chat.chartRequest} />
            </Panel>
          </PanelGroup>
        </div>

        {/* Mobile: Toggled View */}
        <div className="lg:hidden h-full">
          {mobileView === 'chat' ? (
            <ChatPanel
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
  )
}
