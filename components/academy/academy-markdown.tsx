/**
 * File: components/academy/academy-markdown.tsx
 * Purpose: Consistent, premium Markdown rendering for TITM Academy content.
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'

const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false })
const remarkGfm = import('remark-gfm').then((module) => module.default)

type MarkdownVariant = 'lesson' | 'chunk'

const PROSE_BASE =
  'prose prose-invert prose-emerald max-w-none ' +
  'prose-headings:font-semibold prose-headings:text-white ' +
  'prose-p:text-white/70 prose-p:leading-relaxed ' +
  'prose-strong:text-white ' +
  'prose-a:text-emerald-300 prose-a:no-underline hover:prose-a:underline ' +
  'prose-code:text-emerald-200 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.85em] ' +
  'prose-pre:bg-[#0E0E10] prose-pre:border prose-pre:border-white/10 ' +
  'prose-blockquote:border-emerald-500/50 prose-blockquote:text-white/60 ' +
  'prose-li:text-white/70 ' +
  'prose-th:text-white/80 prose-td:text-white/65 ' +
  'prose-hr:border-white/10 ' +
  'prose-img:rounded-xl prose-img:border prose-img:border-white/10 prose-img:bg-black/20'

const PROSE_VARIANTS: Record<MarkdownVariant, string> = {
  lesson:
    PROSE_BASE +
    ' prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3 ' +
    ' prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2',
  chunk:
    PROSE_BASE +
    ' text-sm ' +
    ' prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 ' +
    ' prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-1.5',
}

interface AcademyMarkdownProps {
  children: string
  variant?: MarkdownVariant
  className?: string
}

export function AcademyMarkdown({ children, variant = 'lesson', className }: AcademyMarkdownProps) {
  const [remarkPlugins, setRemarkPlugins] = useState<any[]>([])

  useEffect(() => {
    let mounted = true
    remarkGfm.then((plugin) => {
      if (!mounted) return
      setRemarkPlugins([plugin])
    })
    return () => {
      mounted = false
    }
  }, [])

  const components = useMemo(() => {
    return {
      a: (props: any) => {
        const href = typeof props.href === 'string' ? props.href : ''
        const isExternal = /^https?:\/\//i.test(href)
        return (
          <a
            {...props}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
          />
        )
      },
      img: (props: any) => {
        return (
          <img
            {...props}
            loading="lazy"
            decoding="async"
            className={cn('my-4', props.className)}
          />
        )
      },
      table: (props: any) => {
        return (
          <div className="my-5 overflow-x-auto rounded-xl border border-white/10 bg-black/20">
            <table {...props} className={cn('w-full border-collapse', props.className)} />
          </div>
        )
      },
      th: (props: any) => (
        <th
          {...props}
          className={cn(
            'bg-white/[0.03] px-3 py-2 text-left text-xs font-semibold text-white/80',
            props.className
          )}
        />
      ),
      td: (props: any) => (
        <td
          {...props}
          className={cn('px-3 py-2 text-xs text-white/65 align-top', props.className)}
        />
      ),
      code: (props: any) => {
        const inline = Boolean(props.inline)
        if (inline) return <code {...props} />
        return (
          <code
            {...props}
            className={cn('text-sm text-emerald-200', props.className)}
          />
        )
      },
    }
  }, [])

  return (
    <article className={cn(PROSE_VARIANTS[variant], className)}>
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {children}
      </ReactMarkdown>
    </article>
  )
}

