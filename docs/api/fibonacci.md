# Fibonacci Retracement API

## Endpoint
`POST /api/fibonacci`

## Description
Calculates Fibonacci retracement/extension levels from recent market swings for the requested symbol.

## Authentication
Requires `Authorization: Bearer <token>`.

## Request Body
```json
{
  "symbol": "SPX",
  "timeframe": "daily",
  "lookback": 20
}
```

## Response (200)
```json
{
  "symbol": "SPX",
  "swingHigh": 5975.25,
  "swingHighIndex": 18,
  "swingLow": 5850,
  "swingLowIndex": 5,
  "timeframe": "daily",
  "lookbackBars": 20,
  "direction": "retracement",
  "levels": {
    "level_0": 5975.25,
    "level_236": 5945.63,
    "level_382": 5927.38,
    "level_500": 5912.63,
    "level_618": 5897.88,
    "level_786": 5876.63,
    "level_100": 5850
  },
  "currentPrice": 5920,
  "closestLevel": {
    "name": "618",
    "price": 5897.88,
    "distance": 22.12
  },
  "performance": {
    "calculationMs": 3,
    "withinTarget": true
  },
  "calculatedAt": "2026-02-10T18:00:00.000Z"
}
```

## Error Responses
- `400` invalid input/body
- `401` missing or invalid auth token
- `404` insufficient market data for calculation
- `500` server-side calculation error

