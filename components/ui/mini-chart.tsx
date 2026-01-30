"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef, memo } from "react";
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
  bullish: "#26a69a",
  bearish: "#ef5350",
  sma: "#f7931a",
  volume: {
    bull: "rgba(38, 166, 154, 0.5)",
    bear: "rgba(239, 83, 80, 0.5)",
  },
  grid: "rgba(255, 255, 255, 0.04)",
  text: "rgba(255, 255, 255, 0.4)",
  champagne: "#E8E4D9",
};

// Mobile detection hook
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

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

function generateRealisticCandles(count: number): Candle[] {
  const candles: Candle[] = [];
  let price = 100;
  let trend = 1;
  let trendStrength = 0.6;
  let volatility = 0.008;

  for (let i = 0; i < count; i++) {
    if (Math.random() < 0.08) {
      trend *= -1;
      trendStrength = 0.4 + Math.random() * 0.4;
    }
    if (Math.random() < 0.1) {
      volatility = 0.005 + Math.random() * 0.015;
    }

    const trendBias = trend * trendStrength * volatility * price;
    const noise = (Math.random() - 0.5) * volatility * price * 2;
    const move = trendBias + noise;

    const open = price;
    const close = price + move;
    const bodySize = Math.abs(close - open);
    const upperWick = Math.random() * bodySize * 1.5;
    const lowerWick = Math.random() * bodySize * 1.5;

    const high = Math.max(open, close) + upperWick;
    const low = Math.min(open, close) - lowerWick;

    const baseVolume = 50 + Math.random() * 50;
    const volumeSpike = Math.abs(move) > volatility * price ? 1.5 : 1;
    const volume = baseVolume * volumeSpike;

    candles.push({ open, high, low, close, volume });
    price = close;
  }

  return candles;
}

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

