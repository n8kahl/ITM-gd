import { useState } from "react"

// ─── Mock Data ───
const MOCK = {
  spxPrice: 6042.17,
  spyPrice: 603.82,
  regime: "compression",
  basis: { current: 1.47, zscore: 0.82, leading: "SPX", trend: "expanding" },
  gexNet: -6200000000,
  flipPoint: 6055,
  prediction: { bullish: 42, bearish: 35, neutral: 23, confidence: 72 },
  actionableCount: 3,
  flowBias: { label: "Bullish pressure 67%", tone: "bullish" },
  setups: [
    {
      id: "s1",
      type: "Fade at Wall",
      direction: "bullish",
      status: "triggered",
      confluenceScore: 4,
      sources: ["GEX Wall", "Cluster", "Fib 0.618", "Flow"],
      entryLow: 6035,
      entryHigh: 6042,
      stop: 6018,
      t1: 6065,
      t2: 6090,
      rr: 2.8,
      winPct: 68,
      prob: 72,
    },
    {
      id: "s2",
      type: "Breakout Vacuum",
      direction: "bullish",
      status: "ready",
      confluenceScore: 3,
      sources: ["Vacuum Zone", "Cone", "Flow"],
      entryLow: 6055,
      entryHigh: 6060,
      stop: 6040,
      t1: 6085,
      t2: 6110,
      rr: 2.2,
      winPct: 61,
      prob: 58,
    },
  ],
  contract: {
    desc: "6050C 0DTE",
    rr: 2.8,
    delta: 0.42,
    gamma: 0.018,
    theta: -1.24,
    vega: 0.08,
    bid: 4.2,
    ask: 4.6,
    maxLoss: 460,
    t1Pnl: 820,
    t2Pnl: 1380,
    spreadPct: 8.7,
    reasoning: "Optimal delta for compression breakout. Spread is fair at 8.7%. R:R favors entry at current bid.",
  },
  flowEvents: [
    { dir: "bull", size: "$2.1M", desc: "6050C sweep", time: "10:42" },
    { dir: "bear", size: "$890K", desc: "6020P block", time: "10:38" },
    { dir: "bull", size: "$1.4M", desc: "6060C sweep", time: "10:35" },
    { dir: "bull", size: "$560K", desc: "6045C ask lift", time: "10:31" },
  ],
  clusters: [
    { range: "6035–6045", score: 4.2, type: "fortress", sources: 5, held: true, holdRate: 87, spyDerived: true },
    { range: "6015–6022", score: 3.1, type: "defended", sources: 3, held: null, holdRate: 62, spyDerived: false },
  ],
  fibs: [
    { ratio: "0.618", price: 6038, dist: -4.17, crossVal: true },
    { ratio: "0.5", price: 6028, dist: -14.17, crossVal: false },
    { ratio: "0.786", price: 6052, dist: +9.83, crossVal: true },
  ],
  cone: [
    { mins: 15, high: 6058, low: 6026 },
    { mins: 30, high: 6072, low: 6012 },
    { mins: 60, high: 6095, low: 5989 },
  ],
  coachMessages: [
    { id: "c1", priority: "alert", content: "Compression narrowing — breakout likely within 15m. GEX unstable below flip point amplifies move.", ts: "10:41 AM" },
    { id: "c2", priority: "setup", content: "Fade at Wall triggered. Flow confirms 67% bullish. Entry zone active.", ts: "10:38 AM" },
  ],
}

// ─── Styles ───
const S = {
  bg: "#0a0f0d",
  card: "rgba(255,255,255,0.025)",
  cardBorder: "rgba(255,255,255,0.07)",
  emerald: "#10B981",
  emeraldDim: "rgba(16,185,129,0.15)",
  champagne: "#F3E5AB",
  champagneDim: "rgba(243,229,171,0.08)",
  rose: "#FB7185",
  roseDim: "rgba(251,113,133,0.1)",
  amber: "#FBBF24",
  ivory: "#FDFCF5",
  textMuted: "rgba(255,255,255,0.45)",
  textDim: "rgba(255,255,255,0.3)",
  textFaint: "rgba(255,255,255,0.18)",
}

const glass = {
  background: `linear-gradient(135deg, ${S.card}, rgba(16,185,129,0.02))`,
  border: `1px solid ${S.cardBorder}`,
  borderRadius: 16,
  padding: 12,
}

