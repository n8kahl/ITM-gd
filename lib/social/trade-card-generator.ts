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

interface TemplateColors {
  backgroundFrom: string
  backgroundMid: string
  backgroundTo: string
  border: string
  accent: string
  accentBright: string
  text: string
  muted: string
}

const TEMPLATE_COLORS: Record<TradeCardTemplate, TemplateColors> = {
  'dark-elite': {
    backgroundFrom: '#07090D',
    backgroundMid: '#0A1018',
    backgroundTo: '#050507',
    border: '#1F2937',
    accent: '#10B981',
    accentBright: '#34D399',
    text: '#F5F5F0',
    muted: '#94A3B8',
  },
  'emerald-gradient': {
    backgroundFrom: '#042721',
    backgroundMid: '#0D3D36',
    backgroundTo: '#031915',
    border: '#1D7C6B',
    accent: '#34D399',
    accentBright: '#6EE7B7',
    text: '#ECFDF5',
    muted: '#A7F3D0',
  },
  'champagne-premium': {
    backgroundFrom: '#191711',
    backgroundMid: '#252116',
    backgroundTo: '#12110D',
    border: '#574A2C',
    accent: '#F5EDCC',
    accentBright: '#FFF4D1',
    text: '#F5EDCC',
    muted: '#C4B998',
  },
  minimal: {
    backgroundFrom: '#0E0E10',
    backgroundMid: '#121215',
    backgroundTo: '#09090B',
    border: '#27272A',
    accent: '#FAFAFA',
    accentBright: '#FFFFFF',
    text: '#FAFAFA',
    muted: '#A1A1AA',
  },
  story: {
    backgroundFrom: '#05080E',
    backgroundMid: '#08131A',
    backgroundTo: '#050508',
    border: '#14532D',
    accent: '#10B981',
    accentBright: '#34D399',
    text: '#F5F5F0',
    muted: '#94A3B8',
  },
}

