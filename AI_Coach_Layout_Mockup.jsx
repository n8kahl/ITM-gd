import { useState, useEffect, useCallback } from "react";

// ─── Icon Components ───
const Icons = {
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Command: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>,
  Send: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>,
  Chart: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6v12"/><path d="M12 4v16"/><path d="M16 8v8"/><path d="M20 10v4"/><path d="M4 10v4"/></svg>,
  Table: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>,
  Bell: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  Book: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
  Target: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  Scan: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 12h8"/></svg>,
  Sun: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>,
  List: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><circle cx="3" cy="6" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="18" r="1"/></svg>,
  Globe: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>,
  Calendar: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>,
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  Settings: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
  Home: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>,
  ChevronUp: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m18 15-6-6-6 6"/></svg>,
  ChevronDown: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>,
  ArrowUp: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m18 15-6-6-6 6"/></svg>,
  ArrowDown: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>,
  Sparkle: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/></svg>,
  Maximize: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>,
  Zap: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
};

// ─── Mock Data ───
const LEVELS = [
  { name: "PMH", price: 6082, side: "resistance", strength: "strong" },
  { name: "PDH", price: 6068, side: "resistance", strength: "moderate" },
  { name: "R1 Pivot", price: 6055, side: "resistance", strength: "weak" },
  { name: "VWAP", price: 6042, side: "support", strength: "dynamic" },
  { name: "Pivot", price: 6035, side: "support", strength: "moderate" },
  { name: "PDL", price: 6018, side: "support", strength: "strong" },
  { name: "S1 Pivot", price: 6005, side: "support", strength: "weak" },
];

const CURRENT_PRICE = 6047.82;

const COMMAND_ITEMS = [
  { label: "SPX Chart", desc: "Live candlestick chart", icon: "Chart", category: "Analyze" },
  { label: "SPX Options Chain", desc: "Full Greeks & IV", icon: "Table", category: "Analyze" },
  { label: "Opportunity Scanner", desc: "Find setups now", icon: "Scan", category: "Analyze" },
  { label: "Trade Journal", desc: "Log & review trades", icon: "Book", category: "Portfolio" },
  { label: "Tracked Setups", desc: "Monitored positions", icon: "Target", category: "Portfolio" },
  { label: "Alerts", desc: "Price level alerts", icon: "Bell", category: "Monitor" },
  { label: "Morning Brief", desc: "Daily market briefing", icon: "Sun", category: "Research" },
  { label: "Macro Context", desc: "Economic calendar", icon: "Globe", category: "Research" },
  { label: "Earnings", desc: "Earnings calendar", icon: "Calendar", category: "Research" },
  { label: "LEAPS", desc: "Long-term options", icon: "Clock", category: "Portfolio" },
];

