'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FeedItemCard } from '@/components/social/feed-item-card'
import type { FeedFilters, FeedResponse, SocialFeedItem } from '@/lib/types/social'
import { Loader2, Inbox } from 'lucide-react'

interface SocialFeedProps {
  filters: FeedFilters
  className?: string
}

export function SocialFeed({ filters, className }: SocialFeedProps) {
  const [items, setItems] = useState<SocialFeedItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const fetchItems = useCallback(
    async (nextCursor?: string | null) => {
      try {
        const isInitial = !nextCursor
        if (isInitial) {
          setLoading(true)
        } else {
          setLoadingMore(true)
        }
        setError(null)

        const params = new URLSearchParams()
        if (filters.type !== 'all') params.set('type', filters.type)
        params.set('sort', filters.sort)
        if (filters.featured_only) params.set('featured_only', 'true')
        params.set('limit', '20')
        if (nextCursor) params.set('cursor', nextCursor)

        const response = await fetch(`/api/social/feed?${params.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to load feed')
        }

        const json = await response.json()
        if (!json?.success) {
          throw new Error(json?.error || 'Failed to load feed')
        }

        const data = json.data as FeedResponse

        if (isInitial) {
          setItems(data.items)
        } else {
          setItems((prev) => [...prev, ...data.items])
        }
        setCursor(data.next_cursor)
        setHasMore(data.has_more)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filters]
  )

  const deleteFeedItem = useCallback(async (itemId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/social/feed/${itemId}`, {
        method: 'DELETE',
      })

      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        return {
          success: false,
          error: json?.error || 'Failed to delete feed item',
        }
      }

      setItems((prev) => prev.filter((item) => item.id !== itemId))
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete feed item',
      }
    }
  }, [])

  // Reset and fetch on filter change
  useEffect(() => {
    setItems([])
    setCursor(null)
    setHasMore(true)
    fetchItems()
  }, [fetchItems])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
          fetchItems(cursor)
        }
      },
      { rootMargin: '200px' }
    )

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current)
    }

    return () => {
      observerRef.current?.disconnect()
    }
  }, [hasMore, loadingMore, loading, cursor, fetchItems])

  // Initial loading state
  if (loading && items.length === 0) {
    return (
      <div
        data-testid="social-feed"
        className={cn('flex items-center justify-center py-20', className)}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm text-white/40">Loading feed...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && items.length === 0) {
    return (
      <div
        data-testid="social-feed"
        className={cn('flex items-center justify-center py-20', className)}
      >
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-red-400">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchItems()}
            className="text-xs"
          >
            Try again
          </Button>
        </div>
      </div>
    )
  }

  // Empty state
  if (!loading && items.length === 0) {
    return (
      <div
        data-testid="social-feed"
        className={cn('flex items-center justify-center py-20', className)}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <Inbox className="h-7 w-7 text-white/30" />
          </div>
          <p className="text-sm font-medium text-white/50">No items yet</p>
          <p className="max-w-xs text-xs text-white/30">
            Be the first to share a trade or achievement with the community.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="social-feed" className={cn('space-y-4', className)}>
      {items.map((item) => (
        <FeedItemCard key={item.id} item={item} onDeleteItem={deleteFeedItem} />
      ))}

      {/* Load More / Sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loadingMore ? (
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchItems(cursor)}
              className="text-xs text-white/40 hover:text-white/70"
            >
              Load more
            </Button>
          )}
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <p className="py-6 text-center text-xs text-white/30">
          You&apos;ve reached the end
        </p>
      )}
    </div>
  )
}
