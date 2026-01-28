"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";

interface PricingCardProps {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  whopLink: string;
  popular?: boolean;
  tier: "starter" | "pro" | "elite";
  urgencyText?: string;
  spotsLeft?: number;
}

// CSS Credit Card Component
function CreditCardVisual({ tier, isHovered }: { tier: "starter" | "pro" | "elite"; isHovered: boolean }) {
  const isElite = tier === "elite";
  const isPro = tier === "pro";
  const isStarter = tier === "starter";
  const isUnavailable = isPro || isStarter;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl",
        "transition-transform duration-500",
        isHovered && isElite && "scale-105"
      )}
      style={{
        aspectRatio: "1.586",
      }}
    >
      {/* Card Background */}
      <div
        className={cn(
          "absolute inset-0 rounded-xl overflow-hidden",
          // Starter - Frosted Glass
          isStarter && "bg-gradient-to-br from-white/20 via-white/10 to-white/5 backdrop-blur-sm",
          // Pro - Brushed Metal
          isPro && "bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-900",
          // Elite - Black Card
          isElite && "bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a]"
        )}
      >
        {/* Starter - Glass refraction effect */}
        {isStarter && (
          <>
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%, rgba(255,255,255,0.1) 100%)",
              }}
            />
            <div className="absolute inset-0 border border-white/20 rounded-xl" />
          </>
        )}

        {/* Pro - Brushed metal texture */}
        {isPro && (
          <>
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  115deg,
                  transparent,
                  transparent 1px,
                  rgba(255,255,255,0.03) 1px,
                  rgba(255,255,255,0.03) 2px
                )`,
              }}
            />
            <div className="absolute inset-0 border border-zinc-600/50 rounded-xl" />
          </>
        )}

        {/* Elite - Premium black with gold border */}
        {isElite && (
          <>
            {/* Subtle inner glow */}
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background: "radial-gradient(ellipse at 30% 20%, rgba(212,175,55,0.1) 0%, transparent 50%)",
              }}
            />
            {/* Gold border */}
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                border: "1.5px solid rgba(212,175,55,0.5)",
                boxShadow: "inset 0 0 20px rgba(212,175,55,0.1)",
              }}
            />
            {/* Corner accents */}
            <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-[#D4AF37]/60" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-[#D4AF37]/60" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-[#D4AF37]/60" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r border-[#D4AF37]/60" />
          </>
        )}

        {/* Sheen animation - runs every 4 seconds */}
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
              ${isElite ? "rgba(212,175,55,0.15)" : isPro ? "rgba(192,192,192,0.1)" : "rgba(255,255,255,0.2)"} 50%,
              transparent 60%
            )`,
          }}
        />

        {/* Card chip (Elite only) */}
        {isElite && (
          <div className="absolute top-4 left-4">
            <div
              className="w-8 h-6 rounded-sm"
              style={{
                background: "linear-gradient(135deg, #D4AF37 0%, #B8860B 50%, #D4AF37 100%)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }}
            >
              <div className="absolute inset-[2px] rounded-[2px] opacity-50"
                style={{
                  background: "repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)",
                }}
              />
            </div>
          </div>
        )}

        {/* Tier Name - Centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "text-2xl md:text-3xl font-serif font-medium tracking-wide",
              // Starter - Muted white
              isStarter && "text-white/40",
              // Pro - Silver stamping
              isPro && "text-transparent bg-clip-text bg-gradient-to-b from-zinc-300 via-zinc-400 to-zinc-500",
              // Elite - Gold foil
              isElite && "text-transparent bg-clip-text bg-gradient-to-b from-[#E8E4D9] via-[#D4AF37] to-[#B8860B]",
              isUnavailable && "grayscale"
            )}
            style={{
              textShadow: isElite ? "0 2px 4px rgba(0,0,0,0.5)" : undefined,
            }}
          >
            {tier.charAt(0).toUpperCase() + tier.slice(1)}
          </span>
        </div>

        {/* ITM Logo mark - Bottom right */}
        <div className="absolute bottom-3 right-4">
          <span
            className={cn(
              "text-xs font-mono tracking-widest uppercase",
              isStarter && "text-white/20",
              isPro && "text-zinc-500",
              isElite && "text-[#D4AF37]/60"
            )}
          >
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

      {/* Grayscale overlay for unavailable */}
      {isUnavailable && (
        <div className="absolute inset-0 bg-black/20 rounded-xl" />
      )}
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
}: PricingCardProps) {
  const isElite = tier === "elite";
  const isPro = tier === "pro";
  const isStarter = tier === "starter";
  const isUnavailable = isPro || isStarter;

  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Mouse position for 3D tilt
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth spring animation for tilt
  const springConfig = { damping: 25, stiffness: 150 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [8, -8]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

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

  return (
    <motion.div
      ref={cardRef}
      className={cn(
        "relative rounded-2xl overflow-visible h-full",
        isElite && "lg:scale-105 z-10",
        isUnavailable && "opacity-50"
      )}
      style={{
        perspective: 1000,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      {/* 3D Tilt Container */}
      <motion.div
        className="relative h-full [&_a]:pointer-events-auto [&_button]:pointer-events-auto"
        style={{
          rotateX: isHovered ? rotateX : 0,
          rotateY: isHovered ? rotateY : 0,
          transformStyle: "preserve-3d",
        }}
        whileHover={isElite ? { y: -8, scale: 1.02 } : { y: -4, scale: 1.01 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Unavailable Cards - Subtle border */}
        {isUnavailable && (
          <div className="absolute -inset-[1px] rounded-2xl bg-white/5 -z-10" />
        )}

        {/* Elite Card - Liquid Metal Shimmer Border */}
        {isElite && (
          <>
            <motion.div
              className="absolute -inset-[2px] rounded-2xl -z-10"
              style={{
                background: "linear-gradient(135deg, rgba(232,228,217,0.4) 0%, rgba(212,175,55,0.3) 25%, rgba(232,228,217,0.5) 50%, rgba(192,192,192,0.3) 75%, rgba(232,228,217,0.4) 100%)",
              }}
              animate={{
                backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "linear",
              }}
            />
            <motion.div
              className="absolute -inset-[2px] rounded-2xl -z-10 opacity-60"
              animate={{
                background: [
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                  "linear-gradient(90deg, transparent 100%, rgba(255,255,255,0.3) 150%, transparent 200%)",
                ],
                backgroundPosition: ["-200% 0%", "200% 0%"],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{
                backgroundSize: "200% 100%",
              }}
            />
            <motion.div
              className="absolute -inset-[2px] rounded-2xl -z-20"
              animate={{
                boxShadow: isHovered
                  ? [
                      "0 0 30px rgba(232,228,217,0.3), 0 0 60px rgba(212,175,55,0.2)",
                      "0 0 40px rgba(232,228,217,0.4), 0 0 80px rgba(212,175,55,0.3)",
                      "0 0 30px rgba(232,228,217,0.3), 0 0 60px rgba(212,175,55,0.2)",
                    ]
                  : "0 0 20px rgba(232,228,217,0.15), 0 0 40px rgba(212,175,55,0.1)",
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </>
        )}

        {/* Card Container */}
        <div
          className={cn(
            "relative h-full p-6 md:p-8 rounded-2xl border overflow-hidden",
            isUnavailable && "bg-[rgba(12,12,12,0.9)] backdrop-blur-xl border-white/5",
            isElite && "bg-[rgba(8,8,8,0.95)] backdrop-blur-xl border-white/10"
          )}
        >
          {/* Elite - Premium Frosted glass overlay */}
          {isElite && (
            <div
              className="absolute inset-0 opacity-60 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 0%, rgba(232,228,217,0.08) 0%, transparent 50%)",
              }}
            />
          )}

          {/* Card Content */}
          <div className="relative z-10 flex flex-col h-full">
            {/* CSS Credit Card Visual */}
            <div className="relative w-full mb-6 flex items-center justify-center px-4">
              <CreditCardVisual tier={tier} isHovered={isHovered} />
            </div>

            {/* Header */}
            <div className="text-center mb-6">
              {/* Elite Tag - Primary Available Option */}
              {isElite && (
                <div className="space-y-3 mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                    </span>
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider font-mono">
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
              )}

              {/* Plan Name with Lock for unavailable */}
              <h3
                className={cn(
                  "text-2xl font-bold mb-2 flex items-center justify-center gap-2",
                  isElite && "text-gradient-champagne",
                  isUnavailable && "text-smoke/50"
                )}
              >
                {isUnavailable && <Lock className="w-5 h-5 text-smoke/40" />}
                {name}
              </h3>

              {/* Price */}
              <div className="mb-3">
                <span
                  className={cn(
                    "text-5xl price-display",
                    isElite && "text-champagne",
                    isUnavailable && "text-smoke/40"
                  )}
                >
                  {price}
                </span>
                <span className={cn(
                  "text-lg",
                  isElite ? "text-muted-foreground" : "text-muted-foreground/50"
                )}>{period}</span>
              </div>

              {/* Description */}
              <p className={cn(
                "text-sm",
                isElite ? "text-muted-foreground" : "text-muted-foreground/50"
              )}>{description}</p>
            </div>

            {/* Divider */}
            <div
              className={cn(
                "h-px w-full mb-6",
                isElite && "bg-gradient-to-r from-transparent via-champagne/30 to-transparent",
                isUnavailable && "bg-gradient-to-r from-transparent via-white/10 to-transparent"
              )}
            />

            {/* Features List */}
            <ul className="space-y-3 flex-grow mb-8">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      isElite && "bg-champagne/10",
                      isUnavailable && "bg-white/5"
                    )}
                  >
                    <Check
                      className={cn(
                        "w-3 h-3",
                        isElite && "text-champagne",
                        isUnavailable && "text-smoke/30"
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-sm leading-relaxed",
                      isElite && "text-smoke/80",
                      isUnavailable && "text-smoke/40"
                    )}
                  >
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            {/* CTA Button */}
            <div
              className="space-y-3 relative z-50"
              style={{ transform: "translateZ(0)" }}
            >
              {isElite ? (
                <a
                  href={whopLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(whopLink, '_blank', 'noopener,noreferrer');
                  }}
                  className="flex items-center justify-center gap-2 font-mono tracking-wide w-full h-14 text-base font-bold rounded-xl transition-all duration-500 bg-gradient-to-r from-champagne-dark via-champagne to-champagne-light text-onyx hover:shadow-[0_0_40px_rgba(232,228,217,0.5)] hover:-translate-y-0.5 cursor-pointer"
                >
                  JOIN TODAY
                </a>
              ) : (
                <Button
                  className="w-full h-14 text-base font-medium rounded-xl bg-white/5 text-smoke/50 border border-white/10 hover:bg-white/10 hover:text-smoke/70 transition-all duration-300"
                >
                  <span className="font-mono tracking-wide">JOIN WAITLIST</span>
                </Button>
              )}

              {/* Security Badge - Elite only */}
              {isElite && (
                <p className="text-center text-xs text-muted-foreground/60">
                  Secure transaction powered by{" "}
                  <span className="text-muted-foreground/80">Whop</span> &{" "}
                  <span className="text-muted-foreground/80">Stripe</span>
                </p>
              )}
            </div>
          </div>

          {/* Elite - Corner accents */}
          {isElite && (
            <>
              <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-champagne/30 rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-champagne/30 rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-champagne/30 rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-champagne/30 rounded-br-2xl" />
            </>
          )}

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
            background: isElite
              ? "radial-gradient(ellipse at center, rgba(232,228,217,0.2) 0%, transparent 70%)"
              : "radial-gradient(ellipse at center, rgba(255, 255, 255, 0.03) 0%, transparent 70%)",
            filter: "blur(12px)",
            opacity: isHovered ? 1 : 0.5,
            transition: "opacity 0.3s ease",
          }}
        />
      </motion.div>
    </motion.div>
  );
}
