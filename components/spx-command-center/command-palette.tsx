'use client'

import { useEffect, useMemo, useState } from 'react'
import { Command } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SPXPaletteCommand {
  id: string
  label: string
  keywords?: string[]
  shortcut?: string
  group?: string
  disabled?: boolean
  run: () => void
}

interface SPXCommandPaletteProps {
  open: boolean
  commands: SPXPaletteCommand[]
  onOpenChange: (next: boolean) => void
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

export function SPXCommandPalette({ open, commands, onOpenChange }: SPXCommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const filteredCommands = useMemo(() => {
    const normalizedQuery = normalize(query)
    if (!normalizedQuery) return commands
    return commands.filter((command) => {
      const searchable = [
        command.label,
        ...(command.keywords || []),
        command.group || '',
      ]
        .join(' ')
        .toLowerCase()
      return searchable.includes(normalizedQuery)
    })
  }, [commands, query])
  const boundedActiveIndex = filteredCommands.length === 0
    ? 0
    : Math.min(activeIndex, filteredCommands.length - 1)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setQuery('')
        setActiveIndex(0)
        onOpenChange(false)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((previous) => {
          if (filteredCommands.length === 0) return 0
          return (previous + 1) % filteredCommands.length
        })
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((previous) => {
          if (filteredCommands.length === 0) return 0
          return (previous - 1 + filteredCommands.length) % filteredCommands.length
        })
        return
      }
      if (event.key === 'Enter') {
        const command = filteredCommands[boundedActiveIndex]
        if (!command || command.disabled) return
        event.preventDefault()
        command.run()
        setQuery('')
        setActiveIndex(0)
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [boundedActiveIndex, filteredCommands, onOpenChange, open])

  if (!open) return null

  const visibleCommands = filteredCommands.slice(0, 10)

  return (
    <div
      className="fixed inset-0 z-[75] flex items-start justify-center bg-black/70 px-4 pt-[12vh]"
      onClick={() => {
        setQuery('')
        setActiveIndex(0)
        onOpenChange(false)
      }}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-white/20 bg-[#090B0F] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 px-3 py-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.03] px-2 py-1.5">
            <Command className="h-4 w-4 text-white/55" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              placeholder="Search commands (stage trade, exit trade, ask coach...)"
              className="w-full bg-transparent text-sm text-ivory placeholder:text-white/45 focus:outline-none"
            />
          </div>
          <p className="mt-1.5 px-0.5 text-[10px] text-white/45">Arrow keys to navigate · Enter to run · Esc to close</p>
        </div>

        <div className="max-h-[420px] overflow-auto p-2">
          {visibleCommands.length === 0 ? (
            <p className="px-2 py-3 text-sm text-white/55">No commands match this query.</p>
          ) : (
            <ul className="space-y-1">
              {(() => {
                let previousGroup: string | null = null
                return visibleCommands.map((command, index) => {
                  const showGroupHeading = Boolean(command.group && command.group !== previousGroup)
                  previousGroup = command.group || previousGroup

                  return (
                    <li key={command.id}>
                      {showGroupHeading && (
                        <p className="px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white/45">
                          {command.group}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (command.disabled) return
                          command.run()
                          setQuery('')
                          setActiveIndex(0)
                          onOpenChange(false)
                        }}
                        disabled={command.disabled}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left',
                          index === boundedActiveIndex
                            ? 'border-emerald-400/35 bg-emerald-500/12'
                            : 'border-white/10 bg-white/[0.02]',
                          command.disabled
                            ? 'cursor-not-allowed opacity-50'
                            : 'hover:border-white/20 hover:bg-white/[0.04]',
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[12px] text-ivory">{command.label}</p>
                          {command.group && (
                            <p className="text-[10px] uppercase tracking-[0.08em] text-white/45">{command.group}</p>
                          )}
                        </div>
                        {command.shortcut && (
                          <span className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-white/65">
                            {command.shortcut}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })
              })()}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