// ─── Simulated Candlestick Chart ───
function CandlestickChart() {
  const candles = [
    { o: 6030, h: 6042, l: 6025, c: 6038 },
    { o: 6038, h: 6045, l: 6032, c: 6033 },
    { o: 6033, h: 6048, l: 6030, c: 6046 },
    { o: 6046, h: 6055, l: 6040, c: 6042 },
    { o: 6042, h: 6050, l: 6035, c: 6048 },
    { o: 6048, h: 6058, l: 6044, c: 6044 },
    { o: 6044, h: 6052, l: 6038, c: 6050 },
    { o: 6050, h: 6062, l: 6048, c: 6055 },
    { o: 6055, h: 6060, l: 6045, c: 6048 },
    { o: 6048, h: 6054, l: 6040, c: 6052 },
    { o: 6052, h: 6058, l: 6046, c: 6046 },
    { o: 6046, h: 6055, l: 6042, c: 6053 },
    { o: 6053, h: 6060, l: 6048, c: 6050 },
    { o: 6050, h: 6056, l: 6044, c: 6048 },
    { o: 6048, h: 6052, l: 6038, c: 6040 },
    { o: 6040, h: 6050, l: 6036, c: 6048 },
    { o: 6048, h: 6058, l: 6045, c: 6055 },
    { o: 6055, h: 6065, l: 6050, c: 6060 },
    { o: 6060, h: 6068, l: 6055, c: 6052 },
    { o: 6052, h: 6056, l: 6042, c: 6048 },
  ];

  const minP = 6000, maxP = 6090, range = maxP - minP;
  const chartH = 320, chartW = 700;
  const padTop = 10, padBot = 10;
  const usableH = chartH - padTop - padBot;
  const yScale = (p) => padTop + usableH - ((p - minP) / range) * usableH;
  const candleW = 28, gap = 7;

  const levelLines = LEVELS.map((lv) => ({
    ...lv,
    y: yScale(lv.price),
  }));

  const priceY = yScale(CURRENT_PRICE);

  return (
    <svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id="gridFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
        </linearGradient>
      </defs>
      <rect width={chartW} height={chartH} fill="url(#gridFade)" rx="4" />

      {/* Grid lines */}
      {[6010, 6020, 6030, 6040, 6050, 6060, 6070, 6080].map((p) => (
        <line key={p} x1="40" x2={chartW - 10} y1={yScale(p)} y2={yScale(p)} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      ))}

      {/* Level lines */}
      {levelLines.map((lv, i) => (
        <g key={i}>
          <line x1="40" x2={chartW - 60} y1={lv.y} y2={lv.y}
            stroke={lv.side === "resistance" ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}
            strokeWidth="1" strokeDasharray="4,3" />
          <text x={chartW - 56} y={lv.y + 3} fontSize="8" fill={lv.side === "resistance" ? "rgba(239,68,68,0.6)" : "rgba(16,185,129,0.6)"} fontFamily="monospace">
            {lv.name}
          </text>
        </g>
      ))}

      {/* Candlesticks */}
      {candles.map((c, i) => {
        const x = 44 + i * (candleW + gap);
        const bullish = c.c >= c.o;
        const color = bullish ? "#10B981" : "#EF4444";
        const bodyTop = yScale(Math.max(c.o, c.c));
        const bodyBot = yScale(Math.min(c.o, c.c));
        const bodyH = Math.max(bodyBot - bodyTop, 1);
        return (
          <g key={i}>
            <line x1={x + candleW / 2} x2={x + candleW / 2} y1={yScale(c.h)} y2={yScale(c.l)} stroke={color} strokeWidth="1" />
            <rect x={x + 4} y={bodyTop} width={candleW - 8} height={bodyH} fill={bullish ? color : color} rx="1" opacity="0.9" />
          </g>
        );
      })}

      {/* Current price line */}
      <line x1="40" x2={chartW - 10} y1={priceY} y2={priceY} stroke="#10B981" strokeWidth="1.5" opacity="0.7" />
      <rect x="0" y={priceY - 9} width="40" height="18" rx="3" fill="#10B981" />
      <text x="20" y={priceY + 4} fontSize="9" fill="white" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
        {CURRENT_PRICE.toFixed(0)}
      </text>

      {/* Y-axis labels */}
      {[6010, 6030, 6050, 6070].map((p) => (
        <text key={p} x="4" y={yScale(p) + 3} fontSize="8" fill="rgba(255,255,255,0.25)" fontFamily="monospace">{p}</text>
      ))}
    </svg>
  );
}

