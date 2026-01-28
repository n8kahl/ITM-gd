"use client";

import { motion } from "framer-motion";

export function GradientMeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden -z-10">
      {/* Base dark layer */}
      <div className="absolute inset-0 bg-void" />

      {/* Animated gradient orbs - "market liquidity" effect */}
      <div className="absolute inset-0">
        {/* Primary green orb - top left */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, rgba(16, 185, 129, 0) 70%)",
            filter: "blur(60px)",
            left: "-10%",
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

        {/* Secondary green orb - bottom right */}
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full opacity-25"
          style={{
            background: "radial-gradient(circle, rgba(5, 150, 105, 0.5) 0%, rgba(5, 150, 105, 0) 70%)",
            filter: "blur(80px)",
            right: "-5%",
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

        {/* Gold accent orb - center right */}
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(212, 175, 55, 0.4) 0%, rgba(212, 175, 55, 0) 70%)",
            filter: "blur(70px)",
            right: "20%",
            top: "30%",
          }}
          animate={{
            x: [0, -60, 30, 0],
            y: [0, 80, 40, 0],
            scale: [1, 1.15, 0.9, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Deep green orb - bottom left */}
        <motion.div
          className="absolute w-[450px] h-[450px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(4, 120, 87, 0.5) 0%, rgba(4, 120, 87, 0) 70%)",
            filter: "blur(90px)",
            left: "10%",
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

        {/* Small gold accent - top right */}
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full opacity-15"
          style={{
            background: "radial-gradient(circle, rgba(184, 134, 11, 0.5) 0%, rgba(184, 134, 11, 0) 70%)",
            filter: "blur(50px)",
            right: "5%",
            top: "5%",
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

      {/* Mesh gradient overlay for depth */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(at 20% 30%, rgba(16, 185, 129, 0.15) 0px, transparent 50%),
            radial-gradient(at 80% 70%, rgba(5, 150, 105, 0.1) 0px, transparent 50%),
            radial-gradient(at 60% 20%, rgba(212, 175, 55, 0.08) 0px, transparent 50%),
            radial-gradient(at 40% 80%, rgba(4, 120, 87, 0.12) 0px, transparent 50%)
          `,
        }}
      />

      {/* Subtle grid pattern for texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(212, 175, 55, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212, 175, 55, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Vignette effect */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, rgba(5, 5, 5, 0.4) 70%, rgba(5, 5, 5, 0.8) 100%)",
        }}
      />
    </div>
  );
}
