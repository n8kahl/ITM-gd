"use client";

import { useEffect, useState } from "react";

export function AuroraBackground() {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!mounted) return null;

  // Mobile gets a simplified static background
  if (isMobile) {
    return (
      <div className="absolute inset-0 overflow-hidden">
        {/* Base deep onyx layer */}
        <div className="absolute inset-0 bg-[#050505]" />

        {/* Static gradient that mimics the aurora effect */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 100% 80% at 20% 20%, rgba(4, 120, 87, 0.25) 0%, transparent 50%),
              radial-gradient(ellipse 80% 60% at 80% 80%, rgba(212, 175, 55, 0.15) 0%, transparent 45%),
              radial-gradient(ellipse 70% 50% at 50% 50%, rgba(4, 120, 87, 0.1) 0%, transparent 40%)
            `,
          }}
        />

        {/* Subtle gold ribbon */}
        <div
          className="absolute w-full h-[200px] top-[30%]"
          style={{
            background: "linear-gradient(180deg, transparent 0%, rgba(212, 175, 55, 0.06) 50%, transparent 100%)",
            filter: "blur(30px)",
          }}
        />

        {/* Top vignette */}
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
      </div>
    );
  }

  // Desktop gets CSS keyframe animations (much lighter than Framer Motion)
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base deep onyx layer */}
      <div className="absolute inset-0 bg-[#050505]" />

      {/* Primary liquid silk blob - Emerald - CSS Animation */}
      <div
        className="absolute w-[90vw] h-[90vh] rounded-full aurora-blob-1"
        style={{
          background: "radial-gradient(ellipse at center, rgba(4, 120, 87, 0.4) 0%, rgba(4, 120, 87, 0.1) 40%, transparent 70%)",
          filter: "blur(80px)",
          left: "-10%",
          top: "-10%",
          willChange: "transform",
        }}
      />

      {/* Secondary liquid blob - Deep Gold - CSS Animation */}
      <div
        className="absolute w-[70vw] h-[70vh] rounded-full aurora-blob-2"
        style={{
          background: "radial-gradient(ellipse at center, rgba(212, 175, 55, 0.25) 0%, rgba(212, 175, 55, 0.05) 50%, transparent 70%)",
          filter: "blur(100px)",
          right: "-20%",
          bottom: "-20%",
          willChange: "transform",
        }}
      />

      {/* Tertiary silk layer - Emerald deeper - CSS Animation */}
      <div
        className="absolute w-[80vw] h-[60vh] rounded-full aurora-blob-3"
        style={{
          background: "radial-gradient(ellipse at center, rgba(6, 95, 70, 0.35) 0%, transparent 60%)",
          filter: "blur(120px)",
          left: "20%",
          bottom: "10%",
          willChange: "transform",
        }}
      />

      {/* Floating gold accent ribbon - CSS Animation */}
      <div
        className="absolute w-[120vw] h-[300px] -left-[10vw] aurora-ribbon"
        style={{
          background: "linear-gradient(180deg, transparent 0%, rgba(212, 175, 55, 0.08) 50%, transparent 100%)",
          filter: "blur(40px)",
          top: "30%",
          willChange: "transform, opacity",
        }}
      />

      {/* Center glow - for logo pop - CSS Animation */}
      <div
        className="absolute w-[60vw] h-[60vh] rounded-full aurora-center-glow"
        style={{
          background: "radial-gradient(ellipse at center, rgba(4, 120, 87, 0.15) 0%, rgba(212, 175, 55, 0.05) 30%, transparent 60%)",
          filter: "blur(60px)",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          willChange: "transform, opacity",
        }}
      />

      {/* Subtle shimmer streak - CSS Animation */}
      <div
        className="absolute w-[150vw] h-[1px] -left-[25vw] aurora-shimmer"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(232, 228, 217, 0.1) 20%, rgba(212, 175, 55, 0.15) 50%, rgba(232, 228, 217, 0.1) 80%, transparent 100%)",
          top: "35%",
          willChange: "transform, opacity",
        }}
      />

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

      {/* CSS Keyframe Animations - moved to style tag for performance */}
      <style jsx>{`
        @keyframes aurora-float-1 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(150px, -80px) scale(1.15);
          }
          50% {
            transform: translate(80px, 120px) scale(0.95);
          }
          75% {
            transform: translate(-80px, 60px) scale(1.1);
          }
        }

        @keyframes aurora-float-2 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(-120px, 100px) scale(0.9);
          }
          50% {
            transform: translate(-60px, -60px) scale(1.2);
          }
          75% {
            transform: translate(100px, -80px) scale(0.95);
          }
        }

        @keyframes aurora-float-3 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(-100px, 80px) scale(1.1);
          }
          50% {
            transform: translate(120px, -40px) scale(0.85);
          }
          75% {
            transform: translate(-40px, 100px) scale(1.15);
          }
        }

        @keyframes aurora-ribbon-float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.8;
          }
          25% {
            transform: translateY(80px) rotate(2deg);
            opacity: 1;
          }
          50% {
            transform: translateY(-60px) rotate(-1deg);
            opacity: 0.7;
          }
          75% {
            transform: translateY(40px) rotate(1deg);
            opacity: 0.9;
          }
        }

        @keyframes aurora-center-pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 0.8;
          }
        }

        @keyframes aurora-shimmer {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.3;
          }
          25% {
            transform: translateY(150px);
            opacity: 0.6;
          }
          50% {
            transform: translateY(80px);
            opacity: 0.2;
          }
          75% {
            transform: translateY(-50px);
            opacity: 0.5;
          }
        }

        .aurora-blob-1 {
          animation: aurora-float-1 30s ease-in-out infinite;
        }

        .aurora-blob-2 {
          animation: aurora-float-2 35s ease-in-out infinite;
        }

        .aurora-blob-3 {
          animation: aurora-float-3 28s ease-in-out infinite;
        }

        .aurora-ribbon {
          animation: aurora-ribbon-float 20s ease-in-out infinite;
        }

        .aurora-center-glow {
          animation: aurora-center-pulse 8s ease-in-out infinite;
        }

        .aurora-shimmer {
          animation: aurora-shimmer 25s ease-in-out infinite;
        }

        /* Respect reduced motion preference */
        @media (prefers-reduced-motion: reduce) {
          .aurora-blob-1,
          .aurora-blob-2,
          .aurora-blob-3,
          .aurora-ribbon,
          .aurora-center-glow,
          .aurora-shimmer {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
