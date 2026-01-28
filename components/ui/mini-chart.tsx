"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Cell,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";

// ============================================
// COLOR PALETTE - TradingView/Bloomberg Professional
// ============================================
const COLORS = {
  // Candlestick colors - Professional muted tones
  bullish: "#0ccb80",        // Muted Mint (TradingView green)
  bearish: "#f23645",        // Muted Red (TradingView red)
  bullishDark: "#089968",    // Darker mint for depth
  bearishDark: "#c42d3a",    // Darker red for depth

  // Moving Average
  sma: "#f0b90b",            // Gold/Yellow SMA line

  // Volume
  volumeBull: "rgba(12, 203, 128, 0.3)",
  volumeBear: "rgba(242, 54, 69, 0.3)",

  // UI Elements
  gold: "#D4AF37",
  champagne: "#E8E4D9",
  gridLine: "rgba(255, 255, 255, 0.05)",
  gridLineBright: "rgba(255, 255, 255, 0.08)",
};

// ============================================
// CANDLESTICK CHART - Professional Trading Feed
// ============================================

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma: number;
}

// Simple Moving Average calculation
function calculateSMA(data: CandleData[], period: number, index: number): number {
  const start = Math.max(0, index - period + 1);
  const slice = data.slice(start, index + 1);
  const sum = slice.reduce((acc, c) => acc + c.close, 0);
  return sum / slice.length;
}

// Generate a new random candle based on previous close
function generateCandle(prevClose: number, index: number, prevVolume: number): Omit<CandleData, 'sma'> {
  const volatility = 0.02;
  const trend = Math.random() > 0.45 ? 1 : -1;

  const change = prevClose * volatility * Math.random() * trend;
  const open = prevClose;
  const close = prevClose + change;

  const highExtra = Math.abs(change) * Math.random() * 0.8;
  const lowExtra = Math.abs(change) * Math.random() * 0.8;

  const high = Math.max(open, close) + highExtra;
  const low = Math.min(open, close) - lowExtra;

  // Volume with some variation
  const volumeChange = (Math.random() - 0.5) * 0.4;
  const volume = Math.max(50, prevVolume * (1 + volumeChange));

  return {
    time: index,
    open,
    high,
    low,
    close,
    volume,
  };
}

// Generate initial candles with SMA
function generateInitialCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let price = 100;
  let volume = 100;

  for (let i = 0; i < count; i++) {
    const candle = generateCandle(price, i, volume);
    candles.push({ ...candle, sma: 0 });
    price = candle.close;
    volume = candle.volume;
  }

  // Calculate SMA for all candles
  return candles.map((candle, index) => ({
    ...candle,
    sma: calculateSMA(candles, 7, index),
  }));
}

interface CandlestickChartProps {
  className?: string;
  candleCount?: number;
  updateInterval?: number;
}

