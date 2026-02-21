import { useState, useEffect, useRef, useCallback } from "react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SPX COMMAND CENTER — SPATIAL HUD CONCEPT MOCKUP
// The Emerald Standard | TradeITM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ONYX = "#0A0A0B";
const EMERALD = "#10B981";
const CHAMPAGNE = "#F5EDCC";
const ROSE = "#FB7185";

// Simulated price data for the candlestick chart
function generateBars(count, basePrice) {
  const bars = [];
  let price = basePrice;
  for (let i = 0; i < count; i++) {
    const open = price;
    const volatility = Math.random() * 8 - 4;
    const close = open + volatility;
    const high = Math.max(open, close) + Math.random() * 3;
    const low = Math.min(open, close) - Math.random() * 3;
    bars.push({ open, close, high, low, time: i });
    price = close + (Math.random() - 0.5) * 2;
  }
  return bars;
}

// Key levels data
const LEVELS = [
  { price: 6012, label: "Call Wall", strength: "critical", type: "options", gex: 2800 },
  { price: 5998, label: "Zero Gamma", strength: "strong", type: "options", gex: 0 },
  { price: 5985, label: "VWAP", strength: "strong", type: "structural", gex: 400 },
  { price: 5972, label: "Fib 0.618", strength: "moderate", type: "fibonacci", gex: 200 },
  { price: 5960, label: "Cluster Zone", strength: "strong", type: "structural", gex: 1200 },
  { price: 5945, label: "Put Wall", strength: "critical", type: "options", gex: -1900 },
  { price: 5930, label: "Flip Point", strength: "moderate", type: "options", gex: -600 },
  { price: 5918, label: "SPY→SPX S1", strength: "moderate", type: "spy_derived", gex: -300 },
];

// Simulated AI coach insights
const AI_INSIGHTS = [
  { id: 1, price: 6012, timeIdx: 72, text: "Massive call wall — expect magnetic pull. Fade if rejected.", type: "resistance", action: "Fade Setup" },
  { id: 2, price: 5960, timeIdx: 45, text: "Cluster confluence zone. High-probability bounce if tested. Size in.", type: "support", action: "Stage Trade" },
  { id: 3, price: 5985, timeIdx: 60, text: "VWAP reclaim confirmed. Momentum shift bullish above this level.", type: "neutral", action: "Monitor" },
];

// Probability cone data
const CONE_POINTS = [
  { minutesForward: 15, high: 5998, low: 5978 },
  { minutesForward: 30, high: 6008, low: 5968 },
  { minutesForward: 60, high: 6022, low: 5954 },
  { minutesForward: 120, high: 6040, low: 5936 },
];

