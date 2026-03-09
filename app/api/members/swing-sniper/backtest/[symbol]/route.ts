import { proxyAICoachGet } from '@/app/api/ai-coach-proxy/_shared'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params

  return proxyAICoachGet(
    request,
    `/api/swing-sniper/backtest/${encodeURIComponent(symbol)}`,
    'Unable to reach the Swing Sniper backtest endpoint.',
  )
}
