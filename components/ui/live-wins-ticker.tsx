"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { TrendingUp, DollarSign, Zap } from "lucide-react";

interface WinEvent {
  id: number;
  trader: string;
  ticker: string;
  gain: string;
  time: string;
}

const SAMPLE_WINS: Omit<WinEvent, "id" | "time">[] = [
  { trader: "M. Chen", ticker: "NVDA", gain: "+142%" },
  { trader: "S. Rodriguez", ticker: "TSLA", gain: "+87%" },
  { trader: "D. Park", ticker: "SPY", gain: "+156%" },
  { trader: "Elite Member", ticker: "AAPL", gain: "+203%" },
  { trader: "J. Miller", ticker: "AMD", gain: "+118%" },
  { trader: "A. Thompson", ticker: "META", gain: "+94%" },
  { trader: "Elite Member", ticker: "GOOGL", gain: "+167%" },
  { trader: "R. Garcia", ticker: "AMZN", gain: "+131%" },
  { trader: "L. Kim", ticker: "MSFT", gain: "+89%" },
  { trader: "Elite Member", ticker: "QQQ", gain: "+245%" },
];

function generateTime(): string {
  const minutes = Math.floor(Math.random() * 59) + 1;
  return `${minutes}m ago`;
}

export function LiveWinsTicker() {
  const [wins, setWins] = useState<WinEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Initialize with a few wins
    const initialWins = SAMPLE_WINS.slice(0, 5).map((w, i) => ({
      ...w,
      id: i,
      time: generateTime(),
    }));
    setWins(initialWins);
  }, []);

  useEffect(() => {
    // Add new wins periodically
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const nextIndex = (prev + 1) % SAMPLE_WINS.length;
        setWins((prevWins) => {
          const newWin = {
            ...SAMPLE_WINS[nextIndex],
            id: Date.now(),
            time: "Just now",
          };
          return [newWin, ...prevWins.slice(0, 4)];
        });
        return nextIndex;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
        </div>
        <span className="text-xs font-mono tracking-widest text-emerald-400/80 uppercase">
          Live Member Wins
        </span>
      </div>

      {/* Wins Feed */}
      <div className="relative h-[180px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050505] pointer-events-none z-10" />

        <motion.div layout className="space-y-2">
          {wins.map((win, index) => (
            <motion.div
              key={win.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1 - index * 0.15, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-[rgba(16,185,129,0.08)] border border-emerald-500/20 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ivory/90">{win.trader}</span>
                    <span className="text-xs text-muted-foreground/60">•</span>
                    <span className="text-xs font-mono text-muted-foreground">{win.ticker}</span>
                  </div>
                  <span className="text-xs text-muted-foreground/60">{win.time}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-lg font-bold text-emerald-400 font-mono">{win.gain}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

// Compact inline ticker for hero section
export function HeroWinsBadge() {
  const [currentWin, setCurrentWin] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWin((prev) => (prev + 1) % SAMPLE_WINS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const win = SAMPLE_WINS[currentWin];

  return (
    <motion.div
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
      </div>
      <motion.div
        key={currentWin}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2"
      >
        <span className="text-xs text-ivory/70">{win.trader} just hit</span>
        <span className="text-sm font-bold text-emerald-400 font-mono">{win.gain}</span>
        <span className="text-xs text-ivory/70">on {win.ticker}</span>
      </motion.div>
    </motion.div>
  );
}