// ─── Command Palette ───
function CommandPalette({ open, onClose, onSelect }) {
  const [query, setQuery] = useState("");

  const filtered = COMMAND_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.desc.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  const grouped = filtered.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "15vh",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(520px, 90vw)", background: "#0F172A",
        border: "1px solid rgba(16,185,129,0.2)", borderRadius: 16,
        boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(16,185,129,0.1)",
        overflow: "hidden",
      }}>
        {/* Search input */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <Icons.Search />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools, symbols, actions..."
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "white", fontSize: 15, fontFamily: "inherit",
            }}
          />
          <span style={{
            fontSize: 11, color: "rgba(255,255,255,0.25)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4,
            padding: "2px 6px",
          }}>ESC</span>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 360, overflowY: "auto", padding: "8px 6px" }}>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div style={{
                fontSize: 10, color: "rgba(255,255,255,0.3)",
                textTransform: "uppercase", letterSpacing: 1.2,
                padding: "10px 12px 4px",
              }}>{category}</div>
              {items.map((item) => {
                const Icon = Icons[item.icon] || Icons.Search;
                return (
                  <button key={item.label} onClick={() => { onSelect(item.label); onClose(); }} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", border: "none", borderRadius: 8,
                    background: "transparent", color: "white", cursor: "pointer",
                    textAlign: "left", transition: "background 0.15s",
                  }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(16,185,129,0.08)"}
                     onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: "rgba(16,185,129,0.1)", display: "flex",
                      alignItems: "center", justifyContent: "center",
                      color: "#10B981",
                    }}><Icon /></div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Floating AI Response Toast ───
function AIResponseCard({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{
      position: "absolute", bottom: 62, left: 16, right: 16,
      background: "rgba(15,23,42,0.95)", border: "1px solid rgba(16,185,129,0.15)",
      borderRadius: 12, padding: "14px 16px", backdropFilter: "blur(12px)",
      boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
      animation: "slideUp 0.3s ease-out",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
          <span style={{ fontSize: 11, color: "#10B981", fontWeight: 600 }}>AI Coach</span>
        </div>
        <button onClick={onDismiss} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.3)",
          cursor: "pointer", padding: 2,
        }}><Icons.X /></button>
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
        {message}
      </div>
      {/* Follow-up chips */}
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {["Show Chart", "Options Chain", "Set Alerts"].map((chip) => (
          <button key={chip} style={{
            padding: "4px 10px", borderRadius: 20, fontSize: 11,
            background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
            color: "#10B981", cursor: "pointer", transition: "all 0.15s",
          }}>{chip}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Level Ladder (Vertical) ───
function LevelLadder() {
  const sorted = [...LEVELS].sort((a, b) => b.price - a.price);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {sorted.map((lv, i) => {
        const isAbove = lv.price > CURRENT_PRICE;
        const dist = Math.abs(lv.price - CURRENT_PRICE).toFixed(1);
        const distPct = ((Math.abs(lv.price - CURRENT_PRICE) / CURRENT_PRICE) * 100).toFixed(2);
        const isNearest = i > 0 && sorted[i - 1].price > CURRENT_PRICE && lv.price <= CURRENT_PRICE;
        return (
          <div key={lv.name}>
            {isNearest && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 10px", margin: "2px 0",
                background: "rgba(16,185,129,0.1)", borderRadius: 6,
                border: "1px solid rgba(16,185,129,0.3)",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px rgba(16,185,129,0.5)" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#10B981", fontFamily: "monospace" }}>
                  {CURRENT_PRICE.toFixed(2)}
                </span>
                <span style={{ fontSize: 10, color: "rgba(16,185,129,0.6)", marginLeft: "auto" }}>CURRENT</span>
              </div>
            )}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "5px 10px", borderRadius: 4,
              transition: "background 0.15s", cursor: "pointer",
            }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
               onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <div style={{
                width: 3, height: 16, borderRadius: 2,
                background: isAbove ? "rgba(239,68,68,0.5)" : "rgba(16,185,129,0.5)",
              }} />
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: isAbove ? "rgba(239,68,68,0.7)" : "rgba(16,185,129,0.7)",
                width: 60,
              }}>{lv.name}</span>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "rgba(255,255,255,0.6)" }}>
                {lv.price}
              </span>
              <span style={{
                fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: "auto",
              }}>{dist}pts ({distPct}%)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Overnight Gap Card ───
function OvernightGapCard() {
  const gapPts = 12.5;
  const atr = 42;
  const ratio = gapPts / atr;
  const barW = Math.min(ratio * 100, 100);
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10, padding: "12px 14px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.8 }}>
          Overnight Gap
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Icons.ArrowUp />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#10B981", fontFamily: "monospace" }}>
            +{gapPts} pts
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{
          flex: 1, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3,
          overflow: "hidden",
        }}>
          <div style={{
            width: `${barW}%`, height: "100%", borderRadius: 3,
            background: ratio < 0.5 ? "#10B981" : ratio < 0.8 ? "#F59E0B" : "#EF4444",
          }} />
        </div>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
          {(ratio * 100).toFixed(0)}% ATR
        </span>
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
        Gap = {ratio.toFixed(2)}x ATR ({atr}pts) &middot; 67% of similar gaps fill by 11am
      </div>
    </div>
  );
}

