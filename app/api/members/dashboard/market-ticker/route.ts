import { NextResponse } from 'next/server'

/**
 * GET /api/members/dashboard/market-ticker
 * Returns live market data for SPX/NDX.
 * In production this calls Massive.com REST API.
 * Returns cached/mock data as fallback when API is unavailable.
 */
export async function GET() {
  try {
    // Try fetching from Massive.com API
    const apiKey = process.env.MASSIVE_API_KEY
    if (apiKey) {
      try {
        const [spxRes, ndxRes] = await Promise.all([
          fetch(`https://api.massive.com/v2/aggs/ticker/I:SPX/prev?apiKey=${apiKey}`, {
            next: { revalidate: 15 },
          }),
          fetch(`https://api.massive.com/v2/aggs/ticker/I:NDX/prev?apiKey=${apiKey}`, {
            next: { revalidate: 15 },
          }),
        ])

        if (spxRes.ok && ndxRes.ok) {
          const [spxData, ndxData] = await Promise.all([spxRes.json(), ndxRes.json()])

          const spxResult = spxData.results?.[0]
          const ndxResult = ndxData.results?.[0]

          const quotes = []

          if (spxResult) {
            quotes.push({
              symbol: 'SPX',
              price: spxResult.c,
              change: spxResult.c - spxResult.o,
              changePercent: ((spxResult.c - spxResult.o) / spxResult.o) * 100,
            })
          }

          if (ndxResult) {
            quotes.push({
              symbol: 'NDX',
              price: ndxResult.c,
              change: ndxResult.c - ndxResult.o,
              changePercent: ((ndxResult.c - ndxResult.o) / ndxResult.o) * 100,
            })
          }

          return NextResponse.json({
            success: true,
            data: {
              quotes,
              metrics: {
                vwap: spxResult?.vw || null,
              },
              source: 'massive',
            },
          })
        }
      } catch {
        // Fall through to fallback
      }
    }

    // Fallback: return empty data — never show fake prices
    return NextResponse.json({
      success: true,
      data: {
        quotes: [],
        metrics: {},
        source: 'unavailable',
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to fetch market data' } },
      { status: 500 }
    )
  }
}
