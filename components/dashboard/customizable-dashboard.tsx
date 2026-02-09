'use client'

import { useMemo } from 'react'
import { GripVertical } from 'lucide-react'
import {
  Responsive,
  useContainerWidth,
  type LayoutItem,
  type ResponsiveLayouts,
} from 'react-grid-layout'
import { cn } from '@/lib/utils'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

type DashboardBreakpoint = 'lg' | 'md' | 'sm' | 'xs' | 'xxs'

const GRID_BREAKPOINTS: Record<DashboardBreakpoint, number> = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
}

const GRID_COLS: Record<DashboardBreakpoint, number> = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 1,
}

const BREAKPOINT_ORDER: DashboardBreakpoint[] = ['lg', 'md', 'sm', 'xs', 'xxs']

function toInteger(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  return fallback
}

function sanitizeLayout(layout: LayoutItem, cols: number): LayoutItem {
  const minW = toInteger(layout.minW, 1)
  const minH = toInteger(layout.minH, 4)
  const width = Math.min(cols, Math.max(minW, toInteger(layout.w, Math.min(cols, 4))))
  const height = Math.max(minH, toInteger(layout.h, 8))

  return {
    ...layout,
    x: Math.max(0, toInteger(layout.x, 0)),
    y: Math.max(0, toInteger(layout.y, 0)),
    w: width,
    h: height,
    minW,
    minH,
  }
}

export interface DashboardWidget {
  id: string
  title: string
  description?: string
  content: React.ReactNode
  defaultW?: number
  defaultH?: number
  minW?: number
  minH?: number
}

export type DashboardLayouts = ResponsiveLayouts<DashboardBreakpoint>

interface CustomizableDashboardProps {
  widgets: DashboardWidget[]
  layouts: DashboardLayouts
  editable?: boolean
  className?: string
  onLayoutsChange: (next: DashboardLayouts) => void
}

function normalizeLayouts(layouts: DashboardLayouts, widgets: DashboardWidget[]): DashboardLayouts {
  const next: DashboardLayouts = {}

  for (const breakpoint of BREAKPOINT_ORDER) {
    const cols = GRID_COLS[breakpoint]
    const source = Array.isArray(layouts?.[breakpoint]) ? layouts[breakpoint] : []
    const sourceById = new Map(source.map((item) => [item.i, item]))
    let cursorY = 0

    next[breakpoint] = widgets.map((widget) => {
      const fromSaved = sourceById.get(widget.id)
      if (fromSaved) {
        return sanitizeLayout(
          {
            ...fromSaved,
            i: widget.id,
            minW: widget.minW ?? fromSaved.minW ?? 1,
            minH: widget.minH ?? fromSaved.minH ?? 4,
          },
          cols,
        )
      }

      const fallbackWidth = Math.min(cols, Math.max(widget.minW ?? 1, widget.defaultW ?? (cols >= 6 ? 6 : cols)))
      const fallbackHeight = Math.max(widget.minH ?? 4, widget.defaultH ?? 9)
      const fallback: LayoutItem = {
        i: widget.id,
        x: 0,
        y: cursorY,
        w: fallbackWidth,
        h: fallbackHeight,
        minW: widget.minW ?? 1,
        minH: widget.minH ?? 4,
      }
      cursorY += fallbackHeight
      return fallback
    })
  }

  return next
}

export function CustomizableDashboard({
  widgets,
  layouts,
  editable = false,
  className,
  onLayoutsChange,
}: CustomizableDashboardProps) {
  const { width, mounted, containerRef } = useContainerWidth({
    initialWidth: 1280,
    measureBeforeMount: false,
  })

  const normalizedLayouts = useMemo(
    () => normalizeLayouts(layouts, widgets),
    [layouts, widgets],
  )

  if (widgets.length === 0) {
    return (
      <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
        No widgets selected. Enable at least one widget to build your dashboard.
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn('dashboard-grid-shell', className)}>
      {mounted && (
        <Responsive
          className="layout"
          width={width}
          layouts={normalizedLayouts}
          breakpoints={GRID_BREAKPOINTS}
          cols={GRID_COLS}
          rowHeight={28}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          dragConfig={{
            enabled: editable,
            handle: '.dashboard-widget-drag-handle',
          }}
          resizeConfig={{
            enabled: editable,
            handles: editable ? ['se'] : [],
          }}
          onLayoutChange={(_, allLayouts) => {
            onLayoutsChange(normalizeLayouts(allLayouts as DashboardLayouts, widgets))
          }}
        >
          {widgets.map((widget) => (
            <section
              key={widget.id}
              className={cn(
                'glass-card rounded-xl border border-white/[0.08] bg-black/15 p-4 overflow-hidden',
                editable && 'ring-1 ring-white/[0.06]',
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{widget.title}</p>
                  {widget.description && (
                    <p className="mt-1 text-[11px] text-muted-foreground/90">{widget.description}</p>
                  )}
                </div>
                {editable && (
                  <button
                    type="button"
                    className="dashboard-widget-drag-handle inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.03] p-1 text-muted-foreground hover:text-ivory cursor-move"
                    aria-label={`Drag ${widget.title} widget`}
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="h-[calc(100%-2.75rem)]">{widget.content}</div>
            </section>
          ))}
        </Responsive>
      )}
    </div>
  )
}
