import { proxyAICoachGet } from '@/app/api/ai-coach-proxy/_shared'
import { authorizeSwingSniperMemberRequest } from '@/app/api/members/swing-sniper/_access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const denied = await authorizeSwingSniperMemberRequest()
  if (denied) return denied

  const { symbol } = await params

  return proxyAICoachGet(
    request,
    `/api/swing-sniper/backtest/${encodeURIComponent(symbol)}`,
    'Market data is temporarily unavailable.',
  )
}
