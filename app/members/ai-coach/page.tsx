'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { PanelGroup, Panel, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels'
import {
  BrainCircuit,
  MessageSquare,
  Send,
  Loader2,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
  PanelLeftClose,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAICoachChat } from '@/hooks/use-ai-coach-chat'
import { ChatMessageBubble, TypingIndicator } from '@/components/ai-coach/chat-message'
import { ChatImageUpload, ChatDropOverlay } from '@/components/ai-coach/chat-image-upload'
import { CenterPanel, type ChartRequest, type CenterView } from '@/components/ai-coach/center-panel'
import { MobileToolSheet } from '@/components/ai-coach/mobile-tool-sheet'
import { MiniChatOverlay } from '@/components/ai-coach/mini-chat-overlay'
import { AICoachErrorBoundary } from '@/components/ai-coach/error-boundary'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { AICoachWorkflowProvider } from '@/contexts/AICoachWorkflowContext'
import {
  analyzeScreenshot as apiAnalyzeScreenshot,
  getChartData,
  type ExtractedPosition,
  type ScreenshotActionId,
  type ScreenshotSuggestedAction,
} from '@/lib/api/ai-coach'
import { useMobileToolSheet, type MobileToolView } from '@/hooks/use-mobile-tool-sheet'
import { usePanelAttentionPulse } from '@/hooks/use-panel-attention-pulse'
import { Button } from '@/components/ui/button'
import type { ChatMessage } from '@/hooks/use-ai-coach-chat'
import type { ChatSession } from '@/lib/api/ai-coach'
import { Analytics } from '@/lib/analytics'
import { getActiveChartSymbol, subscribeActiveChartSymbol } from '@/lib/ai-coach-chart-context'

type PlaceholderBucket = 'pre_market' | 'session' | 'after_hours' | 'closed'
type LearnerLevel = 'beginner' | 'intermediate' | 'advanced'
type QuickPromptItem = {
  text: string
  prompt: string
}

function normalizePromptSymbol(symbol: string | null | undefined): string {
  if (typeof symbol !== 'string') return 'SPX'
  const normalized = symbol.trim().toUpperCase()
  return /^[A-Z0-9._:-]{1,10}$/.test(normalized) ? normalized : 'SPX'
}

function inferLearnerLevel(tier: 'core' | 'pro' | 'executive' | null | undefined): LearnerLevel {
  if (tier === 'executive') return 'advanced'
  if (tier === 'pro') return 'intermediate'
  return 'beginner'
}

function buildQuickPrompts(symbolRaw: string, learnerLevel: LearnerLevel): QuickPromptItem[] {
  const symbol = normalizePromptSymbol(symbolRaw)
  const advancedPlanPrompt = symbol === 'SPX'
    ? 'Give me the full SPX game plan: key levels (PDH, PDL, pivot, VWAP), GEX profile with flip point, expected move, and what setups to watch today. Show the chart.'
    : `Give me a full ${symbol} game plan: trend, key levels, bull/bear triggers, invalidation, and the cleanest setup to watch today. Show the chart.`

  return [
    {
      text: 'Start Here',
      prompt: `I am a ${learnerLevel === 'advanced' ? 'trader' : 'newer trader'}. Show ${symbol} on the chart and explain the most important support/resistance levels in plain English.`,
    },
    {
      text: 'Read This Chart',
      prompt: `Show ${symbol} on the chart and give me a simple read: trend, nearest support/resistance, and one bull + one bear trigger.`,
    },
    {
      text: 'Risk Checklist',
      prompt: `Build a ${learnerLevel === 'beginner' ? 'beginner-friendly ' : ''}risk checklist for trading ${symbol} today: position size, max loss, and what invalidation means before entry.`,
    },
    {
      text: symbol === 'SPX' ? 'Advanced SPX Plan' : `${symbol} Full Plan`,
      prompt: advancedPlanPrompt,
    },
  ]
}

function buildPlaceholderOptions(bucket: PlaceholderBucket, symbolRaw: string): string[] {
  const symbol = normalizePromptSymbol(symbolRaw)

  if (bucket === 'pre_market') {
    return [
      `Show me ${symbol} overnight levels in plain English`,
      `What should I watch first on ${symbol} at the open?`,
      `Give me a simple morning brief for ${symbol}`,
    ]
  }

  if (bucket === 'session') {
    return [
      `How is ${symbol} holding up right now?`,
      `Find one clean setup for ${symbol} with invalidation`,
      `Explain this ${symbol} move simply`,
    ]
  }

  if (bucket === 'after_hours') {
    return [
      `Recap today's ${symbol} session simply`,
      `What worked and what failed in ${symbol} today?`,
      `Build a simple ${symbol} plan for tomorrow`,
    ]
  }

  return [
    'Review my trade journal',
    `What mistakes should I avoid when trading ${symbol} tomorrow?`,
    `Study one ${symbol} setup step-by-step`,
  ]
}

function buildCapabilityHints(bucket: PlaceholderBucket, symbolRaw: string, learnerLevel: LearnerLevel): string[] {
  const symbol = normalizePromptSymbol(symbolRaw)

  if (bucket === 'pre_market') {
    return [
      `You can ask me: "What are the two key ${symbol} levels for the open?"`,
      `You can ask me: "Give me a pre-market risk checklist for ${symbol}."`,
    ]
  }

  if (bucket === 'session') {
    return [
      `You can ask me: "Explain this ${symbol} move simply and show it on chart."`,
      `You can ask me: "Build a risk plan around current ${symbol} price."`,
    ]
  }

  if (bucket === 'after_hours') {
    return [
      `You can ask me: "Recap ${symbol} and what I should improve tomorrow."`,
      `You can ask me: "What ${symbol} setup should I study tonight?"`,
    ]
  }

  return [
    'You can ask me: "Review my mistakes and build tomorrow plan."',
    learnerLevel === 'advanced'
      ? `You can ask me: "Build a tactical ${symbol} execution plan for tomorrow with entry, invalidation, and targets."`
      : `You can ask me: "Teach me one ${symbol} setup step-by-step."`,
  ]
}