// Memoized to prevent parent re-renders
export const CandlestickChart = memo(function CandlestickChart({ className }: CandlestickChartProps) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  const isVisible = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate candles only on client-side to avoid hydration mismatch
  useEffect(() => {
    setCandles(generateRealisticCandles(32));
    setMounted(true);
  }, []);

  // Intersection Observer - pause when not visible
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible.current = entry.isIntersecting;
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Add new candle periodically - SLOWER interval on mobile
  useEffect(() => {
    const intervalDuration = isMobile ? 2500 : 1200;

    const interval = setInterval(() => {
      if (!isVisible.current) return;

      setCandles(prev => {
        const lastCandle = prev[prev.length - 1];
        const price = lastCandle.close;

        const trend = lastCandle.close > lastCandle.open ? 1 : -1;
        const momentum = Math.random() < 0.7;
        const breakout = Math.random() < 0.15;
        const direction = momentum ? trend : -trend;

        const baseVolatility = 0.012;
        const volatility = breakout ? baseVolatility * 2.5 : baseVolatility;
        const move = direction * (Math.random() * volatility * price) + (Math.random() - 0.5) * volatility * price * 0.5;

        const open = price;
        const close = price + move;
        const bodySize = Math.abs(close - open);
        const wickMultiplier = breakout ? 2 : 1.2;
        const high = Math.max(open, close) + Math.random() * bodySize * wickMultiplier;
        const low = Math.min(open, close) - Math.random() * bodySize * wickMultiplier;
        const volume = breakout ? 100 + Math.random() * 100 : 40 + Math.random() * 60;

        return [...prev.slice(1), { open, high, low, close, volume }];
      });
    }, intervalDuration);

    return () => clearInterval(interval);
  }, [isMobile]);

  const sma = useMemo(() => calculateSMA(candles, 7), [candles]);

  const { chartMin, chartMax, chartRange, maxVolume } = useMemo(() => {
    const prices = candles.flatMap(c => [c.high, c.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const padding = priceRange * 0.1;
    return {
      chartMin: minPrice - padding,
      chartMax: maxPrice + padding,
      chartRange: (maxPrice + padding) - (minPrice - padding),
      maxVolume: Math.max(...candles.map(c => c.volume)),
    };
  }, [candles]);

  const priceToY = useCallback((price: number, height: number) => {
    return height - ((price - chartMin) / chartRange) * height;
  }, [chartMin, chartRange]);

  const candleWidth = 100 / (candles.length || 1);
  const bodyWidth = candleWidth * 0.7;

  // Render placeholder until mounted to avoid hydration mismatch
  if (!mounted || candles.length === 0) {
    return <div ref={containerRef} className={`relative w-full h-full ${className}`} />;
  }

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={COLORS.grid} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <svg className="absolute top-0 left-0 right-0" style={{ height: '75%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
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
              <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={color} strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
              <rect x={x - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} stroke={color} strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </svg>

      <svg className="absolute bottom-0 left-0 right-0" style={{ height: '20%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
        {candles.map((candle, i) => {
          const x = i * candleWidth + candleWidth / 2;
          const isBullish = candle.close >= candle.open;
          const height = (candle.volume / maxVolume) * 80;
          return (
            <rect key={i} x={x - bodyWidth / 2} y={100 - height} width={bodyWidth} height={height} fill={isBullish ? COLORS.volume.bull : COLORS.volume.bear} />
          );
        })}
      </svg>

      <div className="absolute top-1 right-1 text-[9px] font-mono text-white/30">{chartMax.toFixed(2)}</div>
      <div className="absolute right-1 text-[9px] font-mono text-white/30" style={{ top: '70%' }}>{chartMin.toFixed(2)}</div>

      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#26a69a] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#26a69a]"></span>
        </span>
        <span className="text-[9px] font-mono text-white/50 uppercase tracking-wider">Live</span>
      </div>

      <div className="absolute top-2 right-2 flex items-center gap-1">
        <div className="w-3 h-[2px] rounded" style={{ backgroundColor: COLORS.sma }} />
        <span className="text-[8px] font-mono text-white/30">SMA 7</span>
      </div>
    </div>
  );
});


// ============================================
// WIN RATE DONUT CHART
// ============================================

interface WinRateChartProps {
  percentage?: number;
  className?: string;
}

export const WinRateChart = memo(function WinRateChart({ percentage = 87, className }: WinRateChartProps) {
  const [currentValue, setCurrentValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasAnimated) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          const duration = 2000;
          const startTime = Date.now();

          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCurrentValue(Math.round(eased * percentage));

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              setHasAnimated(true);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [percentage, hasAnimated]);

  const data = [{ name: "Win Rate", value: currentValue, fill: COLORS.bullish }];

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <div className="absolute inset-0 opacity-50" style={{
        backgroundImage: `linear-gradient(${COLORS.grid} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.grid} 1px, transparent 1px)`,
        backgroundSize: '30px 30px',
      }} />

      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="85%" barSize={8} data={data} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: "rgba(255,255,255,0.05)" }} dataKey="value" cornerRadius={4} isAnimationActive={false} fill={COLORS.bullish} />
        </RadialBarChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl md:text-5xl font-serif font-medium tracking-tight" style={{ color: COLORS.champagne }}>{currentValue}%</span>
        <span className="text-[10px] text-white/40 font-mono uppercase tracking-[0.25em] mt-1">Win Rate</span>
      </div>
    </div>
  );
});


// ============================================
// LIVE SIGNAL PULSE
// ============================================

interface Signal {
  id: number;
  type: "long" | "short";
  strength: number;
  active: boolean;
}

interface SignalPulseProps {
  className?: string;
}

