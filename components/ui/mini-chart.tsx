"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";

// ============================================
// CANDLESTICK CHART - Live Trading Feed
// ============================================

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Generate a new random candle based on previous close
function generateCandle(prevClose: number, index: number): CandleData {
  const volatility = 0.02; // 2% max move
  const trend = Math.random() > 0.45 ? 1 : -1; // Slight bullish bias

  const change = prevClose * volatility * Math.random() * trend;
  const open = prevClose;
  const close = prevClose + change;

  const highExtra = Math.abs(change) * Math.random() * 0.5;
  const lowExtra = Math.abs(change) * Math.random() * 0.5;

  const high = Math.max(open, close) + highExtra;
  const low = Math.min(open, close) - lowExtra;

  return {
    time: index,
    open,
    high,
    low,
    close,
  };
}

// Generate initial candles
function generateInitialCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let price = 100; // Starting price

  for (let i = 0; i < count; i++) {
    const candle = generateCandle(price, i);
    candles.push(candle);
    price = candle.close;
  }

  return candles;
}

interface CandlestickChartProps {
  className?: string;
  candleCount?: number;
  updateInterval?: number; // ms
}

export function CandlestickChart({
  className,
  candleCount = 20,
  updateInterval = 1500,
}: CandlestickChartProps) {
  const [candles, setCandles] = useState<CandleData[]>(() =>
    generateInitialCandles(candleCount)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCandles((prev) => {
        const lastCandle = prev[prev.length - 1];
        const newCandle = generateCandle(lastCandle.close, lastCandle.time + 1);
        // Remove first candle and add new one
        return [...prev.slice(1), newCandle];
      });
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  // Transform data for the composed chart (we'll fake candlesticks with bars)
  const chartData = useMemo(() => {
    return candles.map((candle) => ({
      time: candle.time,
      // For the body of the candle
      bodyBottom: Math.min(candle.open, candle.close),
      bodyHeight: Math.abs(candle.close - candle.open),
      // For wicks
      wickLow: candle.low,
      wickHigh: candle.high,
      // Color
      bullish: candle.close >= candle.open,
      open: candle.open,
      close: candle.close,
      high: candle.high,
      low: candle.low,
    }));
  }, [candles]);

  const minPrice = Math.min(...candles.map(c => c.low)) * 0.998;
  const maxPrice = Math.max(...candles.map(c => c.high)) * 1.002;

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <XAxis dataKey="time" hide />
          <YAxis domain={[minPrice, maxPrice]} hide />

          {/* Candle Bodies */}
          <Bar
            dataKey="bodyHeight"
            stackId="candle"
            barSize={8}
            isAnimationActive={false}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`body-${index}`}
                fill={entry.bullish ? "#00E676" : "#FF5252"}
                fillOpacity={0.9}
              />
            ))}
          </Bar>

          {/* Wicks - represented as thin lines via custom shape would be ideal,
              but for simplicity we'll use the bar approach with visual styling */}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Custom wick overlay using divs for better visual */}
      <div className="absolute inset-0 flex items-end justify-around pointer-events-none px-1">
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
                  backgroundColor: candle.bullish ? "#00E676" : "#FF5252",
                  opacity: 0.6,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ============================================
// WIN RATE DONUT CHART - Animated Stats
// ============================================

interface WinRateChartProps {
  percentage?: number;
  className?: string;
  animationDuration?: number; // ms
}

export function WinRateChart({
  percentage = 87,
  className,
  animationDuration = 2000,
}: WinRateChartProps) {
  const [currentValue, setCurrentValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);

      // Easing function (ease-out-cubic)
      const eased = 1 - Math.pow(1 - progress, 3);

      setCurrentValue(Math.round(eased * percentage));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(animate);
  }, [percentage, animationDuration]);

  const data = [
    { name: "Win Rate", value: currentValue, fill: "#00E676" },
  ];

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="70%"
          outerRadius="100%"
          barSize={12}
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
            cornerRadius={6}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ResponsiveContainer>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl md:text-4xl font-bold font-mono text-primary">
          {currentValue}%
        </span>
        <span className="text-xs text-smoke/50 font-mono uppercase tracking-wider">
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
  const [signals, setSignals] = useState<{ id: number; type: "buy" | "sell"; active: boolean }[]>(
    Array.from({ length: signalCount }, (_, i) => ({
      id: i,
      type: Math.random() > 0.4 ? "buy" : "sell",
      active: false,
    }))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * signalCount);

      setSignals((prev) =>
        prev.map((signal, i) =>
          i === randomIndex
            ? { ...signal, active: true, type: Math.random() > 0.4 ? "buy" : "sell" }
            : signal
        )
      );

      // Reset after animation
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
      <div className="flex items-end justify-around h-full gap-1 px-2">
        {signals.map((signal) => (
          <div
            key={signal.id}
            className="flex-1 flex flex-col items-center justify-end gap-1"
          >
            {/* Signal bar */}
            <div
              className={`w-full rounded-t transition-all duration-300 ${
                signal.active
                  ? signal.type === "buy"
                    ? "bg-primary shadow-[0_0_10px_rgba(0,230,118,0.5)]"
                    : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                  : "bg-smoke/10"
              }`}
              style={{
                height: signal.active ? `${40 + Math.random() * 50}%` : "20%",
              }}
            />
            {/* Indicator dot */}
            <div
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                signal.active
                  ? signal.type === "buy"
                    ? "bg-primary animate-pulse"
                    : "bg-red-500 animate-pulse"
                  : "bg-smoke/20"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-4 text-[10px] font-mono">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-smoke/40">BUY</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-smoke/40">SELL</span>
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
  color?: string;
  pointCount?: number;
}

export function MiniLineChart({
  className,
  color = "#00E676",
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

  return (
    <div className={className}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        {/* Gradient fill */}
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaD} fill="url(#lineGradient)" />

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

        {/* Current value dot */}
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
