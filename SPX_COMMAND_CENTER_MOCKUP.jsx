import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// SPX SNIPER COMMAND CENTER — REDESIGN MOCKUP
// ═══════════════════════════════════════════════════════════════

const MOCK = {
  spxPrice: 6836.17,
  spyPrice: 683.42,
  regime: "compression",
  direction: "bullish",
  confidence: 34,
  prediction: { bullish: 42, bearish: 28, neutral: 30 },
  basis: { current: 18.67, ema5: 18.67, ema20: 18.67, zscore: -1.0, trend: "stable" },
  flowEvents: [
    { id: "f1", symbol: "SPX", type: "block", strike: 6000, direction: "bullish", premium: 337584708, timestamp: "2026-02-16T19:30:00Z" },
    { id: "f2", symbol: "SPX", type: "sweep", strike: 6425, direction: "bearish", premium: 89619700, timestamp: "2026-02-16T19:28:00Z" },
    { id: "f3", symbol: "SPX", type: "sweep", strike: 6850, direction: "bullish", premium: 42300000, timestamp: "2026-02-16T19:25:00Z" },
    { id: "f4", symbol: "SPY", type: "block", strike: 684, direction: "bullish", premium: 18700000, timestamp: "2026-02-16T19:22:00Z" },
  ],
  setups: [
    {
      id: "s1", type: "fade_at_wall", direction: "bullish", regime: "compression", status: "ready",
      entryZone: { low: 6827.67, high: 6831.45 }, stop: 6825.92, target1: { price: 6836.17, label: "T1 GEX Wall" },
      target2: { price: 6848.98, label: "T2 Fib Ext" }, confluenceScore: 3, probability: 55,
      confluenceSources: ["gex_alignment", "regime_alignment", "fib_confluence"],
      recommendedContract: { description: "6830C 0DTE", strike: 6830, type: "call", riskReward: 2.4, bid: 4.20, ask: 4.80, maxLoss: 480, expectedPnlAtTarget1: 620, expectedPnlAtTarget2: 1150 },
    },
    {
      id: "s2", type: "mean_reversion", direction: "bearish", regime: "compression", status: "forming",
      entryZone: { low: 6888.67, high: 6891.45 }, stop: 6892.95, target1: { price: 6881.72, label: "T1 EMA" },
      target2: { price: 6864.99, label: "T2 Support" }, confluenceScore: 2, probability: 45,
      confluenceSources: ["regime_alignment", "volume_profile"],
      recommendedContract: null,
    },
    {
      id: "s3", type: "breakout_vacuum", direction: "bullish", regime: "compression", status: "triggered",
      entryZone: { low: 6833.00, high: 6837.50 }, stop: 6828.00, target1: { price: 6850.00, label: "T1 Vacuum" },
      target2: { price: 6872.00, label: "T2 Resistance" }, confluenceScore: 4, probability: 62,
      confluenceSources: ["gex_alignment", "flow_confirm", "fib_confluence", "basis_expansion"],
      recommendedContract: { description: "6840C 0DTE", strike: 6840, type: "call", riskReward: 3.1, bid: 2.80, ask: 3.20, maxLoss: 320, expectedPnlAtTarget1: 520, expectedPnlAtTarget2: 990 },
    },
  ],
  coachMessages: [
    { id: "c1", priority: "alert", content: "Risk reminder: 2 detected setup(s) are below 3/5 confluence. Skip weak signals and preserve capital for A+ structures.", timestamp: "2026-02-16T19:33:52Z" },
    { id: "c2", priority: "guidance", content: "Pre-trade brief: breakout vacuum at 6833–6837 | confluence 4/5 | stop 6828 | T1 6850 | T2 6872. Flow confirms 67%.", timestamp: "2026-02-16T19:33:52Z" },
    { id: "c3", priority: "behavioral", content: "Regime update: compression (34% confidence). Bias is bullish. Favor setups aligned with regime; avoid forcing counter-regime trades.", timestamp: "2026-02-16T19:33:52Z" },
  ],
  gex: { flipPoint: 6685, callWall: 6988.70, putWall: 6768.70, netGex: -6003731079 },
  clusterZones: [
    { id: "cz1", low: 6825, high: 6832, type: "fortress", score: 92, sources: 5 },
    { id: "cz2", low: 6848, high: 6855, type: "defended", score: 74, sources: 3 },
    { id: "cz3", low: 6618, high: 6619, type: "minor", score: 28, sources: 2 },
  ],
  probCone: [
    { min: 5, low: 6815.55, high: 6856.80 },
    { min: 10, low: 6801.80, high: 6870.55 },
    { min: 15, low: 6788.05, high: 6884.30 },
    { min: 30, low: 6760.55, high: 6911.80 },
  ],
};

