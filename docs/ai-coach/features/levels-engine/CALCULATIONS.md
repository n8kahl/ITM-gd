# Levels Engine - Calculation Formulas

**Status**: Implementation Reference
**Last Updated**: 2026-02-03
**Version**: 1.0

---

## Overview

This document contains the **exact mathematical formulas** used to calculate all key levels in the TITM AI Coach levels engine. These formulas MUST match TradingView calculations within $0.50.

---

## 1. Previous Day Levels

### PDH (Previous Day High)
```
PDH = High of most recent completed trading day
```

**Example**:
- If today is Tuesday, PDH = Monday's High
- If today is Monday, PDH = Friday's High (skip weekend)

### PDL (Previous Day Low)
```
PDL = Low of most recent completed trading day
```

### PDC (Previous Day Close)
```
PDC = Close of most recent completed trading day
```

### PWH/PWL (Previous Week High/Low)
```
PWH = Highest High of last 5 trading days
PWL = Lowest Low of last 5 trading days
```

---

## 2. Pre-Market Levels

### PMH (Pre-Market High)
```
PMH = Highest price between 4:00 AM ET and 9:30 AM ET
```

**Time Window**: Extended hours data from market open (4:00 AM ET) to regular session start (9:30 AM ET)

**Data Source**: 1-minute aggregates from Massive.com API

### PML (Pre-Market Low)
```
PML = Lowest price between 4:00 AM ET and 9:30 AM ET
```

**Important Notes**:
- All times are in Eastern Time (ET)
- Pre-market session runs 4:00 AM - 9:30 AM ET
- Regular session runs 9:30 AM - 4:00 PM ET
- After-hours session runs 4:00 PM - 8:00 PM ET

---

## 3. Standard Pivot Points

**Input**: Previous day's High (H), Low (L), Close (C)

### Pivot Point (PP)
```
PP = (High + Low + Close) / 3
```

### Resistance Levels
```
R1 = (2 × PP) - Low
R2 = PP + (High - Low)
R3 = High + 2 × (PP - Low)
```

### Support Levels
```
S1 = (2 × PP) - High
S2 = PP - (High - Low)
S3 = Low - 2 × (High - PP)
```

### Example Calculation
Given: H = 5920, L = 5880, C = 5900

```
PP = (5920 + 5880 + 5900) / 3 = 5900.00

R1 = (2 × 5900) - 5880 = 5920.00
R2 = 5900 + (5920 - 5880) = 5940.00
R3 = 5920 + 2 × (5900 - 5880) = 5960.00

S1 = (2 × 5900) - 5920 = 5880.00
S2 = 5900 - (5920 - 5880) = 5860.00
S3 = 5880 - 2 × (5920 - 5900) = 5840.00
```

---

## 4. Camarilla Pivot Points

**Purpose**: More sensitive pivots designed for intraday trading

**Input**: Previous day's High (H), Low (L), Close (C)

### Formulas
```
Range = High - Low

H4 = Close + (Range × 1.1 / 2)
H3 = Close + (Range × 1.1 / 4)
L3 = Close - (Range × 1.1 / 4)
L4 = Close - (Range × 1.1 / 2)
```

### Example Calculation
Given: H = 5920, L = 5880, C = 5900

```
Range = 5920 - 5880 = 40

H4 = 5900 + (40 × 1.1 / 2) = 5900 + 22 = 5922.00
H3 = 5900 + (40 × 1.1 / 4) = 5900 + 11 = 5911.00
L3 = 5900 - (40 × 1.1 / 4) = 5900 - 11 = 5889.00
L4 = 5900 - (40 × 1.1 / 2) = 5900 - 22 = 5878.00
```

---

## 5. Fibonacci Pivot Points

**Purpose**: Uses Fibonacci ratios (0.382, 0.618, 1.0)

**Input**: Previous day's High (H), Low (L), Close (C)

### Formulas
```
PP = (High + Low + Close) / 3
Range = High - Low

R1 = PP + (0.382 × Range)
R2 = PP + (0.618 × Range)
R3 = PP + (1.000 × Range)

S1 = PP - (0.382 × Range)
S2 = PP - (0.618 × Range)
S3 = PP - (1.000 × Range)
```

### Example Calculation
Given: H = 5920, L = 5880, C = 5900

```
PP = (5920 + 5880 + 5900) / 3 = 5900.00
Range = 5920 - 5880 = 40

R1 = 5900 + (0.382 × 40) = 5900 + 15.28 = 5915.28
R2 = 5900 + (0.618 × 40) = 5900 + 24.72 = 5924.72
R3 = 5900 + (1.000 × 40) = 5900 + 40.00 = 5940.00

S1 = 5900 - (0.382 × 40) = 5900 - 15.28 = 5884.72
S2 = 5900 - (0.618 × 40) = 5900 - 24.72 = 5875.28
S3 = 5900 - (1.000 × 40) = 5900 - 40.00 = 5860.00
```

---

## 6. VWAP (Volume Weighted Average Price)

### Formula
```
VWAP = Σ(Typical Price × Volume) / Σ(Volume)

Where Typical Price = (High + Low + Close) / 3
```

**Time Window**: Cumulative from market open (9:30 AM ET) to current time

**Data Source**: 1-minute aggregates from Massive.com API (intraday data)

### Algorithm
```typescript
let cumulativePriceVolume = 0;
let cumulativeVolume = 0;

for each minute bar from 9:30 AM to now:
    typicalPrice = (high + low + close) / 3
    cumulativePriceVolume += typicalPrice × volume
    cumulativeVolume += volume

VWAP = cumulativePriceVolume / cumulativeVolume
```

