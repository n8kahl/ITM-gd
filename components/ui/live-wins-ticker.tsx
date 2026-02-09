"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef, memo } from "react";
import { TrendingUp, DollarSign } from "lucide-react";

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

export const LiveWinsTicker = memo(function LiveWinsTicker() {
  const [wins, setWins] = useState<WinEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isMobile = useIsMobile();
  const isVisible = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    // Initialize with fewer wins on mobile
    const initialCount = isMobile ? 3 : 5;
    const initialWins = SAMPLE_WINS.slice(0, initialCount).map((w, i) => ({
      ...w,
      id: i,
      time: generateTime(),
    }));
    setWins(initialWins);
  }, [isMobile]);

  useEffect(() => {
    // Slower interval on mobile (6s vs 4s)
    const intervalDuration = isMobile ? 6000 : 4000;
    const maxWins = isMobile ? 3 : 5;

    const interval = setInterval(() => {
      // Skip update if not visible
      if (!isVisible.current) return;

      setCurrentIndex((prev) => {
        const nextIndex = (prev + 1) % SAMPLE_WINS.length;
        setWins((prevWins) => {
          const newWin = {
            ...SAMPLE_WINS[nextIndex],
            id: Date.now(),
            time: "Just now",
          };
          return [newWin, ...prevWins.slice(0, maxWins - 1)];
        });
        return nextIndex;
      });
    }, intervalDuration);

    return () => clearInterval(interval);
  }, [isMobile]);

  // Reduced visible items on mobile
  const visibleWins = isMobile ? wins.slice(0, 3) : wins;

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
        </div>
        <span className="text-xs font-semibold tracking-widest text-emerald-400/80 uppercase">
          Live Member Wins
        </span>
      </div>

      {/* Wins Feed - Reduced height on mobile */}
      <div className={`relative overflow-hidden ${isMobile ? 'h-[120px]' : 'h-[180px]'}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050505] pointer-events-none z-10" />

        {/* Use AnimatePresence with mode="popLayout" for smoother transitions */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div layout="position" className="space-y-2">
            {visibleWins.map((win, index) => (
              <motion.div
                key={win.id}
                layout
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1 - index * 0.2, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{
                  duration: 0.3,
                  ease: "easeOut",
                  layout: { duration: 0.2 }
                }}
                className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-[rgba(16,185,129,0.08)] border border-emerald-500/20 backdrop-blur-sm will-change-transform"
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
        </AnimatePresence>
      </div>
    </div>
  );
});

// Compact inline ticker for hero section
export const HeroWinsBadge = memo(function HeroWinsBadge() {
  const [currentWin, setCurrentWin] = useState(0);
  const isVisible = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isVisible.current) return;
      setCurrentWin((prev) => (prev + 1) % SAMPLE_WINS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const win = SAMPLE_WINS[currentWin];

  return (
    <motion.div
      ref={containerRef}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
      </div>
      <AnimatePresence mode="wait">
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
      </AnimatePresence>
    </motion.div>
  );
});
