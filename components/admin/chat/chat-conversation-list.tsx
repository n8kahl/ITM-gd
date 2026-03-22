'use client'

import { forwardRef } from 'react'
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import {
  CheckCircle2,
  Clock,
  Flame,
  Sparkles,
  User,
} from 'lucide-react'
import type { Conversation } from './chat-types'

export function LeadScoreFlames({ score }: { score: number }) {
  const flameCount = score >= 10 ? 4 : score >= 7 ? 3 : score >= 4 ? 2 : 1
  const flameColor = score >= 7 ? 'text-orange-500' : score >= 4 ? 'text-yellow-500' : 'text-platinum/40'

  return (
    <div className="flex items-center gap-0.5" title={`Lead Score: ${score}/10`}>
      {Array.from({ length: flameCount }).map((_, i) => (
        <Flame
          key={i}
          className={`w-3.5 h-3.5 ${flameColor} ${score >= 7 ? 'animate-pulse' : ''}`}
          fill={score >= 4 ? 'currentColor' : 'none'}
        />
      ))}
      <span className={`text-xs ml-1 ${flameColor}`}>{score}</span>
    </div>
  )
}

type ConversationItemProps = {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  onTakeOver: () => void
  onResolve?: () => void
  isMobile?: boolean
}

export const ConversationItem = forwardRef<HTMLDivElement, ConversationItemProps>(
  ({ conversation, isSelected, onClick, onTakeOver, onResolve, isMobile }, ref) => {
    const isEscalated = conversation.escalation_reason !== null
    const leadScore = conversation.lead_score || 0
    const status = conversation.status || 'active'
    const hasPendingEscalation = !!(conversation.metadata as Record<string, Record<string, unknown>>)?.pending_escalation
    const isHighPriority = status === 'active' && (isEscalated || leadScore >= 7 || hasPendingEscalation)
    const isArchived = status === 'archived'
    const isResolved = status === 'resolved'

    const x = useMotionValue(0)
    const background = useTransform(
      x,
      [-150, -80, 0],
      ['rgba(16, 185, 129, 0.3)', 'rgba(16, 185, 129, 0.15)', 'rgba(0, 0, 0, 0)']
    )
    const resolveOpacity = useTransform(x, [-120, -60], [1, 0])

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.x < -100 && onResolve && status === 'active') {
        onResolve()
      }
    }

    const canSwipe = isMobile && status === 'active' && onResolve

    const cardContent = (
      <div
        className={`p-3 lg:p-3 border-2 rounded-lg cursor-pointer transition-all min-h-[72px] ${
          isSelected
            ? 'bg-emerald-500/10 border-emerald-500/50'
            : isArchived
            ? 'bg-background/30 border-border/20 opacity-60 hover:opacity-80'
            : isResolved
            ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
            : isHighPriority
            ? 'bg-orange-500/5 border-orange-500/40 hover:bg-orange-500/10 animate-pulse-border'
            : 'bg-background/50 border-border/40 hover:bg-accent/10'
        }`}
        style={isHighPriority && !isSelected ? {
          animation: 'pulse-border 2s ease-in-out infinite',
          boxShadow: '0 0 0 0 rgba(249, 115, 22, 0.4)'
        } : undefined}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`font-medium text-sm truncate ${isArchived ? 'text-platinum/50' : 'text-ivory'}`}>
              {conversation.visitor_name || conversation.visitor_id.slice(0, 20)}
            </span>
            {leadScore > 0 && !isArchived && <LeadScoreFlames score={leadScore} />}
          </div>

          {isResolved ? (
            <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded flex-shrink-0">
              ✓ Resolved
            </span>
          ) : isArchived ? (
            <span className="text-xs px-2 py-0.5 bg-platinum/10 text-platinum/40 rounded flex-shrink-0">
              📦 Archived
            </span>
          ) : hasPendingEscalation ? (
            <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded animate-pulse flex-shrink-0">
              ✉️ Pending Email
            </span>
          ) : conversation.ai_handled ? (
            <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded flex-shrink-0">
              🤖 AI
            </span>
          ) : isEscalated ? (
            <span className="text-xs px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded animate-pulse flex-shrink-0">
              👋 Escalated
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded flex-shrink-0">
              ✓ Human
            </span>
          )}
        </div>

        {isEscalated && status === 'active' && (
          <div className="text-xs text-orange-400 mb-2 truncate">
            ⚠️ {conversation.escalation_reason}
          </div>
        )}

        {hasPendingEscalation && status === 'active' && (
          <div className="text-xs text-yellow-400 mb-2 truncate">
            ⏳ {((conversation.metadata as Record<string, Record<string, unknown>>)?.pending_escalation as Record<string, string>)?.reason}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Clock className={`w-3 h-3 ${isArchived ? 'text-platinum/30' : 'text-platinum/40'}`} />
          <span className={`text-xs ${isArchived ? 'text-platinum/40' : 'text-platinum/60'}`}>
            {new Date(conversation.last_message_at).toLocaleString()}
          </span>
        </div>

        {conversation.ai_handled && status === 'active' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTakeOver()
            }}
            className="mt-2 text-xs text-champagne hover:underline"
          >
            Take over this chat
          </button>
        )}
      </div>
    )

    if (canSwipe) {
      return (
        <div ref={ref} className="relative overflow-hidden rounded-lg">
          <motion.div
            className="absolute inset-0 flex items-center justify-end pr-4 rounded-lg"
            style={{ background }}
          >
            <motion.div
              className="flex items-center gap-2 text-emerald-400"
              style={{ opacity: resolveOpacity }}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">Resolve</span>
            </motion.div>
          </motion.div>

          <motion.div
            drag="x"
            dragConstraints={{ left: -150, right: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            onClick={onClick}
            style={{ x }}
            whileTap={{ cursor: 'grabbing' }}
          >
            {cardContent}
          </motion.div>
        </div>
      )
    }

    return (
      <div ref={ref} onClick={onClick}>
        {cardContent}
      </div>
    )
  }
)

ConversationItem.displayName = 'ConversationItem'

export function MessageBubble({ message }: { message: { id: string; sender_type: string; sender_name: string; message_text: string; image_url: string | null; ai_generated: boolean; ai_confidence: number | null; created_at: string } }) {
  const isVisitor = message.sender_type === 'visitor'
  const isSystem = message.sender_type === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-platinum/5 border border-platinum/10 rounded-lg px-3 py-2 text-xs text-platinum/60 max-w-[80%] text-center">
          {message.message_text}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isVisitor ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] ${
        isVisitor
          ? 'bg-champagne/10 border-champagne/30'
          : 'bg-emerald-500/10 border-emerald-500/30'
      } border rounded-lg px-4 py-2`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-platinum/60">
            {message.sender_name}
          </span>
          {message.ai_generated && (
            <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">
              AI {message.ai_confidence && `(${Math.round(message.ai_confidence * 100)}%)`}
            </span>
          )}
        </div>
        <p className="text-sm text-ivory whitespace-pre-wrap">{message.message_text}</p>
        {message.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={message.image_url} alt="Shared" className="mt-2 rounded max-w-full" />
        )}
        <span className="text-xs text-platinum/40 mt-1 block">
          {new Date(message.created_at).toLocaleTimeString()}
        </span>
      </div>
    </div>
  )
}
