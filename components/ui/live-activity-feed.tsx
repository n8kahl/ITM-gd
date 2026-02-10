"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { UserPlus, TrendingUp, Award } from "lucide-react";

interface Activity {
  id: number;
  type: "join" | "signal" | "win";
  user: string;
  action: string;
  time: string;
}

const activities: Activity[] = [
  { id: 1, type: "join", user: "Michael T.", action: "joined Pro", time: "2m ago" },
  { id: 2, type: "signal", user: "Signal Bot", action: "BTC Long +2.4%", time: "5m ago" },
  { id: 3, type: "win", user: "Sarah K.", action: "closed +$1,240", time: "8m ago" },
  { id: 4, type: "join", user: "David R.", action: "joined Elite", time: "12m ago" },
  { id: 5, type: "signal", user: "Signal Bot", action: "ETH Short +1.8%", time: "15m ago" },
  { id: 6, type: "join", user: "Emma L.", action: "joined Pro", time: "18m ago" },
  { id: 7, type: "win", user: "James W.", action: "closed +$890", time: "22m ago" },
  { id: 8, type: "signal", user: "Signal Bot", action: "SPX Call +3.2%", time: "25m ago" },
];

const icons = {
  join: UserPlus,
  signal: TrendingUp,
  win: Award,
};

export function LiveActivityFeed() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Rotate activities every 3 seconds
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activities.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const displayedActivities = useMemo(() => {
    return Array.from({ length: 3 }, (_, offset) => activities[(currentIndex + offset) % activities.length]);
  }, [currentIndex]);

  return (
    <div className="mt-16 md:mt-20">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground/60 font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Live Activity
        </div>
      </div>

      <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6">
        <AnimatePresence mode="popLayout">
          {displayedActivities.map((activity, idx) => {
            const Icon = icons[activity.type];
            return (
              <motion.div
                key={`${activity.id}-${currentIndex}-${idx}`}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-platinum/10 backdrop-blur-sm"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    activity.type === "join"
                      ? "bg-primary/20 text-primary"
                      : activity.type === "signal"
                        ? "bg-cyan-500/20 text-cyan-400"
                        : "bg-platinum/20 text-platinum"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-smoke/90">{activity.user}</span>
                  <span className="text-muted-foreground">{activity.action}</span>
                </div>
                <span className="text-xs text-muted-foreground/50 font-mono">
                  {activity.time}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
