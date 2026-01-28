"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function AuroraBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base dark layer */}
      <div className="absolute inset-0 bg-[#050505]" />

      {/* Primary aurora blob - Emerald */}
      <motion.div
        className="absolute w-[80vw] h-[80vh] rounded-full blur-[120px] opacity-30"
        style={{
          background: "radial-gradient(circle, #047857 0%, transparent 70%)",
          left: "10%",
          top: "20%",
        }}
        animate={{
          x: [0, 100, 50, -50, 0],
          y: [0, -50, 100, 50, 0],
          scale: [1, 1.2, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Secondary aurora blob - Gold accent */}
      <motion.div
        className="absolute w-[60vw] h-[60vh] rounded-full blur-[100px] opacity-20"
        style={{
          background: "radial-gradient(circle, #D4AF37 0%, transparent 70%)",
          right: "5%",
          bottom: "10%",
        }}
        animate={{
          x: [0, -80, -40, 60, 0],
          y: [0, 60, -40, -60, 0],
          scale: [1, 0.9, 1.15, 0.95, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Tertiary aurora blob - Deep emerald */}
      <motion.div
        className="absolute w-[70vw] h-[50vh] rounded-full blur-[150px] opacity-25"
        style={{
          background: "radial-gradient(circle, #065F46 0%, transparent 70%)",
          left: "30%",
          bottom: "20%",
        }}
        animate={{
          x: [0, -60, 80, -30, 0],
          y: [0, 80, -20, 60, 0],
          scale: [1, 1.1, 0.85, 1.05, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Subtle gold highlight streak */}
      <motion.div
        className="absolute w-[100vw] h-[2px] blur-[2px] opacity-10"
        style={{
          background: "linear-gradient(90deg, transparent 0%, #D4AF37 50%, transparent 100%)",
          top: "40%",
        }}
        animate={{
          y: [0, 100, -50, 50, 0],
          opacity: [0.1, 0.15, 0.08, 0.12, 0.1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Top gradient overlay for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, rgba(5,5,5,0.8) 0%, transparent 30%, transparent 70%, rgba(5,5,5,0.6) 100%)",
        }}
      />

      {/* Radial vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, transparent 0%, rgba(5,5,5,0.4) 100%)",
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
