'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, BrainCircuit, Wrench, Search, Activity, PenSquare } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { sanitizeContent } from '@/lib/sanitize'
import { type ChatMessage } from '@/hooks/use-ai-coach-chat'
import type { ChartRequest } from '@/components/ai-coach/center-panel'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { WidgetCard, extractWidgets } from './widget-cards'
import { FollowUpChips } from './follow-up-chips'
import { InlineMiniChart } from './inline-mini-chart'

interface ChatMessageProps {
  message: ChatMessage
  onSendPrompt?: (prompt: string) => void
  onExpandChart?: (chartRequest: ChartRequest) => void
}

/**
 * Modern chat message component with proper bubbles, markdown rendering,
 * and inline generative UI widgets.
 */
export const ChatMessageBubble = memo(function ChatMessageBubble({ message, onSendPrompt, onExpandChart }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const { session } = useMemberAuth()
  const [isHighlighted, setIsHighlighted] = useState(false)

  const widgets = useMemo(() => {
    if (isUser || !message.functionCalls) return []
    return extractWidgets(message.functionCalls)
  }, [isUser, message.functionCalls])

  useEffect(() => {
    const handleHover = (event: Event) => {
      const detail = (event as CustomEvent<{
        type?: string
        value?: string
        sourcePanel?: 'chat' | 'center'
      }>).detail
      if (detail?.sourcePanel !== 'center' || detail?.type !== 'level' || !detail?.value) return
      if (isUser || !message.content) return
      const target = detail.value.toLowerCase()
      setIsHighlighted(message.content.toLowerCase().includes(target))
    }
    const handleClear = () => setIsHighlighted(false)

    window.addEventListener('ai-coach-hover-coordinate', handleHover)
    window.addEventListener('ai-coach-hover-clear', handleClear)

    return () => {
      window.removeEventListener('ai-coach-hover-coordinate', handleHover)
      window.removeEventListener('ai-coach-hover-clear', handleClear)
    }
  }, [isUser, message.content])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn('flex gap-3 group', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={cn(
        'flex gap-3 max-w-[84%]',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}>
        {/* Avatar */}
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1',
          isUser
            ? 'bg-[linear-gradient(135deg,rgba(243,229,171,0.24),rgba(243,229,171,0.08))] ring-1 ring-[rgba(243,229,171,0.35)] shadow-[0_6px_16px_rgba(243,229,171,0.14)]'
            : 'bg-[linear-gradient(135deg,rgba(16,185,129,0.28),rgba(16,185,129,0.08))] ring-1 ring-emerald-400/35 shadow-[0_6px_16px_rgba(16,185,129,0.18)]'
        )}>
          {isUser ? (
            <User className="w-4 h-4 text-[#F3E5AB]" />
          ) : (
            <BrainCircuit className="w-4 h-4 text-emerald-400" />
          )}
        </div>

        {/* Message content */}
        <div className="flex flex-col gap-1.5 min-w-0">
          {/* Bubble */}
          <div
            className={cn(
              !isUser && isHighlighted && 'rounded-2xl ring-1 ring-emerald-400/45 shadow-[0_0_0_1px_rgba(16,185,129,0.18)_inset]',
            )}
          >
            <div className={cn(
              'rounded-2xl px-4 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.24)]',
              isUser
                ? 'rounded-tr-md border border-[rgba(243,229,171,0.24)] bg-[linear-gradient(145deg,rgba(243,229,171,0.20),rgba(30,41,59,0.48))]'
                : 'rounded-tl-md border border-emerald-500/20 bg-[linear-gradient(145deg,rgba(16,185,129,0.13),rgba(255,255,255,0.02))] backdrop-blur-[2px]',
              message.isOptimistic && 'opacity-60'
            )}>
            {/* Streaming status */}
            {message.isStreaming && message.streamStatus && !message.content && (
              <div className="flex items-center gap-2 text-xs text-emerald-400/70">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {message.streamStatus}
              </div>
            )}

            {/* Content */}
            {message.content ? (
              <div className={cn(
                'text-sm leading-relaxed break-words [overflow-wrap:anywhere]',
                isUser ? 'text-white' : 'text-white/90'
              )}>
                {isUser ? (
                  <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{sanitizeContent(message.content)}</span>
                ) : (
                  <MarkdownRenderer content={message.content} />
                )}
                {message.isStreaming && (
                  <span className="inline-block w-0.5 h-4 bg-emerald-400/60 ml-0.5 animate-pulse align-middle" />
                )}
              </div>
            ) : !message.isStreaming ? (
              <div className="text-sm text-white/40 italic">
                {message.functionCalls && message.functionCalls.length > 0
                  ? 'Analysis complete. See the result cards below.'
                  : 'No response'}
              </div>
            ) : null}
            </div>
          </div>

          {/* Inline widgets from function calls */}
          {widgets.length > 0 && (
            <div className="space-y-2 mt-1">
              {widgets.map((widget, i) => (
                <WidgetCard key={i} widget={widget} />
              ))}
            </div>
          )}

          {!isUser && message.chartRequest && (
            <InlineMiniChart
              chartRequest={message.chartRequest}
              accessToken={session?.access_token}
              onExpand={() => onExpandChart?.(message.chartRequest!)}
            />
          )}

          {!isUser && !message.isStreaming && message.content && onSendPrompt && (
            <FollowUpChips
              content={message.content}
              functionCalls={message.functionCalls}
              onSelect={onSendPrompt}
            />
          )}

          {/* Footer */}
          <div className={cn(
            'flex items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity duration-200',
            isUser ? 'justify-end pr-1' : 'justify-start pl-1'
          )}>
            <span className="text-[11px] text-white/30">
              {formatTime(message.timestamp)}
            </span>
            {message.functionCalls && message.functionCalls.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-500/50">
                <Wrench className="w-3 h-3" />
                Live data synced
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
})

/**
 * Typing indicator with stream-status context
 */
export function TypingIndicator({ streamStatus }: { streamStatus?: string }) {
  const normalized = (streamStatus || '').toLowerCase()
  const state = normalized.includes('analyz')
    ? { label: 'Analyzing...', icon: Activity }
    : normalized.includes('writing')
      ? { label: 'Writing...', icon: PenSquare }
      : normalized.includes('fetch') || normalized.includes('using')
        ? { label: 'Fetching data...', icon: Search }
        : { label: 'Thinking...', icon: BrainCircuit }
  const StatusIcon = state.icon

  return (
    <div className="flex gap-3 justify-start">
      <div className="flex gap-3">
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(16,185,129,0.28),rgba(16,185,129,0.08))] ring-1 ring-emerald-400/35 shadow-[0_6px_16px_rgba(16,185,129,0.18)]">
          <BrainCircuit className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-[linear-gradient(145deg,rgba(16,185,129,0.12),rgba(255,255,255,0.02))] px-4 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
          <StatusIcon className="w-3.5 h-3.5 text-emerald-300/80 animate-pulse" />
          <span className="text-xs text-emerald-200/80">{state.label}</span>
          <span
            className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"
            style={{ animationDelay: '0ms', animationDuration: '0.6s' }}
          />
          <span
            className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"
            style={{ animationDelay: '150ms', animationDuration: '0.6s' }}
          />
          <span
            className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"
            style={{ animationDelay: '300ms', animationDuration: '0.6s' }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Renders AI message content as rich Markdown with remark-gfm.
 * Tables and code blocks get monospace; everything else is sans-serif.
 */
function MarkdownRenderer({ content }: { content: string }) {
  const sanitized = sanitizeContent(content)

  return (
    <div className="break-words [overflow-wrap:anywhere]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Headings
        h1: ({ children }) => <h3 className="text-base font-semibold text-white mt-3 mb-1.5">{children}</h3>,
        h2: ({ children }) => <h4 className="text-sm font-semibold text-white mt-2.5 mb-1">{children}</h4>,
        h3: ({ children }) => <h5 className="text-sm font-medium text-white mt-2 mb-1">{children}</h5>,
        // Paragraph
        p: ({ children }) => <p className="mb-2 last:mb-0 break-words [overflow-wrap:anywhere]">{children}</p>,
        // Bold & italic
        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
        em: ({ children }) => <em className="text-white/80 italic">{children}</em>,
        // Lists
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5 ml-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5 ml-1">{children}</ol>,
        li: ({ children }) => <li className="text-white/80 break-words [overflow-wrap:anywhere]">{children}</li>,
        // Inline code — monospace
        code: ({ className, children, ...props }) => {
          const isCodeBlock = className?.includes('language-')
          if (isCodeBlock) {
            return (
              <code className="text-xs font-mono text-emerald-300" {...props}>
                {children}
              </code>
            )
          }
          return (
            <code className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-xs text-emerald-300" {...props}>
              {children}
            </code>
          )
        },
        // Code blocks
        pre: ({ children }) => (
          <pre className="my-2 p-3 rounded-lg bg-black/30 border border-white/10 overflow-x-auto text-xs">
            {children}
          </pre>
        ),
        // Tables — monospace numbers, compact
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-xs">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-white/5 text-white/60">{children}</thead>,
        tbody: ({ children }) => <tbody className="divide-y divide-white/5">{children}</tbody>,
        tr: ({ children }) => <tr className="hover:bg-white/3">{children}</tr>,
        th: ({ children }) => <th className="px-3 py-1.5 text-left font-medium text-white/50 uppercase text-[10px] tracking-wider">{children}</th>,
        td: ({ children }) => <td className="px-3 py-1.5 font-mono text-white/70">{children}</td>,
        // Links
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
            {children}
          </a>
        ),
        // Horizontal rule
        hr: () => <hr className="my-3 border-white/10" />,
        // Blockquote
        blockquote: ({ children }) => (
          <blockquote className="my-2 pl-3 border-l-2 border-emerald-500/30 text-white/70 italic">
            {children}
          </blockquote>
        ),
        // Images — suppress broken markdown images; charts use show_chart() function calls
        img: ({ alt }) => alt ? (
          <span className="text-xs text-white/40 italic">{alt}</span>
        ) : null,
        }}
      >
        {sanitized}
      </ReactMarkdown>
    </div>
  )
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}