// ─── Utility ───
function fmt(n) { return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtK(n) { const a = Math.abs(n); if (a >= 1e9) return `$${(n/1e9).toFixed(1)}B`; if (a >= 1e6) return `$${(n/1e6).toFixed(1)}M`; if (a >= 1e3) return `$${(n/1e3).toFixed(0)}K`; return `$${n}`; }

// ═══════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════

function SniperHeader() {
  const actionable = MOCK.setups.filter(s => s.status === "ready" || s.status === "triggered").length;
  const bullPrem = MOCK.flowEvents.filter(e => e.direction === "bullish").reduce((s,e) => s + e.premium, 0);
  const bearPrem = MOCK.flowEvents.filter(e => e.direction === "bearish").reduce((s,e) => s + e.premium, 0);
  const gross = bullPrem + bearPrem;
  const bullPct = gross > 0 ? Math.round((bullPrem / gross) * 100) : 50;

  return (
    <header style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(16,185,129,0.04) 100%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "16px 20px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: -60, top: -60, width: 180, height: 180, borderRadius: "50%", background: "rgba(16,185,129,0.08)", filter: "blur(40px)" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
        {/* Left: Price hero */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, letterSpacing: 2, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>SPX Command Center</span>
            <span style={{ fontSize: 9, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 99, padding: "2px 8px", color: "#6ee7b7", fontWeight: 600 }}>LIVE</span>
          </div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 700, color: "#f5f5f0", lineHeight: 1.1 }}>
            {MOCK.spxPrice.toLocaleString()}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>
            {actionable} setups actionable · {MOCK.regime} regime · {bullPct >= 60 ? `bullish pressure ${bullPct}%` : bullPct <= 40 ? `bearish pressure ${100-bullPct}%` : `balanced ${bullPct}%`}
          </div>
        </div>

        {/* Right: Posture + Key metrics compact grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 320 }}>
          {/* Market posture — single line hero */}
          <div style={{ background: "rgba(243,229,171,0.08)", border: "1px solid rgba(243,229,171,0.25)", borderRadius: 10, padding: "8px 12px" }}>
            <div style={{ fontSize: 9, letterSpacing: 1.5, color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>Market Posture</div>
            <div style={{ fontFamily: "monospace", fontSize: 14, color: "#F3E5AB", fontWeight: 600 }}>
              {MOCK.regime.toUpperCase()} {MOCK.direction.toUpperCase()} {MOCK.confidence}%
            </div>
          </div>

          {/* Compact 4-metric row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
            <MetricBox label="Basis" value={`+${MOCK.basis.current.toFixed(2)}`} color="#6ee7b7" />
            <MetricBox label="Z-Score" value={MOCK.basis.zscore.toFixed(2)} color={MOCK.basis.zscore < 0 ? "#fda4af" : "#6ee7b7"} />
            <MetricBox label="GEX Net" value={MOCK.gex.netGex > 0 ? "Support" : "Unstable"} color={MOCK.gex.netGex > 0 ? "#6ee7b7" : "#fda4af"} />
            <MetricBox label="Flip" value={MOCK.gex.flipPoint.toFixed(0)} color="rgba(255,255,255,0.7)" />
          </div>

          {/* Direction probability pills */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            <DirPill label="↑" pct={MOCK.prediction.bullish} color="emerald" />
            <DirPill label="↓" pct={MOCK.prediction.bearish} color="rose" />
            <DirPill label="↔" pct={MOCK.prediction.neutral} color="neutral" />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.5)", position: "relative", zIndex: 1 }}>
        <span style={{ color: "#6ee7b7" }}>⚡</span>
        <span>Sniper briefing active</span>
        <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
        <span>Pro Tier</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <StatusPill label="WS LIVE" active />
          <StatusPill label="SNAPSHOT 0s AGO" active />
        </div>
      </div>
    </header>
  );
}

function MetricBox({ label, value, color }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 8, letterSpacing: 1.2, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "monospace", fontSize: 13, color, fontWeight: 600, marginTop: 1 }}>{value}</div>
    </div>
  );
}

