import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

type MarketEndpoint = 'indices' | 'status' | 'movers' | 'splits' | 'analytics' | 'holidays';
function resolveBackendBaseUrl(request: Request): string {
  const configured =
    process.env.AI_COACH_API_URL ||
    process.env.NEXT_PUBLIC_AI_COACH_API_URL ||
    'http://localhost:3001';

  const host = (() => {
    try {
      return new URL(request.url).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';

  // Local host should default to local backend even if production URL is present in env.
  const preferLocalInDev = process.env.NEXT_PUBLIC_FORCE_REMOTE_AI_COACH !== 'true';
  if (
    isLocalHost &&
    preferLocalInDev &&
    /railway\.app/i.test(configured)
  ) {
    return 'http://localhost:3001';
  }

  return configured.replace(/\/+$/, '');
}

function getMarketFallback(endpoint: MarketEndpoint) {
  const timestamp = new Date().toISOString();

  switch (endpoint) {
    case 'indices':
      return { quotes: [], metrics: { vwap: null }, source: 'fallback' };
    case 'status':
      return {
        status: 'closed',
        session: 'none',
        message: 'Market data temporarily unavailable',
        nextOpen: 'Check data provider status',
      };
    case 'movers':
      return { gainers: [], losers: [] };
    case 'splits':
      return [];
    case 'analytics':
      return {
        timestamp,
        status: { isOpen: false, session: 'none', message: 'Market analytics temporarily unavailable' },
        indices: [],
        regime: {
          label: 'Neutral',
          description: 'Live analytics unavailable; using safe neutral fallback.',
          signals: ['Data provider unavailable'],
        },
        breadth: { advancers: 0, decliners: 0, ratio: 0, label: 'Unavailable' },
      };
    case 'holidays':
      return [];
    default:
      return { error: 'Market data unavailable' };
  }
}

export async function proxyMarketGet(request: Request, endpoint: MarketEndpoint) {
  try {
    const url = new URL(request.url);
    const backendBase = resolveBackendBaseUrl(request).replace(/\/+$/, '');
    const upstream = `${backendBase}/api/market/${endpoint}${url.search}`;

    let authHeader: string | undefined;
    const incomingAuth = request.headers.get('authorization') || request.headers.get('Authorization');
    if (incomingAuth && /^bearer\s+/i.test(incomingAuth)) {
      authHeader = incomingAuth;
    }

    try {
      if (!authHeader) {
        const supabase = await createServerSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          authHeader = `Bearer ${session.access_token}`;
        }
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

    if (!response.ok) {
      return NextResponse.json(getMarketFallback(endpoint), {
        status: 200,
        headers: {
          'X-Market-Fallback': `upstream_${response.status}`,
        },
      });
    }

    const payload = await response.text();
    return new NextResponse(payload, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json(getMarketFallback(endpoint), {
      status: 200,
      headers: {
        'X-Market-Fallback': 'proxy_error',
      },
    });
  }
}
