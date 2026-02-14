import { describe, expect, it } from 'vitest'
import {
  formatHoldDuration,
  formatPnl,
  formatPnlPercentage,
  generateTradeCardImage,
  type JournalTradeCardMetadata,
} from '@/lib/social/trade-card-generator'

const metadata: JournalTradeCardMetadata = {
  symbol: 'TSLA',
  direction: 'LONG',
  contractType: 'Stock',
  pnl: formatPnl(420.55),
  pnlPercentage: formatPnlPercentage(8.4),
  isWinner: true,
  entryPrice: '$201.22',
  exitPrice: '$222.22',
  strategy: 'Breakout Retest',
  aiGrade: 'A',
  memberName: 'Sample Member',
  memberTier: 'executive',
  tradeDate: 'Feb 14, 2026',
  holdDuration: formatHoldDuration(185),
}

describe('trade-card-generator', () => {
  it('renders landscape card', async () => {
    const buffer = await generateTradeCardImage(metadata, 'dark-elite', 'landscape')
    expect(buffer.byteLength).toBeGreaterThan(20_000)
  })

  it('renders square card', async () => {
    const buffer = await generateTradeCardImage(metadata, 'champagne-premium', 'square')
    expect(buffer.byteLength).toBeGreaterThan(20_000)
  })

  it('renders story card', async () => {
    const buffer = await generateTradeCardImage(metadata, 'story', 'story')
    expect(buffer.byteLength).toBeGreaterThan(30_000)
  })
})
