
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function resolveBackendBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_AI_COACH_API_URL || 'http://localhost:3001';
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

/**
 * GET /api/members/dashboard/market-ticker
 * Proxies request to backend /api/market/indices endpoint.
 * This ensures the Next.js app never calls Massive.com directly.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiUrl = resolveBackendBaseUrl();

    // Call backend
    const response = await fetch(`${apiUrl}/api/market/indices`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 15 }, // Cache for 15s
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to fetch market data' } },
      { status: 500 }
    );
  }
}
