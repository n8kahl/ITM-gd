/**
 * Social Trade Card Generator
 *
 * Adapts the existing academy trade card pipeline for journal trade sharing.
 * Uses Satori (JSX to SVG) + Resvg (SVG to PNG) to generate shareable trade cards.
 */

export type TradeCardTemplate = 'dark-elite' | 'emerald-gradient' | 'champagne-premium' | 'minimal' | 'story'
export type TradeCardFormat = 'landscape' | 'story' | 'square'

export interface JournalTradeCardMetadata {
  symbol: string
  direction: 'LONG' | 'SHORT'
  contractType: 'Stock' | 'Call' | 'Put'
  pnl: string
  pnlPercentage: string
  isWinner: boolean
  entryPrice: string
  exitPrice: string
  strategy: string | null
  aiGrade: string | null
  memberName: string
  memberTier: string
  tradeDate: string
  holdDuration: string | null
}

export const TRADE_CARD_DIMENSIONS: Record<TradeCardFormat, { width: number; height: number }> = {
  landscape: { width: 1200, height: 630 },
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
}

const TEMPLATE_COLORS: Record<TradeCardTemplate, { bg: string; accent: string; text: string; border: string }> = {
  'dark-elite': {
    bg: '#0A0A0B',
    accent: '#10B981',
    text: '#F5F5F0',
    border: '#1a1a1b',
  },
  'emerald-gradient': {
    bg: '#064E3B',
    accent: '#34D399',
    text: '#FFFFFF',
    border: '#10B981',
  },
  'champagne-premium': {
    bg: '#1a1816',
    accent: '#F5EDCC',
    text: '#F5EDCC',
    border: '#F5EDCC33',
  },
  'minimal': {
    bg: '#111111',
    accent: '#FFFFFF',
    text: '#FFFFFF',
    border: '#333333',
  },
  'story': {
    bg: '#0A0A0B',
    accent: '#10B981',
    text: '#F5F5F0',
    border: '#10B981',
  },
}

const TIER_COLORS: Record<string, string> = {
  core: '#10B981',
  pro: '#3B82F6',
  executive: '#F5EDCC',
}

export function formatPnl(pnl: number): string {
  const abs = Math.abs(pnl)
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${pnl >= 0 ? '+' : '-'}$${formatted}`
}

export function formatPnlPercentage(pct: number | null): string {
  if (pct === null) return ''
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

export function formatHoldDuration(minutes: number | null): string | null {
  if (minutes === null) return null
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / 1440)}d`
}

/**
 * Generate Satori-compatible JSX structure for a journal trade card.
 * This returns the React element tree that Satori converts to SVG.
 */
