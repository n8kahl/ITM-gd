'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
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

const CHAT_QUICK_PROMPTS = [
  {
    text: 'Start Here',
    prompt: 'I am a newer trader. Show SPY on the chart and explain the most important support/resistance levels in plain English.',
  },
  {
    text: 'Read This Chart',
    prompt: 'Show SPX on the chart and give me a simple read: trend, nearest support/resistance, and one bull + one bear trigger.',
  },
  {
    text: 'Risk Checklist',
    prompt: 'Build a beginner-friendly risk checklist for today: position size, max loss, and what invalidation means before entry.',
  },
  {
    text: 'Advanced SPX Plan',
    prompt: 'Give me the full SPX game plan: key levels (PDH, PDL, pivot, VWAP), GEX profile with flip point, expected move, and what setups to watch today. Show the chart.',
  },
] as const

const CHAT_PLACEHOLDERS = {
  pre_market: [
    'Show me overnight levels in plain English',
    'What should I watch at the open?',
    'Morning brief',
  ],
  session: [
    'How is SPX holding up right now?',
    'What is the safest setup to watch?',
    'Explain this move simply',
  ],
  after_hours: [
    'Recap today\'s session simply',
    'What worked and what failed today?',
    'Build a plan for tomorrow',
  ],
  closed: [
    'Review my trade journal',
    'What mistakes should I avoid tomorrow?',
    'Study one setup step-by-step',
  ],
} as const

function getEasternPlaceholderBucket(now: Date = new Date()): keyof typeof CHAT_PLACEHOLDERS {
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
      const symbol = chat.chartRequest?.symbol || 'SPX'
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

  return (
    <AICoachErrorBoundary fallbackTitle="AI Coach encountered an error">
      <AICoachWorkflowProvider onSendPrompt={handleSendPrompt}>
        {/* Full-height container — fills available space inside member layout */}
        <div className="flex flex-col h-[calc(100dvh-var(--members-topbar-h)-var(--members-bottomnav-h))] lg:h-[calc(100dvh-3.5rem)]">
          {/* Main Content — full remaining height */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {/* Desktop: Resizable Split Panels */}
            <div className="hidden lg:block h-full relative">
              <PanelGroup direction="horizontal">
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
  onSendMessage: (text: string) => void
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
  const { session } = useMemberAuth()
  const [inputValue, setInputValue] = useState('')
  const [showSessions, setShowSessions] = useState(false)
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [placeholderBucket, setPlaceholderBucket] = useState<keyof typeof CHAT_PLACEHOLDERS>(() => getEasternPlaceholderBucket())
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
      setPlaceholderIndex((index) => index + 1)
    }, 10_000)
    const bucketInterval = window.setInterval(() => {
      setPlaceholderBucket(getEasternPlaceholderBucket())
    }, 60_000)

    return () => {
      window.clearInterval(rotateInterval)
      window.clearInterval(bucketInterval)
    }
  }, [])

  const loadSPXHeaderTicker = useCallback(async () => {
    if (!session?.access_token) return

    try {
      let data = await getChartData('SPX', '1m', session.access_token)
      if (data.bars.length < 2) {
        data = await getChartData('SPX', '1D', session.access_token)
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
    } catch {
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
      void loadSPXHeaderTicker()
    }, 60_000)
    return () => window.clearInterval(interval)
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
  const placeholderOptions = CHAT_PLACEHOLDERS[placeholderBucket]
  const rotatingPlaceholder = placeholderOptions[placeholderIndex % placeholderOptions.length]
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
    onAppendUserMessage(`${msg}\n\n[Uploaded screenshot attached]`)
    setStagedImage(null)
    setIsAnalyzingImage(true)

    if (!session?.access_token) {
      onAppendAssistantMessage('Screenshot upload received, but your session token is missing. Please refresh and try again.')
      setIsAnalyzingImage(false)
      return
    }

    try {
      const analysis = await apiAnalyzeScreenshot(staged.base64, staged.mimeType, session.access_token)
      setScreenshotActions({
        intent: analysis.intent,
        positions: analysis.positions,
        actions: analysis.suggestedActions,
      })

      const extracted = analysis.positions.map((position, index) => {
        const strike = position.strike ? ` ${position.strike}` : ''
        const expiry = position.expiry ? ` ${position.expiry}` : ''
        const confidence = Math.round(position.confidence * 100)
        return `${index + 1}. ${position.symbol} ${position.type}${strike}${expiry} x${position.quantity} (confidence ${confidence}%)`
      })

      const warnings = analysis.warnings.length > 0
        ? `\n\nWarnings:\n${analysis.warnings.map((warning) => `- ${warning}`).join('\n')}`
        : ''

      const accountValue = typeof analysis.accountValue === 'number'
        ? `\n\nAccount Value: $${analysis.accountValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        : ''

      const summary = analysis.positionCount > 0
        ? `I extracted ${analysis.positionCount} position${analysis.positionCount === 1 ? '' : 's'} from your screenshot:\n${extracted.join('\n')}`
        : 'I could not reliably extract any positions from this screenshot.'

      onAppendAssistantMessage(
        `${summary}${accountValue}${warnings}\n\nIntent detected: ${analysis.intent.replace('_', ' ')}.\nUse the action buttons below the input to choose your next step instantly.`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to analyze screenshot.'
      onAppendAssistantMessage(`Screenshot analysis failed: ${message}`)
      setScreenshotActions(null)
    } finally {
      setIsAnalyzingImage(false)
    }
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
        <div className="border-b border-white/5 px-3 py-2.5 sm:px-4">
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
          className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
        >
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState onSendPrompt={onSendMessage} />
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
        <div className="relative px-4 py-3 border-t border-white/5 bg-[#0A0A0B]">
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
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all transition-[height] duration-150 ease-out disabled:opacity-40 resize-none min-h-[44px] max-h-[120px]"
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

function EmptyState({ onSendPrompt }: { onSendPrompt: (prompt: string) => void }) {
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
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {CHAT_QUICK_PROMPTS.map((item) => (
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
