'use client'

import { useState } from 'react'
import { Share2, Download, Copy, Check, Twitter } from 'lucide-react'

interface ShareButtonsProps {
  verificationUrl: string
  cardImageUrl: string | null
  achievementTitle: string
}

export function ShareButtons({
  verificationUrl,
  cardImageUrl,
  achievementTitle,
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(verificationUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = verificationUrl
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShareTwitter = () => {
    const text = encodeURIComponent(
      `I just earned "${achievementTitle}" at TITM Academy! Verify my achievement:`
    )
    const url = encodeURIComponent(verificationUrl)
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  const handleDownload = async () => {
    if (!cardImageUrl) return

    try {
      const response = await fetch(cardImageUrl)
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `titm-achievement-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)
    } catch {
      // Fallback: open in new tab
      window.open(cardImageUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full">
      {/* Share on Twitter */}
      <button
        onClick={handleShareTwitter}
        className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg
          bg-[#1DA1F2]/10 border border-[#1DA1F2]/20 text-[#1DA1F2]
          hover:bg-[#1DA1F2]/20 hover:border-[#1DA1F2]/30
          transition-all duration-300 font-medium text-sm flex-1"
      >
        <Twitter className="w-4 h-4" />
        Share on X
      </button>

      {/* Download Card */}
      {cardImageUrl && (
        <button
          onClick={handleDownload}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg
            bg-white/5 border border-white/10 text-[#F5F5F0]
            hover:bg-white/10 hover:border-white/15
            transition-all duration-300 font-medium text-sm flex-1"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
      )}

      {/* Copy Link */}
      <button
        onClick={handleCopyLink}
        className={`flex items-center justify-center gap-2 px-5 py-3 rounded-lg
          border transition-all duration-300 font-medium text-sm flex-1
          ${
            copied
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-white/5 border-white/10 text-[#F5F5F0] hover:bg-white/10 hover:border-white/15'
          }`}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy Link
          </>
        )}
      </button>
    </div>
  )
}

export function ShareIcon() {
  return <Share2 className="w-5 h-5 text-emerald-400" />
}
