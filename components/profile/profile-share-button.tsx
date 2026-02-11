'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Share2, Check } from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface ProfileShareButtonProps {
  userId: string
  className?: string
}

// ============================================
// COMPONENT
// ============================================

export function ProfileShareButton({
  userId,
  className,
}: ProfileShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const profileUrl = `${window.location.origin}/profile/${userId}`

    try {
      await navigator.clipboard.writeText(profileUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = profileUrl
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      className={cn('gap-2 text-xs', className)}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400">Link Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="w-3.5 h-3.5" />
          Share Profile
        </>
      )}
    </Button>
  )
}
