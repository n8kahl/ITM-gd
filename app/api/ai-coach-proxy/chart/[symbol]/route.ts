import { proxyAICoachGet } from '@/app/api/ai-coach-proxy/_shared'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: Request,
  ctx: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await ctx.params
  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
  }

  const search = new URL(request.url).search
  return proxyAICoachGet(
    request,
    `/api/chart/${encodeURIComponent(symbol)}${search}`,
    'Failed to fetch chart data.',
  )
}