// ─── Main App ───
export default function AICoachMockup() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [activeView, setActiveView] = useState("chart");
  const [chatExpanded, setChatExpanded] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [aiResponse, setAiResponse] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState("dashboard");
  const [selectedGroup, setSelectedGroup] = useState("Analyze");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSend = useCallback(() => {
    if (!chatInput.trim()) return;
    const q = chatInput;
    setChatInput("");
    setChatExpanded(false);
    setTimeout(() => {
      setAiResponse(
        `SPX is trading at 6,047.82, up +12.50 from yesterday's close. Currently above VWAP (6,042) and Pivot (6,035) in positive gamma territory. PDH resistance at 6,068 is the key level to watch. The overnight gap of +12.5 pts (0.30x ATR) suggests room to run.`
      );
    }, 800);
  }, [chatInput]);

  const navGroups = [
    { name: "Analyze", items: [
      { id: "chart", label: "Chart", icon: Icons.Chart },
      { id: "options", label: "Options", icon: Icons.Table },
      { id: "scanner", label: "Scanner", icon: Icons.Scan },
    ]},
    { name: "Portfolio", items: [
      { id: "journal", label: "Journal", icon: Icons.Book },
      { id: "tracked", label: "Tracked", icon: Icons.Target },
      { id: "leaps", label: "LEAPS", icon: Icons.Clock },
    ]},
    { name: "Monitor", items: [
      { id: "alerts", label: "Alerts", icon: Icons.Bell },
      { id: "watchlist", label: "Watchlist", icon: Icons.List },
    ]},
    { name: "Research", items: [
      { id: "brief", label: "Brief", icon: Icons.Sun },
      { id: "macro", label: "Macro", icon: Icons.Globe },
      { id: "earnings", label: "Earnings", icon: Icons.Calendar },
    ]},
  ];

  // ─── MOBILE LAYOUT ───
  if (isMobile) {
    return (
      <div style={{
        height: "100vh", display: "flex", flexDirection: "column",
        background: "#080B11", color: "white", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflow: "hidden",
      }}>
        <style>{`
          @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
          @keyframes glow { 0%, 100% { box-shadow: 0 0 4px rgba(16,185,129,0.3); } 50% { box-shadow: 0 0 12px rgba(16,185,129,0.5); } }
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        `}</style>

        {/* Mobile Header */}
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "rgba(16,185,129,0.15)", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}><Icons.Zap /></div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#10B981" }}>AI Coach</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize: 10, padding: "3px 8px", borderRadius: 20,
              background: "rgba(16,185,129,0.1)", color: "#10B981",
              border: "1px solid rgba(16,185,129,0.2)",
            }}>LIVE SESSION</span>
          </div>
        </div>

        {/* Symbol Bar (Mobile) */}
        <div style={{
          padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>SPX</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: "white", fontFamily: "monospace" }}>6,047.82</span>
          <span style={{ fontSize: 12, color: "#10B981", fontWeight: 600 }}>+12.50 (+0.21%)</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {[Icons.Chart, Icons.Table, Icons.Bell].map((Icon, i) => (
              <button key={i} style={{
                width: 32, height: 32, borderRadius: 8,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.5)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><Icon /></button>
            ))}
          </div>
        </div>

        {/* Mobile Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
          {mobileTab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <OvernightGapCard />
              <div style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, padding: 4, overflow: "hidden",
              }}>
                <CandlestickChart />
              </div>
              <div style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, padding: "10px 12px",
              }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Key Levels</div>
                <LevelLadder />
              </div>
            </div>
          )}
          {mobileTab === "tools" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {navGroups.map((group) => (
                <div key={group.name}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{group.name}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {group.items.map((item) => (
                      <button key={item.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "14px 12px", borderRadius: 10,
                        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                        color: "white", cursor: "pointer", textAlign: "left",
                      }}>
                        <div style={{ color: "#10B981" }}><item.icon /></div>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile Chat Terminal */}
        <div style={{
          padding: "8px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(15,23,42,0.8)", backdropFilter: "blur(12px)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px", borderRadius: 12,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <Icons.Sparkle />
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask AI Coach anything..."
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "white", fontSize: 14,
              }}
            />
            <button onClick={handleSend} style={{
              width: 32, height: 32, borderRadius: 8,
              background: chatInput ? "#10B981" : "rgba(255,255,255,0.05)",
              border: "none", color: "white", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}><Icons.Send /></button>
          </div>
        </div>

        {/* Mobile Bottom Nav */}
        <div style={{
          display: "flex", borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "#080B11",
        }}>
          {[
            { id: "dashboard", label: "Dashboard", icon: Icons.Home },
            { id: "tools", label: "Tools", icon: Icons.Chart },
            { id: "chat", label: "Chat", icon: Icons.Sparkle },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setMobileTab(tab.id)} style={{
              flex: 1, padding: "10px 0 8px", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 3, background: "transparent", border: "none",
              color: mobileTab === tab.id ? "#10B981" : "rgba(255,255,255,0.3)",
              cursor: "pointer", transition: "color 0.15s",
            }}>
              <tab.icon />
              <span style={{ fontSize: 10, fontWeight: 500 }}>{tab.label}</span>
            </button>
          ))}
        </div>

        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onSelect={setActiveView} />
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ───
  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "#080B11", color: "white",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 4px rgba(16,185,129,0.3); } 50% { box-shadow: 0 0 12px rgba(16,185,129,0.5); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      {/* ─── Top Bar: Persistent Symbol Context ─── */}
      <div style={{
        height: 44, display: "flex", alignItems: "center", gap: 16,
        padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(15,23,42,0.5)", backdropFilter: "blur(12px)",
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(16,185,129,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "glow 3s ease-in-out infinite",
          }}>
            <Icons.Zap />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>AI Coach</span>
        </div>

        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />

        {/* Symbol Context Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>SPX</span>
          <span style={{ fontSize: 18, fontWeight: 600, fontFamily: "monospace", letterSpacing: -0.5 }}>
            6,047.82
          </span>
          <span style={{
            display: "flex", alignItems: "center", gap: 2,
            fontSize: 13, fontWeight: 600, color: "#10B981",
          }}>
            <Icons.ArrowUp />+12.50 (+0.21%)
          </span>
        </div>

        <div style={{
          padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
          background: "rgba(16,185,129,0.1)", color: "#10B981",
          border: "1px solid rgba(16,185,129,0.2)",
          animation: "pulse 2s ease-in-out infinite",
        }}>LIVE SESSION</div>

        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />

        {/* Quick symbol actions */}
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { icon: Icons.Chart, label: "Chart" },
            { icon: Icons.Table, label: "Options" },
            { icon: Icons.Bell, label: "Alert" },
          ].map((btn) => (
            <button key={btn.label} style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 11,
              background: activeView === btn.label.toLowerCase() ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)",
              border: activeView === btn.label.toLowerCase() ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(255,255,255,0.06)",
              color: activeView === btn.label.toLowerCase() ? "#10B981" : "rgba(255,255,255,0.5)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              transition: "all 0.15s",
            }} onClick={() => setActiveView(btn.label.toLowerCase())}>
              <btn.icon />{btn.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Command Palette trigger */}
        <button onClick={() => setCmdOpen(true)} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 12px", borderRadius: 8,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13,
          transition: "all 0.15s",
        }}>
          <Icons.Search />
          <span>Search tools & symbols</span>
          <span style={{
            fontSize: 10, padding: "1px 5px", borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.25)",
            display: "flex", alignItems: "center", gap: 2,
          }}><Icons.Command /> K</span>
        </button>

        <button style={{
          width: 32, height: 32, borderRadius: 8,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.4)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Icons.Settings /></button>
      </div>

      {/* ─── Main Content Area ─── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* ─── Grouped Side Navigation ─── */}
        <div style={{
          width: 56, borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "8px 0", gap: 4, flexShrink: 0,
          background: "rgba(255,255,255,0.01)",
        }}>
          {/* Home */}
          <button onClick={() => setActiveView("home")} style={{
            width: 40, height: 40, borderRadius: 10, border: "none",
            background: activeView === "home" ? "rgba(16,185,129,0.12)" : "transparent",
            color: activeView === "home" ? "#10B981" : "rgba(255,255,255,0.3)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 8, transition: "all 0.15s",
          }}><Icons.Home /></button>

          <div style={{ width: 24, height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 4 }} />

          {/* Nav groups */}
          {navGroups.map((group) => (
            <div key={group.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, marginBottom: 8 }}>
              <span style={{ fontSize: 7, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {group.name.slice(0, 3)}
              </span>
              {group.items.map((item) => (
                <button key={item.id} onClick={() => setActiveView(item.id)} title={item.label} style={{
                  width: 40, height: 36, borderRadius: 8, border: "none",
                  background: activeView === item.id ? "rgba(16,185,129,0.12)" : "transparent",
                  color: activeView === item.id ? "#10B981" : "rgba(255,255,255,0.3)",
                  cursor: "pointer", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 2,
                  transition: "all 0.15s", position: "relative",
                }}>
                  <item.icon />
                  <span style={{ fontSize: 7, opacity: 0.7 }}>{item.label}</span>
                  {activeView === item.id && (
                    <div style={{
                      position: "absolute", left: -4, top: "50%", transform: "translateY(-50%)",
                      width: 3, height: 16, borderRadius: 2, background: "#10B981",
                    }} />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* ─── Center Panel (Full Width) ─── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

          {/* Chart / Main Visualization */}
          <div style={{ flex: 1, padding: 16, overflow: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, height: "100%" }}>
              {/* Main chart area */}
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12, padding: 12, display: "flex", flexDirection: "column",
              }}>
                {/* Chart toolbar */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                  paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>SPX</span>
                  {["1m", "5m", "15m", "1H", "1D"].map((tf) => (
                    <button key={tf} style={{
                      padding: "3px 8px", borderRadius: 4, fontSize: 11,
                      background: tf === "5m" ? "rgba(16,185,129,0.12)" : "transparent",
                      border: tf === "5m" ? "1px solid rgba(16,185,129,0.25)" : "1px solid transparent",
                      color: tf === "5m" ? "#10B981" : "rgba(255,255,255,0.35)",
                      cursor: "pointer",
                    }}>{tf}</button>
                  ))}
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
                    Gamma: <span style={{ color: "#10B981" }}>Positive</span> &middot; Flip: 6,020
                  </span>
                  <button style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.4)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}><Icons.Maximize /></button>
                </div>

                {/* Chart */}
                <div style={{ flex: 1, minHeight: 0 }}>
                  <CandlestickChart />
                </div>
              </div>

              {/* Right sidebar: Levels + Gap */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "auto" }}>
                <OvernightGapCard />

                <div style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10, padding: "10px 12px", flex: 1,
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    marginBottom: 8,
                  }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                      Key Levels
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
                      7 active
                    </span>
                  </div>
                  <LevelLadder />
                </div>

                {/* Quick AI summary */}
                <div style={{
                  background: "rgba(16,185,129,0.04)",
                  border: "1px solid rgba(16,185,129,0.1)",
                  borderRadius: 10, padding: "10px 12px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Icons.Sparkle />
                    <span style={{ fontSize: 10, color: "#10B981", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      AI Insight
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: 0 }}>
                    SPX holding above VWAP in positive gamma. PDH 6,068 is the magnet. Watch for rejection at R1 Pivot 6,055 for a fade setup.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Chat Terminal Bar (Bottom) ─── */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            {/* AI Response toast */}
            <AIResponseCard message={aiResponse} onDismiss={() => setAiResponse(null)} />

            {/* Chat input bar */}
            <div style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              padding: "8px 16px 10px",
              background: "rgba(15,23,42,0.6)", backdropFilter: "blur(12px)",
            }}>
              {/* Expanded chat history */}
              {chatExpanded && (
                <div style={{
                  maxHeight: 200, overflowY: "auto", marginBottom: 8,
                  padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.3)", marginTop: 6, flexShrink: 0 }} />
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                      Where is SPX relative to key levels?
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", marginTop: 6, flexShrink: 0 }} />
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                      SPX at 6,047.82 is above VWAP (6,042) and Pivot (6,035). Next resistance: R1 Pivot 6,055, then PDH 6,068...
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setChatExpanded(!chatExpanded)} style={{
                  background: "none", border: "none", color: "rgba(255,255,255,0.3)",
                  cursor: "pointer", padding: 4,
                }}>
                  {chatExpanded ? <Icons.ChevronDown /> : <Icons.ChevronUp />}
                </button>

                <div style={{
                  flex: 1, display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 14px", borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  transition: "border-color 0.15s",
                }}>
                  <Icons.Sparkle />
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    onFocus={() => setChatExpanded(true)}
                    placeholder="Ask AI Coach... (Cmd+K for tools)"
                    style={{
                      flex: 1, background: "transparent", border: "none", outline: "none",
                      color: "white", fontSize: 14, fontFamily: "inherit",
                    }}
                  />
                  <button onClick={handleSend} style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: chatInput ? "#10B981" : "rgba(255,255,255,0.05)",
                    border: "none", color: "white", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}><Icons.Send /></button>
                </div>
              </div>

              {/* Quick prompts */}
              <div style={{ display: "flex", gap: 6, marginTop: 8, paddingLeft: 36 }}>
                {["SPX Game Plan", "Best Setup Now", "Morning Brief", "SPX vs SPY"].map((prompt) => (
                  <button key={prompt} onClick={() => {
                    setChatInput(prompt);
                    handleSend();
                  }} style={{
                    padding: "4px 10px", borderRadius: 20, fontSize: 11,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.4)", cursor: "pointer",
                    transition: "all 0.15s",
                  }}>{prompt}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Command Palette overlay */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onSelect={setActiveView} />
    </div>
  );
}