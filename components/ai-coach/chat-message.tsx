'use client'

import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, BrainCircuit, Wrench, Search, Activity, PenSquare } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { sanitizeContent } from '@/lib/sanitize'
import { type ChatMessage } from '@/hooks/use-ai-coach-chat'
import { WidgetCard, extractWidgets } from './widget-cards'
import { FollowUpChips } from './follow-up-chips'

interface ChatMessageProps {
  message: ChatMessage
  onSendPrompt?: (prompt: string) => void
}

/**
 * Modern chat message component with proper bubbles, markdown rendering,
 * and inline generative UI widgets.
 */
export const ChatMessageBubble = memo(function ChatMessageBubble({ message, onSendPrompt }: ChatMessageProps) {
  const isUser = message.role === 'user'

  const widgets = useMemo(() => {
    if (isUser || !message.functionCalls) return []
    return extractWidgets(message.functionCalls)
  }, [isUser, message.functionCalls])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn('flex gap-3 group', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={cn(
        'flex gap-3 max-w-[80%]',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}>
        {/* Avatar */}
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1',
          isUser
            ? 'bg-[rgba(243,229,171,0.15)] ring-1 ring-[rgba(243,229,171,0.25)]'
            : 'bg-emerald-500/15 ring-1 ring-emerald-500/25'
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
          <div className={cn(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'bg-gradient-to-br from-slate-700/60 to-slate-800/60 border border-slate-600/30 rounded-tr-md'
              : 'bg-transparent border-none px-0 py-0 rounded-tl-md',
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
                'text-sm leading-relaxed',
                isUser ? 'text-white' : 'text-white/90'
              )}>
                {isUser ? (
                  <span className="whitespace-pre-wrap">{sanitizeContent(message.content)}</span>
                ) : (
                  <MarkdownRenderer content={message.content} />
                )}
                {message.isStreaming && (
                  <span className="inline-block w-0.5 h-4 bg-emerald-400/60 ml-0.5 animate-pulse align-middle" />
                )}
              </div>
            ) : !message.isStreaming ? (
              <div className="text-sm text-white/30 italic">No response</div>
            ) : null}
          </div>

          {/* Inline widgets from function calls */}
          {widgets.length > 0 && (
            <div className="space-y-2 mt-1">
              {widgets.map((widget, i) => (
                <WidgetCard key={i} widget={widget} />
              ))}
            </div>
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
            'flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
            isUser ? 'justify-end pr-1' : 'justify-start pl-1'
          )}>
            <span className="text-[11px] text-white/30">
              {formatTime(message.timestamp)}
            </span>
            {message.functionCalls && message.functionCalls.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-500/50">
                <Wrench className="w-3 h-3" />
                {message.functionCalls.length} tool{message.functionCalls.length > 1 ? 's' : ''}
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
        <div className="w-8 h-8 rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/25 flex items-center justify-center shrink-0 mt-1">
          <BrainCircuit className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex items-center gap-2 px-4 py-3">
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
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Headings
        h1: ({ children }) => <h3 className="text-base font-semibold text-white mt-3 mb-1.5">{children}</h3>,
        h2: ({ children }) => <h4 className="text-sm font-semibold text-white mt-2.5 mb-1">{children}</h4>,
        h3: ({ children }) => <h5 className="text-sm font-medium text-white mt-2 mb-1">{children}</h5>,
        // Paragraph
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        // Bold & italic
        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
        em: ({ children }) => <em className="text-white/80 italic">{children}</em>,
        // Lists
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5 ml-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5 ml-1">{children}</ol>,
        li: ({ children }) => <li className="text-white/80">{children}</li>,
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
