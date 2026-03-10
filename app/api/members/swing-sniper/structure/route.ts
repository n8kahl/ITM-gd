import { proxyAICoachRequest } from '@/app/api/ai-coach-proxy/_shared'
import { authorizeSwingSniperMemberRequest } from '@/app/api/members/swing-sniper/_access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const denied = await authorizeSwingSniperMemberRequest()
  if (denied) return denied

  return proxyAICoachRequest(
    request,
    '/api/swing-sniper/structure/recommend',
    'Unable to refresh structure recommendations right now.',
  )
}