### Example Calculation
Given 3 minute bars:
- Bar 1: H=5905, L=5895, C=5900, V=100000 → TP=5900, PV=590,000,000
- Bar 2: H=5908, L=5898, C=5903, V=120000 → TP=5903, PV=708,360,000
- Bar 3: H=5910, L=5900, C=5905, V=110000 → TP=5905, PV=649,550,000

```
Cumulative PV = 590,000,000 + 708,360,000 + 649,550,000 = 1,947,910,000
Cumulative V = 100,000 + 120,000 + 110,000 = 330,000

VWAP = 1,947,910,000 / 330,000 = 5,902.76
```

---

## 7. ATR (Average True Range)

### True Range Formula
```
True Range = max(
    High - Low,
    abs(High - Previous Close),
    abs(Low - Previous Close)
)
```

### ATR Formula (14-period)
```
Initial ATR = Average of first 14 True Range values

Subsequent ATR = ((Previous ATR × 13) + Current TR) / 14
```

**This is Wilder's smoothing method**

### Example Calculation

Given 3 days of data:
- Day 1: H=5920, L=5880, C=5900
- Day 2: H=5930, L=5890, C=5910
- Day 3: H=5940, L=5900, C=5920

```
TR1 = max(5920-5880, abs(5920-5900), abs(5880-5900)) = max(40, 20, 20) = 40
TR2 = max(5930-5890, abs(5930-5900), abs(5890-5900)) = max(40, 30, 10) = 40
TR3 = max(5940-5900, abs(5940-5910), abs(5900-5910)) = max(40, 30, 10) = 40

(For full ATR(14), you need 14+ days. First ATR = average of first 14 TRs)

If initial ATR = 40, and next TR = 42:
New ATR = ((40 × 13) + 42) / 14 = (520 + 42) / 14 = 40.14
```

### ATR(7)
Same formula, but with 7-period smoothing:
```
ATR(7) = ((Previous ATR × 6) + Current TR) / 7
```

---

## 8. Distance Calculations

### Distance from Current Price
```
Distance = Level Price - Current Price
Distance % = (Distance / Current Price) × 100
Distance ATR = Distance / ATR(14)
```

**Positive distance** = Level is above current price (resistance)
**Negative distance** = Level is below current price (support)

### Example
Given: Current Price = 5912.50, PDH = 5930.00, ATR = 47.25

```
Distance = 5930.00 - 5912.50 = 17.50
Distance % = (17.50 / 5912.50) × 100 = 0.30%
Distance ATR = 17.50 / 47.25 = 0.37 ATR
```

---

## 9. Level Strength Classification

Based on distance in ATR:

```
if abs(Distance ATR) < 0.5:  strength = "critical"
if abs(Distance ATR) < 1.0:  strength = "strong"
if abs(Distance ATR) < 2.0:  strength = "moderate"
if abs(Distance ATR) >= 2.0: strength = "weak"

Special cases:
- VWAP always has strength = "dynamic"
- Levels beyond 2 ATR are often ignored by day traders
```

---

## 10. Validation Against TradingView

**CRITICAL**: All calculations MUST match TradingView within $0.50

### How to Validate

1. Open TradingView → Load SPX chart
2. Add indicator: "Previous Day High/Low"
3. Add indicator: "Pivot Points Standard"
4. Add indicator: "VWAP"
5. Compare values to your API response

**Example Validation**:
```bash
# Your API
curl -H "Authorization: Bearer token" \
  http://localhost:3001/api/levels/SPX | jq '.levels.resistance[] | select(.type=="PDH") | .price'
# Output: 5930.00

# TradingView shows: PDH = 5930.00 ✓ MATCH
```

If values don't match:
- Check your formulas (copy-paste from this document)
- Verify you're using previous day's data (not current day)
- Check time zones (all times in ET)
- Verify data source is correct (1-day bars for pivots, 1-min bars for VWAP)

---

## 11. Data Sources & Timing

### Massive.com API Endpoints

**Daily Aggregates** (for PDH, pivots, ATR):
```
GET /v2/aggs/ticker/I:SPX/range/1/day/{from}/{to}
```

**Minute Aggregates** (for PMH, VWAP):
```
GET /v2/aggs/ticker/I:SPX/range/1/minute/{from}/{to}
```

### Calculation Schedule

- **Daily Levels** (PDH, pivots): Calculate once at 4:00 AM ET, cache for 24 hours
- **VWAP**: Recalculate every minute during market hours
- **PMH/PML**: Calculate once at 9:30 AM ET, cache until next day
- **ATR**: Calculate once per day at 4:00 AM ET, cache for 24 hours

---

## 12. Edge Cases & Special Handling

### Market Holidays
- Skip weekends and holidays when calculating "previous day"
- Use last trading day's data

### Extended Hours
- Pre-market: 4:00 AM - 9:30 AM ET
- Regular: 9:30 AM - 4:00 PM ET
- After-hours: 4:00 PM - 8:00 PM ET

### Insufficient Data
- ATR requires 14+ bars → return null if less
- VWAP requires intraday data → return null if market closed
- PMH/PML require pre-market data → return null if unavailable

### Rounding
- All prices rounded to 2 decimal places
- Percentages rounded to 2 decimal places
- ATR distances rounded to 2 decimal places

---

## Related Documentation

- [LEVELS_ENGINE_SPEC.md](./SPEC.md) - Overall specification
- [DATABASE_SCHEMA.md](../../data-models/DATABASE_SCHEMA.md) - Data storage
- [API_CONTRACTS.md](../../architecture/API_CONTRACTS.md) - API response formats

---

**Document Version History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-03 | Claude | Initial formulas documented with examples and validation instructions |
