"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

// Hook to detect mobile devices for performance optimization
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

export function AuroraBackground() {
  const isMobile = useIsMobile();

  // Reduced blur values for mobile performance
  const blurPrimary = isMobile ? "blur(30px)" : "blur(80px)";
  const blurSecondary = isMobile ? "blur(35px)" : "blur(100px)";
  const blurTertiary = isMobile ? "blur(40px)" : "blur(120px)";
  const blurRibbon = isMobile ? "blur(20px)" : "blur(40px)";
  const blurCenter = isMobile ? "blur(25px)" : "blur(60px)";

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base deep onyx layer */}
      <div className="absolute inset-0 bg-[#050505]" />

      {/* Primary liquid silk blob - Emerald */}
      <motion.div
        className="absolute w-[90vw] h-[90vh] rounded-full"
        style={{
          background: "radial-gradient(ellipse at center, rgba(4, 120, 87, 0.4) 0%, rgba(4, 120, 87, 0.1) 40%, transparent 70%)",
          filter: blurPrimary,
          left: "-10%",
          top: "-10%",
        }}
        animate={isMobile ? undefined : {
          x: [0, 150, 80, -80, 0],
          y: [0, -80, 120, 60, 0],
          scale: [1, 1.15, 0.95, 1.1, 1],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Secondary liquid blob - Deep Gold */}
      <motion.div
        className="absolute w-[70vw] h-[70vh] rounded-full"
        style={{
          background: "radial-gradient(ellipse at center, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0.05) 50%, transparent 70%)",
          filter: blurSecondary,
          right: "-20%",
          bottom: "-20%",
        }}
        animate={isMobile ? undefined : {
          x: [0, -120, -60, 100, 0],
          y: [0, 100, -60, -80, 0],
          scale: [1, 0.9, 1.2, 0.95, 1],
        }}
        transition={{
          duration: 35,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Tertiary silk layer - Emerald deeper - hidden on mobile */}
      {!isMobile && (
        <motion.div
          className="absolute w-[80vw] h-[60vh] rounded-full"
          style={{
            background: "radial-gradient(ellipse at center, rgba(6, 95, 70, 0.35) 0%, transparent 60%)",
            filter: blurTertiary,
            left: "20%",
            bottom: "10%",
          }}
          animate={{
            x: [0, -100, 120, -40, 0],
            y: [0, 80, -40, 100, 0],
            scale: [1, 1.1, 0.85, 1.15, 1],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Floating gold accent ribbon - hidden on mobile */}
      {!isMobile && (
        <motion.div
          className="absolute w-[120vw] h-[300px] -left-[10vw]"
          style={{
            background: "linear-gradient(180deg, transparent 0%, rgba(16, 185, 129, 0.08) 50%, transparent 100%)",
            filter: blurRibbon,
            top: "30%",
          }}
          animate={{
            y: [0, 80, -60, 40, 0],
            rotate: [0, 2, -1, 1, 0],
            opacity: [0.8, 1, 0.7, 0.9, 0.8],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Center glow - for logo pop */}
      <motion.div
        className="absolute w-[60vw] h-[60vh] rounded-full"
        style={{
          background: "radial-gradient(ellipse at center, rgba(4, 120, 87, 0.15) 0%, rgba(16, 185, 129, 0.05) 30%, transparent 60%)",
          filter: blurCenter,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
        animate={isMobile ? undefined : {
          scale: [1, 1.1, 0.95, 1.05, 1],
          opacity: [0.6, 0.8, 0.5, 0.7, 0.6],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Subtle shimmer streaks - hidden on mobile */}
      {!isMobile && (
        <motion.div
          className="absolute w-[150vw] h-[1px] -left-[25vw]"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(232, 228, 217, 0.1) 20%, rgba(16, 185, 129, 0.15) 50%, rgba(232, 228, 217, 0.1) 80%, transparent 100%)",
            top: "35%",
          }}
          animate={{
            y: [0, 150, 80, -50, 0],
            opacity: [0.3, 0.6, 0.2, 0.5, 0.3],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Top vignette for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, rgba(5,5,5,0.7) 0%, transparent 25%, transparent 75%, rgba(5,5,5,0.5) 100%)",
        }}
      />

      {/* Radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 0%, rgba(5,5,5,0.6) 100%)",
        }}
      />

      {/* Noise texture overlay for luxury feel */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
