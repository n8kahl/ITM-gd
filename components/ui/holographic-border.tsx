"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface HolographicBorderProps {
  children: ReactNode;
  className?: string;
  borderClassName?: string;
  glowIntensity?: "low" | "medium" | "high";
  animationSpeed?: "slow" | "normal" | "fast";
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

const glowIntensityMap = {
  low: "opacity-60",
  medium: "opacity-80",
  high: "opacity-100",
};

const animationSpeedMap = {
  slow: "6s",
  normal: "3s",
  fast: "1.5s",
};

const roundedMap = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

export function HolographicBorder({
  children,
  className,
  borderClassName,
  glowIntensity = "medium",
  animationSpeed = "normal",
  rounded = "xl",
}: HolographicBorderProps) {
  return (
    <div className={cn("relative group", className)}>
      {/* Holographic border layer */}
      <motion.div
        className={cn(
          "absolute -inset-[1px] -z-10",
          roundedMap[rounded],
          glowIntensityMap[glowIntensity],
          borderClassName
        )}
        style={{
          background: `conic-gradient(
            from var(--holo-angle, 0deg),
            #00E676 0deg,
            #00E5FF 60deg,
            #E5E4E2 120deg,
            #FF00E5 180deg,
            #00E676 240deg,
            #00E5FF 300deg,
            #00E676 360deg
          )`,
          animation: `holo-rotate ${animationSpeedMap[animationSpeed]} linear infinite`,
        }}
      />

      {/* Glow effect layer */}
      <motion.div
        className={cn(
          "absolute -inset-[2px] -z-20 blur-md",
          roundedMap[rounded],
          "opacity-0 group-hover:opacity-50 transition-opacity duration-500"
        )}
        style={{
          background: `conic-gradient(
            from var(--holo-angle, 0deg),
            #00E676 0deg,
            #00E5FF 60deg,
            #E5E4E2 120deg,
            #FF00E5 180deg,
            #00E676 240deg,
            #00E5FF 300deg,
            #00E676 360deg
          )`,
          animation: `holo-rotate ${animationSpeedMap[animationSpeed]} linear infinite`,
        }}
      />

      {/* Content container */}
      <div className={cn("relative z-10", roundedMap[rounded])}>
        {children}
      </div>
    </div>
  );
}

// Simpler variant that uses the CSS class approach
export function HoloBorder({
  children,
  className,
  borderWidth = 1,
  rounded = "xl",
}: {
  children: ReactNode;
  className?: string;
  borderWidth?: 1 | 2 | 3;
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}) {
  return (
    <div
      className={cn(
        "relative border-holo",
        roundedMap[rounded],
        className
      )}
      style={{
        // Override the default inset based on border width
        ["--border-inset" as string]: `-${borderWidth}px`,
      }}
    >
      {children}
    </div>
  );
}

// Card variant with built-in glass effect
export function HolographicCard({
  children,
  className,
  glowOnHover = true,
}: {
  children: ReactNode;
  className?: string;
  glowOnHover?: boolean;
}) {
  return (
    <HolographicBorder
      className={cn("group", className)}
      glowIntensity="medium"
      rounded="2xl"
    >
      <div
        className={cn(
          "relative bg-void/90 backdrop-blur-xl p-6 rounded-2xl",
          "border border-white/5",
          glowOnHover && "transition-all duration-300",
          glowOnHover && "group-hover:border-primary/20 group-hover:shadow-[0_0_30px_rgba(0,230,118,0.1)]"
        )}
      >
        {children}
      </div>
    </HolographicBorder>
  );
}
