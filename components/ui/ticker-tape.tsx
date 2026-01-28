"use client";

import { motion } from "framer-motion";

interface TickerItem {
  symbol: string;
  price: string;
  change: string;
  positive: boolean;
}

const tickerData: TickerItem[] = [
  { symbol: "BTC", price: "97,432.18", change: "+2.34%", positive: true },
  { symbol: "ETH", price: "3,891.56", change: "+1.87%", positive: true },
  { symbol: "SPX", price: "5,234.18", change: "+0.42%", positive: true },
  { symbol: "NVDA", price: "892.45", change: "+3.21%", positive: true },
  { symbol: "AAPL", price: "198.32", change: "-0.18%", positive: false },
  { symbol: "TSLA", price: "412.87", change: "+1.95%", positive: true },
  { symbol: "NDX", price: "18,432.90", change: "+0.67%", positive: true },
  { symbol: "DXY", price: "104.23", change: "-0.12%", positive: false },
  { symbol: "GOLD", price: "2,341.50", change: "+0.28%", positive: true },
  { symbol: "EUR/USD", price: "1.0842", change: "+0.15%", positive: true },
];

export function TickerTape() {
  // Duplicate for seamless loop
  const items = [...tickerData, ...tickerData];

  return (
    <div className="w-full overflow-hidden bg-void/50 backdrop-blur-sm border-b border-platinum/5">
      <motion.div
        className="flex items-center gap-12 py-2 opacity-30"
        animate={{
          x: [0, -50 * tickerData.length],
        }}
        transition={{
          duration: 60,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 whitespace-nowrap font-mono text-xs"
          >
            <span className="text-platinum font-semibold">{item.symbol}</span>
            <span className="text-smoke/60">${item.price}</span>
            <span
              className={
                item.positive ? "text-primary" : "text-red-500"
              }
            >
              {item.change}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
