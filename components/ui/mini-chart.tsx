"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";

// ============================================
// COLOR PALETTE - TradingView Professional
// ============================================
const COLORS = {
  bullish: "#26a69a",      // TradingView green
  bearish: "#ef5350",      // TradingView red
  sma: "#f7931a",          // Bitcoin orange / Gold
  volume: {
    bull: "rgba(38, 166, 154, 0.5)",
    bear: "rgba(239, 83, 80, 0.5)",
  },
  grid: "rgba(255, 255, 255, 0.04)",
  text: "rgba(255, 255, 255, 0.4)",
  champagne: "#E8E4D9",
};

// ============================================
// REALISTIC CANDLESTICK CHART
// ============================================

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Generate realistic market data with trends
function generateRealisticCandles(count: number): Candle[] {
  const candles: Candle[] = [];
  let price = 100;
  let trend = 1;
  let trendStrength = 0.6;
  let volatility = 0.008;

  for (let i = 0; i < count; i++) {
    // Occasionally change trend
    if (Math.random() < 0.08) {
      trend *= -1;
      trendStrength = 0.4 + Math.random() * 0.4;
    }

    // Vary volatility
    if (Math.random() < 0.1) {
      volatility = 0.005 + Math.random() * 0.015;
    }

    const trendBias = trend * trendStrength * volatility * price;
    const noise = (Math.random() - 0.5) * volatility * price * 2;
    const move = trendBias + noise;

    const open = price;
    const close = price + move;

    // Generate realistic wicks
    const bodySize = Math.abs(close - open);
    const upperWick = Math.random() * bodySize * 1.5;
    const lowerWick = Math.random() * bodySize * 1.5;

    const high = Math.max(open, close) + upperWick;
    const low = Math.min(open, close) - lowerWick;

    // Volume correlates with volatility and trend changes
    const baseVolume = 50 + Math.random() * 50;
    const volumeSpike = Math.abs(move) > volatility * price ? 1.5 : 1;
    const volume = baseVolume * volumeSpike;

    candles.push({ open, high, low, close, volume });
    price = close;
  }

  return candles;
}

// Calculate SMA
function calculateSMA(candles: Candle[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      sma.push(candles[i].close);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += candles[j].close;
      }
      sma.push(sum / period);
    }
  }
  return sma;
}

interface CandlestickChartProps {
  className?: string;
}

