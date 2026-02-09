# TITM AI Coach Backend

Backend server for the TITM AI Coach trading platform, providing real-time market data analysis, key levels calculation, and API endpoints for the frontend application.

## Features

- **Key Levels Calculation**: PDH/PDL/PDC, PMH/PML, Standard Pivots, Camarilla Pivots, Fibonacci Pivots
- **Technical Indicators**: VWAP, ATR(7), ATR(14)
- **Market Data Integration**: Massive.com API for historical and real-time data
- **Redis Caching**: High-performance caching for frequently accessed data
- **Supabase Integration**: PostgreSQL database with Row Level Security
- **JWT Authentication**: Secure API endpoints with Supabase Auth
- **TypeScript**: Type-safe code with full TypeScript support

## Prerequisites

- Node.js 20+ installed
- Redis server (local or remote)
- Supabase project (existing TITM database)
- Massive.com API key (Options + Stocks + Indices Advanced subscription - $597/month)

## Installation

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your credentials:
   ```bash
   # Massive.com API
   MASSIVE_API_KEY=your_massive_api_key

   # Supabase (from existing TITM project)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # Redis
   REDIS_URL=redis://localhost:6379

   # App Config
   NODE_ENV=development
   PORT=3001
   ```

4. **Start Redis** (if running locally):
   ```bash
   redis-server
   ```

5. **Run database migrations**:
   Navigate to the project root and run:
   ```bash
   npx supabase db push
   ```

## Running the Server

### Development Mode (with hot reload):
```bash
npm run dev
```

### Build for Production:
```bash
npm run build
```

### Start Production Server:
```bash
npm start
```

The server will start on `http://localhost:3001`

## Testing

### Run All Tests:
```bash
npm test
```

### Run Tests in Watch Mode:
```bash
npm run test:watch
```

### Test Coverage:
```bash
npm test -- --coverage
```

## API Endpoints

### Health Check
```http
GET /health
```
**Response**:
```json
{
  "status": "ok"
}
```

