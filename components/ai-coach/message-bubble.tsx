'use client'

import { memo } from 'react'
import { User, BrainCircuit, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/hooks/use-ai-coach-chat'
import { WidgetCard, extractWidgets } from './widget-cards'

interface MessageBubbleProps {
  message: ChatMessage
}

/**
 * Renders a single chat message with appropriate styling for user vs AI messages.
 * Follows the Emerald Standard design system.
 */
export const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'flex gap-3 max-w-[85%]',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}>
        {/* Avatar */}
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
          isUser
            ? 'bg-champagne/20 border border-champagne/30'
            : 'bg-emerald-500/20 border border-emerald-500/30'
        )}>
          {isUser ? (
            <User className="w-4 h-4 text-[var(--champagne-hex)]" />
          ) : (
            <BrainCircuit className="w-4 h-4 text-emerald-400" />
          )}
        </div>

        {/* Message content */}
        <div className="flex flex-col gap-1">
          <div className={cn(
            'rounded-2xl px-4 py-2.5',
            isUser
              ? 'bg-gradient-to-br from-[rgba(243,229,171,0.2)] to-[rgba(243,229,171,0.1)] border border-[rgba(243,229,171,0.3)] text-white'
              : 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 text-white/90',
            message.isOptimistic && 'opacity-70'
          )}>
            {/* Render message content with basic formatting */}
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              <FormattedContent content={message.content} />
            </div>
          </div>

          {/* Widget cards rendered from function call results */}
          {!isUser && message.functionCalls && (() => {
            const widgets = extractWidgets(message.functionCalls)
            return widgets.length > 0 ? (
              <div className="space-y-2">
                {widgets.map((widget, i) => (
                  <WidgetCard key={i} widget={widget} />
                ))}
              </div>
            ) : null
          })()}

          {/* Footer: timestamp + function call badge */}
          <div className={cn(
            'flex items-center gap-2 px-2',
            isUser ? 'justify-end' : 'justify-start'
          )}>
            <span className="text-xs text-white/40">
              {formatTime(message.timestamp)}
            </span>
            {message.functionCalls && message.functionCalls.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-emerald-500/60">
                <Wrench className="w-3 h-3" />
                {message.functionCalls.length} tool{message.functionCalls.length > 1 ? 's' : ''} used
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

/**
 * Basic markdown-like formatting for AI responses.
 * Handles bold, inline code, and code blocks.
 */
function FormattedContent({ content }: { content: string }) {
  // Split content into lines for processing
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let inCodeBlock = false
  let codeBlockContent: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Handle code blocks (```)
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <pre key={`code-${i}`} className="my-2 p-3 rounded-lg bg-black/30 border border-white/10 overflow-x-auto">
            <code className="text-xs font-mono text-emerald-300">
              {codeBlockContent.join('\n')}
            </code>
          </pre>
        )
        codeBlockContent = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockContent.push(line)
      continue
    }

    // Regular line - apply inline formatting
    elements.push(
      <span key={i}>
        {i > 0 && <br />}
        <InlineFormatted text={line} />
      </span>
    )
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <pre key="code-unclosed" className="my-2 p-3 rounded-lg bg-black/30 border border-white/10 overflow-x-auto">
        <code className="text-xs font-mono text-emerald-300">
          {codeBlockContent.join('\n')}
        </code>
      </pre>
    )
  }

  return <>{elements}</>
}

/**
 * Handles inline formatting: **bold**, `code`, *italic*
 */
function InlineFormatted({ text }: { text: string }) {
  // Process bold (**text**), inline code (`text`), and italic (*text*)
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // Inline code: `text`
    const codeMatch = remaining.match(/`([^`]+)`/)

    // Find earliest match
    const boldIndex = boldMatch ? remaining.indexOf(boldMatch[0]) : -1
    const codeIndex = codeMatch ? remaining.indexOf(codeMatch[0]) : -1

    let earliestIndex = -1
    let earliestType: 'bold' | 'code' | null = null

    if (boldIndex >= 0 && (codeIndex < 0 || boldIndex <= codeIndex)) {
      earliestIndex = boldIndex
      earliestType = 'bold'
    } else if (codeIndex >= 0) {
      earliestIndex = codeIndex
      earliestType = 'code'
    }

    if (earliestType === null) {
      parts.push(remaining)
      break
    }

    // Add text before match
    if (earliestIndex > 0) {
      parts.push(remaining.substring(0, earliestIndex))
    }

    if (earliestType === 'bold' && boldMatch) {
      parts.push(
        <strong key={key++} className="font-semibold text-white">
          {boldMatch[1]}
        </strong>
      )
      remaining = remaining.substring(earliestIndex + boldMatch[0].length)
    } else if (earliestType === 'code' && codeMatch) {
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 rounded bg-black/30 border border-white/10 font-mono text-xs text-emerald-300">
          {codeMatch[1]}
        </code>
      )
      remaining = remaining.substring(earliestIndex + codeMatch[0].length)
    }
  }

  return <>{parts}</>
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
