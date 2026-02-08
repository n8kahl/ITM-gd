import { useState } from "react";
import {
  LayoutDashboard, BookOpen, Bot, GraduationCap, Palette, UserCircle,
  TrendingUp, TrendingDown, Target, Flame, BarChart3, Plus, Share2,
  ChevronRight, Sparkles, LogOut, RefreshCw, Menu, X, Bell,
  Calendar, ArrowUpRight, ArrowDownRight, Star, Clock, Zap
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

// ─── Mock Data ───
const equityData = [
  { date: "Jan 6", pnl: 0 }, { date: "Jan 10", pnl: 420 }, { date: "Jan 14", pnl: 310 },
  { date: "Jan 17", pnl: 780 }, { date: "Jan 21", pnl: 650 }, { date: "Jan 24", pnl: 1120 },
  { date: "Jan 28", pnl: 980 }, { date: "Feb 1", pnl: 1540 }, { date: "Feb 4", pnl: 1380 },
  { date: "Feb 7", pnl: 2210 }, { date: "Feb 8", pnl: 2450 },
];

const recentTrades = [
  { symbol: "SPX", direction: "long", pnl: 840, pnlPct: 4.2, grade: "A", date: "2h ago" },
  { symbol: "NDX", direction: "short", pnl: -220, pnlPct: -1.1, grade: "B+", date: "Yesterday" },
  { symbol: "SPY", direction: "long", pnl: 560, pnlPct: 2.8, grade: "A-", date: "Yesterday" },
  { symbol: "QQQ", direction: "long", pnl: 340, pnlPct: 1.7, grade: "B", date: "Feb 5" },
  { symbol: "SPX", direction: "short", pnl: -150, pnlPct: -0.8, grade: "C+", date: "Feb 4" },
];

const calendarData = Array.from({ length: 35 }, (_, i) => ({
  day: i + 1,
  value: Math.random() > 0.4 ? (Math.random() > 0.3 ? Math.random() * 3 : -Math.random() * 2) : 0
}));

const tabs = [
  { id: "dashboard", label: "Command Center", icon: LayoutDashboard, active: true },
  { id: "journal", label: "Trade Journal", icon: BookOpen },
  { id: "ai-coach", label: "AI Coach", icon: Bot, badge: "Beta" },
  { id: "library", label: "Training Library", icon: GraduationCap },
  { id: "studio", label: "Trade Studio", icon: Palette, locked: true },
  { id: "profile", label: "Profile", icon: UserCircle },
];

// ─── Glassmorphism Styles ───
const glass = {
  background: "rgba(255,255,255,0.03)",
  backdropFilter: "blur(40px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 12,
};
const glassHeavy = {
  ...glass,
  background: "rgba(255,255,255,0.02)",
  backdropFilter: "blur(60px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
  borderRadius: 16,
};

// ─── Sub Components ───
function StatCard({ label, value, trend, trendUp, icon: Icon, accent, glow }) {
  return (
    <div style={{
      ...glass, padding: "20px", flex: 1, minWidth: 0,
      position: "relative", overflow: "hidden", transition: "all 0.3s ease",
    }}>
      {glow && <div style={{
        position: "absolute", top: -20, right: -20, width: 80, height: 80,
        background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`,
        borderRadius: "50%",
      }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", color: "#9A9A9A", textTransform: "uppercase" }}>{label}</span>
        <Icon size={16} style={{ color: accent || "#9A9A9A", opacity: 0.7 }} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Geist Mono', monospace", color: accent || "#F5F5F0", marginBottom: 6 }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
        {trendUp !== undefined && (trendUp
          ? <ArrowUpRight size={14} style={{ color: "#10B981" }} />
          : <ArrowDownRight size={14} style={{ color: "#EF4444" }} />
        )}
        <span style={{ color: trendUp ? "#10B981" : trendUp === false ? "#EF4444" : "#9A9A9A" }}>{trend}</span>
      </div>
    </div>
  );
}

function GradeCircle({ grade, size = 28 }) {
  const colors = { A: "#10B981", B: "#F3E5AB", C: "#F59E0B", D: "#EF4444", F: "#EF4444" };
  const color = colors[grade[0]] || "#9A9A9A";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
      background: `${color}20`, border: `1px solid ${color}40`, fontSize: size * 0.43, fontWeight: 600, color,
      fontFamily: "'Geist Mono', monospace",
    }}>{grade}</div>
  );
}

function DirectionBadge({ direction }) {
  const isLong = direction === "long";
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "3px 8px", borderRadius: 6,
      background: isLong ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
      color: isLong ? "#10B981" : "#EF4444",
      border: `1px solid ${isLong ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
    }}>{direction}</span>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...glass, padding: "10px 14px", background: "rgba(20,20,22,0.95)" }}>
      <p style={{ fontSize: 11, color: "#9A9A9A", margin: 0 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 600, fontFamily: "'Geist Mono', monospace", color: payload[0].value >= 0 ? "#10B981" : "#EF4444", margin: "4px 0 0" }}>
        ${payload[0].value.toLocaleString()}
      </p>
    </div>
  );
}

// ─── Main Component ───
export default function MemberDashboardMockup() {
  const [view, setView] = useState("desktop");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState("dashboard");
  const [timeRange, setTimeRange] = useState("30d");

  const isMobile = view === "mobile";

  // ─── SIDEBAR (Desktop) ───
  const Sidebar = () => (
    <div style={{
      width: 280, height: "100%", position: "fixed", left: 0, top: 0,
      background: "rgba(10,10,11,0.95)", backdropFilter: "blur(40px)",
      borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column",
      zIndex: 40, padding: "0",
    }}>
      {/* Brand */}
      <div style={{ padding: "24px 24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #10B981, #064E3B)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "white",
          }}>T</div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontWeight: 600, color: "#F5F5F0" }}>TradeITM</div>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", color: "#F3E5AB", fontWeight: 500 }}>TRADING ROOM</div>
          </div>
        </div>
        <div style={{ height: 1, background: "linear-gradient(90deg, #F3E5AB40, transparent)", marginTop: 16 }} />
      </div>

      {/* User Profile */}
      <div style={{ margin: "0 12px 16px", ...glass, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "linear-gradient(135deg, #10B981, #047857)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 600, color: "white",
          border: "2px solid rgba(16,185,129,0.4)",
          boxShadow: "0 0 12px rgba(16,185,129,0.2)",
        }}>N</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#F5F5F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Nate</div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4,
            fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
            padding: "2px 8px", borderRadius: 20,
            background: "linear-gradient(135deg, rgba(243,229,171,0.15), rgba(16,185,129,0.15))",
            border: "1px solid rgba(243,229,171,0.3)",
            color: "#F3E5AB",
          }}>
            <Sparkles size={10} /> PRO SNIPER
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {tabs.map(tab => (
          <button key={tab.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 12px", borderRadius: 8,
            background: tab.active ? "rgba(16,185,129,0.08)" : "transparent",
            border: "none", cursor: "pointer", width: "100%", textAlign: "left",
            borderLeft: tab.active ? "3px solid #F3E5AB" : "3px solid transparent",
            transition: "all 0.2s ease",
            opacity: tab.locked ? 0.4 : 1,
          }}>
            <tab.icon size={18} style={{ color: tab.active ? "#10B981" : "#9A9A9A", flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: tab.active ? 500 : 400, color: tab.active ? "#F5F5F0" : "#9A9A9A", flex: 1 }}>{tab.label}</span>
            {tab.badge && (
              <span style={{
                fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 10,
                background: "rgba(16,185,129,0.15)", color: "#10B981",
                border: "1px solid rgba(16,185,129,0.25)",
              }}>{tab.badge}</span>
            )}
            {tab.locked && (
              <span style={{ fontSize: 9, color: "#9A9A9A" }}>🔒</span>
            )}
          </button>
        ))}
      </nav>

      {/* Upgrade CTA */}
      <div style={{
        margin: "16px 12px", ...glass, padding: 16, textAlign: "center",
        borderColor: "rgba(243,229,171,0.2)",
        boxShadow: "0 0 20px rgba(243,229,171,0.05)",
      }}>
        <Sparkles size={20} style={{ color: "#F3E5AB", margin: "0 auto 8px" }} />
        <div style={{ fontSize: 13, fontWeight: 500, color: "#F5F5F0", marginBottom: 4 }}>Unlock Executive</div>
        <div style={{ fontSize: 11, color: "#9A9A9A", marginBottom: 12 }}>Get Trade Studio & more</div>
        <button style={{
          width: "100%", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500,
          background: "transparent", border: "1px solid rgba(243,229,171,0.3)",
          color: "#F3E5AB", cursor: "pointer", transition: "all 0.2s ease",
        }}>Upgrade</button>
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 24px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RefreshCw size={12} style={{ color: "#9A9A9A" }} />
          <span style={{ fontSize: 10, color: "#9A9A9A" }}>Synced 2m ago</span>
        </div>
      </div>
    </div>
  );

  // ─── MOBILE TOP BAR ───
  const MobileTopBar = () => (
    <div style={{
      height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 16px", background: "rgba(10,10,11,0.95)", backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 40,
    }}>
      <button onClick={() => setMobileMenuOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
        <Menu size={22} style={{ color: "#F5F5F0" }} />
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: "linear-gradient(135deg, #10B981, #064E3B)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, color: "white",
        }}>T</div>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, fontWeight: 600, color: "#F5F5F0" }}>TradeITM</span>
      </div>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "linear-gradient(135deg, #10B981, #047857)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 600, color: "white",
      }}>N</div>
    </div>
  );

  // ─── MOBILE BOTTOM NAV ───
  const MobileBottomNav = () => {
    const mobileTabs = [
      { id: "dashboard", label: "Home", icon: LayoutDashboard },
      { id: "journal", label: "Journal", icon: BookOpen },
      { id: "ai-coach", label: "AI Coach", icon: Bot },
      { id: "profile", label: "Profile", icon: UserCircle },
    ];
    return (
      <div style={{
        height: 64, display: "flex", alignItems: "center", justifyContent: "space-around",
        background: "rgba(10,10,11,0.98)", backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.06)", position: "fixed", bottom: 0,
        left: 0, right: 0, zIndex: 40, paddingBottom: 8,
      }}>
        {mobileTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveMobileTab(tab.id)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            background: "none", border: "none", cursor: "pointer", padding: "6px 12px",
          }}>
            <tab.icon size={20} style={{ color: activeMobileTab === tab.id ? "#10B981" : "#9A9A9A" }} />
            <span style={{
              fontSize: 10, fontWeight: 500,
              color: activeMobileTab === tab.id ? "#10B981" : "#9A9A9A",
            }}>{tab.label}</span>
          </button>
        ))}
      </div>
    );
  };

  // ─── DASHBOARD CONTENT ───
  const DashboardContent = () => (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1200 }}>
      {/* Welcome Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: isMobile ? 20 : 32, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0 }}>
        <div>
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif", fontSize: isMobile ? 22 : 28,
            fontWeight: 600, color: "#F5F5F0", margin: 0, letterSpacing: "-0.02em",
          }}>Good morning, Nate</h1>
          <p style={{ fontSize: 13, color: "#9A9A9A", margin: "6px 0 0" }}>Saturday, February 8, 2026</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "6px 14px",
            borderRadius: 20, background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6B7280" }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "#9A9A9A" }}>Market Closed</span>
          </div>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "#9A9A9A" }}>4:00 PM ET</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)",
        gap: isMobile ? 10 : 16, marginBottom: isMobile ? 20 : 32,
      }}>
        <StatCard label="Win Rate" value="68.4%" trend="+3.2% vs last mo" trendUp={true} icon={Target} accent="#10B981" glow />
        <StatCard label="P&L This Month" value="+$2,450" trend="+18% vs Jan" trendUp={true} icon={TrendingUp} accent="#10B981" glow />
        <StatCard label="Current Streak" value="4 Wins 🔥" trend="Best: 7" trendUp={undefined} icon={Flame} accent="#F3E5AB" />
        <StatCard label="Avg AI Grade" value="A-" trend="↑ from B+" trendUp={true} icon={GraduationCap} accent="#10B981" />
        {!isMobile && <StatCard label="Trades MTD" value="18" trend="vs 22 last month" trendUp={undefined} icon={BarChart3} />}
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1.8fr 1fr",
        gap: isMobile ? 16 : 24, marginBottom: isMobile ? 16 : 24,
      }}>
        {/* Equity Curve */}
        <div style={{ ...glassHeavy, padding: isMobile ? 16 : 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#F5F5F0", margin: 0 }}>P&L Equity Curve</h3>
            <div style={{ display: "flex", gap: 4 }}>
              {["7d", "30d", "90d", "YTD"].map(r => (
                <button key={r} onClick={() => setTimeRange(r)} style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                  background: timeRange === r ? "rgba(16,185,129,0.12)" : "transparent",
                  color: timeRange === r ? "#10B981" : "#9A9A9A",
                  border: timeRange === r ? "1px solid rgba(16,185,129,0.2)" : "1px solid transparent",
                  cursor: "pointer",
                }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
            <AreaChart data={equityData}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9A9A9A" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9A9A9A", fontFamily: "'Geist Mono', monospace" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="pnl" stroke="#F3E5AB" strokeWidth={2} fill="url(#pnlGradient)" dot={false} activeDot={{ r: 5, fill: "#F3E5AB", stroke: "#0A0A0B", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Actions */}
        <div style={{ ...glass, padding: isMobile ? 16 : 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#F5F5F0", margin: "0 0 4px" }}>Quick Actions</h3>
          {[
            { label: "Log Trade", icon: Plus, bg: "linear-gradient(135deg, #10B981, #047857)", color: "white" },
            { label: "Ask AI Coach", icon: Bot, bg: "transparent", color: "#F5F5F0", border: true },
            { label: "Share Last Win", icon: Share2, bg: "rgba(255,255,255,0.03)", color: "#F5F5F0", border: true },
          ].map((action, i) => (
            <button key={i} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
              borderRadius: 10, background: action.bg, color: action.color,
              border: action.border ? "1px solid rgba(255,255,255,0.10)" : "none",
              cursor: "pointer", fontSize: 14, fontWeight: 500, width: "100%", textAlign: "left",
              transition: "all 0.2s ease",
            }}>
              <action.icon size={18} />
              {action.label}
            </button>
          ))}

          {/* Mini AI Insight */}
          <div style={{
            marginTop: "auto", padding: 16, borderRadius: 12,
            background: "rgba(243,229,171,0.04)", border: "1px solid rgba(243,229,171,0.12)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Zap size={14} style={{ color: "#F3E5AB" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#F3E5AB", letterSpacing: "0.06em", textTransform: "uppercase" }}>AI Insight</span>
            </div>
            <p style={{ fontSize: 12, color: "#9A9A9A", margin: 0, lineHeight: 1.5 }}>
              Your win rate on <span style={{ color: "#F5F5F0" }}>support bounces</span> is 82% — significantly above your 68% average. Consider focusing on this setup.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Trades */}
      <div style={{ ...glass, padding: isMobile ? 16 : 24, marginBottom: isMobile ? 16 : 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#F5F5F0", margin: 0 }}>Recent Trades</h3>
          <button style={{ background: "none", border: "none", color: "#10B981", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
            View All →
          </button>
        </div>

        {/* Table Header (Desktop) */}
        {!isMobile && (
          <div style={{
            display: "grid", gridTemplateColumns: "80px 80px 1fr 80px 60px 100px",
            padding: "10px 16px", background: "rgba(255,255,255,0.03)",
            borderRadius: 8, marginBottom: 4,
          }}>
            {["Symbol", "Direction", "P&L", "Grade", "Stars", "Date"].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", color: "#9A9A9A", textTransform: "uppercase" }}>{h}</span>
            ))}
          </div>
        )}

        {recentTrades.map((trade, i) => (
          <div key={i} style={{
            display: isMobile ? "flex" : "grid",
            gridTemplateColumns: !isMobile ? "80px 80px 1fr 80px 60px 100px" : undefined,
            flexDirection: isMobile ? "row" : undefined,
            justifyContent: isMobile ? "space-between" : undefined,
            alignItems: "center",
            padding: isMobile ? "14px 0" : "14px 16px",
            borderBottom: i < recentTrades.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
            borderLeft: `2px solid ${trade.pnl >= 0 ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.3)"}`,
            paddingLeft: isMobile ? 12 : 16,
            cursor: "pointer", transition: "background 0.15s ease",
            gap: isMobile ? 0 : undefined,
          }}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 600, fontSize: 14, color: "#F5F5F0" }}>{trade.symbol}</span>
            {!isMobile && <DirectionBadge direction={trade.direction} />}
            <span style={{
              fontFamily: "'Geist Mono', monospace", fontWeight: 600, fontSize: 14,
              color: trade.pnl >= 0 ? "#10B981" : "#EF4444",
            }}>
              {trade.pnl >= 0 ? "+" : ""}${Math.abs(trade.pnl)} ({trade.pnl >= 0 ? "+" : ""}{trade.pnlPct}%)
            </span>
            {!isMobile && <GradeCircle grade={trade.grade} />}
            {!isMobile && (
              <div style={{ display: "flex", gap: 2 }}>
                {[1,2,3].map(s => <Star key={s} size={12} fill="#10B981" stroke="none" />)}
                {[4,5].map(s => <Star key={s} size={12} fill="none" stroke="#333" />)}
              </div>
            )}
            <span style={{ fontSize: 12, color: "#9A9A9A" }}>
              {isMobile && <GradeCircle grade={trade.grade} size={22} />}
              {!isMobile && trade.date}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom Row: AI Insights + Calendar */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap: isMobile ? 16 : 24,
        marginBottom: isMobile ? 80 : 0,
      }}>
        {/* AI Insights */}
        <div style={{
          ...glass, padding: isMobile ? 16 : 24,
          borderColor: "rgba(243,229,171,0.12)",
          boxShadow: "0 0 24px rgba(243,229,171,0.03)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Bot size={20} style={{ color: "#F3E5AB" }} />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#F5F5F0", margin: 0 }}>AI Coach Insights</h3>
          </div>
          <p style={{ fontSize: 13, color: "#B8B5AD", lineHeight: 1.6, margin: "0 0 12px" }}>
            Based on your last 18 trades, your strongest setups are <strong style={{ color: "#F5F5F0" }}>support bounces</strong> and <strong style={{ color: "#F5F5F0" }}>momentum breakouts</strong>. Your average holding time on winners is 47 minutes.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {["Strong at Support", "Quick Exits", "Improving Entries"].map(tag => (
              <span key={tag} style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 20,
                background: "rgba(16,185,129,0.08)", color: "#10B981",
                border: "1px solid rgba(16,185,129,0.15)",
              }}>{tag}</span>
            ))}
          </div>
          <button style={{
            padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: "transparent", border: "1px solid rgba(243,229,171,0.25)",
            color: "#F3E5AB", cursor: "pointer", width: "100%",
          }}>
            Discuss with Coach →
          </button>
        </div>

        {/* Trading Calendar */}
        <div style={{ ...glass, padding: isMobile ? 16 : 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Calendar size={18} style={{ color: "#9A9A9A" }} />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#F5F5F0", margin: 0 }}>Trading Activity</h3>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3,
          }}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={i} style={{ fontSize: 9, color: "#9A9A9A", textAlign: "center", marginBottom: 4 }}>{d}</span>
            ))}
            {calendarData.map((d, i) => (
              <div key={i} style={{
                width: "100%", aspectRatio: "1", borderRadius: 3,
                background: d.value === 0 ? "rgba(255,255,255,0.03)"
                  : d.value > 0 ? `rgba(16,185,129,${Math.min(d.value / 3, 0.8)})`
                  : `rgba(239,68,68,${Math.min(Math.abs(d.value) / 2, 0.6)})`,
              }} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(16,185,129,0.5)" }} />
              <span style={{ fontSize: 10, color: "#9A9A9A" }}>Profit</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(239,68,68,0.5)" }} />
              <span style={{ fontSize: 10, color: "#9A9A9A" }}>Loss</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(255,255,255,0.03)" }} />
              <span style={{ fontSize: 10, color: "#9A9A9A" }}>No trades</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── MAIN RENDER ───
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: "#F5F5F0", minHeight: "100vh" }}>
      {/* View Toggle */}
      <div style={{
        position: "fixed", top: 16, right: 16, zIndex: 100,
        display: "flex", gap: 4, padding: 4, borderRadius: 10,
        background: "rgba(20,20,22,0.95)", border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(20px)",
      }}>
        {["desktop", "mobile"].map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: "8px 16px", borderRadius: 7, fontSize: 12, fontWeight: 500,
            background: view === v ? "rgba(16,185,129,0.15)" : "transparent",
            color: view === v ? "#10B981" : "#9A9A9A",
            border: "none", cursor: "pointer", textTransform: "capitalize",
          }}>
            {v === "desktop" ? "🖥 Desktop" : "📱 Mobile"}
          </button>
        ))}
      </div>

      {isMobile ? (
        /* ─── MOBILE VIEW ─── */
        <div style={{
          maxWidth: 390, margin: "60px auto 0", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20, overflow: "hidden", background: "#0A0A0B",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}>
          <MobileTopBar />
          <div style={{ height: "calc(100vh - 200px)", overflowY: "auto" }}>
            <DashboardContent />
          </div>
          <MobileBottomNav />
        </div>
      ) : (
        /* ─── DESKTOP VIEW ─── */
        <div style={{ background: "#0A0A0B", minHeight: "100vh" }}>
          <Sidebar />
          <div style={{ marginLeft: 280, minHeight: "100vh" }}>
            <DashboardContent />
          </div>
        </div>
      )}
    </div>
  );
}
