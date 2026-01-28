"use client";

import { motion } from "framer-motion";

export function GradientMeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden -z-10">
      {/* Base dark layer */}
      <div className="absolute inset-0 bg-[#050505]" />

      {/* Premium Grid Pattern - Subtle plaid effect */}
      <div className="absolute inset-0">
        {/* Primary vertical lines */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                90deg,
                transparent,
                transparent 79px,
                rgba(232, 228, 217, 0.5) 79px,
                rgba(232, 228, 217, 0.5) 80px
              )
            `,
          }}
        />

        {/* Primary horizontal lines */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 79px,
                rgba(232, 228, 217, 0.5) 79px,
                rgba(232, 228, 217, 0.5) 80px
              )
            `,
          }}
        />

        {/* Secondary subtle grid - creates depth */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                90deg,
                transparent,
                transparent 19px,
                rgba(232, 228, 217, 0.3) 19px,
                rgba(232, 228, 217, 0.3) 20px
              ),
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 19px,
                rgba(232, 228, 217, 0.3) 19px,
                rgba(232, 228, 217, 0.3) 20px
              )
            `,
          }}
        />
      </div>

      {/* Ambient Glow Spots - Premium lighting */}
      <div className="absolute inset-0">
        {/* Top left emerald glow */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(5, 150, 105, 0.15) 0%, transparent 70%)",
            filter: "blur(80px)",
            left: "-10%",
            top: "-15%",
          }}
        />

        {/* Center champagne glow */}
        <div
          className="absolute w-[800px] h-[800px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(232, 228, 217, 0.06) 0%, transparent 60%)",
            filter: "blur(100px)",
            left: "30%",
            top: "20%",
          }}
        />

        {/* Bottom right teal glow */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(13, 148, 136, 0.12) 0%, transparent 70%)",
            filter: "blur(70px)",
            right: "-5%",
            bottom: "-10%",
          }}
        />

        {/* Subtle emerald accent - bottom left */}
        <div
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)",
            filter: "blur(60px)",
            left: "5%",
            bottom: "20%",
          }}
        />
      </div>

      {/* Premium vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, rgba(5, 5, 5, 0.4) 70%, rgba(5, 5, 5, 0.8) 100%)",
        }}
      />

      {/* Very subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