export const SignalPulse = memo(function SignalPulse({ className }: SignalPulseProps) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  const isVisible = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate signals only on client-side to avoid hydration mismatch
  useEffect(() => {
    setSignals(Array.from({ length: 8 }, (_, i) => ({
      id: i,
      type: Math.random() > 0.35 ? "long" : "short",
      strength: 20 + Math.random() * 30,
      active: false,
    })));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(([entry]) => { isVisible.current = entry.isIntersecting; }, { threshold: 0.1 });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const intervalDuration = isMobile ? 1000 : 500;

    const interval = setInterval(() => {
      if (!isVisible.current) return;

      const idx = Math.floor(Math.random() * signals.length);
      const isLong = Math.random() > 0.35;

      setSignals(prev => prev.map((s, i) =>
        i === idx ? { ...s, active: true, type: isLong ? "long" : "short", strength: 60 + Math.random() * 40 } : s
      ));

      setTimeout(() => {
        setSignals(prev => prev.map((s, i) =>
          i === idx ? { ...s, active: false, strength: 25 + Math.random() * 25 } : s
        ));
      }, 500);
    }, intervalDuration);

    return () => clearInterval(interval);
  }, [signals.length, isMobile]);

  // Render placeholder until mounted to avoid hydration mismatch
  if (!mounted || signals.length === 0) {
    return <div ref={containerRef} className={`relative w-full h-full ${className}`} />;
  }

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <div className="absolute inset-0 opacity-50" style={{
        backgroundImage: `linear-gradient(${COLORS.grid} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.grid} 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
      }} />

      <div className="absolute inset-x-4 top-4 bottom-12 flex items-end justify-around gap-2">
        {signals.map((signal) => (
          <div key={signal.id} className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="w-full rounded-t transition-all duration-300 ease-out" style={{
              height: `${signal.strength}%`,
              backgroundColor: signal.active ? (signal.type === "long" ? COLORS.bullish : COLORS.bearish) : "rgba(255,255,255,0.08)",
              boxShadow: signal.active ? `0 0 20px ${signal.type === "long" ? COLORS.bullish : COLORS.bearish}60` : "none",
            }} />
            <div className="w-2 h-2 rounded-full mt-2 transition-all duration-300" style={{
              backgroundColor: signal.active ? (signal.type === "long" ? COLORS.bullish : COLORS.bearish) : "rgba(255,255,255,0.15)",
              boxShadow: signal.active ? `0 0 8px ${signal.type === "long" ? COLORS.bullish : COLORS.bearish}` : "none",
            }} />
          </div>
        ))}
      </div>

      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.bullish }} />
          <span className="text-[9px] font-mono text-white/50 uppercase tracking-wider">Long</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.bearish }} />
          <span className="text-[9px] font-mono text-white/50 uppercase tracking-wider">Short</span>
        </div>
      </div>
    </div>
  );
});


// ============================================
// MINI LINE CHART
// ============================================

interface MiniLineChartProps {
  className?: string;
}

export const MiniLineChart = memo(function MiniLineChart({ className }: MiniLineChartProps) {
  const [points, setPoints] = useState<number[]>([]);
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  const isVisible = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate points only on client-side to avoid hydration mismatch
  useEffect(() => {
    const arr: number[] = [];
    let value = 50;
    for (let i = 0; i < 40; i++) {
      const trend = i < 15 ? 1 : i < 25 ? -0.5 : 0.8;
      value += trend * 0.5 + (Math.random() - 0.5) * 4;
      value = Math.max(15, Math.min(85, value));
      arr.push(value);
    }
    setPoints(arr);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(([entry]) => { isVisible.current = entry.isIntersecting; }, { threshold: 0.1 });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const intervalDuration = isMobile ? 500 : 200;

    const interval = setInterval(() => {
      if (!isVisible.current) return;

      setPoints(prev => {
        const last = prev[prev.length - 1];
        const trend = last > 65 ? -0.8 : last < 35 ? 0.8 : 0;
        const momentum = Math.random() < 0.2 ? (Math.random() - 0.5) * 8 : 0;
        let newVal = last + trend + (Math.random() - 0.48) * 4 + momentum;
        newVal = Math.max(10, Math.min(90, newVal));
        return [...prev.slice(1), newVal];
      });
    }, intervalDuration);

    return () => clearInterval(interval);
  }, [isMobile]);

  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 100 - p;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [points]);

  const areaD = `${pathD} L 100 100 L 0 100 Z`;
  const isUp = points.length > 0 && points[points.length - 1] > points[0];
  const color = isUp ? COLORS.bullish : COLORS.bearish;

  // Render placeholder until mounted to avoid hydration mismatch
  if (!mounted || points.length === 0) {
    return <div ref={containerRef} className={`relative w-full h-full ${className}`} />;
  }

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <div className="absolute inset-0 opacity-50" style={{
        backgroundImage: `linear-gradient(${COLORS.grid} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.grid} 1px, transparent 1px)`,
        backgroundSize: '25px 25px',
      }} />

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#areaGradient)" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx="100" cy={100 - points[points.length - 1]} r="3" fill={color} className="animate-pulse" />
      </svg>
    </div>
  );
});
