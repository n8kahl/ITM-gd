"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RibbonDividerProps {
  className?: string;
  flip?: boolean;
}

export function RibbonDivider({ className, flip = false }: RibbonDividerProps) {
  return (
    <motion.div
      className={cn(
        "relative w-full h-20 md:h-28 overflow-hidden",
        flip && "scale-y-[-1]",
        className
      )}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      {/* Terminal Grid Background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 230, 118, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 230, 118, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Central Glowing Line */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
        {/* Main line */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        {/* Glow effect */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 bg-gradient-to-r from-transparent via-primary/10 to-transparent blur-sm" />
      </div>

      {/* Animated Data Streams */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Stream 1 */}
        <motion.div
          className="absolute h-[1px] w-32 bg-gradient-to-r from-transparent via-primary/60 to-transparent"
          style={{ top: "30%" }}
          animate={{
            x: ["-10%", "110%"],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
            repeatDelay: 1,
          }}
        />

        {/* Stream 2 */}
        <motion.div
          className="absolute h-[1px] w-20 bg-gradient-to-r from-transparent via-primary/40 to-transparent"
          style={{ top: "70%" }}
          animate={{
            x: ["110%", "-10%"],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "linear",
            delay: 0.5,
            repeatDelay: 0.5,
          }}
        />

        {/* Stream 3 */}
        <motion.div
          className="absolute h-[1px] w-16 bg-gradient-to-r from-transparent via-platinum/30 to-transparent"
          style={{ top: "45%" }}
          animate={{
            x: ["-10%", "110%"],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "linear",
            delay: 1.5,
            repeatDelay: 2,
          }}
        />
      </div>

      {/* Corner Nodes */}
      <div className="absolute left-8 md:left-16 top-1/2 -translate-y-1/2 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-primary/30 animate-pulse" />
        <div className="w-1 h-1 rounded-full bg-primary/20" />
        <div className="w-1 h-1 rounded-full bg-primary/10" />
      </div>

      <div className="absolute right-8 md:right-16 top-1/2 -translate-y-1/2 flex items-center gap-2">
        <div className="w-1 h-1 rounded-full bg-primary/10" />
        <div className="w-1 h-1 rounded-full bg-primary/20" />
        <div className="w-2 h-2 rounded-full bg-primary/30 animate-pulse" />
      </div>

      {/* Edge Fades */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-void to-transparent" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-void to-transparent" />
      <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-void to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-void to-transparent" />
    </motion.div>
  );
}