const SUPPORTED_CHART_TIMEFRAMES = new Set(['1m', '5m', '15m', '1h', '4h', '1D'])

function getEasternPlaceholderBucket(now: Date = new Date()): PlaceholderBucket {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  const isWeekend = weekday === 'Sat' || weekday === 'Sun'

  if (isWeekend) return 'closed'

  const totalMinutes = hour * 60 + minute
  if (totalMinutes >= 570 && totalMinutes < 960) return 'session'
  if (totalMinutes >= 240 && totalMinutes < 570) return 'pre_market'
  if (totalMinutes >= 960 && totalMinutes < 1200) return 'after_hours'
  return 'closed'
}

export default function AICoachPage() {
  const searchParams = useSearchParams()
  const chat = useAICoachChat()
  const mobileSheet = useMobileToolSheet()
  const { activeSheet, openSheet, closeSheet, sheetSymbol, sheetParams } = mobileSheet
  const { sendMessage, isSending } = chat
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  const chatPanelRef = useRef<ImperativePanelHandle | null>(null)
  const seededPromptRef = useRef<string | null>(null)
  const pulse = usePanelAttentionPulse()
  const latestAssistantSummary = useMemo(() => {
    const latest = [...chat.messages].reverse().find((message) => (
      message.role === 'assistant' && message.content.trim().length > 0
    ))
    if (!latest) return null
    const compact = latest.content.replace(/\s+/g, ' ').trim()
    if (compact.length <= 160) return compact
    return `${compact.slice(0, 157)}...`
  }, [chat.messages])

  const handleSendPrompt = useCallback((prompt: string) => {
    chat.sendMessage(prompt)
    closeSheet()
  }, [chat, closeSheet])

  const handleExpandChart = useCallback((request: ChartRequest) => {
    if (typeof window === 'undefined') return

    if (window.innerWidth < 1024) {
      openSheet('chart', request.symbol, {
        symbol: request.symbol,
        timeframe: request.timeframe,
        chartRequest: request,
      })
      return
    }

    window.dispatchEvent(new CustomEvent('ai-coach-show-chart', {
      detail: request,
    }))
  }, [openSheet])

  const handleOpenMobileSheet = useCallback((view: MobileToolView) => {
    if (view === 'chart') {
      const symbol = chat.chartRequest?.symbol || getActiveChartSymbol('SPX')
      const timeframe = chat.chartRequest?.timeframe || '5m'
      openSheet('chart', symbol, { symbol, timeframe })
      return
    }

    if (view !== 'options' && view !== 'journal') return
    openSheet(view)
  }, [chat.chartRequest?.symbol, chat.chartRequest?.timeframe, openSheet])

  const requestFocusInput = useCallback(() => {
    window.dispatchEvent(new CustomEvent('ai-coach-focus-input'))
  }, [])

  const toggleChatPanelCollapse = useCallback(() => {
    if (!chatPanelRef.current) return
    if (isChatCollapsed) {
      chatPanelRef.current.expand()
      setIsChatCollapsed(false)
      requestAnimationFrame(() => requestFocusInput())
    } else {
      chatPanelRef.current.collapse()
      setIsChatCollapsed(true)
    }
  }, [isChatCollapsed, requestFocusInput])

  useEffect(() => {
    const seededPrompt = searchParams.get('prompt')?.trim() || ''
    if (!seededPrompt) return
    if (seededPromptRef.current === seededPrompt) return
    if (isSending) return

    seededPromptRef.current = seededPrompt
    sendMessage(seededPrompt)
  }, [isSending, searchParams, sendMessage])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey
      if (!isMeta) return

      const key = event.key.toLowerCase()
      if (key === 'k') {
        event.preventDefault()
        if (window.innerWidth < 1024) {
          closeSheet()
        } else if (isChatCollapsed) {
          chatPanelRef.current?.expand()
          setIsChatCollapsed(false)
        }
        requestAnimationFrame(() => requestFocusInput())
        return
      }

      if (key === 'b' && window.innerWidth >= 1024) {
        event.preventDefault()
        toggleChatPanelCollapse()
        return
      }

      if (event.key === '/') {
        event.preventDefault()
        if (window.innerWidth < 1024) {
          closeSheet()
        }
        window.dispatchEvent(new CustomEvent('ai-coach-toggle-sessions'))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeSheet, isChatCollapsed, requestFocusInput, toggleChatPanelCollapse])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const toNumber = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string') {
        const parsed = Number.parseFloat(value.replace(/[^0-9.+-]/g, ''))
        if (Number.isFinite(parsed)) return parsed
      }
      return null
    }

    const toChartRequestFromWidget = (detail: Record<string, unknown>): ChartRequest | null => {
      const symbol = typeof detail.symbol === 'string' ? detail.symbol.trim().toUpperCase() : ''
      if (!symbol) return null

      const rawTimeframe = typeof detail.timeframe === 'string' ? detail.timeframe : '5m'
      const timeframe = SUPPORTED_CHART_TIMEFRAMES.has(rawTimeframe)
        ? rawTimeframe as ChartRequest['timeframe']
        : '5m'
      const level = toNumber(detail.level)
      const label = typeof detail.label === 'string' && detail.label.trim().length > 0 ? detail.label.trim() : 'Level'

      const request: ChartRequest = { symbol, timeframe }

      if (level != null) {
        request.levels = {
          support: [{ name: label, price: level }],
          resistance: [],
        }
      }

      if (Array.isArray(detail.contextNotes)) {
        request.contextNotes = detail.contextNotes
          .filter((note): note is string => typeof note === 'string' && note.trim().length > 0)
          .slice(0, 6)
      }

      if (Array.isArray(detail.eventMarkers)) {
        request.eventMarkers = detail.eventMarkers
          .filter((marker): marker is {
            label: string
            date?: string
            impact?: 'high' | 'medium' | 'low' | 'info'
            source?: string
          } => (
            Boolean(marker)
            && typeof marker === 'object'
            && typeof (marker as { label?: unknown }).label === 'string'
            && (marker as { label: string }).label.trim().length > 0
          ))
          .slice(0, 6)
      }

      if (Array.isArray(detail.positionOverlays)) {
        request.positionOverlays = detail.positionOverlays
          .filter((overlay): overlay is {
            id?: string
            label?: string
            entry: number
            stop?: number
            target?: number
          } => (
            Boolean(overlay)
            && typeof overlay === 'object'
            && toNumber((overlay as { entry?: unknown }).entry) != null
          ))
          .map((overlay) => ({
            id: typeof overlay.id === 'string' ? overlay.id : undefined,
            label: typeof overlay.label === 'string' ? overlay.label : undefined,
            entry: toNumber(overlay.entry) as number,
            stop: toNumber(overlay.stop) ?? undefined,
            target: toNumber(overlay.target) ?? undefined,
          }))
          .slice(0, 4)
      }

      return request
    }

    const handleWidgetChat = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: unknown }>).detail
      if (!detail || typeof detail.prompt !== 'string') return
      const prompt = detail.prompt.trim()
      if (!prompt) return
      handleSendPrompt(prompt)
    }

    const handleWidgetAlert = (event: Event) => {
      const detail = (event as CustomEvent<{
        symbol?: unknown
        price?: unknown
        alertType?: unknown
        notes?: unknown
      }>).detail
      const symbol = typeof detail?.symbol === 'string' ? detail.symbol.trim().toUpperCase() : ''
      const price = toNumber(detail?.price)
      const alertType = typeof detail?.alertType === 'string' ? detail.alertType : 'level_approach'
      const notes = typeof detail?.notes === 'string' ? detail.notes.trim() : ''
      if (!symbol || price == null) return

      const prompt = [
        `Create a practical alert plan for ${symbol} around ${price.toFixed(2)} (${alertType}).`,
        'Include trigger, invalidation, and what I should do if the alert fires.',
        notes ? `Context: ${notes}` : null,
      ]
        .filter(Boolean)
        .join(' ')

      handleSendPrompt(prompt)
    }

    const handleWidgetAnalyze = (event: Event) => {
      const detail = (event as CustomEvent<{ setup?: Record<string, unknown> }>).detail
      const setup = detail?.setup
      if (!setup || typeof setup !== 'object') return

      const symbol = typeof setup.symbol === 'string' ? setup.symbol.toUpperCase() : 'this symbol'
      const type = typeof setup.type === 'string' ? setup.type.toUpperCase() : 'POSITION'
      const strike = toNumber(setup.strike)
      const qty = toNumber(setup.quantity)
      const entry = toNumber(setup.entryPrice)

      const setupSummary = [
        symbol,
        type,
        strike != null ? `strike ${strike}` : null,
        qty != null ? `qty ${qty}` : null,
        entry != null ? `entry ${entry}` : null,
      ]
        .filter(Boolean)
        .join(' ')

      handleSendPrompt(`Analyze ${setupSummary}. Give entry, invalidation/stop, take-profits, and risk guidance in plain language.`)
    }

    const handleWidgetChart = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail
      if (!detail || typeof detail !== 'object') return
      const request = toChartRequestFromWidget(detail)
      if (!request) return
      handleExpandChart(request)
    }

    const handleWidgetOptions = (event: Event) => {
      const detail = (event as CustomEvent<{ symbol?: unknown }>).detail
      const symbol = typeof detail?.symbol === 'string' ? detail.symbol.toUpperCase() : undefined

      if (window.innerWidth < 1024) {
        openSheet('options', symbol, symbol ? { symbol } : {})
        return
      }

      window.dispatchEvent(new CustomEvent('ai-coach-center-view', {
        detail: {
          view: 'options',
          symbol,
        },
      }))
    }

    const handleWidgetView = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: unknown; symbol?: unknown; timeframe?: unknown }>).detail
      if (!detail || typeof detail.view !== 'string') return
      const view = detail.view
      const symbol = typeof detail.symbol === 'string' ? detail.symbol.toUpperCase() : undefined
      const timeframe = typeof detail.timeframe === 'string' && SUPPORTED_CHART_TIMEFRAMES.has(detail.timeframe)
        ? detail.timeframe
        : undefined

      if (view === 'chart') {
        handleExpandChart({
          symbol: symbol || getActiveChartSymbol('SPX'),
          timeframe: (timeframe as ChartRequest['timeframe']) || '5m',
        })
        return
      }

      if (window.innerWidth < 1024) {
        if (view === 'options' || view === 'journal') {
          openSheet(view, symbol, symbol ? { symbol } : {})
        }
        return
      }

      if (view === 'journal') {
        window.location.assign('/members/journal')
        return
      }

      window.dispatchEvent(new CustomEvent('ai-coach-center-view', {
        detail: {
          view,
          symbol,
          timeframe,
        },
      }))
    }

    window.addEventListener('ai-coach-widget-chat', handleWidgetChat)
    window.addEventListener('ai-coach-widget-alert', handleWidgetAlert)
    window.addEventListener('ai-coach-widget-analyze', handleWidgetAnalyze)
    window.addEventListener('ai-coach-widget-chart', handleWidgetChart)
    window.addEventListener('ai-coach-widget-options', handleWidgetOptions)
    window.addEventListener('ai-coach-widget-view', handleWidgetView)

    return () => {
      window.removeEventListener('ai-coach-widget-chat', handleWidgetChat)
      window.removeEventListener('ai-coach-widget-alert', handleWidgetAlert)
      window.removeEventListener('ai-coach-widget-analyze', handleWidgetAnalyze)
      window.removeEventListener('ai-coach-widget-chart', handleWidgetChart)
      window.removeEventListener('ai-coach-widget-options', handleWidgetOptions)
      window.removeEventListener('ai-coach-widget-view', handleWidgetView)
    }
  }, [handleExpandChart, handleSendPrompt, openSheet])

  return (
    <AICoachErrorBoundary fallbackTitle="AI Coach encountered an error">
      <AICoachWorkflowProvider onSendPrompt={handleSendPrompt}>
        {/* Full-height container — fills available space inside member layout */}
        <div className="flex flex-col h-[calc(100dvh-var(--members-topbar-h)-var(--members-bottomnav-h))] lg:h-[calc(100dvh-3.5rem)]">
          {/* Main Content — full remaining height */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {/* Desktop: Resizable Split Panels */}
            <div className="hidden lg:block h-full relative">
              <PanelGroup direction="horizontal" autoSaveId="ai-coach:desktop-panels:v1">
                {/* Chat Panel (40% default, more room for messages) */}
                <Panel
                  ref={chatPanelRef}
                  defaultSize={40}
                  minSize={30}
                  maxSize={55}
                  collapsible
                  collapsedSize={0}
                  onCollapse={() => setIsChatCollapsed(true)}
                  onExpand={() => setIsChatCollapsed(false)}
                >
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
                    onAppendUserMessage={chat.appendUserMessage}
                    onAppendAssistantMessage={chat.appendAssistantMessage}
                    onExpandChart={handleExpandChart}
                    onOpenSheet={handleOpenMobileSheet}
                    onTogglePanelCollapse={toggleChatPanelCollapse}
                  />
                </Panel>

                {/* Resize Handle */}
                <PanelResizeHandle className="w-2.5 bg-transparent hover:bg-emerald-500/15 active:bg-emerald-500/25 transition-colors cursor-col-resize relative group">
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/10 group-hover:bg-emerald-500/45 transition-colors" />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-12 rounded-full bg-white/10 group-hover:bg-emerald-500/35 transition-colors" />
                </PanelResizeHandle>

                {/* Center Panel (60%) */}
                <Panel defaultSize={60} minSize={35}>
                  <div
                    className={cn(
                      'relative h-full transition-all duration-300',
                      pulse.isPulsing && 'ring-1 ring-emerald-500/40 rounded-lg',
                    )}
                  >
                    <AnimatePresence>
                      {pulse.isPulsing && pulse.pulseLabel && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="absolute top-2 right-3 z-30 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[10px] text-emerald-300"
                        >
                          {pulse.pulseLabel}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <CenterPanel onSendPrompt={handleSendPrompt} chartRequest={chat.chartRequest} />
                  </div>
                </Panel>
              </PanelGroup>

              {isChatCollapsed && (
                <MiniChatOverlay
                  messages={chat.messages}
                  isSending={chat.isSending}
                  onSendMessage={chat.sendMessage}
                  onExpand={toggleChatPanelCollapse}
                />
              )}
            </div>

            {/* Mobile: Chat-first view with full-screen tool sheets */}
            <div className="lg:hidden h-full relative">
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
                  onAppendUserMessage={chat.appendUserMessage}
                  onAppendAssistantMessage={chat.appendAssistantMessage}
                  onExpandChart={handleExpandChart}
                  onOpenSheet={handleOpenMobileSheet}
                />

              <MobileToolSheet
                activeSheet={activeSheet}
                onClose={closeSheet}
                contextText={latestAssistantSummary}
              >
                {activeSheet && (
                  <CenterPanel
                    onSendPrompt={handleSendPrompt}
                    chartRequest={chat.chartRequest}
                    forcedView={activeSheet as CenterView}
                    sheetSymbol={sheetSymbol}
                    sheetParams={sheetParams}
                  />
                )}
              </MobileToolSheet>
            </div>
          </div>
        </div>
      </AICoachWorkflowProvider>
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
  onSendMessage: (text: string, imagePayload?: { image: string; imageMimeType: string }) => void
  onNewSession: () => void
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onClearError: () => void
  onAppendUserMessage: (content: string) => void
  onAppendAssistantMessage: (content: string) => void
  onExpandChart?: (chartRequest: ChartRequest) => void
  onOpenSheet?: (view: MobileToolView) => void
  onTogglePanelCollapse?: () => void
}

interface StagedCsvUpload {
  fileName: string
  content: string
}

interface ScreenshotActionState {
  intent: string
  positions: ExtractedPosition[]
  actions: ScreenshotSuggestedAction[]
}

function ChatArea({
  messages, sessions, currentSessionId, isSending, isLoadingSessions,
  isLoadingMessages, error, rateLimitInfo, onSendMessage, onNewSession,
  onSelectSession, onDeleteSession, onClearError, onAppendUserMessage, onAppendAssistantMessage, onExpandChart, onOpenSheet, onTogglePanelCollapse,
}: ChatAreaProps) {
  const { session, profile } = useMemberAuth()
  const [inputValue, setInputValue] = useState('')
  const [showSessions, setShowSessions] = useState(false)
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [placeholderBucket, setPlaceholderBucket] = useState<PlaceholderBucket>(() => getEasternPlaceholderBucket())
  const [activePromptSymbol, setActivePromptSymbol] = useState<string>(() => getActiveChartSymbol('SPX'))
  const [stagedImage, setStagedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  const [stagedCsv, setStagedCsv] = useState<StagedCsvUpload | null>(null)
  const [screenshotActions, setScreenshotActions] = useState<ScreenshotActionState | null>(null)
  const [spxHeaderTicker, setSpxHeaderTicker] = useState<{
    price: number | null
    change: number | null
    changePct: number | null
    isLoading: boolean
    error: string | null
  }>({
    price: null,
    change: null,
    changePct: null,
    isLoading: true,
    error: null,
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const previousMessageCount = useRef(0)
  const isUserScrolledUp = useRef(false)
  const headerTickerAbortRef = useRef<AbortController | null>(null)

  const autoResizeInput = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return
    window.requestAnimationFrame(() => {
      element.style.height = 'auto'
      element.style.height = `${Math.min(element.scrollHeight, 120)}px`
    })
  }, [])

  const toggleSessions = useCallback(() => {
    setShowSessions((prev) => !prev)
  }, [])

  // Track whether user has scrolled away from bottom
  const handleMessagesScroll = useCallback(() => {
    const el = messagesScrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    isUserScrolledUp.current = !atBottom
  }, [])

  // Auto-scroll on new messages (only if user hasn't scrolled up)
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (messages.length > previousMessageCount.current && !isUserScrolledUp.current) {
      const timer = setTimeout(scrollToBottom, 50)
      return () => clearTimeout(timer)
    }
  }, [messages.length, scrollToBottom])

  useEffect(() => {
    previousMessageCount.current = messages.length
  }, [messages.length])

  useEffect(() => {
    const rotateInterval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      setPlaceholderIndex((index) => index + 1)
    }, 10_000)
    const bucketInterval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      setPlaceholderBucket(getEasternPlaceholderBucket())
    }, 60_000)

    return () => {
      window.clearInterval(rotateInterval)
      window.clearInterval(bucketInterval)
    }
  }, [])

  useEffect(() => {
    setActivePromptSymbol(getActiveChartSymbol('SPX'))
    return subscribeActiveChartSymbol((symbol) => {
      setActivePromptSymbol(normalizePromptSymbol(symbol))
    })
  }, [])

  const loadSPXHeaderTicker = useCallback(async () => {
    if (!session?.access_token) return
    headerTickerAbortRef.current?.abort()
    const controller = new AbortController()
    headerTickerAbortRef.current = controller

    try {
      let data = await getChartData('SPX', '1m', session.access_token, controller.signal)
      if (data.bars.length < 2) {
        data = await getChartData('SPX', '1D', session.access_token, controller.signal)
      }

      if (data.bars.length === 0) {
        throw new Error('No SPX bars available')
      }

      const last = data.bars[data.bars.length - 1]
      const previous = data.bars.length > 1 ? data.bars[data.bars.length - 2] : null
      const change = previous ? last.close - previous.close : 0
      const changePct = previous && previous.close !== 0 ? (change / previous.close) * 100 : null

      setSpxHeaderTicker({
        price: Number(last.close.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePct: changePct != null ? Number(changePct.toFixed(2)) : null,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      setSpxHeaderTicker((prev) => ({
        ...prev,
        isLoading: false,
        error: 'SPX feed offline',
      }))
    }
  }, [session?.access_token])

  useEffect(() => {
    if (!session?.access_token) return
    void loadSPXHeaderTicker()
    const interval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void loadSPXHeaderTicker()
    }, 60_000)
    return () => {
      window.clearInterval(interval)
      headerTickerAbortRef.current?.abort()
    }
  }, [loadSPXHeaderTicker, session?.access_token])

  useEffect(() => {
    const handleFocusInput = () => {
      inputRef.current?.focus()
      autoResizeInput(inputRef.current)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSessions(false)
      }
    }

    window.addEventListener('ai-coach-focus-input', handleFocusInput as EventListener)
    window.addEventListener('ai-coach-toggle-sessions', toggleSessions as EventListener)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('ai-coach-focus-input', handleFocusInput as EventListener)
      window.removeEventListener('ai-coach-toggle-sessions', toggleSessions as EventListener)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [autoResizeInput, toggleSessions])

  const isBusy = isSending || isAnalyzingImage
  const streamStatus = messages.find((msg) => msg.isStreaming)?.streamStatus
  const learnerLevel = inferLearnerLevel(profile?.membership_tier)
  const quickPrompts = useMemo(
    () => buildQuickPrompts(activePromptSymbol, learnerLevel),
    [activePromptSymbol, learnerLevel],
  )
  const placeholderOptions = useMemo(
    () => buildPlaceholderOptions(placeholderBucket, activePromptSymbol),
    [activePromptSymbol, placeholderBucket],
  )
  const rotatingPlaceholder = placeholderOptions[placeholderIndex % placeholderOptions.length]
  const capabilityHintOptions = useMemo(
    () => buildCapabilityHints(placeholderBucket, activePromptSymbol, learnerLevel),
    [activePromptSymbol, learnerLevel, placeholderBucket],
  )
  const capabilityHint = capabilityHintOptions[placeholderIndex % capabilityHintOptions.length]
  const usageRatio = rateLimitInfo?.queryCount && rateLimitInfo?.queryLimit
    ? rateLimitInfo.queryCount / rateLimitInfo.queryLimit
    : 0
  const usageToneClass = usageRatio >= 0.95
    ? 'text-red-300 border-red-500/30 bg-red-500/10'
    : usageRatio >= 0.8
      ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
      : 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
  const usageBarClass = usageRatio >= 0.95
    ? 'bg-red-400'
    : usageRatio >= 0.8
      ? 'bg-amber-400'
      : 'bg-emerald-400'
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = inputValue.trim()
    if ((!text && !stagedImage && !stagedCsv) || isBusy) return

    if (stagedImage) {
      // Send image for analysis through the chat
      Analytics.trackAICoachAction('analyze_uploaded_screenshot')
      void handleImageAnalysis(text)
    } else if (stagedCsv) {
      // Send CSV for analysis through chat
      Analytics.trackAICoachAction('analyze_uploaded_csv')
      void handleCsvAnalysis(text)
    } else {
      Analytics.trackAICoachAction('send_message')
      onSendMessage(text)
    }
    setInputValue('')
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }

  const handleImageAnalysis = async (userMessage: string) => {
    if (!stagedImage) return

    const staged = stagedImage
    const msg = userMessage || 'Analyze this screenshot'
    setStagedImage(null)
    setIsAnalyzingImage(true)

    if (!session?.access_token) {
      onAppendUserMessage(`${msg}\n\n[Uploaded screenshot attached]`)
      onAppendAssistantMessage('Screenshot upload received, but your session token is missing. Please refresh and try again.')
      setIsAnalyzingImage(false)
      return
    }

    // Run position extraction in the background for action chips
    apiAnalyzeScreenshot(staged.base64, staged.mimeType, session.access_token)
      .then((analysis) => {
        setScreenshotActions({
          intent: analysis.intent,
          positions: analysis.positions,
          actions: analysis.suggestedActions,
        })
      })
      .catch(() => {
        // Position extraction is supplementary; chat vision still works
        setScreenshotActions(null)
      })

    // Send the image directly to the chat LLM so it can see and discuss it
    setIsAnalyzingImage(false)
    onSendMessage(msg, { image: staged.base64, imageMimeType: staged.mimeType })
  }

  const handleCsvAnalysis = async (userMessage: string) => {
    if (!stagedCsv) return

    const staged = stagedCsv
    const lines = staged.content.split(/\r?\n/).filter((line) => line.trim().length > 0)
    const previewLines = lines.slice(0, 30)
    const csvPreview = previewLines.join('\n').slice(0, 3200)
    const rowCount = Math.max(lines.length - 1, 0)
    const promptPrefix = userMessage || `Analyze this uploaded CSV file (${staged.fileName}).`

    const prompt = [
      promptPrefix,
      '',
      `Uploaded CSV: ${staged.fileName}`,
      `Estimated rows: ${rowCount}`,
      '',
      'CSV preview:',
      '```csv',
      csvPreview,
      '```',
      '',
      'Determine whether these should be logged as trades, monitored as open positions, or analyzed for next steps. Then provide concise action recommendations.',
    ].join('\n')

    setStagedCsv(null)
    setScreenshotActions(null)
    onSendMessage(prompt)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleImageReady = useCallback((base64: string, mimeType: string) => {
    Analytics.trackAICoachAction('upload_screenshot')
    const preview = `data:${mimeType};base64,${base64}`
    setStagedCsv(null)
    setScreenshotActions(null)
    setStagedImage({ base64, mimeType, preview })
  }, [])

  const handleCsvReady = useCallback((csvText: string, fileName: string) => {
    Analytics.trackAICoachAction('upload_csv')
    setStagedImage(null)
    setScreenshotActions(null)
    setStagedCsv({ fileName, content: csvText })
  }, [])

  const handleFileDrop = useCallback((file: File) => {
    if (isBusy) return
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    const isCsv = file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
    if ((!allowed.includes(file.type) && !isCsv) || file.size > 10 * 1024 * 1024) return

    if (isCsv) {
      const csvReader = new FileReader()
      csvReader.onload = (ev) => {
        const csvText = typeof ev.target?.result === 'string' ? ev.target.result : ''
        if (!csvText.trim()) return
        setStagedImage(null)
        setScreenshotActions(null)
        setStagedCsv({ fileName: file.name, content: csvText })
      }
      csvReader.readAsText(file)
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      if (!dataUrl) return
      const base64 = dataUrl.split(',')[1]
      setStagedCsv(null)
      setScreenshotActions(null)
      setStagedImage({ base64, mimeType: file.type, preview: dataUrl })
    }
    reader.readAsDataURL(file)
  }, [isBusy])

  const handlePasteImage = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (isBusy) return

    const clipboardItems = Array.from(e.clipboardData?.items ?? [])
    const imageItem = clipboardItems.find(
      (item) => item.kind === 'file' && item.type.startsWith('image/')
    )

    if (!imageItem) return

    const file = imageItem.getAsFile()
    if (!file) return

    e.preventDefault()
    handleFileDrop(file)
  }, [handleFileDrop, isBusy])

  const compactPositionSummary = useCallback((positions: ExtractedPosition[]) => {
    return positions
      .slice(0, 5)
      .map((position) => {
        const strike = position.strike ? ` ${position.strike}` : ''
        const expiry = position.expiry ? ` ${position.expiry}` : ''
        return `${position.symbol} ${position.type}${strike}${expiry} x${position.quantity}`
      })
      .join(', ')
  }, [])

  const openWorkflowView = useCallback((view: 'chart' | 'journal') => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai-coach-widget-view', {
        detail: { view, label: 'Screenshot next step' },
      }))
    }

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onOpenSheet?.(view)
    }
  }, [onOpenSheet])

  const handleScreenshotAction = useCallback((actionId: ScreenshotActionId | 'set_alert') => {
    if (!screenshotActions) return
    Analytics.trackAICoachAction(`action_chip_${actionId}`)
    const summary = compactPositionSummary(screenshotActions.positions)

    switch (actionId) {
      case 'add_to_monitor':
        openWorkflowView('journal')
        onSendMessage(
          summary
            ? `Build a monitoring checklist for these screenshot positions and include alert levels, invalidation, and next-step management: ${summary}`
            : 'Build a monitoring checklist from this screenshot with alert levels, invalidation, and next-step management.',
        )
        break
      case 'log_trade':
        openWorkflowView('journal')
        onSendMessage(
          summary
            ? `Help me log these screenshot trades in my journal with clean fields: ${summary}`
            : 'Help me convert this screenshot into a clean journal entry.',
        )
        break
      case 'analyze_next_steps':
        openWorkflowView('chart')
        onSendMessage(
          summary
            ? `Analyze next steps for these positions with clear risk-managed actions: ${summary}`
            : 'Analyze next steps from this screenshot with clear risk-managed actions.',
        )
        break
      case 'create_setup':
        onSendMessage('Create a structured setup from this screenshot with entry, stop, target, and invalidation.')
        break
      case 'set_alert':
      case 'suggest_alerts':
        onSendMessage('Create practical alert levels from this screenshot and explain each trigger.')
        break
      case 'review_journal_context':
        openWorkflowView('journal')
        onSendMessage('Compare this screenshot against my recent journal history and highlight repeated patterns.')
        break
    }

    setScreenshotActions(null)
  }, [compactPositionSummary, onSendMessage, openWorkflowView, screenshotActions])

  return (
    <div
      className="flex h-full bg-[radial-gradient(120%_120%_at_50%_-10%,rgba(16,185,129,0.08),rgba(10,10,11,1)_52%)]"
      ref={chatContainerRef}
    >
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
                onClick={() => {
                  Analytics.trackAICoachAction('new_session')
                  onNewSession()
                }}
                className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-emerald-500 transition-colors"
                title="New session"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoadingSessions ? (
                <div className="space-y-2 py-2">
                  {[80, 62, 90, 70].map((width, index) => (
                    <div
                      key={`session-skeleton-${index}`}
                      className="h-10 rounded-lg border border-white/5 bg-white/5 animate-pulse"
                      style={{ width: `${width}%` }}
                    />
                  ))}
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
                    onClick={() => {
                      Analytics.trackAICoachAction('open_session')
                      onSelectSession(s.id)
                    }}
                  >
                    <MessageSquare className={cn('w-3.5 h-3.5 shrink-0', s.id === currentSessionId ? 'text-emerald-500' : 'text-white/30')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{s.title}</p>
                      <p className="text-[10px] text-white/25">{s.message_count} msg{s.message_count !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        Analytics.trackAICoachAction('delete_session')
                        onDeleteSession(s.id)
                      }}
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
        <div className="border-b border-white/10 bg-black/25 px-3 py-2.5 backdrop-blur-sm sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                onClick={() => {
                  Analytics.trackAICoachAction('toggle_sessions')
                  toggleSessions()
                }}
                className="shrink-0 p-1.5 rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                title="Toggle sessions (Ctrl/Cmd+/)"
              >
                {showSessions ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <BrainCircuit className="h-5 w-5 shrink-0 text-emerald-500" />
              <h3 className="truncate text-sm font-medium text-white">
                {currentSessionId ? sessions.find(s => s.id === currentSessionId)?.title || 'Chat' : 'AI Coach'}
              </h3>
            </div>

            <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
              <button
                onClick={() => {
                  Analytics.trackAICoachAction('spx_game_plan_refresh')
                  onSendMessage('Give me the full SPX game plan: key levels, GEX profile, expected move, and what setups to watch today. Show the chart.')
                }}
                className="hidden xl:flex items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200 transition-colors hover:bg-emerald-500/15"
                title="Refresh SPX game plan"
              >
                {spxHeaderTicker.isLoading ? (
                  <span>SPX loading...</span>
                ) : spxHeaderTicker.error ? (
                  <span>{spxHeaderTicker.error}</span>
                ) : (
                  <>
                    <span>SPX {spxHeaderTicker.price?.toLocaleString()}</span>
                    {spxHeaderTicker.change != null && (
                      <span className={cn(
                        spxHeaderTicker.change >= 0 ? 'text-emerald-300' : 'text-red-300'
                      )}>
                        {spxHeaderTicker.change >= 0 ? '+' : ''}{spxHeaderTicker.change.toFixed(2)}
                        {spxHeaderTicker.changePct != null ? ` (${spxHeaderTicker.change >= 0 ? '+' : ''}${spxHeaderTicker.changePct.toFixed(2)}%)` : ''}
                      </span>
                    )}
                  </>
                )}
              </button>
              <p className="hidden 2xl:block whitespace-nowrap text-[10px] text-white/30">
                Ctrl/Cmd+K focus | Ctrl/Cmd+/ sessions | Ctrl/Cmd+B collapse
              </p>
              <Button
                onClick={() => {
                  Analytics.trackAICoachAction('new_session')
                  onNewSession()
                }}
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-white/40 hover:text-emerald-500"
              >
                <Plus className="mr-0 h-4 w-4 sm:mr-1" />
                <span className="hidden text-xs sm:inline">New</span>
              </Button>
              {onTogglePanelCollapse && (
                <button
                  onClick={onTogglePanelCollapse}
                  className="p-1.5 rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                  title="Collapse chat panel (Ctrl/Cmd+B)"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error / Rate Limit Banners */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
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
          {rateLimitInfo && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className={cn('px-4 py-2 border-b', usageToneClass)}>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p className="text-xs">
                    Usage {rateLimitInfo.queryCount}/{rateLimitInfo.queryLimit} queries
                    {rateLimitInfo.resetDate ? ` • resets ${new Date(rateLimitInfo.resetDate).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn('h-full transition-all duration-300', usageBarClass)}
                    style={{ width: `${Math.min(Math.max(usageRatio * 100, 0), 100)}%` }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div
          ref={messagesScrollRef}
          onScroll={handleMessagesScroll}
          className="flex-1 space-y-6 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_30%)] px-4 py-6"
        >
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              onSendPrompt={onSendMessage}
              quickPrompts={quickPrompts}
              activeSymbol={activePromptSymbol}
            />
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} onSendPrompt={onSendMessage} onExpandChart={onExpandChart} />
              ))}
              {isSending && !messages.some(m => m.isStreaming) && (
                <TypingIndicator streamStatus={isAnalyzingImage ? 'Analyzing screenshot...' : streamStatus} />
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="relative border-t border-white/10 bg-black/30 px-4 py-3 backdrop-blur-md">
          {/* Image preview strip */}
          <ChatImageUpload
            onImageReady={handleImageReady}
            onCsvReady={handleCsvReady}
            onClear={() => {
              setStagedImage(null)
              setStagedCsv(null)
            }}
            isSending={isBusy}
            stagedPreview={stagedImage?.preview || null}
            stagedCsvName={stagedCsv?.fileName || null}
          />

          {screenshotActions && screenshotActions.actions.length > 0 && (
            <div className="mb-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5">
              <p className="text-[11px] uppercase tracking-wide text-emerald-200/75">
                Screenshot intent: {screenshotActions.intent.replace('_', ' ')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {screenshotActions.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => handleScreenshotAction(action.id)}
                    className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100 transition-colors hover:bg-emerald-500/25"
                    title={action.description}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mb-2 text-[10px] text-white/35">{capabilityHint}</p>
          <p className="mb-2 text-[10px] text-emerald-100/65">
            Tip: use the <span className="text-emerald-300">Screenshot</span> button or paste an image directly into chat.
          </p>

          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                autoResizeInput(e.target)
              }}
              onPaste={handlePasteImage}
              onKeyDown={handleKeyDown}
              placeholder={isBusy ? 'Processing...' : rotatingPlaceholder}
              disabled={isBusy}
              maxLength={2000}
              rows={1}
              aria-label="Message the AI coach"
              className="min-h-[44px] max-h-[120px] flex-1 resize-none rounded-xl border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-4 py-3 text-sm text-white placeholder:text-white/30 transition-all duration-150 ease-out focus:border-emerald-400/45 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 disabled:opacity-40"
            />
            <Button
              type="submit"
              disabled={(!inputValue.trim() && !stagedImage && !stagedCsv) || isBusy}
              aria-label={isBusy ? 'Sending message' : 'Send message'}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-xl transition-all disabled:opacity-20 disabled:cursor-not-allowed h-[44px]"
            >
              {isBusy ? (
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

function EmptyState({
  onSendPrompt,
  quickPrompts,
  activeSymbol,
}: {
  onSendPrompt: (prompt: string) => void
  quickPrompts: QuickPromptItem[]
  activeSymbol: string
}) {
  const bucket = getEasternPlaceholderBucket()
  const contextLine = bucket === 'pre_market'
    ? 'Pre-market prep mode'
    : bucket === 'session'
      ? 'Markets are open'
      : bucket === 'after_hours'
        ? 'After-hours review'
        : 'Markets are closed'

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-sm">
        <motion.div
          className="relative w-14 h-14 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center mx-auto mb-5 overflow-hidden"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity }}
        >
          <motion.span
            className="absolute inset-0 rounded-2xl border border-emerald-400/25"
            animate={{ scale: [1, 1.18, 1], opacity: [0.35, 0, 0.35] }}
            transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
          />
          <BrainCircuit className="w-7 h-7 text-emerald-500" />
        </motion.div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-400/60 mb-2">{contextLine}</p>
        <h3 className="text-base font-medium text-white mb-2">
          What are you trading today?
        </h3>
        <p className="text-sm text-white/40 leading-relaxed mb-6">
          Ask me about any ticker, levels, options setups, and risk in one flow.
          <span className="block mt-1 text-emerald-300/70">Current chart focus: {activeSymbol}</span>
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {quickPrompts.map((item) => (
            <motion.button
              key={item.text}
              onClick={() => {
                Analytics.trackAICoachAction(`quick_prompt_${item.text.toLowerCase().replace(/\s+/g, '_')}`)
                onSendPrompt(item.prompt)
              }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all text-left"
            >
              {item.text}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}