export function CandlestickChart({ className }: CandlestickChartProps) {
  const [candles, setCandles] = useState<Candle[]>(() => generateRealisticCandles(32));
  const [, setTick] = useState(0);

  // Add new candle periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setCandles(prev => {
        const lastCandle = prev[prev.length - 1];
        const price = lastCandle.close;

        // Continue the trend with some randomness
        const trend = lastCandle.close > lastCandle.open ? 1 : -1;
        const continueTrend = Math.random() < 0.6;
        const direction = continueTrend ? trend : -trend;

        const volatility = 0.008;
        const move = direction * (Math.random() * volatility * price) + (Math.random() - 0.5) * volatility * price;

        const open = price;
        const close = price + move;
        const bodySize = Math.abs(close - open);
        const high = Math.max(open, close) + Math.random() * bodySize * 1.2;
        const low = Math.min(open, close) - Math.random() * bodySize * 1.2;
        const volume = 50 + Math.random() * 80;

        return [...prev.slice(1), { open, high, low, close, volume }];
      });
      setTick(t => t + 1);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const sma = useMemo(() => calculateSMA(candles, 7), [candles]);

  // Calculate chart bounds
  const prices = candles.flatMap(c => [c.high, c.low]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const padding = priceRange * 0.1;
  const chartMin = minPrice - padding;
  const chartMax = maxPrice + padding;
  const chartRange = chartMax - chartMin;

  const maxVolume = Math.max(...candles.map(c => c.volume));

  // Convert price to Y coordinate (SVG coords: 0 at top)
  const priceToY = useCallback((price: number, height: number) => {
    return height - ((price - chartMin) / chartRange) * height;
  }, [chartMin, chartRange]);

  const candleWidth = 100 / candles.length;
  const bodyWidth = candleWidth * 0.7;

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Grid background */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={COLORS.grid} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Main chart area (top 75%) */}
      <svg className="absolute top-0 left-0 right-0" style={{ height: '75%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* SMA Line */}
        <path
          d={sma.map((val, i) => {
            const x = (i + 0.5) * candleWidth;
            const y = priceToY(val, 100);
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
          }).join(' ')}
          fill="none"
          stroke={COLORS.sma}
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Candlesticks */}
        {candles.map((candle, i) => {
          const x = i * candleWidth + candleWidth / 2;
          const isBullish = candle.close >= candle.open;
          const color = isBullish ? COLORS.bullish : COLORS.bearish;

          const bodyTop = priceToY(Math.max(candle.open, candle.close), 100);
          const bodyBottom = priceToY(Math.min(candle.open, candle.close), 100);
          const bodyHeight = Math.max(bodyBottom - bodyTop, 0.5);

          const wickTop = priceToY(candle.high, 100);
          const wickBottom = priceToY(candle.low, 100);

          return (
            <g key={i}>
              {/* Wick */}
              <line
                x1={x}
                y1={wickTop}
                x2={x}
                y2={wickBottom}
                stroke={color}
                strokeWidth="0.3"
                vectorEffect="non-scaling-stroke"
              />
              {/* Body */}
              <rect
                x={x - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={bodyHeight}
                fill={isBullish ? color : color}
                stroke={color}
                strokeWidth="0.3"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>

      {/* Volume bars (bottom 20%) */}
      <svg className="absolute bottom-0 left-0 right-0" style={{ height: '20%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
        {candles.map((candle, i) => {
          const x = i * candleWidth + candleWidth / 2;
          const isBullish = candle.close >= candle.open;
          const height = (candle.volume / maxVolume) * 80;

          return (
            <rect
              key={i}
              x={x - bodyWidth / 2}
              y={100 - height}
              width={bodyWidth}
              height={height}
              fill={isBullish ? COLORS.volume.bull : COLORS.volume.bear}
            />
          );
        })}
      </svg>

      {/* Price labels */}
      <div className="absolute top-1 right-1 text-[9px] font-mono text-white/30">
        {chartMax.toFixed(2)}
      </div>
      <div className="absolute right-1 text-[9px] font-mono text-white/30" style={{ top: '70%' }}>
        {chartMin.toFixed(2)}
      </div>

      {/* Live indicator */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#26a69a] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#26a69a]"></span>
        </span>
        <span className="text-[9px] font-medium text-white/50 uppercase tracking-wider">Live</span>
      </div>

      {/* SMA indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <div className="w-3 h-[2px] rounded" style={{ backgroundColor: COLORS.sma }} />
        <span className="text-[8px] font-medium text-white/30">SMA 7</span>
      </div>
    </div>
  );
}


// ============================================
// WIN RATE DONUT CHART
// ============================================

interface WinRateChartProps {
  percentage?: number;
  className?: string;
}

export function WinRateChart({ percentage = 87, className }: WinRateChartProps) {
  const [currentValue, setCurrentValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (hasAnimated) return;

    const duration = 2000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      setCurrentValue(Math.round(eased * percentage));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setHasAnimated(true);
      }
    };

    requestAnimationFrame(animate);
  }, [percentage, hasAnimated]);

  const data = [{ name: "Win Rate", value: currentValue, fill: COLORS.bullish }];

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            linear-gradient(${COLORS.grid} 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.grid} 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px',
        }}
      />

      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="65%"
          outerRadius="85%"
          barSize={8}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            background={{ fill: "rgba(255,255,255,0.05)" }}
            dataKey="value"
            cornerRadius={4}
            isAnimationActive={false}
            fill={COLORS.bullish}
          />
        </RadialBarChart>
      </ResponsiveContainer>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-4xl md:text-5xl font-serif font-medium tracking-tight"
          style={{ color: COLORS.champagne }}
        >
          {currentValue}%
        </span>
        <span className="text-[10px] text-white/40 font-medium uppercase tracking-[0.25em] mt-1">
          Win Rate
        </span>
      </div>
    </div>
  );
}


// ============================================
// LIVE SIGNAL PULSE
// ============================================

interface Signal {
  id: number;
  type: "long" | "short";
  strength: number;
  active: boolean;
  timestamp: number;
}

interface SignalPulseProps {
  className?: string;
}

export function SignalPulse({ className }: SignalPulseProps) {
  const [signals, setSignals] = useState<Signal[]>(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      type: Math.random() > 0.35 ? "long" : "short",
      strength: 20 + Math.random() * 30,
      active: false,
      timestamp: 0,
    }))
  );

  useEffect(() => {
    // Fire signals randomly
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * signals.length);
      const isLong = Math.random() > 0.35;

      setSignals(prev => prev.map((s, i) =>
        i === idx
          ? {
              ...s,
              active: true,
              type: isLong ? "long" : "short",
              strength: 50 + Math.random() * 50,
              timestamp: Date.now(),
            }
          : s
      ));

      // Deactivate after animation
      setTimeout(() => {
        setSignals(prev => prev.map((s, i) =>
          i === idx ? { ...s, active: false, strength: 20 + Math.random() * 20 } : s
        ));
      }, 800);
    }, 600);

    return () => clearInterval(interval);
  }, [signals.length]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            linear-gradient(${COLORS.grid} 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.grid} 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Signal bars */}
      <div className="absolute inset-x-4 top-4 bottom-12 flex items-end justify-around gap-2">
        {signals.map((signal) => (
          <div
            key={signal.id}
            className="flex-1 flex flex-col items-center justify-end h-full"
          >
            {/* Bar */}
            <div
              className="w-full rounded-t transition-all duration-300 ease-out"
              style={{
                height: `${signal.strength}%`,
                backgroundColor: signal.active
                  ? (signal.type === "long" ? COLORS.bullish : COLORS.bearish)
                  : "rgba(255,255,255,0.08)",
                boxShadow: signal.active
                  ? `0 0 20px ${signal.type === "long" ? COLORS.bullish : COLORS.bearish}60`
                  : "none",
                transform: signal.active ? "scaleY(1)" : "scaleY(1)",
              }}
            />
            {/* Indicator dot */}
            <div
              className="w-2 h-2 rounded-full mt-2 transition-all duration-300"
              style={{
                backgroundColor: signal.active
                  ? (signal.type === "long" ? COLORS.bullish : COLORS.bearish)
                  : "rgba(255,255,255,0.15)",
                boxShadow: signal.active
                  ? `0 0 8px ${signal.type === "long" ? COLORS.bullish : COLORS.bearish}`
                  : "none",
              }}
            />
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.bullish }} />
          <span className="text-[9px] font-medium text-white/50 uppercase tracking-wider">Long</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.bearish }} />
          <span className="text-[9px] font-medium text-white/50 uppercase tracking-wider">Short</span>
        </div>
      </div>
    </div>
  );
}


// ============================================
// MINI LINE CHART
// ============================================

interface MiniLineChartProps {
  className?: string;
}

export function MiniLineChart({ className }: MiniLineChartProps) {
  const [points, setPoints] = useState<number[]>(() => {
    const arr: number[] = [];
    let value = 50;
    for (let i = 0; i < 40; i++) {
      const trend = i < 15 ? 1 : i < 25 ? -0.5 : 0.8;
      value += trend * 0.5 + (Math.random() - 0.5) * 4;
      value = Math.max(15, Math.min(85, value));
      arr.push(value);
    }
    return arr;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setPoints(prev => {
        const last = prev[prev.length - 1];
        const trend = last > 60 ? -0.3 : last < 40 ? 0.3 : 0;
        let newVal = last + trend + (Math.random() - 0.48) * 3;
        newVal = Math.max(15, Math.min(85, newVal));
        return [...prev.slice(1), newVal];
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  const pathD = useMemo(() => {
    return points.map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 100 - p;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [points]);

  const areaD = `${pathD} L 100 100 L 0 100 Z`;
  const isUp = points[points.length - 1] > points[0];
  const color = isUp ? COLORS.bullish : COLORS.bearish;

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            linear-gradient(${COLORS.grid} 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.grid} 1px, transparent 1px)
          `,
          backgroundSize: '25px 25px',
        }}
      />

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaD} fill="url(#areaGradient)" />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Current point */}
        <circle
          cx="100"
          cy={100 - points[points.length - 1]}
          r="3"
          fill={color}
          className="animate-pulse"
        />
      </svg>
    </div>
  );
}
