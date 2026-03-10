import { proxyAICoachGet, proxyAICoachRequest } from '@/app/api/ai-coach-proxy/_shared'
import { authorizeMoneyMakerMemberRequest } from '@/app/api/members/money-maker/_access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const denied = await authorizeMoneyMakerMemberRequest()
  if (denied) return denied

  return proxyAICoachGet(
    request,
    '/api/money-maker/watchlist',
    'Market data is temporarily unavailable.',
  )
}

export async function POST(request: Request) {
  const denied = await authorizeMoneyMakerMemberRequest()
  if (denied) return denied

  return proxyAICoachRequest(
    request,
    '/api/money-maker/watchlist',
    'Unable to save your watchlist right now.',
  )
}
