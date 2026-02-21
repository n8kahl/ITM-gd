import React, { useState, useEffect, useRef } from "react";
import { Mic, Paperclip, Command, Crosshair, ArrowUpRight, Send, X, Zap, TrendingUp, Target, Eye, ChevronRight, Volume2 } from "lucide-react";

// ─── Color Constants ───
const EMERALD = "#10B981";
const CHAMPAGNE = "#F3E5AB";
const DARK_BG = "#0A0A0B";

// ─── Mock Candlestick Data ───
const CANDLES = [
  { o: 5875, h: 5892, l: 5868, c: 5885, vol: 1.0, bull: true },
  { o: 5885, h: 5898, l: 5880, c: 5890, vol: 0.7, bull: true },
  { o: 5890, h: 5895, l: 5870, c: 5872, vol: 1.3, bull: false },
  { o: 5872, h: 5880, l: 5860, c: 5865, vol: 0.9, bull: false },
  { o: 5865, h: 5878, l: 5858, c: 5876, vol: 1.1, bull: true },
  { o: 5876, h: 5910, l: 5874, c: 5905, vol: 2.4, bull: true },  // volume climax
  { o: 5905, h: 5915, l: 5900, c: 5912, vol: 1.5, bull: true },
  { o: 5912, h: 5920, l: 5895, c: 5898, vol: 1.2, bull: false },
  { o: 5898, h: 5908, l: 5890, c: 5905, vol: 0.8, bull: true },
  { o: 5905, h: 5918, l: 5902, c: 5915, vol: 1.0, bull: true },
  { o: 5915, h: 5922, l: 5905, c: 5908, vol: 0.6, bull: false },
  { o: 5908, h: 5930, l: 5906, c: 5928, vol: 1.8, bull: true },
];

const TIMES = ["9:30", "9:35", "9:40", "9:45", "9:50", "9:55", "10:00", "10:05", "10:10", "10:15", "10:20", "10:25"];

// ─── Subcomponents ───

function CandlestickChart({ highlightIndex, onCandleHover }) {
  const minPrice = 5850;
  const maxPrice = 5940;
  const range = maxPrice - minPrice;
  const chartH = 400;
  const chartW = 720;
  const candleW = 42;
  const gap = 18;

  const priceToY = (p) => chartH - ((p - minPrice) / range) * chartH;
  const priceLevels = [5860, 5880, 5900, 5920, 5940];

  return (
    <svg width={chartW} height={chartH + 40} className="overflow-visible">
      {/* Grid lines */}
      {priceLevels.map((p) => (
        <g key={p}>
          <line x1={0} y1={priceToY(p)} x2={chartW} y2={priceToY(p)} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          <text x={chartW + 8} y={priceToY(p) + 4} fill="rgba(255,255,255,0.2)" fontSize={9} fontFamily="monospace">{p}</text>
        </g>
      ))}
      {/* VWAP line */}
      <line x1={0} y1={priceToY(5890)} x2={chartW} y2={priceToY(5890)} stroke={`${CHAMPAGNE}33`} strokeWidth={1} strokeDasharray="6 4" />
      <text x={chartW + 8} y={priceToY(5890) + 4} fill={CHAMPAGNE} fontSize={8} fontFamily="monospace" opacity={0.5}>VWAP</text>

      {/* Volume bars */}
      {CANDLES.map((c, i) => {
        const x = i * (candleW + gap) + gap;
        const volH = c.vol * 30;
        return (
          <rect key={`vol-${i}`} x={x + candleW * 0.15} y={chartH - volH} width={candleW * 0.7} height={volH}
            fill={c.bull ? `${EMERALD}15` : "rgba(239,68,68,0.08)"} rx={2} />
        );
      })}

      {/* Candles */}
      {CANDLES.map((c, i) => {
        const x = i * (candleW + gap) + gap;
        const bodyTop = priceToY(Math.max(c.o, c.c));
        const bodyBot = priceToY(Math.min(c.o, c.c));
        const bodyH = Math.max(bodyBot - bodyTop, 2);
        const wickTop = priceToY(c.h);
        const wickBot = priceToY(c.l);
        const color = c.bull ? EMERALD : "#EF4444";
        const isHighlight = i === highlightIndex;

        return (
          <g key={i} onMouseEnter={() => onCandleHover?.(i)} style={{ cursor: "crosshair" }}>
            {/* Highlight glow */}
            {isHighlight && (
              <>
                <rect x={x - 6} y={wickTop - 6} width={candleW + 12} height={wickBot - wickTop + 12}
                  fill="none" stroke={CHAMPAGNE} strokeWidth={1.5} rx={6} opacity={0.5}>
                  <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
                </rect>
                <rect x={x - 6} y={wickTop - 6} width={candleW + 12} height={wickBot - wickTop + 12}
                  fill={`${CHAMPAGNE}08`} rx={6} />
              </>
            )}
            {/* Wick */}
            <line x1={x + candleW / 2} y1={wickTop} x2={x + candleW / 2} y2={wickBot}
              stroke={color} strokeWidth={1.5} opacity={isHighlight ? 1 : 0.6} />
            {/* Body */}
            <rect x={x + candleW * 0.15} y={bodyTop} width={candleW * 0.7} height={bodyH}
              fill={c.bull ? color : color} stroke={color} strokeWidth={1} rx={2}
              opacity={isHighlight ? 1 : 0.7} />
            {/* Hover hitbox */}
            <rect x={x} y={0} width={candleW} height={chartH} fill="transparent" />
          </g>
        );
      })}

      {/* Time labels */}
      {TIMES.map((t, i) => {
        const x = i * (candleW + gap) + gap + candleW / 2;
        return (
          <text key={t} x={x} y={chartH + 20} fill="rgba(255,255,255,0.15)" fontSize={8} fontFamily="monospace" textAnchor="middle">{t}</text>
        );
      })}
    </svg>
  );
}