function DirPill({ label, pct, color }) {
  const colors = {
    emerald: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)", text: "#a7f3d0" },
    rose: { bg: "rgba(244,63,94,0.1)", border: "rgba(244,63,94,0.2)", text: "#fda4af" },
    neutral: { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)", text: "rgba(255,255,255,0.6)" },
  };
  const c = colors[color];
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6, padding: "4px 8px", textAlign: "center" }}>
      <span style={{ fontSize: 12, color: c.text }}>{label} {pct}%</span>
    </div>
  );
}

function StatusPill({ label, active }) {
  return (
    <span style={{
      fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase",
      background: active ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.05)",
      border: `1px solid ${active ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.15)"}`,
      borderRadius: 99, padding: "2px 8px",
      color: active ? "#6ee7b7" : "rgba(255,255,255,0.5)",
    }}>{label}</span>
  );
}

// ─── ACTION STRIP ───
function ActionStrip() {
  const alert = MOCK.coachMessages.find(m => m.priority === "alert");
  return (
    <div style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.02), rgba(16,185,129,0.03), rgba(243,229,171,0.04))", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "10px 14px" }}>
      {alert && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
          <span style={{ color: "#fda4af", fontSize: 14, flexShrink: 0 }}>⚠</span>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 1.2, color: "rgba(253,164,175,0.8)", textTransform: "uppercase", marginBottom: 2 }}>Top Coach Alert</div>
            <div style={{ fontSize: 13, color: "#ffe4e6" }}>{alert.content}</div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <Chip icon="✦" label="3 setups actionable" tone="emerald" />
        <Chip icon="◎" label="COMPRESSION BULLISH 34%" tone="champagne" />
        <Chip icon="●" label="Bullish pressure 67%" tone="emerald" />
        <Chip icon="⬡" label="GEX Unstable -6B" tone="rose" />
      </div>
    </div>
  );
}

function Chip({ icon, label, tone }) {
  const tones = {
    emerald: { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)", color: "#a7f3d0" },
    rose: { bg: "rgba(244,63,94,0.08)", border: "rgba(244,63,94,0.2)", color: "#fda4af" },
    champagne: { bg: "rgba(243,229,171,0.08)", border: "rgba(243,229,171,0.2)", color: "#F3E5AB" },
    neutral: { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" },
  };
  const t = tones[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 99, padding: "4px 10px", fontSize: 11, color: t.color }}>
      <span style={{ fontSize: 10 }}>{icon}</span> {label}
    </span>
  );
}