const chip = (bg, border, color) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  borderRadius: 999,
  border: `1px solid ${border}`,
  background: bg,
  padding: "2px 8px",
  fontSize: 10,
  color,
})

const metricCell = {
  borderRadius: 8,
  border: `1px solid rgba(255,255,255,0.06)`,
  background: "rgba(0,0,0,0.25)",
  padding: "6px 10px",
  textAlign: "center",
}

// ─── Components ───

function Header() {
  const d = MOCK
  const gexPosture = d.gexNet >= 0 ? "Supportive" : "Unstable"
  const gexColor = d.gexNet >= 0 ? S.emerald : S.rose
  const flipDiff = d.spxPrice - d.flipPoint
  const basisLabel = Math.abs(d.basis.zscore) >= 2 ? "Extreme" : Math.abs(d.basis.zscore) >= 1 ? "Notable" : "Normal"

  return (
    <header style={{ ...glass, background: `linear-gradient(135deg, rgba(255,255,255,0.03), rgba(16,185,129,0.035))`, padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        {/* Left: Hero */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: 2, color: S.textMuted, textTransform: "uppercase" }}>SPX Command Center</span>
            <span style={{ ...chip(S.emeraldDim, "rgba(16,185,129,0.3)", S.emerald), fontSize: 9, fontWeight: 600 }}>LIVE</span>
          </div>
          <div style={{ fontSize: 48, fontWeight: 300, color: S.ivory, fontFamily: "Georgia, serif", lineHeight: 1 }}>
            {d.spxPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p style={{ marginTop: 6, fontSize: 12, color: S.textMuted }}>
            <span style={{ color: "rgba(255,255,255,0.7)" }}>{d.actionableCount} setups actionable</span>
            {" · "}
            <span>Regime: <span style={{ color: S.ivory }}>{d.regime}</span></span>
            {" · "}
            <span>Flow: <span style={{ color: S.ivory }}>{d.flowBias.label}</span></span>
          </p>
        </div>

        {/* Right: Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, minWidth: 340 }}>
          {/* Market Posture */}
          <div style={{ gridColumn: "1/-1", borderRadius: 12, border: `1px solid rgba(243,229,171,0.2)`, background: S.champagneDim, padding: "8px 12px" }}>
            <p style={{ fontSize: 9, letterSpacing: 1.5, color: S.textMuted, textTransform: "uppercase" }}>Market Posture · AI Prediction</p>
            <p style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: S.champagne }}>
              COMPRESSION BULLISH {d.prediction.confidence}%
            </p>
          </div>

          {/* Basis */}
          <div style={metricCell}>
            <p style={{ fontSize: 8, letterSpacing: 1.5, color: S.textMuted, textTransform: "uppercase" }}>SPX/SPY Basis</p>
            <p style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: d.basis.current >= 0 ? S.emerald : S.rose }}>
              +{d.basis.current.toFixed(2)}
            </p>
            <p style={{ fontSize: 8, color: S.textDim }}>{d.basis.leading} leads</p>
          </div>

          {/* Z-Score */}
          <div style={metricCell}>
            <p style={{ fontSize: 8, letterSpacing: 1.5, color: S.textMuted, textTransform: "uppercase" }}>Basis Z-Score</p>
            <p style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: S.ivory }}>
              {d.basis.zscore.toFixed(2)}
            </p>
            <p style={{ fontSize: 8, color: S.textDim }}>{basisLabel}</p>
          </div>

          {/* GEX Net */}
          <div style={metricCell}>
            <p style={{ fontSize: 8, letterSpacing: 1.5, color: S.textMuted, textTransform: "uppercase" }}>GEX Net</p>
            <p style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: gexColor }}>{gexPosture}</p>
            <p style={{ fontSize: 8, fontFamily: "monospace", color: S.textDim }}>-6.2B</p>
          </div>

          {/* Flip Point */}
          <div style={metricCell}>
            <p style={{ fontSize: 8, letterSpacing: 1.5, color: S.textMuted, textTransform: "uppercase" }}>GEX Flip Point</p>
            <p style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: S.ivory }}>{d.flipPoint}</p>
            <p style={{ fontSize: 8, fontFamily: "monospace", color: S.textDim }}>
              {flipDiff >= 0 ? "Above" : "Below"} ({flipDiff >= 0 ? "+" : ""}{flipDiff.toFixed(0)})
            </p>
          </div>

          {/* Direction Probability */}
          <div style={{ gridColumn: "1/-1" }}>
            <p style={{ fontSize: 8, letterSpacing: 1.5, color: S.textDim, textTransform: "uppercase", marginBottom: 4 }}>Direction Probability</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              <div style={{ borderRadius: 6, border: `1px solid rgba(16,185,129,0.2)`, background: S.emeraldDim, padding: "4px 6px", textAlign: "center" }}>
                <span style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: 1, color: "rgba(16,185,129,0.5)", display: "block" }}>Bull</span>
                <span style={{ fontSize: 12, color: S.emerald }}>↑ {d.prediction.bullish}%</span>
              </div>
              <div style={{ borderRadius: 6, border: `1px solid rgba(251,113,133,0.2)`, background: S.roseDim, padding: "4px 6px", textAlign: "center" }}>
                <span style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: 1, color: "rgba(251,113,133,0.5)", display: "block" }}>Bear</span>
                <span style={{ fontSize: 12, color: S.rose }}>↓ {d.prediction.bearish}%</span>
              </div>
              <div style={{ borderRadius: 6, border: `1px solid rgba(255,255,255,0.1)`, background: "rgba(255,255,255,0.03)", padding: "4px 6px", textAlign: "center" }}>
                <span style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.25)", display: "block" }}>Flat</span>
                <span style={{ fontSize: 12, color: S.textMuted }}>↔ {d.prediction.neutral}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