function AnchoredInsight({ visible, position }) {
  if (!visible) return null;
  const bubbleStyle = {
    position: "absolute",
    top: position.bubbleY,
    left: position.bubbleX,
    zIndex: 30,
  };

  return (
    <>
      {/* Bezier connector */}
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 25 }}>
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={CHAMPAGNE} stopOpacity={0.6} />
            <stop offset="100%" stopColor={CHAMPAGNE} stopOpacity={0.15} />
          </linearGradient>
        </defs>
        <path d={`M ${position.anchorX},${position.anchorY} C ${position.anchorX + 60},${position.anchorY - 20} ${position.bubbleX - 40},${position.bubbleY + 60} ${position.bubbleX + 10},${position.bubbleY + 60}`}
          fill="none" stroke="url(#lineGrad)" strokeWidth={1.5} strokeDasharray="5 5">
          <animate attributeName="stroke-dashoffset" from="10" to="0" dur="1s" repeatCount="indefinite" />
        </path>
        {/* Anchor dot */}
        <circle cx={position.anchorX} cy={position.anchorY} r={4} fill={CHAMPAGNE} opacity={0.8}>
          <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* Bubble */}
      <div style={bubbleStyle}>
        <div style={{
          background: `${DARK_BG}cc`,
          backdropFilter: "blur(24px)",
          border: `1px solid ${CHAMPAGNE}33`,
          borderRadius: 16,
          padding: "16px 18px",
          width: 290,
          boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${CHAMPAGNE}08`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: `${CHAMPAGNE}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={11} color={CHAMPAGNE} />
            </div>
            <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 2, color: CHAMPAGNE, fontWeight: 600 }}>AI Coach Insight</span>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, margin: 0 }}>
            <strong style={{ color: CHAMPAGNE }}>Volume climax detected</strong> at 9:55 — the wick rejects precisely at daily VWAP (5890). This is a high-conviction reversal signal with 2.4x average volume.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              background: `${EMERALD}18`, border: `1px solid ${EMERALD}40`, color: EMERALD,
              fontSize: 10, padding: "7px 0", borderRadius: 8, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 500,
            }}>
              <Crosshair size={12} /> Draft Trade
            </button>
            <button style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              background: `${CHAMPAGNE}10`, border: `1px solid ${CHAMPAGNE}25`, color: CHAMPAGNE,
              fontSize: 10, padding: "7px 0", borderRadius: 8, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 500,
            }}>
              <Target size={12} /> Add to Monitor
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function RadarBlip({ top, color, label, sublabel, active, delay }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: "relative" }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Blip */}
      <div style={{
        width: 10, height: 10, borderRadius: "50%", cursor: "pointer",
        background: color, boxShadow: `0 0 ${active ? 16 : 8}px ${color}`,
        opacity: active ? 1 : 0.4,
        animation: active ? "pulse 2s ease-in-out infinite" : "none",
        animationDelay: `${delay}s`,
      }} />

      {/* Ring */}
      {active && (
        <div style={{
          position: "absolute", top: -5, left: -5, width: 20, height: 20,
          borderRadius: "50%", border: `1px solid ${color}`,
          opacity: 0.3,
          animation: "ping 2s ease-out infinite",
          animationDelay: `${delay}s`,
        }} />
      )}

      {/* Hover card */}
      {hovered && (
        <div style={{
          position: "absolute", left: 24, top: "50%", transform: "translateY(-50%)",
          background: `${DARK_BG}dd`, backdropFilter: "blur(20px)",
          border: `1px solid ${color}40`, borderRadius: 12, padding: "12px 14px",
          width: 210, boxShadow: `0 12px 40px rgba(0,0,0,0.6)`, zIndex: 50,
        }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 2, color, marginBottom: 4, fontWeight: 600 }}>{label}</div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", margin: 0, lineHeight: 1.6 }}>{sublabel}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, color: `${color}aa`, fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>
            <ChevronRight size={10} /> Click to navigate
          </div>
        </div>
      )}
    </div>
  );
}

