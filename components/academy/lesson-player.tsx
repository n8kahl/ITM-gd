'use client'

import { useEffect, useRef, useCallback, useState, useMemo, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { Clock, BookOpen, PlayCircle } from 'lucide-react'
import { LessonChunkRenderer, type LessonChunk } from '@/components/academy/lesson-chunk-renderer'

// Lazy-load react-markdown for code splitting
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false })
const remarkGfm = import('remark-gfm').then((m) => m.default)

interface LessonPlayerProps {
  lessonId: string
  title: string
  content: string
  contentType: 'markdown' | 'video' | 'mixed'
  chunkData?: LessonChunk[] | null
  videoUrl?: string | null
  durationMinutes?: number
  onProgressUpdate?: (scrollPercent: number) => void
  footer?: ReactNode
  className?: string
}

export function LessonPlayer({
  lessonId,
  title,
  content,
  contentType,
  chunkData,
  videoUrl,
  durationMinutes,
  onProgressUpdate,
  footer,
  className,
}: LessonPlayerProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [remarkPlugin, setRemarkPlugin] = useState<any[]>([])
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastProgressRef = useRef(0)
  const [currentChunk, setCurrentChunk] = useState(0)
  const [completedChunks, setCompletedChunks] = useState<number[]>([])

  // Load remark-gfm plugin
  useEffect(() => {
    remarkGfm.then((plugin) => {
      setRemarkPlugin([plugin])
    })
  }, [])

  const hasChunks = Array.isArray(chunkData) && chunkData.length > 0

  // Scroll-based progress tracking
  const handleScroll = useCallback(() => {
    if (!contentRef.current || !onProgressUpdate) return

    const el = contentRef.current
    const scrollHeight = el.scrollHeight - el.clientHeight
    if (scrollHeight <= 0) {
      onProgressUpdate(100)
      return
    }

    const percent = Math.min(100, Math.round((el.scrollTop / scrollHeight) * 100))
    if (percent > lastProgressRef.current) {
      lastProgressRef.current = percent
      onProgressUpdate(percent)
    }
  }, [onProgressUpdate])

  // Auto-save progress periodically
  useEffect(() => {
    progressTimerRef.current = setInterval(() => {
      if (lastProgressRef.current > 0 && onProgressUpdate) {
        onProgressUpdate(lastProgressRef.current)
      }
    }, 30000) // Save every 30 seconds

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
      }
    }
  }, [onProgressUpdate])

  // Extract YouTube video ID
  const youtubeEmbedUrl = useMemo(() => {
    if (!videoUrl) return null
    const match = videoUrl.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/
    )
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`
    }
    return videoUrl
  }, [videoUrl])

  const handleChunkComplete = useCallback((index: number) => {
    setCompletedChunks((previous) =>
      previous.includes(index) ? previous : [...previous, index]
    )
  }, [])

  const handleChunkNavigate = useCallback((direction: 'prev' | 'next') => {
    setCurrentChunk((previous) => {
      const maxIndex = Math.max((chunkData?.length || 1) - 1, 0)
      if (direction === 'prev') {
        return Math.max(0, previous - 1)
      }
      return Math.min(maxIndex, previous + 1)
    })
  }, [chunkData])

  useEffect(() => {
    if (!hasChunks || !onProgressUpdate || !chunkData) return
    const viewed = new Set<number>([...completedChunks, currentChunk]).size
    const percent = Math.min(100, Math.round((viewed / chunkData.length) * 100))
    onProgressUpdate(percent)
  }, [chunkData, completedChunks, currentChunk, hasChunks, onProgressUpdate])

  return (
    <div className={cn('flex flex-col h-full min-h-0', className)}>
      {/* Lesson header */}
      <div className="px-6 py-4 border-b border-white/5 shrink-0">
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {durationMinutes && (
          <div className="flex items-center gap-3 mt-1.5 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {durationMinutes} min
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {contentType === 'video' ? 'Video Lesson' : contentType === 'mixed' ? 'Video + Reading' : 'Reading'}
            </span>
          </div>
        )}
      </div>

      {/* Content area */}
      <div
        ref={contentRef}
        onScroll={!hasChunks ? handleScroll : undefined}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
      >
        <div className={cn('px-6 py-6', hasChunks ? 'max-w-4xl' : 'space-y-6 max-w-3xl')}>
          {hasChunks && chunkData ? (
            <LessonChunkRenderer
              chunks={chunkData}
              currentChunkIndex={currentChunk}
              onChunkComplete={handleChunkComplete}
              onNavigate={handleChunkNavigate}
              lessonId={lessonId}
            />
          ) : (
            <>
              {/* Video embed */}
              {(contentType === 'video' || contentType === 'mixed') && youtubeEmbedUrl && (
                <div className="relative aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/10">
                  <iframe
                    src={youtubeEmbedUrl}
                    title={title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              )}

              {/* Video placeholder when no URL */}
              {(contentType === 'video' || contentType === 'mixed') && !youtubeEmbedUrl && (
                <div className="relative aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                  <div className="text-center">
                    <PlayCircle className="w-12 h-12 text-white/20 mx-auto mb-2" />
                    <p className="text-sm text-white/40">Video coming soon</p>
                  </div>
                </div>
              )}

              {/* Markdown content */}
              {(contentType === 'markdown' || contentType === 'mixed') && content && (
                <article className="prose prose-invert prose-emerald max-w-none prose-headings:font-semibold prose-headings:text-white prose-p:text-white/70 prose-p:leading-relaxed prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-code:text-emerald-300 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-[#141416] prose-pre:border prose-pre:border-white/10 prose-blockquote:border-emerald-500/50 prose-blockquote:text-white/60 prose-li:text-white/70 prose-th:text-white/80 prose-td:text-white/60 prose-hr:border-white/10">
                  <ReactMarkdown remarkPlugins={remarkPlugin}>
                    {content}
                  </ReactMarkdown>
                </article>
              )}

              {footer && (
                <div className="pt-2">
                  {footer}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
