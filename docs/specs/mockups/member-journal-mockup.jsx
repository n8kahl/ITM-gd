import { useState } from "react";
import {
  BookOpen, Search, Filter, Download, Plus, ChevronDown, ChevronRight,
  ArrowUpDown, Grid3X3, List, Star, Share2, Pencil, Trash2, Image,
  Sparkles, Bot, X, Calendar, TrendingUp, TrendingDown, Target,
  BarChart3, Trophy, AlertTriangle, Upload, Camera, Menu, UserCircle,
  LayoutDashboard, ChevronLeft, ChevronUp, GraduationCap
} from "lucide-react";

// ─── Mock Data ───
const journalEntries = [
  { id: 1, date: "2026-02-08", symbol: "SPX", direction: "long", entry: 6042.50, exit: 6058.75, size: 2, pnl: 840, pnlPct: 4.2, grade: "A", rating: 5, tags: ["Breakout", "Momentum"], hasScreenshot: true, aiAnalyzed: true,
    notes: { setup: "Clean breakout above PDH with volume confirmation", execution: "Entered on pullback to breakout level", lessons: "Trust the setup when volume confirms" },
    aiAnalysis: { summary: "Excellent trend recognition and entry timing. Volume confirmation was key.", strengths: ["Strong entry at breakout retest", "Proper size for account"], improvements: ["Consider trailing stop for larger moves"], coaching: "Your patience on the pullback entry is exactly the discipline that separates consistent traders." }
  },
  { id: 2, date: "2026-02-07", symbol: "NDX", direction: "short", entry: 21540.00, exit: 21605.00, size: 1, pnl: -220, pnlPct: -1.1, grade: "B+", rating: 3, tags: ["Reversal", "Overtraded"], hasScreenshot: true, aiAnalyzed: true,
    notes: { setup: "Double top formation at resistance", execution: "Entered too early before confirmation", lessons: "Wait for candle close confirmation" },
    aiAnalysis: { summary: "Good pattern recognition but premature entry.", strengths: ["Correct pattern identification"], improvements: ["Wait for confirmation candle", "Tighter stop placement"], coaching: "The setup was right — your timing just needs refinement." }
  },
  { id: 3, date: "2026-02-07", symbol: "SPY", direction: "long", entry: 602.30, exit: 605.15, size: 5, pnl: 560, pnlPct: 2.8, grade: "A-", rating: 4, tags: ["Support Bounce"], hasScreenshot: false, aiAnalyzed: true,
    notes: { setup: "Bounce off VWAP with RSI divergence", execution: "Clean entry, took profits at R1", lessons: "VWAP bounces with RSI divergence are high probability" }
  },
  { id: 4, date: "2026-02-06", symbol: "QQQ", direction: "long", entry: 525.40, exit: 528.10, size: 3, pnl: 340, pnlPct: 1.7, grade: "B", rating: 3, tags: ["Gap Fill", "Scalp"], hasScreenshot: true, aiAnalyzed: false },
  { id: 5, date: "2026-02-05", symbol: "SPX", direction: "short", entry: 6010.00, exit: 6022.50, size: 2, pnl: -150, pnlPct: -0.8, grade: "C+", rating: 2, tags: ["Counter-trend"], hasScreenshot: false, aiAnalyzed: false },
  { id: 6, date: "2026-02-04", symbol: "NDX", direction: "long", entry: 21320.00, exit: 21485.00, size: 1, pnl: 720, pnlPct: 3.6, grade: "A", rating: 5, tags: ["Breakout", "High Volume"], hasScreenshot: true, aiAnalyzed: true },
  { id: 7, date: "2026-02-03", symbol: "SPY", direction: "short", entry: 598.50, exit: 595.20, size: 4, pnl: 460, pnlPct: 2.3, grade: "A-", rating: 4, tags: ["Reversal"], hasScreenshot: false, aiAnalyzed: true },
];