const TIER_COLORS: Record<string, string> = {
  core: '#10B981',
  pro: '#F3E5AB',
  executive: '#E8E4D9',
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
  const tierColor = TIER_COLORS[metadata.memberTier.toLowerCase()] ?? colors.accentBright
  const isStory = format === 'story'
  const isSquare = format === 'square'
  const pnlColor = metadata.isWinner ? '#10B981' : '#EF4444'
  const directionColor = metadata.direction === 'LONG' ? '#10B981' : '#EF4444'
  const directionBg = metadata.direction === 'LONG' ? '#052E2B' : '#3A1114'

  const symbolText = escapeXml(truncate(metadata.symbol, 12).toUpperCase())
  const strategyText = metadata.strategy ? escapeXml(truncate(metadata.strategy, 36)) : '—'
  const holdText = metadata.holdDuration ? escapeXml(metadata.holdDuration) : '—'
  const memberNameText = escapeXml(truncate(metadata.memberName, 24))
  const aiGradeText = metadata.aiGrade ? escapeXml(truncate(metadata.aiGrade, 4).toUpperCase()) : ''
  const pnlPercentText = metadata.pnlPercentage ? escapeXml(metadata.pnlPercentage) : '—'
  const basePadding = isStory ? 62 : isSquare ? 52 : 56
  const contentTop = isStory ? 66 : 58
  const cardRadius = isStory ? 36 : 28
  const innerX = basePadding
  const innerY = contentTop
  const innerWidth = width - (basePadding * 2)
  const innerHeight = height - contentTop - basePadding

  const symbolFontSize = isStory ? 100 : isSquare ? 86 : 80
  const pnlFontSize = isStory ? 146 : isSquare ? 118 : 108
  const pnlPctFontSize = isStory ? 54 : isSquare ? 44 : 40
  const metaFontSize = isStory ? 30 : isSquare ? 22 : 24
  const detailFontSize = isStory ? 34 : isSquare ? 24 : 28
  const titleY = innerY + (isStory ? 92 : 72)
  const badgeY = innerY + (isStory ? 16 : 14)
  const pnlLabelY = isStory ? height * 0.43 : isSquare ? height * 0.43 : height * 0.44
  const pnlValueY = pnlLabelY + (isStory ? 120 : isSquare ? 104 : 96)
  const pnlPctY = pnlValueY + (isStory ? 66 : isSquare ? 56 : 50)
  const footerStartY = isStory ? height - 260 : isSquare ? height - 184 : height - 168
  const verifyY = isStory ? height - 84 : isSquare ? height - 62 : height - 52
  const tierBadgeWidth = isStory ? 260 : isSquare ? 234 : 220
  const tierBadgeHeight = isStory ? 56 : 50
  const directionBadgeWidth = isStory ? 200 : isSquare ? 170 : 164
  const directionBadgeHeight = isStory ? 64 : isSquare ? 54 : 52
  const contractBadgeWidth = isStory ? 180 : isSquare ? 152 : 146
  const contractBadgeHeight = isStory ? 64 : isSquare ? 54 : 52
  const topLineHeight = isStory ? 6 : 4
  const watermarkFontSize = isStory ? 320 : isSquare ? 260 : 300
  const watermarkX = isStory ? width / 2 : width - (isSquare ? 210 : 160)
  const watermarkY = isStory ? height * 0.52 : height * 0.56
  const cornerSize = isStory ? 58 : 44

  const tierLabel = escapeXml(metadata.memberTier.toUpperCase())
  const contractLabel = escapeXml(metadata.contractType.toUpperCase())
  const dateText = escapeXml(metadata.tradeDate)
  const entryText = escapeXml(metadata.entryPrice)
  const exitText = escapeXml(metadata.exitPrice)
  const verifyUrl = 'tradeitm.com/social'
  const headerTag = 'VERIFIED TRADE CARD'
  const cardTitle = metadata.isWinner ? 'REALIZED PROFIT' : 'REALIZED LOSS'
  const centerX = Math.floor(width / 2)

  const titleTextSize = isStory ? 20 : 18
  const directionTextSize = isStory ? 34 : isSquare ? 30 : 28
  const contractTextSize = isStory ? 30 : isSquare ? 26 : 24
  const tierTextSize = isStory ? 22 : isSquare ? 20 : 18
  const verifyLabelSize = isStory ? 14 : 12
  const verifyUrlSize = isStory ? 18 : 16

  const aiBadge = aiGradeText
    ? `<g>
        <rect x="${innerX + innerWidth - (isStory ? 170 : 148)}" y="${badgeY + tierBadgeHeight + 12}" width="${isStory ? 170 : 148}" height="${isStory ? 62 : 56}" rx="14" fill="rgba(0,0,0,0.45)" stroke="${colors.accent}" stroke-opacity="0.6"/>
        <text x="${innerX + innerWidth - (isStory ? 85 : 74)}" y="${badgeY + tierBadgeHeight + (isStory ? 52 : 48)}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${isStory ? 30 : 28}" fill="${colors.accentBright}" font-weight="700">${aiGradeText}</text>
      </g>`
    : ''

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colors.backgroundFrom}" />
      <stop offset="52%" stop-color="${colors.backgroundMid}" />
      <stop offset="100%" stop-color="${colors.backgroundTo}" />
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="44%" r="66%">
      <stop offset="0%" stop-color="${colors.accent}" stop-opacity="${template === 'minimal' ? '0.10' : '0.22'}" />
      <stop offset="100%" stop-color="${colors.accent}" stop-opacity="0" />
    </radialGradient>
    <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.035)" stroke-width="1" />
    </pattern>
    <linearGradient id="topBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${colors.accent}" />
      <stop offset="100%" stop-color="${tierColor}" />
    </linearGradient>
    <linearGradient id="pnlGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${pnlColor}" stop-opacity="0.16" />
      <stop offset="100%" stop-color="${pnlColor}" stop-opacity="0.02" />
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bgGradient)" />
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#glow)" />
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#gridPattern)" />
  <text x="${watermarkX}" y="${watermarkY}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${watermarkFontSize}" font-weight="800" fill="rgba(255,255,255,0.045)">${template === 'minimal' ? 'TRADE' : 'TITM'}</text>

  <rect x="0" y="0" width="${width}" height="${topLineHeight}" fill="url(#topBar)" />
  <rect x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}" rx="${cardRadius}" fill="none" stroke="${colors.border}" stroke-width="2" />
  <rect x="${centerX - (isStory ? 330 : isSquare ? 280 : 320)}" y="${pnlLabelY - (isStory ? 58 : 54)}" width="${isStory ? 660 : isSquare ? 560 : 640}" height="${isStory ? 224 : isSquare ? 198 : 186}" rx="${isStory ? 28 : 24}" fill="url(#pnlGlow)" />

  <path d="M ${width - cornerSize - 16} 16 L ${width - 16} 16 L ${width - 16} ${16 + cornerSize}" stroke="${colors.accent}" stroke-width="1.2" fill="none" opacity="0.42" />
  <path d="M 16 ${height - cornerSize - 16} L 16 ${height - 16} L ${16 + cornerSize} ${height - 16}" stroke="${colors.accent}" stroke-width="1.2" fill="none" opacity="0.42" />

  <text x="${innerX + 8}" y="${badgeY + 18}" font-family="Inter, Arial, sans-serif" font-size="${titleTextSize}" letter-spacing="2" font-weight="600" fill="${colors.muted}" opacity="0.85">${headerTag}</text>
  <text x="${innerX + 8}" y="${titleY}" font-family="Inter, Arial, sans-serif" font-size="${symbolFontSize}" font-weight="800" fill="${colors.text}" letter-spacing="1">${symbolText}</text>

  <rect x="${innerX + (isStory ? 8 : 14)}" y="${badgeY + (isStory ? 114 : 92)}" width="${directionBadgeWidth}" height="${directionBadgeHeight}" rx="12" fill="${directionBg}" stroke="${directionColor}" stroke-opacity="0.7" />
  <text x="${innerX + (isStory ? 8 : 14) + (directionBadgeWidth / 2)}" y="${badgeY + (isStory ? 158 : 130)}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${directionTextSize}" font-weight="700" fill="${directionColor}" letter-spacing="2">${metadata.direction}</text>

  <rect x="${innerX + (isStory ? 224 : 196)}" y="${badgeY + (isStory ? 114 : 92)}" width="${contractBadgeWidth}" height="${contractBadgeHeight}" rx="12" fill="rgba(17,24,39,0.58)" stroke="rgba(148,163,184,0.45)" />
  <text x="${innerX + (isStory ? 224 : 196) + (contractBadgeWidth / 2)}" y="${badgeY + (isStory ? 158 : 130)}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${contractTextSize}" font-weight="600" fill="${colors.text}" letter-spacing="1">${contractLabel}</text>

  <rect x="${innerX + innerWidth - tierBadgeWidth}" y="${badgeY}" width="${tierBadgeWidth}" height="${tierBadgeHeight}" rx="999" fill="rgba(255,255,255,0.045)" stroke="${tierColor}" stroke-opacity="0.55" />
  <text x="${innerX + innerWidth - (tierBadgeWidth / 2)}" y="${badgeY + (isStory ? 37 : 34)}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${tierTextSize}" font-weight="600" fill="${tierColor}" letter-spacing="2">${tierLabel} TIER</text>

  ${aiBadge}

  <text x="${centerX}" y="${pnlLabelY}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${metaFontSize}" font-weight="600" fill="${colors.muted}" letter-spacing="2">${cardTitle}</text>
  <text x="${centerX}" y="${pnlValueY}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${pnlFontSize}" font-weight="800" fill="${pnlColor}">${escapeXml(metadata.pnl)}</text>
  <text x="${centerX}" y="${pnlPctY}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${pnlPctFontSize}" font-weight="700" fill="${pnlColor}" letter-spacing="1">${pnlPercentText}</text>

  <text x="${innerX + 10}" y="${footerStartY}" font-family="Inter, Arial, sans-serif" font-size="${detailFontSize}" fill="${colors.muted}" opacity="0.95">Entry: ${entryText}   Exit: ${exitText}</text>
  <text x="${innerX + 10}" y="${footerStartY + (isStory ? 54 : 44)}" font-family="Inter, Arial, sans-serif" font-size="${detailFontSize}" fill="${colors.muted}" opacity="0.95">Strategy: ${strategyText}</text>
  <text x="${innerX + 10}" y="${footerStartY + (isStory ? 108 : 88)}" font-family="Inter, Arial, sans-serif" font-size="${detailFontSize}" fill="${colors.muted}" opacity="0.95">Duration: ${holdText}   Date: ${dateText}</text>

  <text x="${innerX + innerWidth}" y="${footerStartY + (isStory ? 54 : 44)}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="${isStory ? 40 : isSquare ? 30 : 32}" font-weight="700" fill="${tierColor}">${memberNameText}</text>
  <text x="${innerX + innerWidth}" y="${verifyY - (isStory ? 26 : 20)}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="${verifyLabelSize}" fill="${colors.muted}" opacity="0.75" letter-spacing="2">SHARED VIA TITM</text>
  <text x="${innerX + innerWidth}" y="${verifyY}" text-anchor="end" font-family="Courier New, monospace" font-size="${verifyUrlSize}" fill="${colors.accentBright}" opacity="0.82">${verifyUrl}</text>

  <rect x="0" y="${height - 2}" width="${width}" height="2" fill="url(#topBar)" opacity="0.5" />
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
