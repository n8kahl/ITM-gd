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

export function GradientMeshBackground() {
  const isMobile = useIsMobile();

  // Reduced blur values for mobile performance
  const blurOrb1 = isMobile ? "blur(25px)" : "blur(60px)";
  const blurOrb2 = isMobile ? "blur(30px)" : "blur(80px)";
  const blurOrb3 = isMobile ? "blur(25px)" : "blur(70px)";
  const blurOrb4 = isMobile ? "blur(30px)" : "blur(90px)";
  const blurOrb5 = isMobile ? "blur(20px)" : "blur(50px)";

  return (
    <div className="absolute inset-0 overflow-hidden -z-10">
      {/* Base dark layer */}
      <div className="absolute inset-0 bg-void" />

      {/* Animated gradient orbs - "Cold HFT" effect */}
      <div className="absolute inset-0">
        {/* Deep Emerald orb - top left */}
        <motion.div
          className={`absolute rounded-full opacity-25 ${isMobile ? 'w-[300px] h-[300px]' : 'w-[600px] h-[600px]'}`}
          style={{
            background: "radial-gradient(circle, rgba(0, 230, 118, 0.35) 0%, rgba(0, 230, 118, 0) 70%)",
            filter: blurOrb1,
            left: "-10%",
            top: "-20%",
          }}
          animate={isMobile ? undefined : {
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

        {/* Bright Cyan orb - bottom right */}
        <motion.div
          className={`absolute rounded-full opacity-20 ${isMobile ? 'w-[250px] h-[250px]' : 'w-[500px] h-[500px]'}`}
          style={{
            background: "radial-gradient(circle, rgba(0, 188, 212, 0.5) 0%, rgba(0, 188, 212, 0) 70%)",
            filter: blurOrb2,
            right: "-5%",
            bottom: "-15%",
          }}
          animate={isMobile ? undefined : {
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

        {/* Cool Grey orb - center right - hidden on mobile */}
        {!isMobile && (
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full opacity-15"
            style={{
              background: "radial-gradient(circle, rgba(160, 160, 160, 0.4) 0%, rgba(160, 160, 160, 0) 70%)",
              filter: blurOrb3,
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
        )}

        {/* Deep Teal orb - bottom left - hidden on mobile */}
        {!isMobile && (
          <motion.div
            className="absolute w-[450px] h-[450px] rounded-full opacity-20"
            style={{
              background: "radial-gradient(circle, rgba(0, 150, 136, 0.5) 0%, rgba(0, 150, 136, 0) 70%)",
              filter: blurOrb4,
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
        )}

        {/* Bright Cyan accent - top right - hidden on mobile */}
        {!isMobile && (
          <motion.div
            className="absolute w-[300px] h-[300px] rounded-full opacity-15"
            style={{
              background: "radial-gradient(circle, rgba(0, 229, 255, 0.4) 0%, rgba(0, 229, 255, 0) 70%)",
              filter: blurOrb5,
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
        )}
      </div>

      {/* Mesh gradient overlay for depth - cold tones */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(at 20% 30%, rgba(0, 230, 118, 0.12) 0px, transparent 50%),
            radial-gradient(at 80% 70%, rgba(0, 188, 212, 0.1) 0px, transparent 50%),
            radial-gradient(at 60% 20%, rgba(160, 160, 160, 0.08) 0px, transparent 50%),
            radial-gradient(at 40% 80%, rgba(0, 150, 136, 0.1) 0px, transparent 50%)
          `,
        }}
      />

      {/* Subtle grid pattern for texture - platinum */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(229, 228, 226, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(229, 228, 226, 0.5) 1px, transparent 1px)
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
