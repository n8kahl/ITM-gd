"use client";

import { motion } from "framer-motion";

export function GradientMeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden -z-10">
      {/* Base dark layer */}
      <div className="absolute inset-0 bg-void" />

      {/* Animated Trading Grid - HFT Terminal Aesthetic */}
      <div className="absolute inset-0">
        {/* Primary Grid */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 230, 118, 0.6) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 230, 118, 0.6) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
          }}
        />

        {/* Secondary Fine Grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 230, 118, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 230, 118, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: "20px 20px",
          }}
        />
      </div>

      {/* Horizontal Scan Lines - Trading Terminal Effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 230, 118, 0.03) 2px,
            rgba(0, 230, 118, 0.03) 4px
          )`,
        }}
      />

      {/* Animated Vertical Glow Line - Scanning Effect */}
      <motion.div
        className="absolute top-0 bottom-0 w-[2px] opacity-60"
        style={{
          background: "linear-gradient(180deg, transparent 0%, rgba(0, 230, 118, 0.8) 20%, rgba(0, 255, 200, 1) 50%, rgba(0, 230, 118, 0.8) 80%, transparent 100%)",
          boxShadow: "0 0 20px rgba(0, 230, 118, 0.6), 0 0 40px rgba(0, 230, 118, 0.4), 0 0 60px rgba(0, 230, 118, 0.2)",
        }}
        animate={{
          left: ["-5%", "105%"],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Second Glow Line - Offset timing */}
      <motion.div
        className="absolute top-0 bottom-0 w-[1px] opacity-40"
        style={{
          background: "linear-gradient(180deg, transparent 0%, rgba(0, 188, 212, 0.6) 30%, rgba(0, 229, 255, 0.8) 50%, rgba(0, 188, 212, 0.6) 70%, transparent 100%)",
          boxShadow: "0 0 15px rgba(0, 188, 212, 0.5), 0 0 30px rgba(0, 188, 212, 0.3)",
        }}
        animate={{
          left: ["105%", "-5%"],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Horizontal Glow Line */}
      <motion.div
        className="absolute left-0 right-0 h-[1px] opacity-50"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(0, 230, 118, 0.6) 20%, rgba(0, 255, 200, 0.9) 50%, rgba(0, 230, 118, 0.6) 80%, transparent 100%)",
          boxShadow: "0 0 15px rgba(0, 230, 118, 0.5), 0 0 30px rgba(0, 230, 118, 0.3)",
        }}
        animate={{
          top: ["-5%", "105%"],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Animated gradient orbs - Brighter "Cold HFT" effect */}
      <div className="absolute inset-0">
        {/* Deep Emerald orb - top left - BOOSTED */}
        <motion.div
          className="absolute w-[700px] h-[700px] rounded-full opacity-40"
          style={{
            background: "radial-gradient(circle, rgba(0, 230, 118, 0.5) 0%, rgba(0, 230, 118, 0) 70%)",
            filter: "blur(80px)",
            left: "-15%",
            top: "-20%",
          }}
          animate={{
            x: [0, 100, 50, 0],
            y: [0, 50, 100, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Bright Cyan orb - bottom right - BOOSTED */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full opacity-35"
          style={{
            background: "radial-gradient(circle, rgba(0, 188, 212, 0.6) 0%, rgba(0, 188, 212, 0) 70%)",
            filter: "blur(100px)",
            right: "-10%",
            bottom: "-15%",
          }}
          animate={{
            x: [0, -80, -40, 0],
            y: [0, -60, -120, 0],
            scale: [1, 0.9, 1.05, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Electric Green pulse - center */}
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(0, 255, 136, 0.3) 0%, rgba(0, 255, 136, 0) 60%)",
            filter: "blur(60px)",
            left: "30%",
            top: "40%",
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Deep Teal orb - bottom left - BOOSTED */}
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle, rgba(0, 150, 136, 0.6) 0%, rgba(0, 150, 136, 0) 70%)",
            filter: "blur(90px)",
            left: "5%",
            bottom: "10%",
          }}
          animate={{
            x: [0, 70, 35, 0],
            y: [0, -40, -80, 0],
            scale: [1, 1.08, 0.95, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Bright Cyan accent - top right - BOOSTED */}
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full opacity-25"
          style={{
            background: "radial-gradient(circle, rgba(0, 229, 255, 0.5) 0%, rgba(0, 229, 255, 0) 70%)",
            filter: "blur(60px)",
            right: "0%",
            top: "0%",
          }}
          animate={{
            x: [0, -40, 20, 0],
            y: [0, 60, 30, 0],
            scale: [1, 0.95, 1.1, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Grid Intersection Glow Points */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              background: "rgba(0, 230, 118, 0.8)",
              boxShadow: "0 0 10px rgba(0, 230, 118, 0.6), 0 0 20px rgba(0, 230, 118, 0.4)",
              left: `${(i % 4) * 30 + 10}%`,
              top: `${Math.floor(i / 4) * 35 + 15}%`,
            }}
            animate={{
              opacity: [0.3, 0.8, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + (i * 0.3),
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
          />
        ))}
      </div>

      {/* Mesh gradient overlay for depth - BOOSTED */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            radial-gradient(at 20% 30%, rgba(0, 230, 118, 0.18) 0px, transparent 50%),
            radial-gradient(at 80% 70%, rgba(0, 188, 212, 0.15) 0px, transparent 50%),
            radial-gradient(at 60% 20%, rgba(0, 255, 200, 0.1) 0px, transparent 50%),
            radial-gradient(at 40% 80%, rgba(0, 150, 136, 0.15) 0px, transparent 50%)
          `,
        }}
      />

      {/* Softer Vignette - less darkening */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, rgba(5, 5, 5, 0.2) 60%, rgba(5, 5, 5, 0.6) 100%)",
        }}
      />

      {/* Noise texture for depth */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