// ━━━ Candlestick Chart (SVG-based for mockup) ━━━
function CandlestickChart({ bars, width, height, priceRange, onPriceToY }) {
  const padding = { top: 20, bottom: 20, left: 0, right: 80 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barWidth = Math.max(2, chartW / bars.length - 1);

  const priceToY = useCallback((price) => {
    const ratio = (price - priceRange.min) / (priceRange.max - priceRange.min);
    return padding.top + chartH * (1 - ratio);
  }, [priceRange, chartH, padding.top]);

  useEffect(() => {
    if (onPriceToY) onPriceToY(priceToY);
  }, [priceToY, onPriceToY]);

  return (
    <g>
      {/* Grid lines */}
      {Array.from({ length: 8 }, (_, i) => {
        const price = priceRange.min + (priceRange.max - priceRange.min) * (i / 7);
        const y = priceToY(price);
        return (
          <g key={i}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            <text x={width - padding.right + 8} y={y + 3} fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="monospace">{price.toFixed(0)}</text>
          </g>
        );
      })}

      {/* Candles */}
      {bars.map((bar, i) => {
        const x = padding.left + (i / bars.length) * chartW + barWidth / 2;
        const bullish = bar.close >= bar.open;
        const color = bullish ? EMERALD : ROSE;
        const bodyTop = priceToY(Math.max(bar.open, bar.close));
        const bodyBot = priceToY(Math.min(bar.open, bar.close));
        const bodyH = Math.max(1, bodyBot - bodyTop);

        return (
          <g key={i}>
            <line x1={x} y1={priceToY(bar.high)} x2={x} y2={priceToY(bar.low)} stroke={color} strokeWidth={1} opacity={0.6} />
            <rect x={x - barWidth / 2} y={bodyTop} width={barWidth} height={bodyH} fill={bullish ? color : color} opacity={bullish ? 0.8 : 0.7} rx={0.5} />
          </g>
        );
      })}
    </g>
  );
}

// ━━━ GEX Ambient Glow Layer ━━━
function GEXAmbientGlow({ levels, priceToY, width }) {
  if (!priceToY) return null;

  return (
    <g>
      {levels.filter(l => Math.abs(l.gex) > 500).map((level, i) => {
        const y = priceToY(level.price);
        if (y === null || y === undefined) return null;
        const intensity = Math.min(0.12, Math.abs(level.gex) / 25000);
        const color = level.gex > 0 ? EMERALD : ROSE;

        return (
          <g key={i}>
            <rect x={0} y={y - 40} width={width} height={80} fill={color} opacity={intensity} filter="url(#gexBlur)" />
          </g>
        );
      })}
    </g>
  );
}

// ━━━ Topographic Price Ladder ━━━
function TopographicLadder({ levels, priceToY, currentPrice, height }) {
  if (!priceToY) return null;

  return (
    <div style={{ position: "absolute", right: 0, top: 0, width: 140, height: "100%", pointerEvents: "none" }}>
      {/* Current price laser */}
      {currentPrice && (
        <div style={{
          position: "absolute",
          right: 0,
          top: priceToY(currentPrice),
          width: "100%",
          height: 2,
          background: `linear-gradient(90deg, transparent, ${EMERALD}, ${EMERALD})`,
          boxShadow: `0 0 12px ${EMERALD}88, 0 0 4px ${EMERALD}`,
          zIndex: 5,
          transform: "translateY(-1px)",
        }} />
      )}

      {levels.map((level, i) => {
        const y = priceToY(level.price);
        if (y < 20 || y > height - 20) return null;

        const isCritical = level.strength === "critical";
        const isStrong = level.strength === "strong";
        const isBullish = level.gex >= 0;
        const color = isBullish ? EMERALD : ROSE;
        const blockHeight = isCritical ? 28 : isStrong ? 18 : 8;
        const opacity = isCritical ? 0.35 : isStrong ? 0.2 : 0.1;

        return (
          <div key={i} style={{
            position: "absolute",
            right: 0,
            top: y - blockHeight / 2,
            width: isCritical ? 130 : isStrong ? 100 : 60,
            height: blockHeight,
            pointerEvents: "auto",
            cursor: "pointer",
          }}>
            {/* Glowing block */}
            <div style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(90deg, transparent, ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')})`,
              borderRight: `2px solid ${color}${isCritical ? 'aa' : '55'}`,
              boxShadow: isCritical ? `0 0 20px ${color}33, inset 0 0 10px ${color}11` : "none",
              borderRadius: "4px 0 0 4px",
            }} />
            {/* Label */}
            <div style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}>
              <span style={{
                fontSize: 9,
                fontFamily: "monospace",
                color: `${color}cc`,
                fontWeight: isCritical ? 700 : 400,
              }}>
                {level.label}
              </span>
              <span style={{
                fontSize: 8,
                fontFamily: "monospace",
                color: "rgba(255,255,255,0.4)",
              }}>
                {level.price}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ━━━ Probability Cone SVG ━━━
function ProbabilityCone({ conePoints, priceToY, currentPrice, bars, width }) {
  if (!priceToY || !bars.length) return null;

  const chartRight = width - 80;
  const barSpacing = (width - 80) / bars.length;
  const startX = chartRight - 10;
  const startY = priceToY(currentPrice);

  const points = conePoints.map((pt, i) => ({
    x: startX + (i + 1) * barSpacing * 4,
    highY: priceToY(pt.high),
    lowY: priceToY(pt.low),
  }));

  // Build cone path
  const topPath = points.map(p => `${p.x},${p.highY}`).join(" L");
  const botPath = [...points].reverse().map(p => `${p.x},${p.lowY}`).join(" L");
  const pathD = `M${startX},${startY} L${topPath} L${botPath} Z`;

  return (
    <g>
      <defs>
        <linearGradient id="coneGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={EMERALD} stopOpacity="0.15" />
          <stop offset="100%" stopColor={EMERALD} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <path d={pathD} fill="url(#coneGrad)" stroke={EMERALD} strokeWidth={0.5} strokeOpacity={0.3} />
      {/* Center line (directional bias) */}
      <line x1={startX} y1={startY} x2={points[points.length - 1]?.x || startX} y2={priceToY((conePoints[conePoints.length - 1]?.high + conePoints[conePoints.length - 1]?.low) / 2)} stroke={CHAMPAGNE} strokeWidth={1} strokeOpacity={0.4} strokeDasharray="4 3" />
    </g>
  );
}

// ━━━ Spatial AI Coach Nodes ━━━
function SpatialCoachNode({ insight, priceToY, bars, chartWidth, expanded, onToggle }) {
  if (!priceToY || !bars.length) return null;

  const barSpacing = (chartWidth - 80) / bars.length;
  const x = Math.min(insight.timeIdx * barSpacing, chartWidth - 300);
  const y = priceToY(insight.price);
  if (y < 30 || y > 600) return null;

  const color = insight.type === "resistance" ? ROSE : insight.type === "support" ? EMERALD : CHAMPAGNE;

  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 40, pointerEvents: "auto" }}>
      {/* Connector line to price level */}
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }} width={1} height={1}>
        <line x1={0} y1={0} x2={chartWidth - 80 - x} y2={0} stroke={color} strokeWidth={0.5} strokeOpacity={0.2} strokeDasharray="2 4" />
      </svg>

      {/* Pulsing dot */}
      <div
        onClick={onToggle}
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: color,
          border: `2px solid ${ONYX}`,
          boxShadow: `0 0 12px ${color}66, 0 0 4px ${color}`,
          cursor: "pointer",
          transform: "translate(-7px, -7px)",
          animation: "pulse 2s ease-in-out infinite",
        }}
      />

      {/* Expanded card */}
      {expanded && (
        <div style={{
          position: "absolute",
          left: 20,
          top: -60,
          width: 260,
          padding: "14px 16px",
          background: "rgba(10,10,11,0.92)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 1px ${color}33`,
          zIndex: 50,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontFamily: "monospace", color: `${color}cc`, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              AI Coach
            </span>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.35)" }}>
              @ {insight.price}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.5, margin: 0 }}>
            {insight.text}
          </p>
          <button style={{
            marginTop: 10,
            padding: "6px 14px",
            fontSize: 10,
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            background: `${color}22`,
            border: `1px solid ${color}44`,
            borderRadius: 6,
            color: color,
            cursor: "pointer",
          }}>
            {insight.action}
          </button>
        </div>
      )}
    </div>
  );
}

