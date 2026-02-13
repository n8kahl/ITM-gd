
# Market Data Services (Massive.com Integration)

This document describes the market data services integrated via the Massive.com API.

## Core Services

### 1. Market Status (`backend/src/services/marketHours.ts`, `marketHolidays.ts`)
- **Purpose**: Provides current market status (open/closed/early-close) and upcoming holidays.
- **Key Functions**:
    - `getMarketStatus()`: Returns current status, session type, and next open/close.
    - `getUpcomingHolidays()`: Returns a list of upcoming NYSE/NASDAQ holidays.
- **Endpoints**:
    - `GET /api/market/status`: Current market status.
    - `GET /api/market/holidays`: Upcoming holidays.

### 2. Real-Time Price (`backend/src/services/realTimePrice.ts`)
- **Purpose**: Fetches the most recent trade or quote for a symbol.
- **Key Functions**:
    - `getRealTimePrice(symbol)`: Returns latest price, bid/ask, and spread.
- **Features**:
    - Falls back to `getLastQuote` if `getLastTrade` fails.
    - Caches results for 5 seconds.
    - Used by Options Chain Fetcher for accurate Greek calculations.

### 3. Market Movers (`backend/src/services/marketMovers.ts`)
- **Purpose**: Tracks top gainers and losers for the day.
- **Key Functions**:
    - `getMarketMovers(limit)`: Returns top gainers and losers.
- **Endpoints**:
    - `GET /api/market/movers?limit=10`: JSON object with `{ gainers: [], losers: [] }`.

### 4. Market Indices (`backend/src/services/marketIndices.ts`)
- **Purpose**: Snapshots for SPX and NDX.
- **Endpoints**:
    - `GET /api/market/indices`: Returns SPX and NDX price and change.

### 5. Stock Splits (`backend/src/services/stockSplits.ts`)
- **Purpose**: Upcoming stock split calendar.
- **Endpoints**:
    - `GET /api/market/splits`: Returns upcoming splits within the massive dataset.

## Configuration

- **API Key**: `MASSIVE_API_KEY` in environment variables.
- **Rate Limits**: Configured in `backend/src/config/massive.ts` (10 req/s default).
- **Caching**: Redis is used heavily (TTL varies by service, e.g., 5s for price, 24h for holidays).

## Testing

Run unit tests:
```bash
npm run test:unit backend/src/services/__tests__/
```
