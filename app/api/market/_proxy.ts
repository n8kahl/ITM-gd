import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

function resolveBackendBaseUrl(): string {
  const configured =
    process.env.AI_COACH_API_URL ||
    process.env.NEXT_PUBLIC_AI_COACH_API_URL ||
    'http://localhost:3001';

  // Local dev should default to local backend even if production URL is present in .env.local.
  const preferLocalInDev = process.env.NEXT_PUBLIC_FORCE_REMOTE_AI_COACH !== 'true';
  if (
    process.env.NODE_ENV !== 'production' &&
    preferLocalInDev &&
    /railway\.app/i.test(configured)
  ) {
    return 'http://localhost:3001';
  }

  return configured.replace(/\/+$/, '');
}

export async function proxyMarketGet(request: Request, endpoint: string) {
  try {
    const url = new URL(request.url);
    const backendBase = resolveBackendBaseUrl().replace(/\/+$/, '');
    const upstream = `${backendBase}/api/market/${endpoint}${url.search}`;

    let authHeader: string | undefined;
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        authHeader = `Bearer ${session.access_token}`;
      }
    } catch {
      // Keep proxy public when no session is available.
    }

    const response = await fetch(upstream, {
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const payload = await response.text();
    return new NextResponse(payload, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to proxy market request', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