// ━━━ SPX Header (Transparent HUD Overlay) ━━━
function SPXHeader({ price, regime, basis }) {
  return (
    <div style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 20px",
      background: "linear-gradient(180deg, rgba(10,10,11,0.85) 0%, rgba(10,10,11,0.4) 70%, transparent 100%)",
      backdropFilter: "blur(8px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: EMERALD, boxShadow: `0 0 8px ${EMERALD}88` }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "white", fontFamily: "serif", letterSpacing: "0.05em" }}>
            SPX COMMAND CENTER
          </span>
        </div>
        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />
        <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", color: "white" }}>
          {price.toFixed(2)}
        </span>
        <span style={{
          padding: "3px 10px",
          fontSize: 9,
          fontFamily: "monospace",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          background: regime === "Trending" ? `${EMERALD}22` : "rgba(234,179,8,0.15)",
          border: `1px solid ${regime === "Trending" ? `${EMERALD}44` : "rgba(234,179,8,0.3)"}`,
          borderRadius: 6,
          color: regime === "Trending" ? EMERALD : "#EAB308",
        }}>
          {regime}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Basis</div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.7)" }}>{basis}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Feed</div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: EMERALD }}>● LIVE</div>
        </div>
        <div style={{
          padding: "6px 12px",
          fontSize: 9,
          fontFamily: "monospace",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          background: `${EMERALD}15`,
          border: `1px solid ${EMERALD}33`,
          borderRadius: 8,
          color: EMERALD,
          cursor: "pointer",
        }}>
          ⌘K Commands
        </div>
      </div>
    </div>
  );
}

