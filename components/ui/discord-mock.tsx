"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DiscordMessage {
  id: number;
  type: "bot" | "user";
  username: string;
  avatar: string;
  content: string;
  timestamp: string;
  highlight?: boolean;
}

const messages: DiscordMessage[] = [
  {
    id: 1,
    type: "bot",
    username: "ITM Signals",
    avatar: "🤖",
    content: "🚨 SIGNAL ALERT: buy NVDA 1000C @ 2.50",
    timestamp: "Today at 9:32 AM",
    highlight: true,
  },
  {
    id: 2,
    type: "user",
    username: "TraderMike",
    avatar: "TM",
    content: "In! 🔥",
    timestamp: "Today at 9:32 AM",
  },
  {
    id: 3,
    type: "user",
    username: "StockQueen",
    avatar: "SQ",
    content: "Got 5 contracts! Let's go",
    timestamp: "Today at 9:33 AM",
  },
  {
    id: 4,
    type: "bot",
    username: "ITM Signals",
    avatar: "🤖",
    content: "✅ TARGET HIT: NVDA now 3.20 (+28%) 💰",
    timestamp: "Today at 10:45 AM",
    highlight: true,
  },
  {
    id: 5,
    type: "user",
    username: "TraderMike",
    avatar: "TM",
    content: "Just printed $500 thanks! 🎉",
    timestamp: "Today at 10:46 AM",
  },
];

interface DiscordMockProps {
  className?: string;
}

export function DiscordMock({ className }: DiscordMockProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col overflow-hidden rounded-lg",
        className
      )}
      style={{ backgroundColor: "#36393f" }}
    >
      {/* Discord Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b shrink-0"
        style={{
          backgroundColor: "#2f3136",
          borderColor: "rgba(0,0,0,0.3)",
        }}
      >
        <span className="text-[#8e9297] text-sm font-medium">#</span>
        <span className="text-white text-sm font-semibold flex items-center gap-1.5">
          <span>🚀</span>
          <span>winning-signals</span>
        </span>
        <div className="ml-auto flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[#8e9297] text-[10px]">LIVE</span>
        </div>
      </div>

      {/* Messages Container */}
      <div
        className="flex-1 px-3 py-2 overflow-hidden"
        style={{ backgroundColor: "#36393f" }}
      >
        <div className="flex flex-col gap-2">
          {messages.map((msg, index) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: index * 0.6,
                ease: "easeOut",
              }}
              className={cn(
                "flex items-start gap-2 rounded px-2 py-1.5",
                msg.highlight && "bg-[rgba(88,101,242,0.1)]"
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                  msg.type === "bot"
                    ? "bg-[#5865f2] text-white"
                    : "bg-[#747f8d] text-white"
                )}
              >
                {msg.type === "bot" ? msg.avatar : msg.avatar}
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      msg.type === "bot" ? "text-[#5865f2]" : "text-[#ffffff]"
                    )}
                  >
                    {msg.username}
                  </span>
                  {msg.type === "bot" && (
                    <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-[#5865f2] text-white">
                      BOT
                    </span>
                  )}
                  <span className="text-[#72767d] text-[9px]">
                    {msg.timestamp}
                  </span>
                </div>
                <p
                  className={cn(
                    "text-xs leading-relaxed mt-0.5 break-words",
                    msg.highlight
                      ? "text-white font-medium"
                      : "text-[#dcddde]"
                  )}
                >
                  {msg.content}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Input Bar (decorative) */}
      <div
        className="px-3 py-2 shrink-0"
        style={{ backgroundColor: "#2f3136" }}
      >
        <div
          className="rounded px-3 py-1.5 text-[#72767d] text-[10px]"
          style={{ backgroundColor: "#40444b" }}
        >
          Message #winning-signals
        </div>
      </div>
    </div>
  );
}
