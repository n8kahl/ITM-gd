import { proxyAICoachGet } from '@/app/api/ai-coach-proxy/_shared'
import { authorizeMoneyMakerMemberRequest } from '@/app/api/members/money-maker/_access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const denied = await authorizeMoneyMakerMemberRequest()
  if (denied) return denied

  return proxyAICoachGet(
    request,
    '/api/money-maker/plan',
    'Execution plan data is temporarily unavailable.',
  )
}