// ─── FLOW CONVICTION METER (compact) ───
function FlowConviction() {
  const bullPrem = MOCK.flowEvents.filter(e => e.direction === "bullish").reduce((s,e) => s + e.premium, 0);
  const bearPrem = MOCK.flowEvents.filter(e => e.direction === "bearish").reduce((s,e) => s + e.premium, 0);
  const gross = bullPrem + bearPrem;
  const bullPct = gross > 0 ? (bullPrem / gross) * 100 : 50;

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, background: "rgba(255,255,255,0.02)", padding: "8px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 9, letterSpacing: 1, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", flexShrink: 0 }}>Flow</span>
        <div style={{ flex: 1, height: 5, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 99, background: "rgba(16,185,129,0.6)", width: `${Math.max(5, Math.min(95, bullPct))}%` }} />
        </div>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#a7f3d0" }}>{fmtK(bullPrem)}</span>
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>|</span>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#fda4af" }}>{fmtK(bearPrem)}</span>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: 99, padding: "2px 8px", color: "#6ee7b7", textTransform: "uppercase" }}>
          FLOW CONFIRMS 67%
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
        {MOCK.flowEvents.slice(0, 4).map(e => (
          <span key={e.id} style={{
            display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "monospace", fontSize: 10,
            background: e.direction === "bullish" ? "rgba(16,185,129,0.06)" : "rgba(244,63,94,0.06)",
            border: `1px solid ${e.direction === "bullish" ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.2)"}`,
            borderRadius: 6, padding: "3px 6px",
            color: e.direction === "bullish" ? "#a7f3d0" : "#fda4af",
          }}>
            <span style={{ fontWeight: 600 }}>{e.symbol} {e.type.toUpperCase().slice(0,3)}</span>
            <span>{e.strike}</span>
            <span style={{ color: "rgba(255,255,255,0.35)" }}>{fmtK(e.premium)}</span>
            {Math.abs(e.strike - 6835) < 25 && <span style={{ color: "#F3E5AB", fontSize: 7 }}>●</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── SETUP CARD (with thermometer) ───
function SetupCard({ setup, selected, onClick }) {
  const entryMid = (setup.entryZone.low + setup.entryZone.high) / 2;
  const isBullish = setup.direction === "bullish";
  const rangeMin = isBullish ? setup.stop : setup.target2.price;
  const rangeMax = isBullish ? setup.target2.price : setup.stop;
  const span = Math.abs(rangeMax - rangeMin);
  const pct = (p) => Math.max(0, Math.min(100, ((p - rangeMin) / span) * 100));
  const pricePct = pct(MOCK.spxPrice);
  const inZone = MOCK.spxPrice >= setup.entryZone.low && MOCK.spxPrice <= setup.entryZone.high;
  const riskPts = Math.abs(entryMid - setup.stop);
  const rewardPts = Math.abs(setup.target1.price - entryMid);
  const rr = riskPts > 0 ? rewardPts / riskPts : 0;
  const distToEntry = Math.abs(MOCK.spxPrice - entryMid);

  const statusColors = {
    triggered: { border: "rgba(16,185,129,0.5)", bg: "rgba(16,185,129,0.08)", badge: "#6ee7b7", badgeBg: "rgba(16,185,129,0.2)" },
    ready: { border: "rgba(16,185,129,0.35)", bg: "rgba(16,185,129,0.04)", badge: "#a7f3d0", badgeBg: "rgba(16,185,129,0.12)" },
    forming: { border: "rgba(251,191,36,0.3)", bg: "rgba(251,191,36,0.03)", badge: "#fde68a", badgeBg: "rgba(251,191,36,0.12)" },
  };
  const sc = statusColors[setup.status] || statusColors.forming;

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", borderRadius: 12, padding: 12,
        border: `1px solid ${selected ? "rgba(16,185,129,0.6)" : sc.border}`,
        background: selected ? "rgba(16,185,129,0.1)" : sc.bg,
        boxShadow: selected ? "0 0 12px rgba(16,185,129,0.15)" : "none",
        cursor: "pointer", transition: "all 0.2s",
      }}
    >
      {/* Row 1: Direction + Badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f0", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {setup.direction} {setup.regime}
        </span>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", background: sc.badgeBg, border: `1px solid ${sc.border}`, borderRadius: 99, padding: "2px 8px", color: sc.badge }}>
          {setup.status}
        </span>
      </div>

      {/* Row 2: Type + Confluence score */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <span style={{ fontSize: 10, letterSpacing: 1, color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
          {setup.type.replace(/_/g, " ")}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          {[0,1,2,3,4].map(i => (
            <span key={i} style={{
              width: 8, height: 8, borderRadius: "50%",
              background: i < setup.confluenceScore ? "#10B981" : "rgba(255,255,255,0.12)",
              boxShadow: i < setup.confluenceScore ? "0 0 4px rgba(16,185,129,0.4)" : "none",
            }} />
          ))}
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.5)", marginLeft: 4 }}>{setup.confluenceScore}/5</span>
        </div>
      </div>

      {/* Row 3: Confluence source pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
        {setup.confluenceSources.map(src => (
          <span key={src} style={{
            fontSize: 8, letterSpacing: 0.7, textTransform: "uppercase",
            background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
            borderRadius: 99, padding: "2px 7px", color: "#a7f3d0",
          }}>
            {src.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      {/* Row 4: THERMOMETER */}
      <div style={{ marginTop: 10, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 10px" }}>
        <div style={{ position: "relative", height: 12, borderRadius: 99, background: "rgba(255,255,255,0.05)", overflow: "visible" }}>
          {/* Stop zone */}
          <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${pct(setup.entryZone.low)}%`, background: "rgba(244,63,94,0.2)", borderRadius: "99px 0 0 99px" }} />
          {/* Entry zone */}
          <div style={{
            position: "absolute", top: 0, height: "100%",
            left: `${pct(setup.entryZone.low)}%`,
            width: `${Math.max(2, pct(setup.entryZone.high) - pct(setup.entryZone.low))}%`,
            background: inZone ? "rgba(16,185,129,0.5)" : "rgba(16,185,129,0.2)",
            animation: inZone ? "pulse 2s infinite" : "none",
          }} />
          {/* T1 line */}
          <div style={{ position: "absolute", top: 0, left: `${pct(setup.target1.price)}%`, height: "100%", width: 2, background: "rgba(16,185,129,0.5)" }} />
          {/* T2 line */}
          <div style={{ position: "absolute", top: 0, left: `${pct(setup.target2.price)}%`, height: "100%", width: 2, background: "rgba(243,229,171,0.4)" }} />
          {/* Price marker */}
          <div style={{
            position: "absolute", top: "50%", left: `${pricePct}%`,
            transform: "translate(-50%, -50%)",
            width: 6, height: 18, borderRadius: 99,
            background: inZone ? "#10B981" : "#fff",
            border: `2px solid ${inZone ? "#6ee7b7" : "rgba(255,255,255,0.6)"}`,
            boxShadow: inZone ? "0 0 10px rgba(16,185,129,0.6)" : "0 0 6px rgba(255,255,255,0.3)",
          }} />
        </div>
        {/* Labels */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontFamily: "monospace", fontSize: 9 }}>
          <span style={{ color: "#fda4af" }}>{setup.stop.toFixed(0)}</span>
          <span style={{ color: "#a7f3d0" }}>Entry {entryMid.toFixed(0)}</span>
          <span style={{ color: "#6ee7b7" }}>T1 {setup.target1.price.toFixed(0)}</span>
          <span style={{ color: "#F3E5AB" }}>T2 {setup.target2.price.toFixed(0)}</span>
        </div>
      </div>

      {/* Row 5: 4 compact metric boxes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, marginTop: 8 }}>
        <MiniMetric label="R:R" value={rr.toFixed(1)} color="#a7f3d0" />
        <MiniMetric label="Win%" value={`${setup.probability}%`} color="#f5f5f0" />
        <MiniMetric label="Dist" value={distToEntry.toFixed(1)} color="#f5f5f0" />
        <MiniMetric label="Risk" value={riskPts.toFixed(1)} color="#fda4af" />
      </div>

      {/* Row 6: Inline contract preview (if exists) */}
      {setup.recommendedContract && (
        <div style={{ marginTop: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f0" }}>{setup.recommendedContract.description}</span>
            <span style={{ fontSize: 9, marginLeft: 6, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 99, padding: "1px 6px", color: "#6ee7b7" }}>AI PICK</span>
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 11, display: "flex", gap: 12 }}>
            <span style={{ color: "#a7f3d0" }}>R:R {setup.recommendedContract.riskReward.toFixed(1)}</span>
            <span style={{ color: "#fda4af" }}>Max -${setup.recommendedContract.maxLoss}</span>
          </div>
        </div>
      )}
    </button>
  );
}

function MiniMetric({ label, value, color }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: "4px 6px", textAlign: "center" }}>
      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
      <div style={{ fontFamily: "monospace", fontSize: 12, color, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

// ─── CLUSTER + PROB CONE (compact inline) ───
function DecisionContext() {
  const maxSpread = Math.max(...MOCK.probCone.map(p => p.high - p.low));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {/* Cluster zones */}
      <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, background: "rgba(255,255,255,0.02)", padding: "10px 12px" }}>
        <div style={{ fontSize: 10, letterSpacing: 1.2, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: 6 }}>Cluster Zones</div>
        {MOCK.clusterZones.map(z => (
          <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 99, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 99, background: z.type === "fortress" ? "rgba(16,185,129,0.5)" : z.type === "defended" ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.12)", width: `${z.score}%` }} />
            </div>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.6)", minWidth: 90 }}>{z.low}–{z.high}</span>
            <span style={{ fontSize: 8, letterSpacing: 0.6, textTransform: "uppercase", color: z.type === "fortress" ? "#6ee7b7" : "rgba(255,255,255,0.4)" }}>{z.type}</span>
          </div>
        ))}
      </div>

      {/* Probability cone compact */}
      <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, background: "rgba(255,255,255,0.02)", padding: "10px 12px" }}>
        <div style={{ fontSize: 10, letterSpacing: 1.2, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: 6 }}>Probability Cone</div>
        {MOCK.probCone.map(p => {
          const spread = p.high - p.low;
          const w = Math.max(15, (spread / maxSpread) * 100);
          return (
            <div key={p.min} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.4)", minWidth: 28 }}>{p.min}m</span>
              <div style={{ flex: 1, height: 6, borderRadius: 99, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, background: "rgba(16,185,129,0.35)", width: `${w}%` }} />
              </div>
              <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.5)", minWidth: 110, textAlign: "right" }}>{p.low.toFixed(0)} – {p.high.toFixed(0)}</span>
            </div>
          );
        })}
        {/* Setup target markers */}
        <div style={{ marginTop: 6, display: "flex", gap: 8, fontSize: 9, fontFamily: "monospace" }}>
          <span style={{ color: "#6ee7b7" }}>▲ T1 in 15m cone</span>
          <span style={{ color: "#F3E5AB" }}>▲ T2 in 30m cone</span>
        </div>
      </div>
    </div>
  );
}

// ─── AI COACH (compact with quick actions) ───
function CoachPanel() {
  const quickActions = ["Confirm entry?", "Risk check", "Exit strategy?", "Size guidance"];
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, background: "linear-gradient(135deg, rgba(255,255,255,0.02), rgba(243,229,171,0.03))", padding: "12px 14px" }}>
      <div style={{ fontSize: 11, letterSpacing: 1.5, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 8 }}>AI Coach</div>
      {/* Quick action buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        {quickActions.map(q => (
          <button key={q} style={{
            fontSize: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 6, padding: "4px 10px", color: "#a7f3d0", cursor: "pointer",
          }}>{q}</button>
        ))}
      </div>
      {/* Messages */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
        {MOCK.coachMessages.map(m => {
          const colors = { alert: { bg: "rgba(244,63,94,0.06)", border: "rgba(244,63,94,0.2)", label: "#fda4af" }, guidance: { bg: "rgba(16,185,129,0.04)", border: "rgba(16,185,129,0.15)", label: "#a7f3d0" }, behavioral: { bg: "rgba(243,229,171,0.04)", border: "rgba(243,229,171,0.15)", label: "#F3E5AB" } };
          const c = colors[m.priority] || colors.guidance;
          return (
            <div key={m.id} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: c.label }}>{m.priority}</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>7:33 PM</span>
              </div>
              <div style={{ fontSize: 12, color: "#f5f5f0", lineHeight: 1.5 }}>{m.content}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CONTRACT DETAIL (visual R:R bar) ───
function ContractDetail({ contract }) {
  if (!contract) return null;
  const total = contract.maxLoss + contract.expectedPnlAtTarget2;
  const lossWidth = total > 0 ? (contract.maxLoss / total) * 100 : 50;
  const spread = contract.ask > 0 ? ((contract.ask - contract.bid) / contract.ask * 100) : 0;
  const spreadHealth = spread < 10 ? "emerald" : spread < 20 ? "amber" : "rose";
  const spreadColors = { emerald: "#6ee7b7", amber: "#fde68a", rose: "#fda4af" };

  return (
    <div style={{ border: "1px solid rgba(16,185,129,0.25)", borderRadius: 12, background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))", padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f0" }}>{contract.description}</span>
        <span style={{ fontSize: 9, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 99, padding: "2px 8px", color: "#6ee7b7", fontWeight: 600 }}>AI PICK</span>
      </div>

      {/* Visual R:R bar */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 9, letterSpacing: 1, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 4 }}>Risk / Reward Profile</div>
        <div style={{ display: "flex", height: 20, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ width: `${lossWidth}%`, background: "rgba(244,63,94,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "#fda4af" }}>-${contract.maxLoss}</span>
          </div>
          <div style={{ width: `${100 - lossWidth}%`, background: "rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "space-around" }}>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "#a7f3d0" }}>T1 +${contract.expectedPnlAtTarget1}</span>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "#F3E5AB" }}>T2 +${contract.expectedPnlAtTarget2}</span>
          </div>
        </div>
      </div>

      {/* Compact metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginTop: 8 }}>
        <MiniMetric label="R:R" value={contract.riskReward.toFixed(1)} color="#a7f3d0" />
        <MiniMetric label="Spread" value={`${spread.toFixed(1)}%`} color={spreadColors[spreadHealth]} />
        <MiniMetric label="Bid" value={`$${contract.bid.toFixed(2)}`} color="#f5f5f0" />
        <MiniMetric label="Ask" value={`$${contract.ask.toFixed(2)}`} color="#f5f5f0" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN LAYOUT
// ═══════════════════════════════════════════════════════════════

export default function SPXCommandCenterMockup() {
  const [selectedId, setSelectedId] = useState("s3");
  const selectedSetup = MOCK.setups.find(s => s.id === selectedId);

  return (
    <div style={{ background: "#08090B", color: "#f5f5f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", minHeight: "100vh", padding: 16 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; }
        button { font-family: inherit; border: none; background: none; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      {/* TIER 1: Sniper Briefing */}
      <SniperHeader />
      <div style={{ height: 10 }} />
      <ActionStrip />
      <div style={{ height: 10 }} />

      {/* TIER 2: Battlefield — 60/40 split */}
      <div style={{ display: "grid", gridTemplateColumns: "60fr 40fr", gap: 10, minHeight: "65vh" }}>
        {/* LEFT: Chart + Flow + Context */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Chart placeholder */}
          <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, background: "rgba(255,255,255,0.02)", padding: 14, flex: 1, minHeight: 340, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, letterSpacing: 1.2, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Price + Focus Levels</span>
                <span style={{ fontSize: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99, padding: "2px 8px", color: "rgba(255,255,255,0.5)" }}>8/48 shown</span>
              </div>
              <button style={{ fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "4px 12px", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
                Open Level Matrix
              </button>
            </div>
            <div style={{ flex: 1, background: "linear-gradient(180deg, rgba(16,185,129,0.02), rgba(0,0,0,0.2))", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.25)" }}>[ TradingView Chart — 5m SPX ]</span>
            </div>
          </div>

          {/* Flow (compact) */}
          <FlowConviction />

          {/* Cluster zones + Prob cone — side by side, compact */}
          <DecisionContext />
        </div>

        {/* RIGHT: Setups + Contract + Coach */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Setup Feed */}
          <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, background: "rgba(255,255,255,0.02)", padding: "12px 14px" }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 8 }}>Setup Feed</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {MOCK.setups.map(s => (
                <SetupCard key={s.id} setup={s} selected={s.id === selectedId} onClick={() => setSelectedId(s.id)} />
              ))}
            </div>
          </div>

          {/* Contract (for selected) */}
          {selectedSetup?.recommendedContract && (
            <ContractDetail contract={selectedSetup.recommendedContract} />
          )}

          {/* AI Coach */}
          <CoachPanel />
        </div>
      </div>
    </div>
  );
}
