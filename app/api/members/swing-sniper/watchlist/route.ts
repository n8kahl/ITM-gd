import { proxyAICoachGet, proxyAICoachRequest } from '@/app/api/ai-coach-proxy/_shared'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  return proxyAICoachGet(
    request,
    '/api/swing-sniper/watchlist',
    'Unable to reach the Swing Sniper watchlist endpoint.',
  )
}

export async function POST(request: Request) {
  return proxyAICoachRequest(
    request,
    '/api/swing-sniper/watchlist',
    'Unable to save Swing Sniper watchlist state.',
  )
}
