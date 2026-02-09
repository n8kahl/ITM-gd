# AI Coach - API Contracts

**Status**: Ready for Implementation
**Last Updated**: 2026-02-03
**Version**: 1.0

---

## Overview

This document defines the **exact** request and response formats for all AI Coach API endpoints. Developers must implement these contracts exactly as specified - no deviations.

**Base URL**: `https://api.titm.com` (production) or `http://localhost:3001` (development)

**Authentication**: All endpoints require JWT token in `Authorization: Bearer {token}` header

---

## 1. Levels API

### GET /api/levels/:symbol

**Purpose**: Retrieve key support/resistance levels for a symbol

**Request**:
```http
GET /api/levels/SPX?timeframe=intraday HTTP/1.1
Host: api.titm.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Query Parameters**:
| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| timeframe | string | No | `intraday`, `daily`, `weekly` | Defaults to `intraday` |

**Response** (200 OK):
```json
{
  "symbol": "SPX",
  "timestamp": "2026-02-03T12:05:30.123Z",
  "currentPrice": 5912.50,
  "levels": {
    "resistance": [
      {
        "type": "PWH",
        "price": 5950.00,
        "distance": 37.50,
        "distancePct": 0.64,
        "distanceATR": 0.8,
        "strength": "strong",
        "description": "Previous Week High",
        "testsToday": 0,
        "lastTest": null
      },
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
      },
      {
        "type": "4H_R1",
        "price": 5920.00,
        "distance": 7.50,
        "distancePct": 0.13,
        "distanceATR": 0.2,
        "strength": "moderate",
        "description": "4-Hour Pivot R1",
        "testsToday": 0,
        "lastTest": null
      }
    ],
    "support": [
      {
        "type": "VWAP",
        "price": 5900.00,
        "distance": -12.50,
        "distancePct": -0.21,
        "distanceATR": -0.25,
        "strength": "dynamic",
        "description": "Volume Weighted Average Price",
        "testsToday": 1,
        "lastTest": "2026-02-03T10:15:00Z"
      },
      {
        "type": "PMH",
        "price": 5885.00,
        "distance": -27.50,
        "distancePct": -0.46,
        "distanceATR": -0.6,
        "strength": "strong",
        "description": "Pre-Market High",
        "testsToday": 2,
        "lastTest": "2026-02-03T10:15:00Z"
      },
      {
        "type": "PDC",
        "price": 5850.00,
        "distance": -62.50,
        "distancePct": -1.06,
        "distanceATR": -1.3,
        "strength": "critical",
        "description": "Previous Day Close",
        "testsToday": 0,
        "lastTest": null
      }
    ],
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
      "camarilla": {
        "h4": 5925.00,
        "h3": 5915.00,
        "l3": 5865.00,
        "l4": 5855.00
      },
      "fibonacci": {
        "r3": 5960.00,
        "r2": 5940.00,
        "r1": 5920.00,
        "s1": 5860.00,
        "s2": 5840.00,
        "s3": 5820.00
      }
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

**Error Responses**:

401 Unauthorized:
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

403 Forbidden:
```json
{
  "error": "Query limit exceeded",
  "message": "You have reached your monthly query limit of 100. Upgrade to Pro for 500 queries/month.",
  "queryCount": 100,
  "queryLimit": 100,
  "resetDate": "2026-03-01T00:00:00Z"
}
```

404 Not Found:
```json
{
  "error": "Symbol not found",
  "message": "Symbol 'INVALID' is not supported. Supported symbols: SPX, NDX"
}
```

500 Internal Server Error:
```json
{
  "error": "Data provider error",
  "message": "Unable to fetch data from Massive.com. Please try again in a moment.",
  "retryAfter": 30
}
```

---

## 2. Charts API

### GET /api/charts/:symbol/candles

**Purpose**: Retrieve OHLCV candlestick data for charts

**Request**:
```http
GET /api/charts/SPX/candles?timeframe=5m&bars=100 HTTP/1.1
Host: api.titm.com
Authorization: Bearer {token}
```

**Query Parameters**:
| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| timeframe | string | Yes | `1m`, `5m`, `15m`, `1h`, `4h`, `daily`, `weekly` | Candle interval |
| bars | integer | No | 1-500 | Number of bars to return (default: 100) |
| from | ISO8601 | No | Date string | Start date (alternative to `bars`) |
| to | ISO8601 | No | Date string | End date (default: now) |

**Response** (200 OK):
```json
{
  "symbol": "SPX",
  "timeframe": "5m",
  "barsReturned": 100,
  "candles": [
    {
      "time": "2026-02-03T09:35:00Z",
      "open": 5890.00,
      "high": 5895.50,
      "low": 5888.25,
      "close": 5892.75,
      "volume": 1200000
    },
    {
      "time": "2026-02-03T09:40:00Z",
      "open": 5892.75,
      "high": 5898.00,
      "low": 5891.50,
      "close": 5896.25,
      "volume": 1350000
    }
    // ... 98 more candles
  ]
}
```

**Error Responses**: Same as Levels API (401, 403, 404, 500)

---

## 3. Options Chain API

### GET /api/options/:symbol/chain

**Purpose**: Retrieve options chain with Greeks

**Request**:
```http
GET /api/options/SPX/chain?expiry=2026-02-07&strikeRange=5 HTTP/1.1
Host: api.titm.com
Authorization: Bearer {token}
```

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| expiry | string (YYYY-MM-DD) | No | Specific expiry date. If omitted, returns nearest expiry |
| strikeRange | integer | No | Number of strikes above/below current price (default: 10) |

**Response** (200 OK):
```json
{
  "symbol": "SPX",
  "currentPrice": 5912.50,
  "expiry": "2026-02-07",
  "daysToExpiry": 5,
  "ivRank": 42,
  "options": {
    "calls": [
      {
        "strike": 5850.00,
        "last": 68.20,
        "bid": 67.50,
        "ask": 68.80,
        "volume": 120,
        "openInterest": 2100,
        "delta": 0.85,
        "gamma": 0.008,
        "theta": -15.20,
        "vega": 45.30,
        "impliedVolatility": 0.142,
        "inTheMoney": true
      },
      {
        "strike": 5875.00,
        "last": 52.40,
        "bid": 51.80,
        "ask": 53.20,
        "volume": 245,
        "openInterest": 3800,
        "delta": 0.75,
        "gamma": 0.012,
        "theta": -18.50,
        "vega": 58.20,
        "impliedVolatility": 0.148,
        "inTheMoney": true
      },
      {
        "strike": 5900.00,
        "last": 37.90,
        "bid": 37.40,
        "ask": 38.50,
        "volume": 1200,
        "openInterest": 8500,
        "delta": 0.62,
        "gamma": 0.015,
        "theta": -32.00,
        "vega": 85.00,
        "impliedVolatility": 0.152,
        "inTheMoney": true
      }
      // ... more strikes
    ],
    "puts": [
      {
        "strike": 5850.00,
        "last": 6.10,
        "bid": 5.80,
        "ask": 6.40,
        "volume": 85,
        "openInterest": 1850,
        "delta": -0.15,
        "gamma": 0.008,
        "theta": -8.20,
        "vega": 42.00,
        "impliedVolatility": 0.151,
        "inTheMoney": false
      }
      // ... more strikes
    ]
  }
}
```

### GET /api/options/:symbol/gex

**Purpose**: Retrieve gamma exposure (GEX) profile for SPX/NDX

**Request**:
```http
GET /api/options/SPX/gex?strikeRange=30&maxExpirations=6 HTTP/1.1
Host: api.titm.com
Authorization: Bearer {token}
```

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| expiry | string (YYYY-MM-DD) | No | Analyze only one expiration. If omitted, aggregates multiple nearby expirations |
| strikeRange | integer | No | Number of strikes above/below spot per expiration (default: 30, min: 5, max: 50) |
| maxExpirations | integer | No | Number of expirations to aggregate when `expiry` is omitted (default: 6, max: 12) |
| forceRefresh | boolean | No | Bypass cache and force fresh calculation (default: false) |

**Response** (200 OK):
```json
{
  "symbol": "SPX",
  "spotPrice": 6012.50,
  "gexByStrike": [
    {
      "strike": 6000,
      "gexValue": 1523400,
      "callGamma": 0.0042,
      "putGamma": 0.0039,
      "callOI": 12000,
      "putOI": 10500
    }
  ],
  "flipPoint": 5990,
  "maxGEXStrike": 6000,
  "keyLevels": [
    { "strike": 6000, "gexValue": 1523400, "type": "magnet" }
  ],
  "regime": "positive_gamma",
  "implication": "Positive gamma regime: market makers are more likely to dampen moves.",
  "calculatedAt": "2026-02-09T17:00:00.000Z",
  "expirationsAnalyzed": ["2026-02-10", "2026-02-11"]
}
```

---

## 4. Position Analysis API

### POST /api/positions/analyze

**Purpose**: Analyze a position or portfolio of positions

**Request**:
```http
POST /api/positions/analyze HTTP/1.1
Host: api.titm.com
Authorization: Bearer {token}
Content-Type: application/json

{
  "positions": [
    {
      "symbol": "SPX",
      "type": "call",
      "strike": 5900.00,
      "expiry": "2026-02-07",
      "quantity": 10,
      "entryPrice": 45.20
    },
    {
      "symbol": "NDX",
      "type": "put",
      "strike": 21500.00,
      "expiry": "2026-02-05",
      "quantity": -5,
      "entryPrice": 38.00
    }
  ]
}
```

**Response** (200 OK):
```json
{
  "positions": [
    {
      "symbol": "SPX",
      "type": "call",
      "strike": 5900.00,
      "expiry": "2026-02-07",
      "quantity": 10,
      "entryPrice": 45.20,
      "currentPrice": 52.80,
      "currentValue": 52800.00,
      "costBasis": 45200.00,
      "pnl": 7600.00,
      "pnlPct": 16.81,
      "daysHeld": 2,
      "daysToExpiry": 5,
      "greeks": {
        "delta": 6.20,
        "gamma": 0.15,
        "theta": -320.00,
        "vega": 850.00
      }
    },
    {
      "symbol": "NDX",
      "type": "put",
      "strike": 21500.00,
      "expiry": "2026-02-05",
      "quantity": -5,
      "entryPrice": 38.00,
      "currentPrice": 42.50,
      "currentValue": -21250.00,
      "costBasis": -19000.00,
      "pnl": -2250.00,
      "pnlPct": -11.84,
      "daysHeld": 1,
      "daysToExpiry": 3,
      "greeks": {
        "delta": 1.90,
        "gamma": -0.08,
        "theta": 90.00,
        "vega": -420.00
      }
    }
  ],
  "portfolio": {
    "totalValue": 31550.00,
    "totalCostBasis": 26200.00,
    "totalPnl": 5350.00,
    "totalPnlPct": 20.42,
    "portfolioGreeks": {
      "netDelta": 8.10,
      "netGamma": 0.07,
      "netTheta": -230.00,
      "netVega": 430.00
    },
    "risk": {
      "maxLoss": -64200.00,
      "maxGain": "unlimited",
      "buyingPowerUsed": 26200.00
    },
    "riskAssessment": {
      "overall": "moderate",
      "warnings": [
        "Net Theta is negative (-$230/day) - you are paying time decay",
        "High positive Vega - you benefit from volatility expansion",
        "Net Delta +8.10 - slightly bullish bias"
      ]
    }
  }
}
```

---

## 5. Screenshot Upload & Analysis API

### POST /api/positions/upload-screenshot

**Purpose**: Upload broker screenshot, extract positions, analyze

**Request**:
```http
POST /api/positions/upload-screenshot HTTP/1.1
Host: api.titm.com
Authorization: Bearer {token}
Content-Type: multipart/form-data

------WebKitFormBoundary
Content-Disposition: form-data; name="screenshot"; filename="positions.png"
Content-Type: image/png

[binary image data]
------WebKitFormBoundary--
```

**Response** (200 OK):
```json
{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "extractedPositions": [
    {
      "symbol": "SPX",
      "type": "call",
      "strike": 5900.00,
      "expiry": "2026-02-07",
      "quantity": 10,
      "entryPrice": 45.20,
      "currentPrice": 52.80,
      "confidence": 0.95
    },
    {
      "symbol": "NDX",
      "type": "put",
      "strike": 21500.00,
      "expiry": "2026-02-05",
      "quantity": 5,
      "entryPrice": 38.00,
      "currentPrice": 42.50,
      "confidence": 0.88
    }
  ],
  "extractionConfidence": 0.92,
  "broker": "TastyTrade",
  "needsReview": false,
  "suggestions": [
    "Position 2 (NDX put) has lower confidence. Please verify strike and expiry."
  ]
}
```

**Response** (202 Accepted - Processing):
```json
{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "message": "Screenshot is being analyzed. Check status at /api/positions/upload-screenshot/{uploadId}",
  "estimatedTime": 5
}
```

**Error** (400 Bad Request - Unreadable):
```json
{
  "error": "Extraction failed",
  "message": "Unable to extract position data from screenshot. Please ensure the screenshot is clear and shows the positions table.",
  "suggestions": [
    "Make sure positions table is fully visible",
    "Avoid cropping important parts of the screen",
    "Use higher resolution screenshot"
  ]
}
```

---

## 6. Trade Journal API

### GET /api/journal/trades

**Purpose**: Retrieve trade history with filters

**Request**:
```http
GET /api/journal/trades?startDate=2026-01-01&endDate=2026-02-03&strategy=iron_condor HTTP/1.1
Host: api.titm.com
Authorization: Bearer {token}
```

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| startDate | string (YYYY-MM-DD) | No | Filter trades from this date |
| endDate | string (YYYY-MM-DD) | No | Filter trades to this date |
| symbol | string | No | Filter by symbol (SPX, NDX) |
| strategy | string | No | Filter by strategy type |
| outcome | string | No | `win`, `loss`, `breakeven` |
| limit | integer | No | Max trades to return (default: 50, max: 500) |
| offset | integer | No | Pagination offset (default: 0) |

**Response** (200 OK):
```json
{
  "trades": [
    {
      "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      "symbol": "SPX",
      "positionType": "put_spread",
      "strategy": "put_credit_spread",
      "entryDate": "2026-01-28",
      "entryPrice": 8.50,
      "exitDate": "2026-01-31",
      "exitPrice": 2.20,
      "quantity": 10,
      "pnl": 6300.00,
      "pnlPct": 74.12,
      "holdTimeDays": 3,
      "tradeOutcome": "win",
      "exitReason": "Took profits at 74% max profit per rule",
      "entryContext": {
        "currentPrice": 5890.00,
        "pdh": 5900.00,
        "pml": 5880.00,
        "timeOfDay": "10:45 AM",
        "technicalSetup": "Bounced off PMH support"
      }
    }
    // ... more trades
  ],
  "summary": {
    "totalTrades": 45,
    "wins": 28,
    "losses": 17,
    "winRate": 62.22,
    "avgWin": 385.50,
    "avgLoss": -220.30,
    "profitFactor": 1.82,
    "totalPnl": 7040.00
  },
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 45,
    "hasMore": false
  }
}
```

### POST /api/journal/trades

**Purpose**: Add a new trade to journal

**Request**:
```http
POST /api/journal/trades HTTP/1.1
Host: api.titm.com
Authorization: Bearer {token}
Content-Type: application/json

{
  "symbol": "SPX",
  "positionType": "call",
  "strategy": "call_debit_spread",
  "entryDate": "2026-02-01",
  "entryPrice": 18.50,
  "exitDate": "2026-02-03",
  "exitPrice": 24.80,
  "quantity": 10,
  "exitReason": "Hit profit target",
  "lessonsLearned": "Waited for PDH support confirmation before entry. Worked well.",
  "tags": ["day-trade", "PDH-bounce", "winner"]
}
```

**Response** (201 Created):
```json
{
  "id": "b1ffc999-ad1c-5fg9-cc7e-7cc0ce481b22",
  "message": "Trade added successfully",
  "trade": {
    "id": "b1ffc999-ad1c-5fg9-cc7e-7cc0ce481b22",
    "symbol": "SPX",
    "pnl": 6300.00,
    "pnlPct": 34.05,
    "holdTimeDays": 2,
    "tradeOutcome": "win"
  }
}
```

---

## 7. Alerts API

### POST /api/alerts

**Purpose**: Create a new price alert

**Request**:
```http
POST /api/alerts HTTP/1.1
Host: api.titm.com
Authorization: Bearer {token}
Content-Type: application/json

{
  "symbol": "SPX",
  "alertType": "price_above",
  "targetValue": 5930.00,
  "notificationChannels": ["in-app", "email"],
  "notes": "Alert me when we break PDH"
}
```

**Response** (201 Created):
```json
{
  "id": "c2ggd000-be2d-6gh0-dd8f-8dd1df592c33",
  "message": "Alert created successfully",
  "alert": {
    "id": "c2ggd000-be2d-6gh0-dd8f-8dd1df592c33",
    "symbol": "SPX",
    "alertType": "price_above",
    "targetValue": 5930.00,
    "status": "active",
    "currentDistance": 17.50,
    "createdAt": "2026-02-03T12:10:00Z"
  }
}
```

**Error** (403 Forbidden - Tier Limit):
```json
{
  "error": "Alert limit exceeded",
  "message": "You have reached your alert limit of 5. Upgrade to Elite for unlimited alerts.",
  "currentAlerts": 5,
  "maxAlerts": 5,
  "tier": "pro"
}
```

### GET /api/alerts

**Purpose**: Get user's active alerts

**Response** (200 OK):
```json
{
  "alerts": [
    {
      "id": "c2ggd000-be2d-6gh0-dd8f-8dd1df592c33",
      "symbol": "SPX",
      "alertType": "price_above",
      "targetValue": 5930.00,
      "currentPrice": 5912.50,
      "distance": 17.50,
      "status": "active",
      "notificationChannels": ["in-app", "email"],
      "notes": "Alert me when we break PDH",
      "createdAt": "2026-02-03T12:10:00Z"
    }
  ],
  "summary": {
    "totalActive": 1,
    "maxAllowed": 5,
    "remainingSlots": 4
  }
}
```

---

## 8. ChatKit Integration API

### POST /api/chatkit/message

**Purpose**: Send user message, receive AI response (proxies to OpenAI)

**Request**:
```http
POST /api/chatkit/message HTTP/1.1
Host: api.titm.com
Authorization: Bearer {token}
Content-Type: application/json

{
  "sessionId": "d3hhe111-cf3e-7hi1-ee9g-9ee2eg603d44",
  "message": "Where's PDH for SPX?",
  "context": {
    "currentView": "chat"
  }
}
```

**Response** (200 OK):
```json
{
  "messageId": "e4iif222-dg4f-8ij2-ff0h-0ff3fh714e55",
  "role": "assistant",
  "content": "PDH is at $5,930 (+$17.50 from current / 0.30% / 0.4 ATR). It's been tested 3 times today and held as resistance each time. The last test was at 11:52 AM, and price rejected down $12 within 3 minutes.",
  "functionCalls": [
    {
      "function": "get_key_levels",
      "arguments": {
        "symbol": "SPX",
        "timeframe": "intraday"
      },
      "result": {
        "...": "levels data..."
      }
    }
  ],
  "tokensUsed": 450,
  "responseTime": 2.3
}
```

---

## 9. User Profile & Usage API

### GET /api/user/profile

**Purpose**: Get user's AI Coach profile and usage stats

**Response** (200 OK):
```json
{
  "userId": "f5jjg333-eh5g-9jk3-gg1i-1gg4gi825f66",
  "subscriptionTier": "pro",
  "queryCount": 247,
  "queryLimit": 500,
  "queryReset": "2026-03-01T00:00:00Z",
  "features": {
    "screenshotAnalysis": true,
    "tradeJournal": true,
    "realTimeAlerts": true,
    "opportunityScanner": true,
    "maxAlerts": 5
  },
  "usage": {
    "messagesThisMonth": 247,
    "screenshotsAnalyzed": 12,
    "alertsActive": 3,
    "tradesLogged": 18
  },
  "preferences": {
    "defaultSymbol": "SPX",
    "defaultTimeframe": "5m",
    "notificationsEnabled": true
  }
}
```

### PATCH /api/user/profile

**Purpose**: Update user preferences

**Request**:
```http
PATCH /api/user/profile HTTP/1.1
Host: api.titm.com
Authorization: Bearer {token}
Content-Type: application/json

{
  "preferences": {
    "defaultSymbol": "NDX",
    "defaultTimeframe": "15m",
    "notificationsEnabled": false
  }
}
```

**Response** (200 OK):
```json
{
  "message": "Profile updated successfully",
  "preferences": {
    "defaultSymbol": "NDX",
    "defaultTimeframe": "15m",
    "notificationsEnabled": false
  }
}
```

---

## Common Error Codes

| Status | Code | Message | Action |
|--------|------|---------|--------|
| 400 | `INVALID_REQUEST` | Request validation failed | Check request format |
| 401 | `UNAUTHORIZED` | Invalid or expired token | Re-authenticate |
| 403 | `FORBIDDEN` | Access denied | Check permissions |
| 403 | `QUERY_LIMIT_EXCEEDED` | Monthly query limit reached | Upgrade tier |
| 403 | `ALERT_LIMIT_EXCEEDED` | Max alerts reached | Delete old alerts or upgrade |
| 404 | `NOT_FOUND` | Resource not found | Check ID or symbol |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests | Wait and retry |
| 500 | `INTERNAL_ERROR` | Server error | Retry or contact support |
| 503 | `SERVICE_UNAVAILABLE` | External service down (Massive.com, OpenAI) | Retry after delay |

---

## Rate Limiting

All endpoints are rate-limited per user:

| Tier | Requests/Minute | Requests/Hour | Requests/Day |
|------|-----------------|---------------|--------------|
| Lite | 10 | 100 | 500 |
| Pro | 30 | 500 | 5000 |
| Elite | 100 | 2000 | Unlimited |

**Rate Limit Headers** (included in all responses):
```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 27
X-RateLimit-Reset: 1706972400
```

---

## Versioning

APIs are versioned via URL path:
- Current: `/api/v1/...`
- Future: `/api/v2/...`

Deprecated versions will be supported for 6 months after new version release.

---

## Testing Endpoints

### Development Mode Endpoints (Not in Production)

**POST /api/dev/reset-query-count** - Reset query count for testing
**GET /api/dev/cache/clear** - Clear all caches

---

## Related Documentation

- [DATABASE_SCHEMA.md](../data-models/DATABASE_SCHEMA.md) - Database structure
- [MASSIVE_API_REFERENCE.md](../integrations/MASSIVE_API_REFERENCE.md) - Upstream API
- [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) - Architecture

---

**Document Version History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-03 | Nate | Complete API contracts for 9 endpoints with exact request/response formats |
