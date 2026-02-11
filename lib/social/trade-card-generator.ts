import { Buffer } from 'node:buffer'

export type TradeCardTemplate =
  | 'dark-elite'
  | 'emerald-gradient'
  | 'champagne-premium'
  | 'minimal'
  | 'story'

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

const TEMPLATE_COLORS: Record<TradeCardTemplate, {
  background: string
  border: string
  accent: string
  text: string
  muted: string
}> = {
  'dark-elite': {
    background: '#0A0A0B',
    border: '#1F2937',
    accent: '#10B981',
    text: '#F5F5F0',
    muted: '#94A3B8',
  },
  'emerald-gradient': {
    background: '#052E2B',
    border: '#0F766E',
    accent: '#34D399',
    text: '#ECFDF5',
    muted: '#A7F3D0',
  },
  'champagne-premium': {
    background: '#1A1816',
    border: '#433D2F',
    accent: '#F5EDCC',
    text: '#F5EDCC',
    muted: '#C4B998',
  },
  minimal: {
    background: '#111111',
    border: '#27272A',
    accent: '#FAFAFA',
    text: '#FAFAFA',
    muted: '#A1A1AA',
  },
  story: {
    background: '#0A0A0B',
    border: '#14532D',
    accent: '#10B981',
    text: '#F5F5F0',
    muted: '#94A3B8',
  },
}

const TIER_COLORS: Record<string, string> = {
  core: '#10B981',
  pro: '#3B82F6',
  executive: '#F5EDCC',
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

export function formatPnl(pnl: number): string {
  const absolute = Math.abs(pnl)
  const formatted = absolute.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return `${pnl >= 0 ? '+' : '-'}$${formatted}`
}

export function formatPnlPercentage(value: number | null): string {
  if (value == null) return ''
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatHoldDuration(minutes: number | null): string | null {
  if (minutes == null) return null
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / 1440)}d`
}

function buildTradeCardSvg(
  metadata: JournalTradeCardMetadata,
  template: TradeCardTemplate,
  format: TradeCardFormat,
): string {
  const { width, height } = TRADE_CARD_DIMENSIONS[format]
  const colors = TEMPLATE_COLORS[template]
  const tierColor = TIER_COLORS[metadata.memberTier.toLowerCase()] ?? colors.accent
  const pnlColor = metadata.isWinner ? '#10B981' : '#EF4444'

  const symbolText = escapeXml(truncate(metadata.symbol, 10).toUpperCase())
  const strategyText = metadata.strategy ? escapeXml(truncate(metadata.strategy, 28)) : '—'
  const holdText = metadata.holdDuration ? escapeXml(metadata.holdDuration) : '—'
  const memberNameText = escapeXml(truncate(metadata.memberName, 20))
  const aiGradeText = metadata.aiGrade ? escapeXml(truncate(metadata.aiGrade, 4).toUpperCase()) : ''

  const headerY = 84
  const pnlY = format === 'story' ? 720 : 300
  const footerY = height - 80

  const aiBadge = aiGradeText
    ? `<g>
        <rect x="${width - 170}" y="48" width="120" height="52" rx="12" fill="${colors.background}" stroke="${colors.accent}" stroke-opacity="0.6" />
        <text x="${width - 110}" y="82" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="${colors.accent}" font-weight="700">${aiGradeText}</text>
      </g>`
    : ''

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="topBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${colors.accent}" />
      <stop offset="100%" stop-color="${tierColor}" />
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" fill="${colors.background}" />
  <rect x="0" y="0" width="${width}" height="4" fill="url(#topBar)" />
  <rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="20" fill="none" stroke="${colors.border}" stroke-width="2" />

  <text x="56" y="${headerY}" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="${colors.text}">${symbolText}</text>

  <rect x="330" y="42" width="150" height="56" rx="12" fill="${metadata.direction === 'LONG' ? '#052E2B' : '#3F1111'}" stroke="${metadata.direction === 'LONG' ? '#10B981' : '#EF4444'}" stroke-opacity="0.6" />
  <text x="405" y="80" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="${metadata.direction === 'LONG' ? '#10B981' : '#EF4444'}">${metadata.direction}</text>

  <rect x="500" y="42" width="130" height="56" rx="12" fill="#111827" stroke="#374151" stroke-opacity="0.7" />
  <text x="565" y="80" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="600" fill="${colors.text}">${escapeXml(metadata.contractType.toUpperCase())}</text>

  ${aiBadge}

  <text x="${Math.floor(width / 2)}" y="${pnlY - 24}" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="600" fill="${colors.muted}">${metadata.isWinner ? 'PROFIT' : 'LOSS'}</text>
  <text x="${Math.floor(width / 2)}" y="${pnlY + 54}" text-anchor="middle" font-family="Arial, sans-serif" font-size="90" font-weight="800" fill="${pnlColor}">${escapeXml(metadata.pnl)}</text>
  <text x="${Math.floor(width / 2)}" y="${pnlY + 98}" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="600" fill="${pnlColor}">${escapeXml(metadata.pnlPercentage)}</text>

  <text x="56" y="${footerY - 80}" font-family="Arial, sans-serif" font-size="28" fill="${colors.muted}">Entry: ${escapeXml(metadata.entryPrice)} → Exit: ${escapeXml(metadata.exitPrice)}</text>
  <text x="56" y="${footerY - 42}" font-family="Arial, sans-serif" font-size="28" fill="${colors.muted}">Strategy: ${strategyText}</text>
  <text x="56" y="${footerY - 4}" font-family="Arial, sans-serif" font-size="28" fill="${colors.muted}">Duration: ${holdText} · ${escapeXml(metadata.tradeDate)}</text>

  <text x="${width - 56}" y="${footerY - 42}" text-anchor="end" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="${tierColor}">${memberNameText}</text>
  <text x="${width - 56}" y="${footerY - 8}" text-anchor="end" font-family="Arial, sans-serif" font-size="24" fill="${colors.muted}">${escapeXml(metadata.memberTier.toUpperCase())} MEMBER · ITM</text>
</svg>
`.trim()
}

export async function generateTradeCardImage(
  metadata: JournalTradeCardMetadata,
  template: TradeCardTemplate = 'dark-elite',
  format: TradeCardFormat = 'landscape',
): Promise<Buffer> {
  const { Resvg } = await import('@resvg/resvg-js')

  const svg = buildTradeCardSvg(metadata, template, format)
  const { width } = TRADE_CARD_DIMENSIONS[format]

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
  })

  return Buffer.from(resvg.render().asPng())
}
