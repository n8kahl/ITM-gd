'use client'

import { useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LikeButtonProps {
  feedItemId: string
  initialLiked: boolean
  initialCount: number
}

export function LikeButton({ feedItemId, initialLiked, initialCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef(false)

  const toggleLike = useCallback(async () => {
    if (pendingRef.current) return

    // Optimistic update
    const newLiked = !liked
    setLiked(newLiked)
    setCount((prev) => (newLiked ? prev + 1 : Math.max(0, prev - 1)))

    // Debounce the API call
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(async () => {
      pendingRef.current = true
      try {
        const response = await fetch(`/api/social/feed/${feedItemId}/like`, {
          method: newLiked ? 'POST' : 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) {
          // Revert on error
          setLiked(!newLiked)
          setCount((prev) => (newLiked ? Math.max(0, prev - 1) : prev + 1))
        }
      } catch {
        // Revert on network error
        setLiked(!newLiked)
        setCount((prev) => (newLiked ? Math.max(0, prev - 1) : prev + 1))
      } finally {
        pendingRef.current = false
      }
    }, 300)
  }, [liked, feedItemId])

  return (
    <Button
      variant="ghost"
      size="sm"
      data-testid="like-button"
      data-liked={liked}
      onClick={toggleLike}
      className={cn(
        'group gap-1.5 px-2 text-xs transition-colors',
        liked
          ? 'text-red-400 hover:text-red-300'
          : 'text-white/40 hover:text-white/70'
      )}
    >
      <Heart
        className={cn(
          'h-4 w-4 transition-all',
          liked && 'fill-red-400 text-red-400',
          !liked && 'group-hover:scale-110'
        )}
      />
      <span data-testid="like-count" className="font-mono tabular-nums">
        {count}
      </span>
    </Button>
  )
}
