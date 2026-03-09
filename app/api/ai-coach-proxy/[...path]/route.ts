import { proxyAICoachRequest } from '@/app/api/ai-coach-proxy/_shared'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { path?: string[] }
type RouteContext = { params: Promise<Params> }

async function handle(request: Request, ctx: RouteContext) {
  const { path } = await ctx.params
  if (!Array.isArray(path) || path.length === 0) {
    return NextResponse.json({ error: 'Missing proxy path' }, { status: 400 })
  }

  return proxyAICoachRequest(request, path, 'AI Coach request failed.')
}

export async function GET(request: Request, ctx: RouteContext) {
  return handle(request, ctx)
}

export async function POST(request: Request, ctx: RouteContext) {
  return handle(request, ctx)
}

export async function PUT(request: Request, ctx: RouteContext) {
  return handle(request, ctx)
}

export async function PATCH(request: Request, ctx: RouteContext) {
  return handle(request, ctx)
}

export async function DELETE(request: Request, ctx: RouteContext) {
  return handle(request, ctx)
}

export async function OPTIONS(request: Request, ctx: RouteContext) {
  return handle(request, ctx)
}