function ActionStrip() {
  return (
    <div style={{ ...glass, borderRadius: 16, padding: "10px 12px", background: "linear-gradient(90deg, rgba(255,255,255,0.02), rgba(16,185,129,0.02), rgba(243,229,171,0.03))" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <span style={chip(S.emeraldDim, "rgba(16,185,129,0.3)", S.emerald)}>
          ✦ Setups: {MOCK.actionableCount} actionable
        </span>
        <span style={chip("rgba(0,0,0,0.2)", "rgba(255,255,255,0.12)", "rgba(255,255,255,0.7)")}>
          ◉ Posture: COMPRESSION BULLISH 72%
        </span>
        <span style={chip(S.emeraldDim, "rgba(16,185,129,0.25)", S.emerald)}>
          ● Flow: Bullish pressure 67%
        </span>
        <span style={chip(S.roseDim, "rgba(251,113,133,0.2)", "rgba(251,113,133,0.8)")}>
          ⬡ GEX Unstable -6.2B
        </span>
      </div>
    </div>
  )
}

function SetupCard({ setup, selected, onSelect }) {
  const isBullish = setup.direction === "bullish"
  const entryMid = (setup.entryLow + setup.entryHigh) / 2
  const rangeMin = isBullish ? setup.stop : setup.t2
  const rangeMax = isBullish ? setup.t2 : setup.stop
  const span = Math.abs(rangeMax - rangeMin)
  const pct = (p) => Math.max(0, Math.min(100, ((p - rangeMin) / span) * 100))
  const pricePct = pct(MOCK.spxPrice)
  const inZone = MOCK.spxPrice >= setup.entryLow && MOCK.spxPrice <= setup.entryHigh

  const statusColors = {
    triggered: { bg: S.emeraldDim, border: "rgba(16,185,129,0.35)", color: S.emerald, label: "TRIGGERED" },
    ready: { bg: S.champagneDim, border: "rgba(243,229,171,0.3)", color: S.champagne, label: "READY" },
  }
  const st = statusColors[setup.status] || statusColors.ready

  return (
    <div
      onClick={() => onSelect(setup.id)}
      style={{
        ...glass,
        cursor: "pointer",
        borderColor: selected ? S.emerald : S.cardBorder,
        borderWidth: selected ? 2 : 1,
        transition: "border-color 0.2s",
      }}
    >
      {/* Title + status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 600, color: S.ivory }}>
            {setup.direction.toUpperCase()} {setup.type.toUpperCase()}
          </span>
        </div>
        <span style={{ ...chip(st.bg, st.border, st.color), fontSize: 8, fontWeight: 600 }}>{st.label}</span>
      </div>

      {/* Confluence pills */}
      <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
        {setup.sources.map((s) => (
          <span key={s} style={{ fontSize: 8, borderRadius: 4, padding: "1px 6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: S.textMuted }}>
            {s}
          </span>
        ))}
        <span style={{ fontSize: 8, color: S.champagne, fontWeight: 600 }}>{setup.confluenceScore}/5</span>
      </div>

      {/* Thermometer */}
      <div style={{ marginTop: 8 }}>
        <div style={{ position: "relative", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
          {/* Entry zone */}
          <div style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${pct(setup.entryLow)}%`,
            width: `${pct(setup.entryHigh) - pct(setup.entryLow)}%`,
            background: "rgba(16,185,129,0.2)",
            borderRadius: 4,
          }} />
          {/* Live price marker */}
          <div style={{
            position: "absolute", top: -1, width: 3, height: 10, borderRadius: 2,
            left: `${pricePct}%`,
            background: inZone ? S.emerald : S.ivory,
            boxShadow: inZone ? `0 0 6px ${S.emerald}` : "none",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, fontFamily: "monospace", color: S.textDim, marginTop: 3 }}>
          <span style={{ color: S.rose }}>Stop {setup.stop}</span>
          <span style={{ color: "rgba(16,185,129,0.6)" }}>Entry {setup.entryLow}–{setup.entryHigh}</span>
          <span style={{ color: S.emerald }}>T1 {setup.t1}</span>
          <span style={{ color: S.champagne }}>T2 {setup.t2}</span>
        </div>
      </div>

      {/* Metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginTop: 8 }}>
        {[
          { label: "R:R", value: setup.rr.toFixed(1), color: S.emerald },
          { label: "Win%", value: `${setup.winPct}%`, color: S.ivory },
          { label: "Prob", value: `${setup.prob}%`, color: S.champagne },
          { label: "Dist", value: `${(MOCK.spxPrice - entryMid).toFixed(1)}`, color: S.textMuted },
        ].map((m) => (
          <div key={m.label} style={{ textAlign: "center" }}>
            <p style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: 1, color: S.textDim }}>{m.label}</p>
            <p style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ContractCard() {
  const [expanded, setExpanded] = useState(false)
  const c = MOCK.contract
  const totalRange = c.maxLoss + c.t2Pnl
  const lossPct = (c.maxLoss / totalRange) * 100
  const t1Pct = ((c.maxLoss + c.t1Pnl) / totalRange) * 100
  const spreadOk = c.spreadPct <= 5 ? S.emerald : c.spreadPct <= 12 ? S.amber : S.rose
  const spreadLabel = c.spreadPct <= 5 ? "Tight" : c.spreadPct <= 12 ? "Fair" : "Wide"

  return (
    <div style={{ ...glass, border: `1px solid rgba(16,185,129,0.25)`, background: `linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: S.ivory }}>{c.desc}</span>
          <span style={{ ...chip(S.emeraldDim, "rgba(16,185,129,0.3)", S.emerald), fontSize: 7 }}>AI PICK</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: spreadOk }} />
          <span style={{ fontSize: 9, color: S.textMuted }}>{spreadLabel}</span>
        </div>
      </div>

      {/* R:R Bar */}
      <div style={{ marginTop: 10 }}>
        <div style={{ position: "relative", height: 10, borderRadius: 5, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${lossPct}%`, borderRadius: "5px 0 0 5px", background: "rgba(251,113,133,0.35)" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: `${100 - lossPct}%`, borderRadius: "0 5px 5px 0", background: "rgba(16,185,129,0.35)" }} />
          <div style={{ position: "absolute", top: 0, height: "100%", width: 2, background: "rgba(16,185,129,0.8)", left: `${t1Pct}%` }} />
          <div style={{ position: "absolute", top: 0, height: "100%", width: 2, background: S.champagne, right: 0 }} />
          <div style={{ position: "absolute", top: 0, height: "100%", width: 2, background: "rgba(255,255,255,0.5)", left: `${lossPct}%` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontFamily: "monospace", marginTop: 4 }}>
          <span style={{ color: "rgba(251,113,133,0.7)" }}>-${c.maxLoss}</span>
          <span style={{ color: "rgba(16,185,129,0.7)" }}>T1 +${c.t1Pnl}</span>
          <span style={{ color: "rgba(243,229,171,0.7)" }}>T2 +${c.t2Pnl}</span>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, fontFamily: "monospace" }}>
        <span style={{ color: S.emerald }}>R:R {c.rr}</span>
        <span style={{ color: S.textMuted }}>Δ {c.delta}</span>
        <span style={{ color: S.textMuted }}>Θ {c.theta}</span>
        <span style={{ color: S.textDim }}>{c.bid}/{c.ask}</span>
        <span style={{ color: S.textFaint }}>{c.spreadPct}% sprd</span>
      </div>

      {/* Expand toggle */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ marginTop: 8, cursor: "pointer", borderRadius: 8, border: `1px solid rgba(255,255,255,0.06)`, background: "rgba(255,255,255,0.015)", padding: "4px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span style={{ fontSize: 9, letterSpacing: 1, color: S.textDim, textTransform: "uppercase" }}>Full analytics</span>
        <span style={{ fontSize: 10, color: S.textDim }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, fontSize: 10, color: S.textMuted }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            <div><p style={{ fontSize: 8, color: S.textDim }}>Δ</p><p style={{ fontFamily: "monospace" }}>{c.delta}</p></div>
            <div><p style={{ fontSize: 8, color: S.textDim }}>Γ</p><p style={{ fontFamily: "monospace" }}>{c.gamma}</p></div>
            <div><p style={{ fontSize: 8, color: S.textDim }}>Θ</p><p style={{ fontFamily: "monospace" }}>{c.theta}</p></div>
            <div><p style={{ fontSize: 8, color: S.textDim }}>Vega</p><p style={{ fontFamily: "monospace" }}>{c.vega}</p></div>
          </div>
          <p style={{ marginTop: 6, fontSize: 10, lineHeight: 1.5, color: S.textMuted }}>{c.reasoning}</p>
        </div>
      )}
    </div>
  )
}

function FlowTicker() {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={glass}>
      <div onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, letterSpacing: 1.5, color: S.textDim, textTransform: "uppercase" }}>Flow Conviction</span>
          <span style={{ ...chip(S.emeraldDim, "rgba(16,185,129,0.25)", S.emerald), fontSize: 9, fontWeight: 600 }}>CONFIRMS 67%</span>
        </div>
        <span style={{ fontSize: 10, color: S.textDim }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {/* Tug-of-war bar */}
      <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "67%", background: "rgba(16,185,129,0.4)", borderRadius: 2 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, fontFamily: "monospace", color: S.textDim, marginTop: 2 }}>
        <span style={{ color: "rgba(16,185,129,0.5)" }}>Bull 67%</span>
        <span style={{ color: "rgba(251,113,133,0.5)" }}>Bear 33%</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {MOCK.flowEvents.map((e, i) => (
            <span key={i} style={{
              ...chip(
                e.dir === "bull" ? "rgba(16,185,129,0.06)" : "rgba(251,113,133,0.06)",
                e.dir === "bull" ? "rgba(16,185,129,0.15)" : "rgba(251,113,133,0.15)",
                e.dir === "bull" ? "rgba(16,185,129,0.7)" : "rgba(251,113,133,0.7)",
              ),
              fontSize: 9,
            }}>
              {e.size} {e.desc} · {e.time}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function DecisionContext() {
  const [openPanel, setOpenPanel] = useState(null)
  const toggle = (p) => setOpenPanel(openPanel === p ? null : p)

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      {/* Clusters */}
      <div style={{ ...glass, padding: 10, cursor: "pointer" }} onClick={() => toggle("cluster")}>
        <p style={{ fontSize: 9, letterSpacing: 1.2, color: S.textDim, textTransform: "uppercase" }}>Clusters</p>
        <p style={{ fontSize: 12, fontFamily: "monospace", color: S.ivory, marginTop: 2 }}>{MOCK.clusters[0].range}</p>
        <p style={{ fontSize: 8, color: S.textDim }}>Fortress · {MOCK.clusters[0].sources} sources</p>
        {openPanel === "cluster" && (
          <div style={{ marginTop: 8, fontSize: 9, color: S.textMuted, borderTop: `1px solid ${S.cardBorder}`, paddingTop: 6 }}>
            {MOCK.clusters.map((c, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <span style={{ fontFamily: "monospace", color: S.ivory }}>{c.range}</span>
                <span style={{ marginLeft: 6, color: S.textDim }}>{c.type} · {c.sources} src · hold {c.holdRate}%</span>
                {c.spyDerived && <span style={{ marginLeft: 4, color: S.champagne }}>✦ SPY</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cone */}
      <div style={{ ...glass, padding: 10, cursor: "pointer" }} onClick={() => toggle("cone")}>
        <p style={{ fontSize: 9, letterSpacing: 1.2, color: S.textDim, textTransform: "uppercase" }}>Prob Cone</p>
        <p style={{ fontSize: 12, fontFamily: "monospace", color: S.ivory, marginTop: 2 }}>
          {MOCK.cone[0].low}–{MOCK.cone[0].high}
        </p>
        <p style={{ fontSize: 8, color: S.textDim }}>15m range</p>
        {openPanel === "cone" && (
          <div style={{ marginTop: 8, fontSize: 9, color: S.textMuted, borderTop: `1px solid ${S.cardBorder}`, paddingTop: 6 }}>
            {MOCK.cone.map((c, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <span style={{ fontFamily: "monospace", color: S.ivory }}>{c.mins}m:</span>
                <span style={{ marginLeft: 4 }}>{c.low}–{c.high}</span>
              </div>
            ))}
            <p style={{ marginTop: 4, color: S.emerald, fontSize: 8 }}>▲ T1 in 15m cone · ▲ T2 in 30m cone</p>
          </div>
        )}
      </div>

      {/* Fibs */}
      <div style={{ ...glass, padding: 10, cursor: "pointer" }} onClick={() => toggle("fib")}>
        <p style={{ fontSize: 9, letterSpacing: 1.2, color: S.textDim, textTransform: "uppercase" }}>Fib Levels</p>
        <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
          {MOCK.fibs.slice(0, 2).map((f, i) => (
            <span key={i} style={{ fontSize: 9, fontFamily: "monospace", color: f.crossVal ? S.champagne : S.textMuted }}>
              {f.ratio} {f.price} {f.crossVal ? "✦" : ""}
            </span>
          ))}
        </div>
        {openPanel === "fib" && (
          <div style={{ marginTop: 8, fontSize: 9, color: S.textMuted, borderTop: `1px solid ${S.cardBorder}`, paddingTop: 6 }}>
            {MOCK.fibs.map((f, i) => (
              <div key={i} style={{ marginBottom: 4, display: "flex", gap: 8, fontFamily: "monospace" }}>
                <span style={{ color: S.ivory }}>{f.ratio}</span>
                <span>{f.price}</span>
                <span style={{ color: f.dist > 0 ? S.emerald : S.rose }}>{f.dist > 0 ? "+" : ""}{f.dist.toFixed(1)}</span>
                {f.crossVal && <span style={{ color: S.champagne }}>✦ SPY confirmed</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CoachFeed({ selectedSetup }) {
  const quickActions = ["Confirm entry?", "Risk check", "Exit strategy", "Size guidance"]

  return (
    <div style={{ ...glass, display: "flex", flexDirection: "column", gap: 8, minHeight: 220 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, letterSpacing: 1.8, color: S.textDim, textTransform: "uppercase" }}>AI Coach</span>
        {selectedSetup && <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(243,229,171,0.5)" }}>Focused: {selectedSetup}</span>}
      </div>

      {/* Quick actions */}
      {selectedSetup && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {quickActions.map((a) => (
            <span key={a} style={{ ...chip("rgba(16,185,129,0.05)", "rgba(16,185,129,0.15)", "rgba(16,185,129,0.7)"), fontSize: 9, cursor: "pointer" }}>
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {MOCK.coachMessages.map((m) => (
          <div key={m.id} style={{
            borderRadius: 10,
            border: `1px solid ${m.priority === "alert" ? "rgba(251,113,133,0.3)" : "rgba(16,185,129,0.3)"}`,
            background: m.priority === "alert" ? S.roseDim : S.emeraldDim,
            padding: 10,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9 }}>
              <span style={{ letterSpacing: 1.2, color: S.textDim, textTransform: "uppercase" }}>{m.priority}</span>
              <span style={{ color: S.textDim }}>{m.ts}</span>
            </div>
            <p style={{ fontSize: 12, color: S.ivory, marginTop: 4, lineHeight: 1.5 }}>{m.content}</p>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          placeholder="Ask about this setup..."
          style={{ flex: 1, borderRadius: 8, border: `1px solid rgba(255,255,255,0.1)`, background: "rgba(255,255,255,0.025)", padding: "6px 10px", fontSize: 11, color: S.ivory, outline: "none" }}
        />
        <div style={{ borderRadius: 8, border: `1px solid rgba(16,185,129,0.25)`, background: S.emeraldDim, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: S.emerald }}>→</span>
        </div>
      </div>
    </div>
  )
}

function GexCompact() {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ borderRadius: 12, border: `1px solid rgba(255,255,255,0.06)`, background: "rgba(255,255,255,0.015)", padding: "8px 12px" }}>
      <div onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, letterSpacing: 1.5, color: S.textDim, textTransform: "uppercase" }}>GEX Landscape</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: S.textDim }}>Flip 6055</span>
          <span style={{ fontSize: 10, color: S.textDim }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>
      {!expanded && (
        <div style={{ marginTop: 4, display: "flex", gap: 12, fontSize: 9, fontFamily: "monospace", color: S.textDim }}>
          <span>Call wall 6085</span>
          <span>Put wall 5980</span>
          <span style={{ color: "rgba(251,113,133,0.5)" }}>Net -6.2B</span>
        </div>
      )}
      {expanded && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60 }}>
            {[3, 5, 8, 12, 18, 25, 14, 10, 6, 3, -2, -5, -8, -12, -6, -3].map((v, i) => (
              <div key={i} style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  width: "100%",
                  height: `${Math.max(4, (Math.abs(v) / 25) * 100)}%`,
                  background: v >= 0 ? "rgba(16,185,129,0.4)" : "rgba(251,113,133,0.4)",
                  borderRadius: "2px 2px 0 0",
                }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 4, display: "flex", gap: 12, fontSize: 9, fontFamily: "monospace", color: S.textDim }}>
            <span>Call wall 6085</span>
            <span>Put wall 5980</span>
            <span style={{ color: "rgba(251,113,133,0.5)" }}>Net -6.2B</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Layout ───
export default function SPXCommandCenterMockup() {
  const [selectedSetup, setSelectedSetup] = useState("s1")

  return (
    <div style={{ background: S.bg, color: S.ivory, minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 16 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Tier 1: Sniper Briefing */}
        <Header />
        <ActionStrip />

        {/* Tier 2: Battlefield */}
        <div style={{ display: "grid", gridTemplateColumns: "60% 40%", gap: 10 }}>
          {/* LEFT: Chart + Flow + Decision Context */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Chart placeholder */}
            <div style={{ ...glass, height: 420, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <div style={{ position: "absolute", top: 12, left: 12, display: "flex", justifyContent: "space-between", width: "calc(100% - 24px)" }}>
                <span style={{ fontSize: 11, letterSpacing: 1.8, color: S.textDim, textTransform: "uppercase" }}>Price + Focus Levels</span>
                <span style={{ fontSize: 9, fontFamily: "monospace", color: S.textDim }}>6/14 shown</span>
              </div>
              <div style={{ position: "absolute", top: 34, left: 12, display: "flex", gap: 4 }}>
                {["1m", "5m", "15m", "1h", "4h", "1D"].map((tf) => (
                  <span key={tf} style={{
                    fontSize: 9, padding: "2px 6px", borderRadius: 4,
                    border: tf === "5m" ? `1px solid rgba(16,185,129,0.4)` : `1px solid rgba(255,255,255,0.1)`,
                    background: tf === "5m" ? S.emeraldDim : "rgba(255,255,255,0.02)",
                    color: tf === "5m" ? S.emerald : S.textDim,
                  }}>{tf}</span>
                ))}
              </div>
              <span style={{ fontSize: 16, color: S.textDim }}>[ TradingView Chart ]</span>
            </div>

            <FlowTicker />
            <DecisionContext />

            {/* GEX collapsed */}
            <GexCompact />
          </div>

          {/* RIGHT: Setups + Contract + Coach */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, letterSpacing: 1.8, color: S.textDim, textTransform: "uppercase" }}>Active Setups</span>
              <span style={{ fontSize: 9, color: S.textDim }}>{MOCK.actionableCount} actionable</span>
            </div>

            {MOCK.setups.map((s) => (
              <SetupCard key={s.id} setup={s} selected={selectedSetup === s.id} onSelect={setSelectedSetup} />
            ))}

            <ContractCard />
            <CoachFeed selectedSetup={selectedSetup === "s1" ? "Fade at Wall" : "Breakout Vacuum"} />
          </div>
        </div>
      </div>
    </div>
  )
}
