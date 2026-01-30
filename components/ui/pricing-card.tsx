"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState, useEffect } from "react";
import { Analytics } from "@/lib/analytics";

// Detect touch devices to disable 3D tilt
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches
      );
    };
    checkTouch();
  }, []);

  return isTouch;
}

interface PricingCardProps {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  whopLink: string;
  popular?: boolean;
  tier: "core" | "pro" | "execute";
  urgencyText?: string;
  spotsLeft?: number;
  tagline?: string;
}

// Tier Title Card Component - Premium Luxury Branding
function TierTitleCard({ tier, name, isHovered }: { tier: "core" | "pro" | "execute"; name: string; isHovered: boolean }) {
  // Premium tier colors using existing luxury palette
  const tierColors = {
    core: {
      // Wealth Emerald - Growth & Prosperity
      gradient: "from-[#065F46] via-[#047857] to-[#059669]",
      accent: "#10B981",
      glow: "rgba(16, 185, 129, 0.3)",
      icon: "◆",
    },
    pro: {
      // Champagne Gold - Premium & Value
      gradient: "from-[#92702F] via-[#B8860B] to-[#D4AF37]",
      accent: "#D4AF37",
      glow: "rgba(212, 175, 55, 0.3)",
      icon: "◆◆",
    },
    execute: {
      // Platinum - Elite & Exclusive
      gradient: "from-[#71717A] via-[#A1A1AA] to-[#E4E4E7]",
      accent: "#E8E4D9",
      glow: "rgba(232, 228, 217, 0.35)",
      icon: "◆◆◆",
    },
  };

  const colors = tierColors[tier];

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl",
        "transition-transform duration-500",
        isHovered && "scale-105"
      )}
      style={{
        aspectRatio: "1.586",
      }}
    >
      {/* Card Background with tier gradient */}
      <div
        className={cn(
          "absolute inset-0 rounded-xl overflow-hidden",
          `bg-gradient-to-br ${colors.gradient}`
        )}
      >
        {/* Subtle inner glow */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(ellipse at 30% 20%, ${colors.glow} 0%, transparent 50%)`,
          }}
        />

        {/* Border with tier color */}
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            border: `1.5px solid ${colors.accent}`,
            boxShadow: `inset 0 0 20px ${colors.glow}`,
          }}
        />

        {/* Corner accents */}
        <div className="absolute top-2 left-2 w-4 h-4 border-t border-l" style={{ borderColor: `${colors.accent}99` }} />
        <div className="absolute top-2 right-2 w-4 h-4 border-t border-r" style={{ borderColor: `${colors.accent}99` }} />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l" style={{ borderColor: `${colors.accent}99` }} />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r" style={{ borderColor: `${colors.accent}99` }} />

        {/* Sheen animation */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ x: "-100%" }}
          animate={{ x: ["-100%", "200%"] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            repeatDelay: 4,
            ease: "easeInOut",
          }}
          style={{
            background: `linear-gradient(
              105deg,
              transparent 40%,
              rgba(255,255,255,0.2) 50%,
              transparent 60%
            )`,
          }}
        />

        {/* Tier Icon - Top Left */}
        <div
          className="absolute top-4 left-4 text-sm font-medium tracking-widest"
          style={{ color: colors.accent }}
        >
          {colors.icon}
        </div>

        {/* Tier Name - Centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-2xl md:text-3xl font-serif font-medium tracking-wide text-white drop-shadow-lg"
            style={{
              textShadow: "0 2px 4px rgba(0,0,0,0.5)",
            }}
          >
            {name}
          </span>
        </div>

        {/* ITM Logo mark - Bottom right */}
        <div className="absolute bottom-3 right-4">
          <span className="text-xs font-mono tracking-widest uppercase text-white/60">
            ITM
          </span>
        </div>

        {/* Noise texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03] rounded-xl"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
    </div>
  );
}

export function PricingCard({
  name,
  price,
  period,
  description,
  features,
  whopLink,
  popular = false,
  tier,
  urgencyText,
  spotsLeft,
  tagline,
}: PricingCardProps) {
  const isCore = tier === "core";
  const isPro = tier === "pro";
  const isExecute = tier === "execute";

  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const isTouchDevice = useIsTouchDevice();

  // Mouse position for 3D tilt (disabled on touch devices)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth spring animation for tilt
  const springConfig = { damping: 25, stiffness: 150 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [8, -8]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Disable 3D tilt on touch devices
    if (isTouchDevice || !cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const normalizedX = (e.clientX - centerX) / rect.width;
    const normalizedY = (e.clientY - centerY) / rect.height;

    mouseX.set(normalizedX);
    mouseY.set(normalizedY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setIsHovered(false);
  };

  // Handle card click - navigate to Whop
  const handleCardClick = () => {
    // Track pricing card click
    Analytics.trackPricingClick(name);

    if (whopLink && whopLink !== "#") {
      window.open(whopLink, '_blank', 'noopener,noreferrer');
    }
  };

  // Premium tier styling using luxury palette
  const tierStyles = {
    core: {
      // Wealth Emerald - Growth & Prosperity
      borderColor: "rgba(16, 185, 129, 0.25)",
      glowColor: "rgba(16, 185, 129, 0.12)",
      accentColor: "#10B981",
      buttonGradient: "from-[#065F46] via-[#047857] to-[#059669]",
      checkBg: "bg-emerald-500/10",
      checkColor: "text-emerald-400",
    },
    pro: {
      // Champagne Gold - Premium & Value
      borderColor: "rgba(212, 175, 55, 0.3)",
      glowColor: "rgba(212, 175, 55, 0.15)",
      accentColor: "#D4AF37",
      buttonGradient: "from-[#92702F] via-[#B8860B] to-[#D4AF37]",
      checkBg: "bg-amber-500/10",
      checkColor: "text-amber-400",
    },
    execute: {
      // Platinum - Elite & Exclusive
      borderColor: "rgba(232, 228, 217, 0.3)",
      glowColor: "rgba(232, 228, 217, 0.15)",
      accentColor: "#E8E4D9",
      buttonGradient: "from-[#71717A] via-[#A1A1AA] to-[#E4E4E7]",
      checkBg: "bg-zinc-400/10",
      checkColor: "text-zinc-300",
    },
  };

  const styles = tierStyles[tier];

  return (
    <motion.div
      ref={cardRef}
      className={cn(
        "relative rounded-2xl overflow-visible h-full cursor-pointer",
        isExecute && "lg:scale-105 z-10"
      )}
      style={{
        perspective: 1000,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >
      {/* 3D Tilt Container - disabled on touch devices */}
      <motion.div
        className="relative h-full [&_a]:pointer-events-auto [&_button]:pointer-events-auto"
        style={{
          rotateX: isHovered && !isTouchDevice ? rotateX : 0,
          rotateY: isHovered && !isTouchDevice ? rotateY : 0,
          transformStyle: "preserve-3d",
        }}
        whileHover={isExecute ? { y: -8, scale: 1.02 } : { y: -4, scale: 1.01 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Border glow effect */}
        <div
          className="absolute -inset-[2px] rounded-2xl -z-10"
          style={{
            background: `linear-gradient(135deg, ${styles.borderColor} 0%, ${styles.accentColor}40 50%, ${styles.borderColor} 100%)`,
          }}
        />

        {/* CSS Shimmer animation */}
        <div className="absolute -inset-[2px] rounded-2xl -z-10 overflow-hidden">
          <div
            className="absolute inset-0 animate-shimmer"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
              backgroundSize: "200% 100%",
            }}
          />
        </div>

        {/* Glow effect on hover */}
        <div
          className={cn(
            "absolute -inset-[2px] rounded-2xl -z-20 transition-all duration-500"
          )}
          style={{
            boxShadow: isHovered
              ? `0 0 40px ${styles.glowColor}, 0 0 80px ${styles.glowColor}`
              : `0 0 20px ${styles.glowColor}`,
          }}
        />

        {/* Card Container */}
        <div
          className="relative h-full p-6 md:p-8 rounded-2xl border overflow-hidden bg-[rgba(8,8,8,0.95)] backdrop-blur-xl"
          style={{ borderColor: styles.borderColor }}
        >
          {/* Premium Frosted glass overlay */}
          <div
            className="absolute inset-0 opacity-60 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, ${styles.glowColor} 0%, transparent 50%)`,
            }}
          />

          {/* Card Content */}
          <div className="relative z-10 flex flex-col h-full">
            {/* Tier Title Card Visual */}
            <div className="relative w-full mb-6 flex items-center justify-center px-4">
              <TierTitleCard tier={tier} name={name} isHovered={isHovered} />
            </div>

            {/* Header */}
            <div className="text-center mb-6">
              {/* NOW AVAILABLE Tag */}
              <div className="space-y-3 mb-4">
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border"
                  style={{
                    backgroundColor: `${styles.accentColor}15`,
                    borderColor: `${styles.accentColor}50`
                  }}
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ backgroundColor: styles.accentColor }}
                    ></span>
                    <span
                      className="relative inline-flex rounded-full h-2 w-2"
                      style={{ backgroundColor: styles.accentColor }}
                    ></span>
                  </span>
                  <span
                    className="text-xs font-semibold uppercase tracking-wider font-mono"
                    style={{ color: styles.accentColor }}
                  >
                    NOW AVAILABLE
                  </span>
                </div>

                {/* Urgency/Scarcity Banner */}
                {(urgencyText || spotsLeft) && (
                  <motion.div
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30"
                    animate={{
                      borderColor: ["rgba(239,68,68,0.3)", "rgba(239,68,68,0.6)", "rgba(239,68,68,0.3)"],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {spotsLeft && (
                      <span className="text-xs font-bold text-red-400 font-mono">
                        ⚡ Only {spotsLeft} spots left this month
                      </span>
                    )}
                    {urgencyText && !spotsLeft && (
                      <span className="text-xs font-bold text-red-400">
                        {urgencyText}
                      </span>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Price - Improved typography hierarchy */}
              <div className="mb-3 flex items-baseline justify-center gap-1">
                {/* Currency symbol - smaller */}
                <span
                  className="text-2xl font-light align-top relative -top-3"
                  style={{ color: `${styles.accentColor}99` }}
                >
                  $
                </span>
                {/* Price amount - larger, bolder */}
                <span
                  className="text-6xl md:text-7xl font-serif font-semibold tracking-tight"
                  style={{ color: styles.accentColor }}
                >
                  {price.replace('$', '')}
                </span>
                {/* Period - smaller, muted */}
                <span className="text-base ml-1 text-muted-foreground/70">{period}</span>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>

            {/* Divider */}
            <div
              className="h-px w-full mb-6"
              style={{
                background: `linear-gradient(to right, transparent, ${styles.accentColor}50, transparent)`,
              }}
            />

            {/* Tagline if present */}
            {tagline && (
              <p
                className="text-xs text-center mb-4 italic"
                style={{ color: `${styles.accentColor}99` }}
              >
                {tagline}
              </p>
            )}

            {/* Features List */}
            <ul className="space-y-3 flex-grow mb-8">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      styles.checkBg
                    )}
                  >
                    <Check className={cn("w-3 h-3", styles.checkColor)} />
                  </div>
                  <span className="text-sm leading-relaxed text-smoke/80">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            {/* CTA Button */}
            <div className="space-y-3 relative z-[100]">
              <div
                className={cn(
                  "w-full h-14 text-base font-bold rounded-xl transition-all duration-500",
                  "bg-gradient-to-r hover:-translate-y-0.5",
                  "flex items-center justify-center gap-2 font-mono tracking-wide cursor-pointer",
                  styles.buttonGradient,
                  // Execute tier has light platinum gradient, needs dark text
                  isExecute ? "text-onyx" : "text-white"
                )}
                style={{
                  boxShadow: isHovered ? `0 0 40px ${styles.glowColor}` : `0 0 20px ${styles.glowColor}`,
                }}
              >
                GET STARTED
              </div>

              {/* Security Badge */}
              <p className="text-center text-xs text-muted-foreground/60">
                Secure transaction powered by{" "}
                <span className="text-muted-foreground/80">Whop</span> &{" "}
                <span className="text-muted-foreground/80">Stripe</span>
              </p>
            </div>
          </div>

          {/* Corner accents */}
          <div
            className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 rounded-tl-2xl"
            style={{ borderColor: `${styles.accentColor}50` }}
          />
          <div
            className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 rounded-tr-2xl"
            style={{ borderColor: `${styles.accentColor}50` }}
          />
          <div
            className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 rounded-bl-2xl"
            style={{ borderColor: `${styles.accentColor}50` }}
          />
          <div
            className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 rounded-br-2xl"
            style={{ borderColor: `${styles.accentColor}50` }}
          />

          {/* Noise texture for all cards */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.02]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* 3D Shadow layer */}
        <motion.div
          className="absolute inset-x-4 -bottom-4 h-8 rounded-2xl -z-20"
          style={{
            background: `radial-gradient(ellipse at center, ${styles.glowColor} 0%, transparent 70%)`,
            filter: "blur(12px)",
            opacity: isHovered ? 1 : 0.5,
            transition: "opacity 0.3s ease",
          }}
        />
      </motion.div>
    </motion.div>
  );
}