const filterPresets = ["Today", "This Week", "This Month", "3M", "YTD", "All"];
const quickTags = ["Breakout", "Reversal", "Support Bounce", "Momentum", "Scalp", "Swing", "Gap Fill", "High Volume", "Earnings", "FOMC"];

// ─── Styles ───
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
function GradeCircle({ grade, size = 28 }) {
  const colors = { A: "#10B981", B: "#F3E5AB", C: "#F59E0B", D: "#EF4444", F: "#EF4444" };
  const color = colors[grade?.[0]] || "#9A9A9A";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", display: "flex",
      alignItems: "center", justifyContent: "center",
      background: `${color}20`, border: `1px solid ${color}40`,
      fontSize: size * 0.4, fontWeight: 600, color,
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

function StarRating({ rating, size = 14 }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} size={size} fill={s <= rating ? "#10B981" : "none"} stroke={s <= rating ? "#10B981" : "#333"} />
      ))}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ ...glass, padding: "12px 16px", minWidth: 130, flex: "0 0 auto" }}>
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "#9A9A9A", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, fontFamily: "'Geist Mono', monospace", color: color || "#F5F5F0" }}>{value}</div>
    </div>
  );
}

// ─── Entry Detail Sheet ───
function EntryDetailSheet({ entry, onClose, isMobile }) {
  if (!entry) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60,
      display: "flex", justifyContent: isMobile ? "center" : "flex-end",
      alignItems: isMobile ? "flex-end" : "stretch",
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }} />
      {/* Panel */}
      <div style={{
        position: "relative", width: isMobile ? "100%" : 560,
        height: isMobile ? "92vh" : "100vh",
        background: "#0D0D0E", borderLeft: isMobile ? "none" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: isMobile ? "16px 16px 0 0" : 0,
        overflowY: "auto", padding: isMobile ? 20 : 32,
      }}>
        {/* Drag Handle (mobile) */}
        {isMobile && (
          <div style={{ width: 32, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 16px" }} />
        )}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 600, color: "#F5F5F0", margin: 0 }}>
              {entry.symbol} <span style={{ color: entry.pnl >= 0 ? "#10B981" : "#EF4444", fontSize: 18 }}>{entry.direction.toUpperCase()}</span>
            </h2>
            <p style={{ fontSize: 13, color: "#9A9A9A", margin: "4px 0 0" }}>{new Date(entry.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} style={{ color: "#9A9A9A" }} />
          </button>
        </div>

        {/* Screenshot Placeholder */}
        {entry.hasScreenshot && (
          <div style={{
            ...glass, height: 200, display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20, background: "rgba(255,255,255,0.02)",
            backgroundImage: "linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(6,78,59,0.05) 100%)",
          }}>
            <div style={{ textAlign: "center" }}>
              <Camera size={32} style={{ color: "#9A9A9A", marginBottom: 8 }} />
              <p style={{ fontSize: 12, color: "#9A9A9A" }}>Trade Screenshot</p>
            </div>
          </div>
        )}

        {/* Trade Summary */}
        <div style={{ ...glass, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#9A9A9A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Entry</div>
              <div style={{ fontSize: 16, fontFamily: "'Geist Mono', monospace", fontWeight: 600, color: "#F5F5F0" }}>${entry.entry?.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#9A9A9A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Exit</div>
              <div style={{ fontSize: 16, fontFamily: "'Geist Mono', monospace", fontWeight: 600, color: "#F5F5F0" }}>${entry.exit?.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#9A9A9A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Size</div>
              <div style={{ fontSize: 16, fontFamily: "'Geist Mono', monospace", fontWeight: 600, color: "#F5F5F0" }}>{entry.size}</div>
            </div>
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "14px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: "#9A9A9A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>P&L</div>
              <div style={{
                fontSize: 24, fontFamily: "'Geist Mono', monospace", fontWeight: 700,
                color: entry.pnl >= 0 ? "#10B981" : "#EF4444",
              }}>
                {entry.pnl >= 0 ? "+" : ""}${Math.abs(entry.pnl).toLocaleString()}
                <span style={{ fontSize: 14, marginLeft: 6, opacity: 0.8 }}>({entry.pnl >= 0 ? "+" : ""}{entry.pnlPct}%)</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <GradeCircle grade={entry.grade} size={40} />
              <StarRating rating={entry.rating} />
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        {entry.aiAnalysis && (
          <div style={{
            ...glass, padding: 20, marginBottom: 20,
            borderColor: "rgba(243,229,171,0.15)",
            boxShadow: "0 0 20px rgba(243,229,171,0.03)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Sparkles size={16} style={{ color: "#F3E5AB" }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#F3E5AB", margin: 0 }}>AI Analysis</h3>
            </div>
            <p style={{ fontSize: 13, color: "#B8B5AD", lineHeight: 1.6, margin: "0 0 14px" }}>{entry.aiAnalysis.summary}</p>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#10B981", marginBottom: 6 }}>Strengths</div>
              {entry.aiAnalysis.strengths.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "#9A9A9A", marginBottom: 4, alignItems: "flex-start" }}>
                  <span style={{ color: "#10B981", flexShrink: 0 }}>✓</span> {s}
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#F59E0B", marginBottom: 6 }}>Areas to Improve</div>
              {entry.aiAnalysis.improvements.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "#9A9A9A", marginBottom: 4, alignItems: "flex-start" }}>
                  <span style={{ color: "#F59E0B", flexShrink: 0 }}>→</span> {s}
                </div>
              ))}
            </div>

            <div style={{
              padding: 12, borderRadius: 8, background: "rgba(243,229,171,0.04)",
              border: "1px solid rgba(243,229,171,0.08)", marginTop: 12,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#F3E5AB", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>Coach's Note</div>
              <p style={{ fontSize: 12, color: "#B8B5AD", fontStyle: "italic", margin: 0, lineHeight: 1.5 }}>{entry.aiAnalysis.coaching}</p>
            </div>

            <button style={{
              marginTop: 14, width: "100%", padding: "10px", borderRadius: 8,
              background: "transparent", border: "1px solid rgba(243,229,171,0.2)",
              color: "#F3E5AB", fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}>
              <Bot size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              Discuss with AI Coach →
            </button>
          </div>
        )}

        {/* Notes */}
        {entry.notes && (
          <div style={{ ...glass, padding: 16, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#F5F5F0", margin: "0 0 12px" }}>Trade Notes</h3>
            {Object.entries(entry.notes).map(([key, value]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#9A9A9A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{key.replace("_", " ")}</div>
                <p style={{ fontSize: 13, color: "#B8B5AD", margin: 0, lineHeight: 1.5 }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {entry.tags.map(tag => (
            <span key={tag} style={{
              fontSize: 11, padding: "4px 10px", borderRadius: 20,
              background: "rgba(16,185,129,0.08)", color: "#10B981",
              border: "1px solid rgba(16,185,129,0.15)",
            }}>{tag}</span>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{
            flex: 1, padding: "12px", borderRadius: 10,
            background: "linear-gradient(135deg, #10B981, #047857)",
            border: "none", color: "white", fontSize: 13, fontWeight: 500, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Share2 size={16} /> Share Trade Card
          </button>
          <button style={{
            padding: "12px 16px", borderRadius: 10,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#F5F5F0", cursor: "pointer",
          }}>
            <Pencil size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Entry Sheet ───
function NewEntrySheet({ onClose, isMobile }) {
  const [activeNotesTab, setActiveNotesTab] = useState("setup");
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60,
      display: "flex", justifyContent: isMobile ? "center" : "flex-end",
      alignItems: isMobile ? "flex-end" : "stretch",
    }}>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }} />
      <div style={{
        position: "relative", width: isMobile ? "100%" : 560,
        height: isMobile ? "95vh" : "100vh",
        background: "#0D0D0E", borderLeft: isMobile ? "none" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: isMobile ? "16px 16px 0 0" : 0,
        overflowY: "auto", padding: isMobile ? 20 : 32,
      }}>
        {isMobile && (
          <div style={{ width: 32, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 16px" }} />
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 600, color: "#F5F5F0", margin: 0 }}>Log Trade</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={20} style={{ color: "#9A9A9A" }} />
          </button>
        </div>

        {/* Trade Details */}
        <div style={{ ...glass, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9A9A9A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Trade Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "#9A9A9A", display: "block", marginBottom: 6 }}>Date</label>
              <div style={{
                padding: "10px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#F5F5F0", fontSize: 14, display: "flex", alignItems: "center", gap: 8,
              }}>
                <Calendar size={14} style={{ color: "#9A9A9A" }} /> Feb 8, 2026
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#9A9A9A", display: "block", marginBottom: 6 }}>Symbol</label>
              <input placeholder="SPX" style={{
                padding: "10px 12px", borderRadius: 8, width: "100%", boxSizing: "border-box",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#F5F5F0", fontSize: 14, fontFamily: "'Geist Mono', monospace",
                textTransform: "uppercase", outline: "none",
              }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#9A9A9A", display: "block", marginBottom: 6 }}>Direction</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{
                flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)",
                color: "#10B981", cursor: "pointer",
              }}>LONG</button>
              <button style={{
                flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                color: "#9A9A9A", cursor: "pointer",
              }}>SHORT</button>
            </div>
          </div>
        </div>

        {/* Screenshot Upload */}
        <div style={{
          ...glass, padding: 20, marginBottom: 16, textAlign: "center",
          borderStyle: "dashed", cursor: "pointer",
        }}>
          <Upload size={28} style={{ color: "#9A9A9A", marginBottom: 8 }} />
          <p style={{ fontSize: 13, color: "#9A9A9A", margin: "0 0 4px" }}>Drop screenshot or click to upload</p>
          <p style={{ fontSize: 11, color: "#666", margin: 0 }}>PNG, JPG, WebP (max 5MB)</p>
        </div>

        <button style={{
          width: "100%", padding: "12px", borderRadius: 10, marginBottom: 16,
          background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,78,59,0.12))",
          border: "1px solid rgba(16,185,129,0.25)",
          color: "#10B981", fontSize: 14, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <Sparkles size={16} /> Analyze with AI
        </button>

        {/* Prices */}
        <div style={{ ...glass, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9A9A9A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Price & P&L</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            {["Entry Price", "Exit Price", "Position Size", "P&L ($)"].map(field => (
              <div key={field}>
                <label style={{ fontSize: 11, color: "#9A9A9A", display: "block", marginBottom: 6 }}>{field}</label>
                <input placeholder={field === "P&L ($)" ? "Auto-calc" : "0.00"} style={{
                  padding: "10px 12px", borderRadius: 8, width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#F5F5F0", fontSize: 14, fontFamily: "'Geist Mono', monospace", outline: "none",
                }} />
              </div>
            ))}
          </div>
        </div>

        {/* Notes Tabs */}
        <div style={{ ...glass, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
            {["setup", "execution", "lessons"].map(tab => (
              <button key={tab} onClick={() => setActiveNotesTab(tab)} style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                background: activeNotesTab === tab ? "rgba(16,185,129,0.12)" : "transparent",
                color: activeNotesTab === tab ? "#10B981" : "#9A9A9A",
                border: activeNotesTab === tab ? "1px solid rgba(16,185,129,0.2)" : "1px solid transparent",
                cursor: "pointer", textTransform: "capitalize",
              }}>{tab}</button>
            ))}
          </div>
          <textarea placeholder={
            activeNotesTab === "setup" ? "What was your trade thesis? What levels were you watching?"
              : activeNotesTab === "execution" ? "How did you execute? Any adjustments?"
              : "What did you learn from this trade?"
          } style={{
            width: "100%", height: 80, padding: 12, borderRadius: 8, boxSizing: "border-box",
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            color: "#F5F5F0", fontSize: 13, outline: "none", resize: "vertical",
            fontFamily: "'Inter', sans-serif", lineHeight: 1.5,
          }} />
        </div>

        {/* Tags */}
        <div style={{ ...glass, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9A9A9A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Quick Tags</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {quickTags.slice(0, isMobile ? 6 : 10).map(tag => (
              <button key={tag} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                color: "#9A9A9A", cursor: "pointer",
              }}>{tag}</button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: "#9A9A9A", marginBottom: 6 }}>Rating</div>
            <StarRating rating={0} size={20} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, marginBottom: isMobile ? 40 : 0 }}>
          <button onClick={onClose} style={{
            padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
            color: "#9A9A9A", cursor: "pointer",
          }}>Cancel</button>
          <button style={{
            flex: 1, padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 600,
            background: "linear-gradient(135deg, #10B981, #047857)",
            border: "none", color: "white", cursor: "pointer",
          }}>Save & Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───
export default function TradeJournalMockup() {
  const [view, setView] = useState("desktop");
  const [viewMode, setViewMode] = useState("table");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [datePreset, setDatePreset] = useState("This Month");
  const [direction, setDirection] = useState("all");

  const isMobile = view === "mobile";

  const JournalContent = () => (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isMobile ? 16 : 28 }}>
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif", fontSize: isMobile ? 20 : 28,
          fontWeight: 600, color: "#F5F5F0", margin: 0, letterSpacing: "-0.02em",
        }}>Trade Journal</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {!isMobile && (
            <button style={{
              padding: "10px 16px", borderRadius: 8, fontSize: 13,
              background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
              color: "#9A9A9A", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}>
              <Download size={14} /> Export
            </button>
          )}
          <button onClick={() => setShowNewEntry(true)} style={{
            padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: "linear-gradient(135deg, #10B981, #047857)",
            border: "none", color: "white", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
          }}>
            <Plus size={16} /> {isMobile ? "New" : "New Entry"}
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{
        display: "flex", gap: isMobile ? 8 : 12, marginBottom: isMobile ? 12 : 20,
        overflowX: "auto", paddingBottom: 4,
      }}>
        <MiniStat label="Total Trades" value="18" />
        <MiniStat label="Win Rate" value="68.4%" color="#10B981" />
        <MiniStat label="Avg P&L" value="+$367" color="#10B981" />
        <MiniStat label="Profit Factor" value="2.4" color="#F3E5AB" />
        {!isMobile && <MiniStat label="Best Trade" value="+$840" color="#10B981" />}
        {!isMobile && <MiniStat label="Worst Trade" value="-$220" color="#EF4444" />}
      </div>

      {/* Filter Bar */}
      <div style={{
        ...glass, padding: isMobile ? 12 : 16, marginBottom: isMobile ? 12 : 20,
        display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
      }}>
        {/* Date Presets */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", flex: isMobile ? "1 1 100%" : "0 0 auto" }}>
          {filterPresets.map(p => (
            <button key={p} onClick={() => setDatePreset(p)} style={{
              padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500,
              whiteSpace: "nowrap",
              background: datePreset === p ? "rgba(16,185,129,0.12)" : "transparent",
              color: datePreset === p ? "#10B981" : "#9A9A9A",
              border: datePreset === p ? "1px solid rgba(16,185,129,0.2)" : "1px solid transparent",
              cursor: "pointer",
            }}>{p}</button>
          ))}
        </div>

        {!isMobile && (
          <>
            {/* Symbol Search */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
              borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <Search size={14} style={{ color: "#9A9A9A" }} />
              <input placeholder="Symbol..." style={{
                background: "transparent", border: "none", color: "#F5F5F0", fontSize: 12,
                width: 80, outline: "none", fontFamily: "'Geist Mono', monospace",
              }} />
            </div>

            {/* Direction */}
            <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {["all", "long", "short"].map(d => (
                <button key={d} onClick={() => setDirection(d)} style={{
                  padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                  background: direction === d ? (d === "long" ? "rgba(16,185,129,0.15)" : d === "short" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)") : "transparent",
                  color: direction === d ? (d === "long" ? "#10B981" : d === "short" ? "#EF4444" : "#F5F5F0") : "#9A9A9A",
                  border: "none", cursor: "pointer", textTransform: "capitalize",
                }}>{d}</button>
              ))}
            </div>

            {/* View Toggle */}
            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              <button onClick={() => setViewMode("table")} style={{
                padding: 6, borderRadius: 6, background: viewMode === "table" ? "rgba(16,185,129,0.12)" : "transparent",
                border: "none", cursor: "pointer",
              }}>
                <List size={16} style={{ color: viewMode === "table" ? "#10B981" : "#9A9A9A" }} />
              </button>
              <button onClick={() => setViewMode("cards")} style={{
                padding: 6, borderRadius: 6, background: viewMode === "cards" ? "rgba(16,185,129,0.12)" : "transparent",
                border: "none", cursor: "pointer",
              }}>
                <Grid3X3 size={16} style={{ color: viewMode === "cards" ? "#10B981" : "#9A9A9A" }} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* TABLE VIEW */}
      {(viewMode === "table" && !isMobile) && (
        <div style={{ ...glass, overflow: "hidden" }}>
          {/* Table Header */}
          <div style={{
            display: "grid", gridTemplateColumns: "90px 70px 70px 90px 90px 100px 100px 50px 70px 80px",
            padding: "12px 16px", background: "rgba(255,255,255,0.03)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            {["Date", "Symbol", "Dir", "Entry", "Exit", "P&L", "P&L %", "Grade", "Rating", "Actions"].map(h => (
              <span key={h} style={{
                fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "#9A9A9A",
                textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
              }}>
                {h} {["Date", "P&L", "P&L %", "Grade"].includes(h) && <ArrowUpDown size={10} />}
              </span>
            ))}
          </div>

          {/* Table Rows */}
          {journalEntries.map((entry, i) => (
            <div key={entry.id} onClick={() => setSelectedEntry(entry)} style={{
              display: "grid", gridTemplateColumns: "90px 70px 70px 90px 90px 100px 100px 50px 70px 80px",
              padding: "14px 16px", alignItems: "center",
              borderBottom: i < journalEntries.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              borderLeft: `2px solid ${entry.pnl >= 0 ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.3)"}`,
              cursor: "pointer", transition: "background 0.15s ease",
            }}>
              <span style={{ fontSize: 12, color: "#9A9A9A" }}>
                {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <span style={{ fontSize: 13, fontFamily: "'Geist Mono', monospace", fontWeight: 600, color: "#F5F5F0" }}>{entry.symbol}</span>
              <DirectionBadge direction={entry.direction} />
              <span style={{ fontSize: 12, fontFamily: "'Geist Mono', monospace", color: "#9A9A9A" }}>${entry.entry?.toLocaleString()}</span>
              <span style={{ fontSize: 12, fontFamily: "'Geist Mono', monospace", color: "#9A9A9A" }}>${entry.exit?.toLocaleString()}</span>
              <span style={{
                fontSize: 13, fontFamily: "'Geist Mono', monospace", fontWeight: 600,
                color: entry.pnl >= 0 ? "#10B981" : "#EF4444",
              }}>
                {entry.pnl >= 0 ? "+" : ""}${Math.abs(entry.pnl)}
              </span>
              <span style={{
                fontSize: 12, fontFamily: "'Geist Mono', monospace",
                color: entry.pnl >= 0 ? "#10B981" : "#EF4444",
              }}>
                {entry.pnl >= 0 ? "+" : ""}{entry.pnlPct}%
              </span>
              <GradeCircle grade={entry.grade} size={26} />
              <StarRating rating={entry.rating} size={11} />
              <div style={{ display: "flex", gap: 4 }}>
                <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <Share2 size={14} style={{ color: "#9A9A9A" }} />
                </button>
                <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <Pencil size={14} style={{ color: "#9A9A9A" }} />
                </button>
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)",
          }}>
            <span style={{ fontSize: 12, color: "#9A9A9A" }}>Showing 1-7 of 18 entries</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={{ padding: "4px 8px", borderRadius: 4, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#9A9A9A", cursor: "pointer", fontSize: 12 }}>
                <ChevronLeft size={14} />
              </button>
              {[1, 2, 3].map(p => (
                <button key={p} style={{
                  padding: "4px 10px", borderRadius: 4, fontSize: 12,
                  background: p === 1 ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.05)",
                  border: p === 1 ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(255,255,255,0.08)",
                  color: p === 1 ? "#10B981" : "#9A9A9A", cursor: "pointer",
                }}>{p}</button>
              ))}
              <button style={{ padding: "4px 8px", borderRadius: 4, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#9A9A9A", cursor: "pointer", fontSize: 12 }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CARD VIEW (Desktop) or DEFAULT MOBILE */}
      {(viewMode === "cards" || isMobile) && (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap: isMobile ? 10 : 16,
          marginBottom: isMobile ? 80 : 0,
        }}>
          {journalEntries.map(entry => (
            <div key={entry.id} onClick={() => setSelectedEntry(entry)} style={{
              ...glass, padding: 16, cursor: "pointer", transition: "all 0.2s ease",
              borderTop: `2px solid ${entry.pnl >= 0 ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.4)"}`,
            }}>
              {/* Card Top */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18, fontFamily: "'Geist Mono', monospace", fontWeight: 700, color: "#F5F5F0" }}>{entry.symbol}</span>
                  <DirectionBadge direction={entry.direction} />
                </div>
                <span style={{
                  fontSize: 18, fontFamily: "'Geist Mono', monospace", fontWeight: 700,
                  color: entry.pnl >= 0 ? "#10B981" : "#EF4444",
                }}>
                  {entry.pnl >= 0 ? "+" : ""}${Math.abs(entry.pnl)}
                </span>
              </div>
              {/* Card Middle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "#9A9A9A" }}>
                  {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  <span style={{ margin: "0 8px", opacity: 0.3 }}>|</span>
                  <span style={{ color: entry.pnl >= 0 ? "#10B981" : "#EF4444" }}>{entry.pnl >= 0 ? "+" : ""}{entry.pnlPct}%</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <GradeCircle grade={entry.grade} size={24} />
                  <StarRating rating={entry.rating} size={11} />
                </div>
              </div>
              {/* Card Tags */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {entry.tags.slice(0, 2).map(tag => (
                  <span key={tag} style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 10,
                    background: "rgba(255,255,255,0.04)", color: "#9A9A9A",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>{tag}</span>
                ))}
                {entry.hasScreenshot && <Image size={12} style={{ color: "#9A9A9A", marginLeft: 4, alignSelf: "center" }} />}
                {entry.aiAnalyzed && <Sparkles size={12} style={{ color: "#F3E5AB", marginLeft: 2, alignSelf: "center" }} />}
              </div>
              {/* Card Actions */}
              <div style={{
                display: "flex", gap: 6, marginTop: 10, paddingTop: 10,
                borderTop: "1px solid rgba(255,255,255,0.05)",
              }}>
                <button style={{
                  flex: 1, padding: "6px", borderRadius: 6, fontSize: 11,
                  background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                  color: "#9A9A9A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                }}>
                  <Share2 size={12} /> Share
                </button>
                <button style={{
                  flex: 1, padding: "6px", borderRadius: 6, fontSize: 11,
                  background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                  color: "#9A9A9A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                }}>
                  <Pencil size={12} /> Edit
                </button>
                <button style={{
                  padding: "6px 10px", borderRadius: 6, fontSize: 11,
                  background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                  color: "#9A9A9A", cursor: "pointer",
                }}>
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ─── Sidebar (simplified for journal page) ───
  const Sidebar = () => (
    <div style={{
      width: 280, height: "100%", position: "fixed", left: 0, top: 0,
      background: "rgba(10,10,11,0.95)", backdropFilter: "blur(40px)",
      borderRight: "1px solid rgba(255,255,255,0.08)", zIndex: 40,
      display: "flex", flexDirection: "column", padding: "24px 0",
    }}>
      <div style={{ padding: "0 24px 20px" }}>
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
      </div>
      <nav style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {[
          { label: "Command Center", icon: LayoutDashboard },
          { label: "Trade Journal", icon: BookOpen, active: true },
          { label: "AI Coach", icon: Bot, badge: "Beta" },
          { label: "Training Library", icon: GraduationCap },
          { label: "Profile", icon: UserCircle },
        ].map(tab => (
          <button key={tab.label} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 12px", borderRadius: 8,
            background: tab.active ? "rgba(16,185,129,0.08)" : "transparent",
            border: "none", cursor: "pointer", width: "100%", textAlign: "left",
            borderLeft: tab.active ? "3px solid #F3E5AB" : "3px solid transparent",
          }}>
            <tab.icon size={18} style={{ color: tab.active ? "#10B981" : "#9A9A9A" }} />
            <span style={{ fontSize: 14, fontWeight: tab.active ? 500 : 400, color: tab.active ? "#F5F5F0" : "#9A9A9A", flex: 1 }}>{tab.label}</span>
            {tab.badge && (
              <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 10, background: "rgba(16,185,129,0.15)", color: "#10B981", border: "1px solid rgba(16,185,129,0.25)" }}>{tab.badge}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );

  // ─── Mobile Top/Bottom bars ───
  const MobileTopBar = () => (
    <div style={{
      height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 16px", background: "rgba(10,10,11,0.95)", backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      <Menu size={22} style={{ color: "#F5F5F0" }} />
      <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, fontWeight: 600, color: "#F5F5F0" }}>TradeITM</span>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #10B981, #047857)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "white" }}>N</div>
    </div>
  );
  const MobileBottomNav = () => (
    <div style={{
      height: 64, display: "flex", alignItems: "center", justifyContent: "space-around",
      background: "rgba(10,10,11,0.98)", borderTop: "1px solid rgba(255,255,255,0.06)",
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
    }}>
      {[
        { id: "dashboard", label: "Home", icon: LayoutDashboard },
        { id: "journal", label: "Journal", icon: BookOpen, active: true },
        { id: "ai-coach", label: "AI Coach", icon: Bot },
        { id: "profile", label: "Profile", icon: UserCircle },
      ].map(tab => (
        <div key={tab.id} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 12px",
        }}>
          <tab.icon size={20} style={{ color: tab.active ? "#10B981" : "#9A9A9A" }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: tab.active ? "#10B981" : "#9A9A9A" }}>{tab.label}</span>
        </div>
      ))}
    </div>
  );

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
          <button key={v} onClick={() => { setView(v); if (v === "mobile") setViewMode("cards"); }} style={{
            padding: "8px 16px", borderRadius: 7, fontSize: 12, fontWeight: 500,
            background: view === v ? "rgba(16,185,129,0.15)" : "transparent",
            color: view === v ? "#10B981" : "#9A9A9A",
            border: "none", cursor: "pointer",
          }}>
            {v === "desktop" ? "🖥 Desktop" : "📱 Mobile"}
          </button>
        ))}
      </div>

      {isMobile ? (
        <div style={{
          maxWidth: 390, margin: "60px auto 0", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20, overflow: "hidden", background: "#0A0A0B",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}>
          <MobileTopBar />
          <div style={{ height: "calc(100vh - 200px)", overflowY: "auto" }}>
            <JournalContent />
          </div>
          <MobileBottomNav />
        </div>
      ) : (
        <div style={{ background: "#0A0A0B", minHeight: "100vh" }}>
          <Sidebar />
          <div style={{ marginLeft: 280, minHeight: "100vh" }}>
            <JournalContent />
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      {selectedEntry && (
        <EntryDetailSheet entry={selectedEntry} onClose={() => setSelectedEntry(null)} isMobile={isMobile} />
      )}

      {/* New Entry Sheet */}
      {showNewEntry && (
        <NewEntrySheet onClose={() => setShowNewEntry(false)} isMobile={isMobile} />
      )}
    </div>
  );
}