export function buildTradeCardJsx(
  metadata: JournalTradeCardMetadata,
  template: TradeCardTemplate,
  format: TradeCardFormat,
): React.ReactElement {
  const colors = TEMPLATE_COLORS[template]
  const dims = TRADE_CARD_DIMENSIONS[format]
  const tierColor = TIER_COLORS[metadata.memberTier.toLowerCase()] || colors.accent
  const isWin = metadata.isWinner
  const pnlColor = isWin ? '#10B981' : '#EF4444'

  // Satori requires explicit style objects (no Tailwind)
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    width: dims.width,
    height: dims.height,
    backgroundColor: colors.bg,
    border: `2px solid ${colors.border}`,
    padding: format === 'story' ? 60 : 40,
    fontFamily: 'Inter, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: format === 'story' ? 40 : 24,
  }

  const symbolStyle: React.CSSProperties = {
    fontSize: format === 'story' ? 48 : 36,
    fontWeight: 700,
    color: colors.text,
    letterSpacing: '-0.02em',
  }

  const directionBadgeStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: metadata.direction === 'LONG' ? '#10B981' : '#EF4444',
    backgroundColor: metadata.direction === 'LONG' ? '#10B98120' : '#EF444420',
    border: `1px solid ${metadata.direction === 'LONG' ? '#10B98140' : '#EF444440'}`,
  }

  const pnlStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  }

  const pnlValueStyle: React.CSSProperties = {
    fontSize: format === 'story' ? 72 : 56,
    fontWeight: 800,
    color: pnlColor,
    letterSpacing: '-0.03em',
    lineHeight: 1,
  }

  const pnlPctStyle: React.CSSProperties = {
    fontSize: format === 'story' ? 28 : 22,
    fontWeight: 500,
    color: `${pnlColor}CC`,
    marginTop: 8,
  }

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 'auto',
  }

  const detailStyle: React.CSSProperties = {
    fontSize: 13,
    color: `${colors.text}99`,
    lineHeight: 1.6,
  }

  const brandStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: tierColor,
    textAlign: 'right' as const,
  }

  // Build the element tree using createElement (Satori-compatible)
  const React = require('react')

  return React.createElement('div', { style: containerStyle },
    // Gradient overlay
    React.createElement('div', {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: `linear-gradient(to right, ${colors.accent}, ${tierColor})`,
      }
    }),
    // Header
    React.createElement('div', { style: headerStyle },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 16 } },
        React.createElement('span', { style: symbolStyle }, metadata.symbol),
        React.createElement('span', { style: directionBadgeStyle }, metadata.direction),
        metadata.contractType !== 'Stock' && React.createElement('span', {
          style: {
            ...directionBadgeStyle,
            color: `${colors.text}AA`,
            backgroundColor: `${colors.text}10`,
            border: `1px solid ${colors.text}20`,
          }
        }, metadata.contractType),
      ),
      metadata.aiGrade && React.createElement('div', {
        style: {
          fontSize: 20,
          fontWeight: 700,
          color: colors.accent,
          padding: '4px 12px',
          border: `2px solid ${colors.accent}40`,
          borderRadius: 8,
        }
      }, metadata.aiGrade),
    ),
    // P&L Center
    React.createElement('div', { style: pnlStyle },
      React.createElement('div', { style: { fontSize: 14, color: `${colors.text}66`, marginBottom: 8, fontWeight: 500 } }, isWin ? 'PROFIT' : 'LOSS'),
      React.createElement('div', { style: pnlValueStyle }, metadata.pnl),
      metadata.pnlPercentage && React.createElement('div', { style: pnlPctStyle }, metadata.pnlPercentage),
    ),
    // Footer
    React.createElement('div', { style: footerStyle },
      React.createElement('div', { style: detailStyle },
        React.createElement('div', null, `Entry: ${metadata.entryPrice} → Exit: ${metadata.exitPrice}`),
        metadata.strategy && React.createElement('div', null, `Strategy: ${metadata.strategy}`),
        metadata.holdDuration && React.createElement('div', null, `Duration: ${metadata.holdDuration}`),
        React.createElement('div', null, metadata.tradeDate),
      ),
      React.createElement('div', { style: brandStyle },
        React.createElement('div', null, metadata.memberName),
        React.createElement('div', { style: { fontSize: 12, color: `${colors.text}66`, marginTop: 4 } },
          `${metadata.memberTier.toUpperCase()} MEMBER`
        ),
        React.createElement('div', {
          style: { fontSize: 11, color: `${colors.text}44`, marginTop: 8, fontFamily: 'monospace' }
        }, 'ITM Trading'),
      ),
    ),
  )
}

/**
 * Generate a trade card PNG buffer.
 * Requires satori and @resvg/resvg-js to be installed.
 */
export async function generateTradeCardImage(
  metadata: JournalTradeCardMetadata,
  template: TradeCardTemplate = 'dark-elite',
  format: TradeCardFormat = 'landscape',
): Promise<Buffer> {
  const satori = (await import('satori')).default
  const { Resvg } = await import('@resvg/resvg-js')
  const dims = TRADE_CARD_DIMENSIONS[format]

  // Load Inter font
  const fs = await import('fs')
  const path = await import('path')
  let fontData: ArrayBuffer

  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Inter-Regular.ttf')
    fontData = fs.readFileSync(fontPath).buffer as ArrayBuffer
  } catch {
    // Fallback: fetch from Google Fonts
    const fontRes = await fetch('https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2')
    fontData = await fontRes.arrayBuffer()
  }

  const jsx = buildTradeCardJsx(metadata, template, format)

  const svg = await satori(jsx, {
    width: dims.width,
    height: dims.height,
    fonts: [
      {
        name: 'Inter',
        data: fontData,
        weight: 400,
        style: 'normal',
      },
    ],
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: dims.width },
  })

  return Buffer.from(resvg.render().asPng())
}
