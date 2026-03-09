import { proxyAICoachRequest } from '@/app/api/ai-coach-proxy/_shared'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  return proxyAICoachRequest(
    request,
    '/api/swing-sniper/structure/recommend',
    'Unable to build Swing Sniper structure recommendations.',
  )
}
