'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Award, Share2, Check, Lock } from 'lucide-react'

interface AchievementCardProps {
  id: string
  title: string
  description: string
  icon?: string
  earnedAt?: string | null
  category?: string
  className?: string
}

export function AchievementCard({
  id,
  title,
  description,
  icon,
  earnedAt,
  category,
  className,
}: AchievementCardProps) {
  const [copied, setCopied] = useState(false)
  const isEarned = !!earnedAt

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/achievements/${id}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: `I earned "${title}" on TITM Academy!`,
          url: shareUrl,
        })
      } else {
        await navigator.clipboard.writeText(
          `I just earned the "${title}" achievement on TITM Academy! ${shareUrl}`
        )
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // Share cancelled or failed silently
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'relative rounded-xl p-4',
        'bg-[#0A0A0B]/60 backdrop-blur-xl border',
        isEarned
          ? 'border-emerald-500/30'
          : 'border-white/5 opacity-60',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Badge icon */}
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
            isEarned
              ? 'bg-emerald-500/20'
              : 'bg-white/5'
          )}
        >
          {isEarned ? (
            icon ? (
              <span className="text-lg">{icon}</span>
            ) : (
              <Award className="w-5 h-5 text-emerald-400" />
            )
          ) : (
            <Lock className="w-4 h-4 text-white/30" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className={cn(
            'text-sm font-semibold truncate',
            isEarned ? 'text-white' : 'text-white/50'
          )}>
            {title}
          </h4>
          <p className="text-xs text-white/40 mt-0.5 line-clamp-2">
            {description}
          </p>
          {category && (
            <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">
              {category}
            </span>
          )}
          {earnedAt && (
            <p className="text-[10px] text-white/30 mt-1">
              Earned {new Date(earnedAt).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Share button */}
        {isEarned && (
          <button
            onClick={handleShare}
            className={cn(
              'shrink-0 w-7 h-7 rounded-lg flex items-center justify-center',
              'bg-white/5 hover:bg-white/10 transition-colors',
              'text-white/40 hover:text-white/60'
            )}
            aria-label="Share achievement"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </motion.div>
  )
}