function ScreenshotLightbox({ visible, onClose }) {
  const [scanProgress, setScanProgress] = useState(0);
  const [pins, setPins] = useState([]);
  const [analysisText, setAnalysisText] = useState("");

  useEffect(() => {
    if (!visible) { setScanProgress(0); setPins([]); setAnalysisText(""); return; }
    const scanInterval = setInterval(() => {
      setScanProgress((p) => {
        if (p >= 100) { clearInterval(scanInterval); return 100; }
        return p + 2;
      });
    }, 40);
    const pinTimer1 = setTimeout(() => setPins((p) => [...p, { id: 1, x: "25%", y: "35%", label: "Entry: Aggressive — no confirmation candle" }]), 2200);
    const pinTimer2 = setTimeout(() => setPins((p) => [...p, { id: 2, x: "58%", y: "52%", label: "Stop too tight — below structure" }]), 3000);
    const pinTimer3 = setTimeout(() => setPins((p) => [...p, { id: 3, x: "78%", y: "28%", label: "Exit was optimal — captured 80% of move" }]), 3800);
    const textTimer = setTimeout(() => setAnalysisText("Trade grade: B+. Entry was slightly premature but your exit discipline saved the P&L. Consider waiting for a confirmation candle next time."), 4200);
    return () => { clearInterval(scanInterval); clearTimeout(pinTimer1); clearTimeout(pinTimer2); clearTimeout(pinTimer3); clearTimeout(textTimer); };
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 60,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ position: "relative", width: 640, animation: "floatUp 0.5s ease-out" }}>
        {/* Close */}
        <button onClick={onClose} style={{
          position: "absolute", top: -40, right: 0, background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 8px",
          color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 10,
        }}>
          <X size={12} /> ESC
        </button>

        {/* Screenshot container */}
        <div style={{
          position: "relative", width: "100%", aspectRatio: "16/10",
          background: `linear-gradient(135deg, ${DARK_BG}, #111114)`,
          borderRadius: 16, border: `1px solid rgba(255,255,255,0.1)`,
          overflow: "hidden", boxShadow: `0 40px 100px rgba(0,0,0,0.7), 0 0 60px ${CHAMPAGNE}05`,
          transform: "perspective(800px) rotateX(2deg)",
        }}>
          {/* Mock chart image */}
          <div style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
            <div style={{
              width: "100%", height: "100%",
              backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
              backgroundSize: "30px 30px",
            }} />
            {/* Mock candles in screenshot */}
            {[20, 28, 36, 44, 52, 60, 68, 76].map((left, i) => (
              <div key={i} style={{
                position: "absolute", left: `${left}%`, top: `${30 + Math.sin(i * 1.2) * 15}%`,
                width: 8, height: 30 + Math.random() * 30,
                background: i % 3 === 0 ? `${EMERALD}30` : "rgba(239,68,68,0.15)",
                border: `1px solid ${i % 3 === 0 ? EMERALD + "50" : "rgba(239,68,68,0.3)"}`,
                borderRadius: 2,
              }} />
            ))}
          </div>

          {/* Scan line */}
          {scanProgress < 100 && (
            <div style={{
              position: "absolute", top: `${scanProgress}%`, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, transparent, ${EMERALD}, transparent)`,
              boxShadow: `0 0 20px ${EMERALD}60`,
              transition: "top 0.04s linear",
            }} />
          )}

          {/* Pins */}
          {pins.map((pin) => (
            <div key={pin.id} style={{
              position: "absolute", left: pin.x, top: pin.y, transform: "translate(-50%, -50%)",
              animation: "pinDrop 0.3s ease-out",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: `${CHAMPAGNE}20`, border: `2px solid ${CHAMPAGNE}80`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, color: CHAMPAGNE,
                boxShadow: `0 0 12px ${CHAMPAGNE}30`,
              }}>
                {pin.id}
              </div>
              <div style={{
                position: "absolute", top: 28, left: "50%", transform: "translateX(-50%)",
                background: `${DARK_BG}ee`, border: `1px solid ${CHAMPAGNE}25`,
                borderRadius: 8, padding: "6px 10px", width: 160,
                fontSize: 10, color: "rgba(255,255,255,0.7)", lineHeight: 1.5,
                textAlign: "center", whiteSpace: "normal",
              }}>
                {pin.label}
              </div>
            </div>
          ))}
        </div>

        {/* Analysis text */}
        {analysisText && (
          <div style={{
            marginTop: 20, background: `${DARK_BG}cc`, backdropFilter: "blur(20px)",
            border: `1px solid ${EMERALD}25`, borderRadius: 12, padding: "14px 18px",
            animation: "fadeIn 0.5s ease-out",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Zap size={12} color={EMERALD} />
              <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 2, color: EMERALD, fontWeight: 600 }}>Trade Review Complete</span>
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", margin: 0, lineHeight: 1.7 }}>{analysisText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───

export default function AICoachSpatialHUD() {
  const [omniBarFocused, setOmniBarFocused] = useState(false);
  const [omniBarValue, setOmniBarValue] = useState("");
  const [showInsight, setShowInsight] = useState(true);
  const [showLightbox, setShowLightbox] = useState(false);
  const [hoveredCandle, setHoveredCandle] = useState(null);
  const inputRef = useRef(null);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOmniBarFocused(true);
      }
      if (e.key === "Escape") {
        setOmniBarFocused(false);
        setShowLightbox(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const insightPosition = {
    anchorX: 370, anchorY: 180,
    bubbleX: 500, bubbleY: 70,
  };

  return (
    <div style={{
      position: "relative", width: "100%", height: "100vh",
      background: DARK_BG, overflow: "hidden",
      color: "#e2e8f0", fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Global animations */}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes ping { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes floatUp { from { opacity: 0; transform: perspective(800px) rotateX(8deg) translateY(40px); } to { opacity: 1; transform: perspective(800px) rotateX(2deg) translateY(0); } }
        @keyframes pinDrop { from { opacity: 0; transform: translate(-50%, -80%); } to { opacity: 1; transform: translate(-50%, -50%); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scanPulse { 0%, 100% { box-shadow: 0 0 20px ${EMERALD}20; } 50% { box-shadow: 0 0 40px ${EMERALD}40; } }
        ::selection { background: ${EMERALD}40; }
        * { box-sizing: border-box; }
      `}</style>

      {/* ─── 1. INFINITE CANVAS ─── */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        {/* Grid */}
        <div style={{
          width: "100%", height: "100%", opacity: 0.5,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />
      </div>

      {/* ─── Chart Area ─── */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -55%)", zIndex: 10,
      }}>
        {/* Chart header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingLeft: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)", fontFamily: "monospace" }}>SPX</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: EMERALD, fontFamily: "monospace" }}>5,915.28</span>
          <span style={{ fontSize: 10, color: EMERALD, fontFamily: "monospace", background: `${EMERALD}15`, padding: "2px 8px", borderRadius: 4 }}>+0.42%</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "monospace", marginLeft: "auto" }}>5m • Feb 19 2026</span>
        </div>
        <CandlestickChart highlightIndex={5} onCandleHover={setHoveredCandle} />
      </div>

      {/* ─── 2. AMBIENT RADAR (Left Edge) ─── */}
      <div style={{ position: "absolute", top: "28%", left: 20, zIndex: 30, display: "flex", flexDirection: "column", gap: 28 }}>
        <RadarBlip color={EMERALD} label="NVDA • Setup Ready" sublabel="Approaching 145.00 Gap Fill with positive GEX divergence. Volume building on 15m." active={true} delay={0} />
        <RadarBlip color={CHAMPAGNE} label="AAPL • Watching" sublabel="Consolidating near 195 support. Waiting for catalyst." active={true} delay={0.5} />
        <RadarBlip color="#EF4444" label="TSLA • Alert" sublabel="Breakdown below 220 level. Momentum accelerating to downside." active={true} delay={1} />
        <RadarBlip color={EMERALD} label="QQQ • Regime Shift" sublabel="Transitioning from compression to expansion. Breakout imminent." active={false} delay={0} />
      </div>

      {/* ─── 3. ANCHORED INSIGHT ─── */}
      <AnchoredInsight visible={showInsight} position={insightPosition} />

      {/* ─── 4. STATUS BAR (Top) ─── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 40,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 24px",
        background: `linear-gradient(to bottom, ${DARK_BG}ee, transparent)`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `linear-gradient(135deg, ${EMERALD}20, ${EMERALD}05)`,
            border: `1px solid ${EMERALD}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Zap size={14} color={EMERALD} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>AI Coach</span>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: EMERALD, marginLeft: 4, boxShadow: `0 0 8px ${EMERALD}` }} />
          <span style={{ fontSize: 9, color: EMERALD, textTransform: "uppercase", letterSpacing: 1 }}>Active</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => setShowInsight(!showInsight)} style={{
            background: showInsight ? `${CHAMPAGNE}12` : "rgba(255,255,255,0.03)",
            border: `1px solid ${showInsight ? CHAMPAGNE + "30" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 8, padding: "5px 12px", cursor: "pointer",
            fontSize: 9, color: showInsight ? CHAMPAGNE : "rgba(255,255,255,0.4)",
            textTransform: "uppercase", letterSpacing: 1.5, display: "flex", alignItems: "center", gap: 6,
          }}>
            <Eye size={11} /> Insights {showInsight ? "On" : "Off"}
          </button>
          <button onClick={() => setShowLightbox(true)} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "5px 12px", cursor: "pointer",
            fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1.5,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Paperclip size={11} /> Screenshot Review
          </button>
        </div>
      </div>

      {/* ─── 5. THE OMNI-BAR ─── */}
      <div style={{
        position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
        zIndex: 50, width: 640,
      }}>
        {/* Suggestion chips */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 12 }}>
          {[
            { icon: <TrendingUp size={11} color={EMERALD} />, text: "Analyze current SPX regime" },
            { icon: <Paperclip size={11} color={CHAMPAGNE} />, text: "Review my last trade" },
            { icon: <Volume2 size={11} color="#EF4444" />, text: "Where is unusual volume?" },
          ].map((chip, i) => (
            <button key={i} onClick={() => { setOmniBarValue(chip.text); inputRef.current?.focus(); }} style={{
              background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20,
              padding: "6px 14px", cursor: "pointer", fontSize: 10,
              color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: 6,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
            >
              {chip.icon} {chip.text}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div style={{
          background: `${DARK_BG}cc`, backdropFilter: "blur(32px)",
          border: `1px solid ${omniBarFocused ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 18, padding: "6px 8px",
          boxShadow: `0 20px 60px rgba(0,0,0,0.5)${omniBarFocused ? `, 0 0 40px ${EMERALD}08` : ""}`,
          display: "flex", alignItems: "center", gap: 8,
          transition: "all 0.3s",
        }}>
          <button style={{
            padding: 8, color: "rgba(255,255,255,0.3)", cursor: "pointer",
            background: "none", border: "none", display: "flex",
          }}>
            <Paperclip size={18} />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={omniBarValue}
            onChange={(e) => setOmniBarValue(e.target.value)}
            onFocus={() => setOmniBarFocused(true)}
            onBlur={() => setOmniBarFocused(false)}
            placeholder="Ask AI Coach to analyze the chart, find setups, or review a trade..."
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: 13, color: "rgba(255,255,255,0.9)",
              fontWeight: 300, fontFamily: "'Inter', sans-serif",
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 4 }}>
            {omniBarValue ? (
              <button style={{
                background: EMERALD, border: "none", borderRadius: 10,
                padding: "7px 8px", cursor: "pointer", display: "flex",
              }}>
                <Send size={14} color="white" />
              </button>
            ) : (
              <>
                <button style={{ padding: 6, background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", display: "flex" }}>
                  <Mic size={15} />
                </button>
                <div style={{ height: 16, width: 1, background: "rgba(255,255,255,0.08)", margin: "0 2px" }} />
                <div style={{
                  display: "flex", alignItems: "center", gap: 3, fontSize: 10,
                  fontFamily: "monospace", border: "1px solid rgba(255,255,255,0.1)",
                  padding: "3px 7px", borderRadius: 6, background: "rgba(255,255,255,0.03)",
                  color: "rgba(255,255,255,0.25)",
                }}>
                  <Command size={10} /> K
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── SCREENSHOT LIGHTBOX ─── */}
      <ScreenshotLightbox visible={showLightbox} onClose={() => setShowLightbox(false)} />

      {/* ─── Vignette ─── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 45,
        boxShadow: "inset 0 -120px 160px rgba(0,0,0,0.8), inset 0 120px 160px rgba(0,0,0,0.4)",
      }} />
    </div>
  );
}