// ━━━ Action Strip (Bottom HUD) ━━━
function ActionStrip({ activeTimeframe, onTimeframeChange, showLevels, onToggleLevels, showCone, onToggleCone, showCoach, onToggleCoach }) {
  const timeframes = ["1m", "5m", "15m", "1h", "4h", "1D"];

  return (
    <div style={{
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 20px",
      background: "linear-gradient(0deg, rgba(10,10,11,0.85) 0%, rgba(10,10,11,0.4) 70%, transparent 100%)",
      backdropFilter: "blur(8px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {timeframes.map(tf => (
          <button key={tf} onClick={() => onTimeframeChange(tf)} style={{
            padding: "5px 10px",
            fontSize: 10,
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            background: activeTimeframe === tf ? `${EMERALD}20` : "rgba(255,255,255,0.03)",
            border: `1px solid ${activeTimeframe === tf ? `${EMERALD}44` : "rgba(255,255,255,0.08)"}`,
            borderRadius: 6,
            color: activeTimeframe === tf ? EMERALD : "rgba(255,255,255,0.5)",
            cursor: "pointer",
          }}>
            {tf}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {[
          { label: "Levels", active: showLevels, toggle: onToggleLevels, key: "L" },
          { label: "Cone", active: showCone, toggle: onToggleCone, key: "C" },
          { label: "Coach", active: showCoach, toggle: onToggleCoach, key: "A" },
        ].map(btn => (
          <button key={btn.label} onClick={btn.toggle} style={{
            padding: "5px 12px",
            fontSize: 10,
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            background: btn.active ? `${CHAMPAGNE}15` : "rgba(255,255,255,0.03)",
            border: `1px solid ${btn.active ? `${CHAMPAGNE}33` : "rgba(255,255,255,0.08)"}`,
            borderRadius: 6,
            color: btn.active ? CHAMPAGNE : "rgba(255,255,255,0.4)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}>
            {btn.label}
            <span style={{ fontSize: 8, opacity: 0.5, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 3, padding: "1px 4px" }}>{btn.key}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ━━━ Comparison Side-by-Side Mini ━━━
function ComparisonBadge({ view, onSwitch }) {
  return (
    <div style={{
      position: "absolute",
      top: 56,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 55,
      display: "flex",
      alignItems: "center",
      gap: 2,
      background: "rgba(10,10,11,0.9)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 8,
      padding: 3,
      backdropFilter: "blur(12px)",
    }}>
      {["spatial", "current"].map(v => (
        <button key={v} onClick={() => onSwitch(v)} style={{
          padding: "5px 14px",
          fontSize: 10,
          fontFamily: "monospace",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          background: view === v ? `${EMERALD}20` : "transparent",
          border: "none",
          borderRadius: 6,
          color: view === v ? EMERALD : "rgba(255,255,255,0.4)",
          cursor: "pointer",
          fontWeight: view === v ? 600 : 400,
        }}>
          {v === "spatial" ? "Spatial HUD (Proposed)" : "Panel Layout (Current)"}
        </button>
      ))}
    </div>
  );
}

// ━━━ Current Layout Mini Preview ━━━
function CurrentLayoutPreview() {
  return (
    <div style={{ width: "100%", height: "100%", background: ONYX, display: "flex", flexDirection: "column", padding: 12, gap: 8 }}>
      {/* Header */}
      <div style={{
        padding: "10px 16px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: EMERALD }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "white", fontFamily: "serif" }}>SPX COMMAND CENTER</span>
          <span style={{ fontSize: 16, fontFamily: "monospace", color: "white", marginLeft: 8 }}>5,988.42</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 9, padding: "2px 8px", background: `${EMERALD}15`, border: `1px solid ${EMERALD}33`, borderRadius: 4, color: EMERALD, fontFamily: "monospace" }}>TRENDING</span>
          <span style={{ fontSize: 9, padding: "2px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>⌘K</span>
        </div>
      </div>

      {/* Two panel layout */}
      <div style={{ flex: 1, display: "flex", gap: 6, minHeight: 0 }}>
        {/* Left panel - 60% */}
        <div style={{ flex: "0 0 60%", display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Chart card */}
          <div style={{
            flex: 1,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 10,
            display: "flex",
            flexDirection: "column",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Price + Levels</span>
              <div style={{ display: "flex", gap: 3 }}>
                {["1m", "5m", "15m"].map(tf => (
                  <span key={tf} style={{ fontSize: 8, padding: "2px 6px", background: tf === "1m" ? `${EMERALD}15` : "transparent", border: `1px solid ${tf === "1m" ? `${EMERALD}33` : "rgba(255,255,255,0.08)"}`, borderRadius: 3, color: tf === "1m" ? EMERALD : "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>{tf}</span>
                ))}
              </div>
            </div>
            {/* Mini chart representation */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: 8 }}>
              <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
                {/* Grid */}
                {[0.25, 0.5, 0.75].map(r => (
                  <line key={r} x1={0} y1={r * 200} x2={400} y2={r * 200} stroke="rgba(255,255,255,0.04)" />
                ))}
                {/* Fake candles */}
                {Array.from({ length: 60 }, (_, i) => {
                  const x = (i / 60) * 400;
                  const baseY = 100 + Math.sin(i * 0.15) * 40 + Math.sin(i * 0.05) * 20;
                  const h = 4 + Math.random() * 12;
                  const bullish = Math.random() > 0.45;
                  return (
                    <g key={i}>
                      <line x1={x + 3} y1={baseY - h * 1.5} x2={x + 3} y2={baseY + h * 1.5} stroke={bullish ? EMERALD : ROSE} strokeWidth={0.5} opacity={0.4} />
                      <rect x={x + 1} y={baseY - h / 2} width={5} height={h} fill={bullish ? EMERALD : ROSE} opacity={0.6} rx={0.5} />
                    </g>
                  );
                })}
                {/* Level lines */}
                <line x1={0} y1={60} x2={400} y2={60} stroke={EMERALD} strokeWidth={0.5} opacity={0.4} strokeDasharray="3 3" />
                <line x1={0} y1={140} x2={400} y2={140} stroke={ROSE} strokeWidth={0.5} opacity={0.4} strokeDasharray="3 3" />
              </svg>
            </div>
          </div>

          {/* Flow ticker */}
          <div style={{
            padding: "8px 10px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Flow</span>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: `${EMERALD}aa` }}>+2.4M Call Sweep 5980</span>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: `${ROSE}aa` }}>-1.1M Put Block 5950</span>
          </div>
        </div>

        {/* Resize handle */}
        <div style={{ width: 4, background: "rgba(255,255,255,0.04)", borderRadius: 4, cursor: "col-resize", flexShrink: 0 }} />

        {/* Right panel - 40% */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", minWidth: 0 }}>
          {/* Setup card */}
          <div style={{
            padding: 10,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
          }}>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Active Setups</span>
            <div style={{ marginTop: 6, padding: 8, background: `${EMERALD}08`, border: `1px solid ${EMERALD}22`, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, color: "white", fontWeight: 600 }}>Fade 6012 Wall</span>
                <span style={{ fontSize: 8, padding: "1px 6px", background: `${EMERALD}20`, borderRadius: 4, color: EMERALD, fontFamily: "monospace" }}>READY</span>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}>E: 6010</span>
                <span style={{ fontSize: 9, fontFamily: "monospace", color: `${EMERALD}aa` }}>T: 5985</span>
                <span style={{ fontSize: 9, fontFamily: "monospace", color: `${ROSE}aa` }}>S: 6018</span>
              </div>
            </div>
          </div>

          {/* AI Coach feed */}
          <div style={{
            flex: 1,
            padding: 10,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>AI Coach</span>
            <div style={{ flex: 1, overflowY: "auto", marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { text: "Massive call wall at 6012 — expect magnetic pull. Fade if rejected with confirmation.", color: ROSE },
                { text: "VWAP reclaim confirmed at 5985. Momentum shifting bullish above this level.", color: EMERALD },
                { text: "Cluster confluence at 5960. High-probability bounce zone if price reaches.", color: CHAMPAGNE },
              ].map((msg, i) => (
                <div key={i} style={{ padding: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, margin: 0 }}>{msg.text}</p>
                  <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                    <span style={{ fontSize: 8, padding: "2px 8px", background: `${msg.color}15`, border: `1px solid ${msg.color}33`, borderRadius: 4, color: msg.color, fontFamily: "monospace" }}>Stage Trade</span>
                    <span style={{ fontSize: 8, padding: "2px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>Details</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Level Matrix mini */}
          <div style={{
            padding: 10,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
          }}>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Level Matrix</span>
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                { source: "Call Wall", price: "6012", cat: "Options" },
                { source: "Zero Gamma", price: "5998", cat: "Options" },
                { source: "VWAP", price: "5985", cat: "Structural" },
                { source: "Put Wall", price: "5945", cat: "Options" },
              ].map((l, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{l.source}</span>
                  <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}>{l.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function SPXSpatialHUDMockup() {
  const [view, setView] = useState("spatial");
  const [showLevels, setShowLevels] = useState(true);
  const [showCone, setShowCone] = useState(true);
  const [showCoach, setShowCoach] = useState(true);
  const [timeframe, setTimeframe] = useState("1m");
  const [expandedInsight, setExpandedInsight] = useState(null);
  const [priceToYFn, setPriceToYFn] = useState(null);
  const [tick, setTick] = useState(0);

  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 900, height: 600 });

  const bars = useRef(generateBars(80, 5965)).current;
  const currentPrice = bars[bars.length - 1].close;
  const priceRange = {
    min: Math.min(...bars.map(b => b.low)) - 10,
    max: Math.max(...bars.map(b => b.high)) + 10,
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Simulate price ticking
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "l" || e.key === "L") setShowLevels(v => !v);
      if (e.key === "c" || e.key === "C") setShowCone(v => !v);
      if (e.key === "a" || e.key === "A") setShowCoach(v => !v);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div style={{
      width: "100%",
      height: "100vh",
      background: ONYX,
      position: "relative",
      overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: translate(-7px, -7px) scale(1); opacity: 1; }
          50% { transform: translate(-7px, -7px) scale(1.3); opacity: 0.7; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>

      <ComparisonBadge view={view} onSwitch={setView} />

      {view === "current" ? (
        <CurrentLayoutPreview />
      ) : (
        <>
          {/* Z-0: Full-bleed chart canvas */}
          <div ref={containerRef} style={{ position: "absolute", inset: 0 }}>
            {/* Vignette overlay */}
            <div style={{
              position: "absolute",
              inset: 0,
              boxShadow: "inset 0 0 150px rgba(0,0,0,0.8)",
              pointerEvents: "none",
              zIndex: 1,
            }} />

            <svg width={dims.width} height={dims.height} style={{ position: "absolute", inset: 0 }}>
              <defs>
                <filter id="gexBlur">
                  <feGaussianBlur stdDeviation="25" />
                </filter>
              </defs>

              {/* Z-10: GEX Ambient Glow */}
              <GEXAmbientGlow levels={LEVELS} priceToY={priceToYFn} width={dims.width} />

              {/* Z-0: Candlestick Chart */}
              <CandlestickChart
                bars={bars}
                width={dims.width}
                height={dims.height}
                priceRange={priceRange}
                onPriceToY={(fn) => setPriceToYFn(() => fn)}
              />

              {/* Z-20: Probability Cone */}
              {showCone && (
                <ProbabilityCone
                  conePoints={CONE_POINTS}
                  priceToY={priceToYFn}
                  currentPrice={currentPrice}
                  bars={bars}
                  width={dims.width}
                />
              )}
            </svg>

            {/* Z-30: Topographic Price Ladder (HTML overlay) */}
            {showLevels && (
              <TopographicLadder
                levels={LEVELS}
                priceToY={priceToYFn}
                currentPrice={currentPrice}
                height={dims.height}
              />
            )}

            {/* Z-40: AI Coach Spatial Nodes */}
            {showCoach && AI_INSIGHTS.map(insight => (
              <SpatialCoachNode
                key={insight.id}
                insight={insight}
                priceToY={priceToYFn}
                bars={bars}
                chartWidth={dims.width}
                expanded={expandedInsight === insight.id}
                onToggle={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}
              />
            ))}
          </div>

          {/* Z-50: Static HUD */}
          <SPXHeader price={currentPrice + (tick % 2 === 0 ? 0.15 : -0.08)} regime="Trending" basis="+4.2" />
          <ActionStrip
            activeTimeframe={timeframe}
            onTimeframeChange={setTimeframe}
            showLevels={showLevels}
            onToggleLevels={() => setShowLevels(v => !v)}
            showCone={showCone}
            onToggleCone={() => setShowCone(v => !v)}
            showCoach={showCoach}
            onToggleCoach={() => setShowCoach(v => !v)}
          />
        </>
      )}

      {/* Analysis badge */}
      <div style={{
        position: "absolute",
        bottom: 52,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 55,
        padding: "6px 16px",
        background: "rgba(10,10,11,0.9)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span style={{ fontSize: 9, fontFamily: "monospace", color: CHAMPAGNE, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Concept Mockup
        </span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>|</span>
        <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.4)" }}>
          Toggle layers with L / C / A keys
        </span>
      </div>
    </div>
  );
}
