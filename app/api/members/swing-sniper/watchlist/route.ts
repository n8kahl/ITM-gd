import { proxyAICoachGet, proxyAICoachRequest } from '@/app/api/ai-coach-proxy/_shared'
import { authorizeSwingSniperMemberRequest } from '@/app/api/members/swing-sniper/_access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const denied = await authorizeSwingSniperMemberRequest()
  if (denied) return denied

  return proxyAICoachGet(
    request,
    '/api/swing-sniper/watchlist',
    'Market data is temporarily unavailable.',
  )
}

export async function POST(request: Request) {
  const denied = await authorizeSwingSniperMemberRequest()
  if (denied) return denied

  return proxyAICoachRequest(
    request,
    '/api/swing-sniper/watchlist',
    'Unable to save your watchlist right now.',
  )
}
