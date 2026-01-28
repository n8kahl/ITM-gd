"use client";

import { motion } from "framer-motion";

export function GradientMeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden -z-10">
      {/* Base dark layer */}
      <div className="absolute inset-0 bg-void" />

      {/* Liquid Gradient Blobs - Premium Wealth Management Aesthetic */}
      <div className="absolute inset-0">
        {/* Primary Emerald blob - top left */}
        <motion.div
          className="absolute w-[800px] h-[800px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(5, 150, 105, 0.4) 0%, rgba(5, 150, 105, 0) 70%)",
            filter: "blur(120px)",
            left: "-20%",
            top: "-30%",
          }}
          animate={{
            x: [0, 150, 80, 0],
            y: [0, 100, 180, 0],
            scale: [1, 1.2, 1.1, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Champagne/Gold blob - center right */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(232, 228, 217, 0.15) 0%, rgba(212, 175, 55, 0.08) 40%, transparent 70%)",
            filter: "blur(100px)",
            right: "-5%",
            top: "20%",
          }}
          animate={{
            x: [0, -100, -50, 0],
            y: [0, 120, 60, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Deep Teal blob - bottom center */}
        <motion.div
          className="absolute w-[700px] h-[700px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(13, 148, 136, 0.35) 0%, rgba(13, 148, 136, 0) 70%)",
            filter: "blur(130px)",
            left: "30%",
            bottom: "-25%",
          }}
          animate={{
            x: [0, -80, 60, 0],
            y: [0, -100, -50, 0],
            scale: [1, 1.1, 1.2, 1],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Subtle emerald accent - bottom left */}
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0) 70%)",
            filter: "blur(90px)",
            left: "-10%",
            bottom: "10%",
          }}
          animate={{
            x: [0, 100, 50, 0],
            y: [0, -80, -40, 0],
            scale: [1, 0.9, 1.1, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Warm champagne glow - top right */}
        <motion.div
          className="absolute w-[450px] h-[450px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(232, 228, 217, 0.12) 0%, transparent 70%)",
            filter: "blur(80px)",
            right: "10%",
            top: "-10%",
          }}
          animate={{
            x: [0, -60, 30, 0],
            y: [0, 80, 40, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Central breathing glow - subtle pulse */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(5, 150, 105, 0.2) 0%, transparent 60%)",
            filter: "blur(100px)",
            left: "25%",
            top: "30%",
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Layered depth gradient - premium feel */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 30% 20%, rgba(5, 150, 105, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 80%, rgba(13, 148, 136, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 30%, rgba(232, 228, 217, 0.06) 0%, transparent 40%)
          `,
        }}
      />

      {/* Subtle premium vignette - softer edges */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, rgba(10, 10, 11, 0.3) 70%, rgba(10, 10, 11, 0.7) 100%)",
        }}
      />

      {/* Very subtle noise texture for depth */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
