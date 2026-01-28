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
// COLOR PALETTE - Bloomberg Terminal Style
// ============================================
const COLORS = {
  emerald: "#047857",       // Deep emerald for primary
  emeraldLight: "#059669",  // Lighter emerald
  emeraldGlow: "#10B981",   // Brightest emerald for accents
  gold: "#D4AF37",          // Gold for highlights
  champagne: "#E8E4D9",     // Champagne for text/accents
  red: "#991B1B",           // Deep red for sell/bearish
  redLight: "#DC2626",      // Lighter red
  gridLine: "rgba(232, 228, 217, 0.04)",  // Subtle grid
  gridLineBright: "rgba(232, 228, 217, 0.08)",
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

  // Transform data for the composed chart
  const chartData = useMemo(() => {
    return candles.map((candle) => ({
      time: candle.time,
      bodyBottom: Math.min(candle.open, candle.close),
      bodyHeight: Math.abs(candle.close - candle.open),
      wickLow: candle.low,
      wickHigh: candle.high,
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
      {/* Terminal Grid Background */}
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

      {/* Horizontal price level lines */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between py-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-full h-px" style={{ backgroundColor: COLORS.gridLineBright }} />
        ))}
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis dataKey="time" hide />
          <YAxis domain={[minPrice, maxPrice]} hide />

          {/* Candle Bodies */}
          <Bar
            dataKey="bodyHeight"
            stackId="candle"
            barSize={6}
            isAnimationActive={false}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`body-${index}`}
                fill={entry.bullish ? COLORS.emerald : COLORS.red}
                stroke={entry.bullish ? COLORS.gold : COLORS.redLight}
                strokeWidth={0.5}
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Custom wick overlay */}
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
                  backgroundColor: candle.bullish ? COLORS.emeraldLight : COLORS.redLight,
                  opacity: 0.5,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Price axis labels */}
      <div className="absolute right-1 top-1 bottom-1 flex flex-col justify-between pointer-events-none">
        <span className="text-[8px] font-mono text-champagne/40">{maxPrice.toFixed(1)}</span>
        <span className="text-[8px] font-mono text-champagne/40">{minPrice.toFixed(1)}</span>
      </div>

      {/* Live indicator */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[9px] font-mono text-champagne/50 uppercase tracking-wider">Live</span>
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
    { name: "Win Rate", value: currentValue, fill: COLORS.emerald },
  ];

  return (
    <div className={className}>
      {/* Terminal Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none rounded-lg"
        style={{
          backgroundImage: `
            linear-gradient(${COLORS.gridLine} 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.gridLine} 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="65%"
          outerRadius="95%"
          barSize={10}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <defs>
            <linearGradient id="winRateGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={COLORS.emerald} />
              <stop offset="50%" stopColor={COLORS.emeraldLight} />
              <stop offset="100%" stopColor={COLORS.gold} />
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
            cornerRadius={4}
            isAnimationActive={false}
            fill="url(#winRateGradient)"
          />
        </RadialBarChart>
      </ResponsiveContainer>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl md:text-3xl font-semibold font-mono text-champagne">
          {currentValue}%
        </span>
        <span className="text-[10px] text-champagne/40 font-mono uppercase tracking-widest">
          Win Rate
        </span>
      </div>

      {/* Gold accent ring */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent 45%, ${COLORS.gold}10 48%, transparent 52%)`,
        }}
      />
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
      {/* Terminal Grid Background */}
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

      <div className="flex items-end justify-around h-full gap-1.5 px-3 pb-8">
        {signals.map((signal) => (
          <div
            key={signal.id}
            className="flex-1 flex flex-col items-center justify-end gap-1.5"
          >
            {/* Signal bar */}
            <div
              className={`w-full rounded-t-sm transition-all duration-300 border-t ${
                signal.active
                  ? signal.type === "buy"
                    ? "bg-gradient-to-t from-emerald-900/50 to-emerald-600 border-gold shadow-[0_0_12px_rgba(4,120,87,0.4)]"
                    : "bg-gradient-to-t from-red-900/50 to-red-600 border-red-400 shadow-[0_0_12px_rgba(153,27,27,0.4)]"
                  : "bg-champagne/5 border-champagne/10"
              }`}
              style={{
                height: signal.active ? `${40 + Math.random() * 50}%` : "20%",
              }}
            />
            {/* Indicator dot */}
            <div
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                signal.active
                  ? signal.type === "buy"
                    ? "bg-emerald-500"
                    : "bg-red-500"
                  : "bg-champagne/20"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Legend - Professional Style */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-6 text-[9px] font-mono">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-gradient-to-t from-emerald-900 to-emerald-500 border border-gold/50" />
          <span className="text-champagne/50 uppercase tracking-wider">Long</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-gradient-to-t from-red-900 to-red-500 border border-red-400/50" />
          <span className="text-champagne/50 uppercase tracking-wider">Short</span>
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
  color = COLORS.emerald,
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
      {/* Terminal Grid Background */}
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
        {/* Gradient fill - Deep Emerald */}
        <defs>
          <linearGradient id="terminalLineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={COLORS.emerald} stopOpacity="0.4" />
            <stop offset="100%" stopColor={COLORS.emerald} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaD} fill="url(#terminalLineGradient)" />

        {/* Line - Gold stroke */}
        <path
          d={pathD}
          fill="none"
          stroke={COLORS.gold}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          opacity="0.8"
        />

        {/* Emerald line underneath for depth */}
        <path
          d={pathD}
          fill="none"
          stroke={COLORS.emerald}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          opacity="0.3"
        />

        {/* Current value dot */}
        <circle
          cx="100"
          cy={100 - points[points.length - 1]}
          r="2.5"
          fill={COLORS.gold}
          stroke={COLORS.champagne}
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