### Detailed Health Check
```http
GET /health/detailed
```
**Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-02-03T12:00:00Z",
  "services": {
    "database": true,
    "redis": true,
    "massive": true
  }
}
```

### Get Key Levels
```http
GET /api/levels/:symbol?timeframe=intraday
Authorization: Bearer {jwt_token}
```

**Parameters**:
- `symbol` (required): `SPX` or `NDX`
- `timeframe` (optional): `intraday`, `daily`, or `weekly` (default: `intraday`)

**Response**:
```json
{
  "symbol": "SPX",
  "timestamp": "2026-02-03T12:05:30.123Z",
  "currentPrice": 5912.50,
  "levels": {
    "resistance": [
      {
        "type": "PDH",
        "price": 5930.00,
        "distance": 17.50,
        "distancePct": 0.30,
        "distanceATR": 0.4,
        "strength": "strong",
        "description": "Previous Day High",
        "testsToday": 3,
        "lastTest": "2026-02-03T11:52:00Z"
      }
    ],
    "support": [...],
    "pivots": {
      "standard": {
        "pp": 5890.00,
        "r1": 5910.00,
        "r2": 5930.00,
        "r3": 5950.00,
        "s1": 5870.00,
        "s2": 5850.00,
        "s3": 5830.00
      },
      "camarilla": {...},
      "fibonacci": {...}
    },
    "indicators": {
      "vwap": 5900.00,
      "atr14": 47.25,
      "atr7": 52.30
    }
  },
  "marketContext": {
    "marketStatus": "open",
    "sessionType": "regular",
    "timeSinceOpen": "2h 35m"
  },
  "cached": true,
  "cacheExpiresAt": "2026-02-03T12:06:30Z"
}
```

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts         # Supabase connection
│   │   ├── massive.ts          # Massive.com API client
│   │   └── redis.ts            # Redis connection & helpers
│   ├── services/
│   │   └── levels/
│   │       ├── fetcher.ts      # Data fetching from Massive.com
│   │       ├── calculators/
│   │       │   ├── pivots.ts   # Pivot point calculations
│   │       │   ├── premarket.ts # PMH/PML calculations
│   │       │   ├── previousDay.ts # PDH/PDL/PDC calculations
│   │       │   ├── vwap.ts     # VWAP calculations
│   │       │   └── atr.ts      # ATR calculations
│   │       ├── cache.ts        # Redis caching layer
│   │       ├── index.ts        # Main levels service
│   │       └── __tests__/      # Unit tests
│   ├── routes/
│   │   ├── health.ts           # Health check routes
│   │   └── levels.ts           # Levels API routes
│   ├── middleware/
│   │   └── auth.ts             # JWT authentication
│   └── server.ts               # Express app entry point
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## Calculation Formulas

### Standard Pivots
```
Pivot Point (PP) = (High + Low + Close) / 3
R1 = (2 * PP) - Low
R2 = PP + (High - Low)
R3 = High + 2 * (PP - Low)
S1 = (2 * PP) - High
S2 = PP - (High - Low)
S3 = Low - 2 * (High - PP)
```
*Uses previous day's High, Low, Close*

### Pre-Market High/Low (PMH/PML)
- Scans extended hours data from **4:00 AM ET to 9:30 AM ET**
- PMH = highest price during this window
- PML = lowest price during this window

### VWAP (Volume Weighted Average Price)
```
VWAP = Σ(Price × Volume) / Σ(Volume)
```
*Cumulative from market open (9:30 AM ET) to current time*

### ATR (Average True Range)
```
True Range = max(High - Low, abs(High - PrevClose), abs(Low - PrevClose))
ATR = 14-period moving average of True Range
```

## Caching Strategy

- **Daily Levels** (PDH, pivots): 24 hours
- **VWAP**: 1 minute (updates frequently)
- **Pre-market Levels**: 5 minutes
- **ATR**: 1 hour
- **Full Levels Response**: 1 minute

## Deployment

### Railway (Recommended for Backend)

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login:
   ```bash
   railway login
   ```

3. Create project:
   ```bash
   railway init
   ```

4. Deploy:
   ```bash
   railway up
   ```

5. Set environment variables:
   ```bash
   railway variables set MASSIVE_API_KEY=xxx
   railway variables set NEXT_PUBLIC_SUPABASE_URL=xxx
   # ... set all other variables
   ```

### Environment Variables for Production
Make sure to set all variables from `.env.example` in your production environment.

Worker-health incident alerting (Discord) is optional and disabled by default. To enable:

```bash
WORKER_ALERTS_ENABLED=true
WORKER_ALERTS_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
WORKER_ALERTS_POLL_INTERVAL_MS=60000
WORKER_ALERTS_STALE_THRESHOLD_MS=1200000
WORKER_ALERTS_STARTUP_GRACE_MS=300000
WORKER_ALERTS_COOLDOWN_MS=900000
WORKER_ALERTS_SENTRY_ENABLED=false
```

E2E auth bypass is available for Playwright/backend-integrated tests in non-production only:

```bash
E2E_BYPASS_AUTH=true
E2E_BYPASS_TOKEN_PREFIX=e2e:
E2E_BYPASS_SHARED_SECRET=replace-with-long-random-secret
```

Do not enable `E2E_BYPASS_AUTH` in production.

## Troubleshooting

### "Massive.com API returns 401"
- Check your API key in `.env.local`
- Verify your Massive.com subscription is active
- Test the API key directly with curl:
  ```bash
  curl "https://api.massive.com/v2/aggs/ticker/I:SPX/range/1/day/2024-01-01/2024-01-31?apiKey=YOUR_KEY"
  ```

### "Redis connection failed"
- Make sure Redis is running: `redis-cli ping` (should return "PONG")
- Check REDIS_URL in `.env.local`
- Try connecting manually: `redis-cli -u redis://localhost:6379`

### "Levels don't match TradingView"
- Check your calculation formulas in `/src/services/levels/calculators/`
- Verify you're using correct high/low/close (previous day)
- PMH/PML: Make sure you're using extended hours data (4am-9:30am ET)
- Time zones: All times must be in ET (Eastern Time)

### "Database connection failed"
- Verify Supabase credentials in `.env.local`
- Check if migrations have been run: `npx supabase db push`
- Test connection in Supabase dashboard

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review `/docs/ai-coach/DEVELOPER_HANDOFF.md`
3. Check the test files for usage examples
4. Contact the development team

## License

MIT