export function CandlestickChart({
  className,
  candleCount = 24,
  updateInterval = 1500,
}: CandlestickChartProps) {
  const [candles, setCandles] = useState<CandleData[]>(() =>
    generateInitialCandles(candleCount)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCandles((prev) => {
        const lastCandle = prev[prev.length - 1];
        const newCandleBase = generateCandle(lastCandle.close, lastCandle.time + 1, lastCandle.volume);
        const newCandles = [...prev.slice(1), { ...newCandleBase, sma: 0 }];

        // Recalculate SMA for last candle
        newCandles[newCandles.length - 1].sma = calculateSMA(newCandles, 7, newCandles.length - 1);

        return newCandles;
      });
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  // Transform data for the chart
  const chartData = useMemo(() => {
    return candles.map((candle) => ({
      time: candle.time,
      bodyBottom: Math.min(candle.open, candle.close),
      bodyHeight: Math.abs(candle.close - candle.open),
      bullish: candle.close >= candle.open,
      open: candle.open,
      close: candle.close,
      high: candle.high,
      low: candle.low,
      volume: candle.volume,
      sma: candle.sma,
    }));
  }, [candles]);

  const minPrice = Math.min(...candles.map(c => c.low)) * 0.995;
  const maxPrice = Math.max(...candles.map(c => c.high)) * 1.005;
  const maxVolume = Math.max(...candles.map(c => c.volume));

  return (
    <div className={className}>
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(${COLORS.gridLine} 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.gridLine} 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Main chart area */}
      <div className="absolute inset-0 bottom-[20%]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <XAxis dataKey="time" hide />
            <YAxis domain={[minPrice, maxPrice]} hide />

            {/* SMA Line - Gold moving average */}
            <Line
              type="monotone"
              dataKey="sma"
              stroke={COLORS.sma}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />

            {/* Candle Bodies */}
            <Bar
              dataKey="bodyHeight"
              barSize={8}
              isAnimationActive={false}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`body-${index}`}
                  fill={entry.bullish ? COLORS.bullish : COLORS.bearish}
                />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>

        {/* Custom wicks overlay */}
        <div className="absolute inset-0 flex items-end justify-around pointer-events-none px-2">
          {chartData.map((candle, i) => {
            const range = maxPrice - minPrice;
            const wickTopPercent = ((maxPrice - candle.high) / range) * 100;
            const wickBottomPercent = ((candle.low - minPrice) / range) * 100;
            const wickHeight = 100 - wickTopPercent - wickBottomPercent;

            return (
              <div
                key={i}
                className="relative h-full flex-1 flex justify-center"
              >
                <div
                  className="absolute w-[1px]"
                  style={{
                    top: `${wickTopPercent}%`,
                    height: `${wickHeight}%`,
                    backgroundColor: candle.bullish ? COLORS.bullish : COLORS.bearish,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Volume bars at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-[18%] flex items-end justify-around px-2 gap-[2px]">
        {chartData.map((candle, i) => (
          <div
            key={`vol-${i}`}
            className="flex-1 rounded-t-[1px]"
            style={{
              height: `${(candle.volume / maxVolume) * 100}%`,
              backgroundColor: candle.bullish ? COLORS.volumeBull : COLORS.volumeBear,
              minHeight: '2px',
            }}
          />
        ))}
      </div>

      {/* Price axis labels */}
      <div className="absolute right-1 top-1 bottom-[22%] flex flex-col justify-between pointer-events-none">
        <span className="text-[8px] font-mono text-white/30">{maxPrice.toFixed(2)}</span>
        <span className="text-[8px] font-mono text-white/30">{minPrice.toFixed(2)}</span>
      </div>

      {/* Live indicator */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: COLORS.bullish }}></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: COLORS.bullish }}></span>
        </span>
        <span className="text-[8px] font-mono text-white/40 uppercase tracking-wider">Live</span>
      </div>

      {/* Symbol label */}
      <div className="absolute top-2 right-2">
        <span className="text-[8px] font-mono text-white/30">SMA(7)</span>
      </div>
    </div>
  );
}


// ============================================
// WIN RATE DONUT CHART - Institutional Style
// ============================================

interface WinRateChartProps {
  percentage?: number;
  className?: string;
  animationDuration?: number;
}

export function WinRateChart({
  percentage = 87,
  className,
  animationDuration = 2000,
}: WinRateChartProps) {
  const [currentValue, setCurrentValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setCurrentValue(Math.round(eased * percentage));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [percentage, animationDuration]);

  const data = [
    { name: "Win Rate", value: currentValue, fill: COLORS.bullish },
  ];

  return (
    <div className={className}>
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 pointer-events-none rounded-lg"
        style={{
          backgroundImage: `
            linear-gradient(${COLORS.gridLine} 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.gridLine} 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />

      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="70%"
          outerRadius="90%"
          barSize={6}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <defs>
            <linearGradient id="winRateGradientPro" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={COLORS.bullish} />
              <stop offset="100%" stopColor={COLORS.sma} />
            </linearGradient>
          </defs>
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            background={{ fill: "rgba(255,255,255,0.03)" }}
            dataKey="value"
            cornerRadius={3}
            isAnimationActive={false}
            fill="url(#winRateGradientPro)"
          />
        </RadialBarChart>
      </ResponsiveContainer>

      {/* Center label - Serif font for elegance */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl md:text-4xl font-serif font-medium text-champagne tracking-tight">
          {currentValue}%
        </span>
        <span className="text-[9px] text-white/30 font-mono uppercase tracking-[0.2em] mt-1">
          Win Rate
        </span>
      </div>
    </div>
  );
}


// ============================================
// LIVE SIGNAL PULSE - Activity Indicator
// ============================================

interface SignalPulseProps {
  className?: string;
  signalCount?: number;
}

export function SignalPulse({ className, signalCount = 5 }: SignalPulseProps) {
  const [signals, setSignals] = useState<{ id: number; type: "long" | "short"; active: boolean }[]>(
    Array.from({ length: signalCount }, (_, i) => ({
      id: i,
      type: Math.random() > 0.4 ? "long" : "short",
      active: false,
    }))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * signalCount);

      setSignals((prev) =>
        prev.map((signal, i) =>
          i === randomIndex
            ? { ...signal, active: true, type: Math.random() > 0.4 ? "long" : "short" }
            : signal
        )
      );

      setTimeout(() => {
        setSignals((prev) =>
          prev.map((signal, i) =>
            i === randomIndex ? { ...signal, active: false } : signal
          )
        );
      }, 500);
    }, 800);

    return () => clearInterval(interval);
  }, [signalCount]);

  return (
    <div className={className}>
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(${COLORS.gridLine} 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.gridLine} 1px, transparent 1px)
          `,
          backgroundSize: '16px 16px',
        }}
      />

      <div className="flex items-end justify-around h-full gap-2 px-4 pb-8">
        {signals.map((signal) => (
          <div
            key={signal.id}
            className="flex-1 flex flex-col items-center justify-end gap-1.5"
          >
            {/* Signal bar */}
            <div
              className="w-full rounded-t transition-all duration-300"
              style={{
                height: signal.active ? `${40 + Math.random() * 50}%` : "20%",
                backgroundColor: signal.active
                  ? signal.type === "long"
                    ? COLORS.bullish
                    : COLORS.bearish
                  : "rgba(255,255,255,0.05)",
                boxShadow: signal.active
                  ? `0 0 12px ${signal.type === "long" ? COLORS.bullish : COLORS.bearish}40`
                  : "none",
              }}
            />
            {/* Indicator dot */}
            <div
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor: signal.active
                  ? signal.type === "long"
                    ? COLORS.bullish
                    : COLORS.bearish
                  : "rgba(255,255,255,0.15)",
              }}
            />
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-6 text-[8px] font-mono">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: COLORS.bullish }} />
          <span className="text-white/40 uppercase tracking-wider">Long</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: COLORS.bearish }} />
          <span className="text-white/40 uppercase tracking-wider">Short</span>
        </div>
      </div>
    </div>
  );
}


// ============================================
// MINI LINE CHART - For trends
// ============================================

interface MiniLineChartProps {
  className?: string;
  pointCount?: number;
}

export function MiniLineChart({
  className,
  pointCount = 30,
}: MiniLineChartProps) {
  const [points, setPoints] = useState<number[]>(() => {
    const arr: number[] = [];
    let value = 50;
    for (let i = 0; i < pointCount; i++) {
      value += (Math.random() - 0.45) * 10;
      value = Math.max(10, Math.min(90, value));
      arr.push(value);
    }
    return arr;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setPoints((prev) => {
        const lastValue = prev[prev.length - 1];
        let newValue = lastValue + (Math.random() - 0.45) * 8;
        newValue = Math.max(10, Math.min(90, newValue));
        return [...prev.slice(1), newValue];
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const pathD = useMemo(() => {
    const width = 100;
    const height = 100;
    const stepX = width / (points.length - 1);

    let d = `M 0 ${height - points[0]}`;

    for (let i = 1; i < points.length; i++) {
      const x = i * stepX;
      const y = height - points[i];
      d += ` L ${x} ${y}`;
    }

    return d;
  }, [points]);

  const areaD = useMemo(() => {
    return `${pathD} L 100 100 L 0 100 Z`;
  }, [pathD]);

  const isUp = points[points.length - 1] > points[0];

  return (
    <div className={className}>
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(${COLORS.gridLine} 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.gridLine} 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full relative z-10"
      >
        <defs>
          <linearGradient id="lineAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isUp ? COLORS.bullish : COLORS.bearish} stopOpacity="0.25" />
            <stop offset="100%" stopColor={isUp ? COLORS.bullish : COLORS.bearish} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaD} fill="url(#lineAreaGradient)" />

        {/* Main line */}
        <path
          d={pathD}
          fill="none"
          stroke={isUp ? COLORS.bullish : COLORS.bearish}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Current value dot */}
        <circle
          cx="100"
          cy={100 - points[points.length - 1]}
          r="2"
          fill={isUp ? COLORS.bullish : COLORS.bearish}
        />
      </svg>
    </div>
  );
}
