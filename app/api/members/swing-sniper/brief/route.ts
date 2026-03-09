import { proxyAICoachGet } from '@/app/api/ai-coach-proxy/_shared'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  return proxyAICoachGet(
    request,
    '/api/swing-sniper/brief',
    'Unable to reach the Swing Sniper brief endpoint.',
  )
}
