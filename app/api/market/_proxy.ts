import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

type MarketEndpoint = 'indices' | 'status' | 'movers' | 'splits' | 'analytics' | 'holidays';

const DEFAULT_LOCAL_BACKEND = 'http://localhost:3001';
const DEFAULT_REMOTE_BACKEND = 'https://itm-gd-production.up.railway.app';
const MARKET_PROXY_TIMEOUT_MS = 8_000;

function ensureProtocol(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const isLocal =
    /^localhost(?::\d+)?$/i.test(trimmed)
    || /^127\.0\.0\.1(?::\d+)?$/i.test(trimmed);

  return `${isLocal ? 'http' : 'https'}://${trimmed}`;
}

function resolveBackendBaseUrl(request: Request): string {
  const configuredRaw =
    process.env.AI_COACH_API_URL ||
    process.env.NEXT_PUBLIC_AI_COACH_API_URL ||
    '';

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
  const fallbackDefault = isLocalHost && preferLocalInDev
    ? DEFAULT_LOCAL_BACKEND
    : DEFAULT_REMOTE_BACKEND;
  const configured = ensureProtocol(configuredRaw || fallbackDefault).replace(/\/+$/, '');

  if (isLocalHost && preferLocalInDev && /railway\.app/i.test(configured)) {
    return DEFAULT_LOCAL_BACKEND;
  }

  try {
    const hostname = new URL(configured).hostname.toLowerCase();
    if (!isLocalHost && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return DEFAULT_REMOTE_BACKEND;
    }
  } catch {
    return fallbackDefault;
  }

  return configured;
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
        source: 'fallback',
      };
    case 'movers':
      return { gainers: [], losers: [], source: 'fallback' };
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
        source: 'fallback',
      };
    case 'holidays':
      return [];
    default:
      return { error: 'Market data unavailable' };
  }
}

function createFallbackResponse(
  endpoint: MarketEndpoint,
  reason: string,
  upstreamStatus?: number,
) {
  return NextResponse.json(getMarketFallback(endpoint), {
    status: 200,
    headers: {
      'X-Market-Fallback': reason,
      ...(typeof upstreamStatus === 'number' ? { 'X-Market-Upstream-Status': String(upstreamStatus) } : {}),
      'Retry-After': '30',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MARKET_PROXY_TIMEOUT_MS);
    const response = await fetch(upstream, {
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        const payload = await response.text();
        return new NextResponse(payload, {
          status: response.status,
          headers: {
            'Content-Type': response.headers.get('content-type') || 'application/json',
            'Cache-Control': 'no-store, max-age=0',
          },
        });
      }

      return createFallbackResponse(endpoint, `upstream_${response.status}`, response.status);
    }

    const payload = await response.text();
    return new NextResponse(payload, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return createFallbackResponse(endpoint, 'upstream_timeout');
    }

    return createFallbackResponse(endpoint, 'proxy_error');
  }
}
