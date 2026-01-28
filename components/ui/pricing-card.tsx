"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import { Check, AlertCircle } from "lucide-react";
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
}

const cardImages = {
  starter: "/card-starter.png",
  pro: "/card-pro.png",
  elite: "/card-elite.png",
};

export function PricingCard({
  name,
  price,
  period,
  description,
  features,
  whopLink,
  popular = false,
  tier,
}: PricingCardProps) {
  const isElite = tier === "elite";
  const isPro = tier === "pro";
  const isStarter = tier === "starter";

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

    // Normalized position from -0.5 to 0.5
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
        isElite ? "lg:scale-105 z-10" : ""
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
        className="relative h-full"
        style={{
          rotateX: isHovered ? rotateX : 0,
          rotateY: isHovered ? rotateY : 0,
          transformStyle: "preserve-3d",
        }}
        whileHover={{ y: -8, scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Pro Card - Signal Green Glowing Border */}
        {isPro && (
          <motion.div
            className="absolute -inset-[2px] rounded-2xl -z-10"
            style={{
              background: "linear-gradient(135deg, #00E676, #00C853, #00E676)",
            }}
            animate={{
              boxShadow: isHovered
                ? [
                    "0 0 25px rgba(0, 230, 118, 0.5), 0 0 50px rgba(0, 230, 118, 0.3)",
                    "0 0 35px rgba(0, 230, 118, 0.7), 0 0 70px rgba(0, 230, 118, 0.4)",
                    "0 0 25px rgba(0, 230, 118, 0.5), 0 0 50px rgba(0, 230, 118, 0.3)",
                  ]
                : "0 0 20px rgba(0, 230, 118, 0.3), 0 0 40px rgba(0, 230, 118, 0.15)",
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        {/* Elite Card - Subtle border glow */}
        {isElite && (
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-white/20 via-white/5 to-white/10 -z-10" />
        )}

        {/* Card Container */}
        <div
          className={cn(
            "relative h-full p-6 md:p-8 rounded-2xl border overflow-hidden",
            // Pro - Black Titanium metallic gradient
            isPro &&
              "bg-gradient-to-br from-[#1a1a1a] via-[#0d0d0d] to-[#1a1a1a] border-primary/50",
            // Elite - Dark Frosted Glass
            isElite &&
              "bg-[rgba(8,8,8,0.9)] backdrop-blur-xl border-white/10",
            // Starter - Ghost frosted glass
            isStarter && "bg-[rgba(15,15,15,0.8)] backdrop-blur-xl border-white/10"
          )}
        >
          {/* Pro - Animated Diagonal Sheen */}
          {isPro && (
            <motion.div
              className="absolute inset-0 pointer-events-none z-10"
              initial={{ x: "-100%", opacity: 0 }}
              animate={{
                x: ["−150%", "250%"],
                opacity: [0, 0.3, 0.3, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatDelay: 5,
                ease: "easeInOut",
              }}
              style={{
                background:
                  "linear-gradient(105deg, transparent 20%, rgba(0, 230, 118, 0.15) 40%, rgba(255, 255, 255, 0.2) 50%, rgba(0, 230, 118, 0.15) 60%, transparent 80%)",
                transform: "skewX(-20deg)",
              }}
            />
          )}

          {/* Pro - Brushed metal texture */}
          {isPro && (
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  90deg,
                  transparent,
                  transparent 1px,
                  rgba(255,255,255,0.1) 1px,
                  rgba(255,255,255,0.1) 2px
                )`,
              }}
            />
          )}

          {/* Elite - Limited Spots Badge */}
          {isElite && (
            <motion.div
              className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/40"
              animate={{
                boxShadow: [
                  "0 0 10px rgba(239, 68, 68, 0.3)",
                  "0 0 20px rgba(239, 68, 68, 0.5)",
                  "0 0 10px rgba(239, 68, 68, 0.3)",
                ],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <AlertCircle className="w-3 h-3 text-red-400" />
              <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider font-mono">
                Limited Spots
              </span>
            </motion.div>
          )}

          {/* Elite - Frosted glass overlay */}
          {isElite && (
            <div
              className="absolute inset-0 opacity-50 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.08) 0%, transparent 50%)",
              }}
            />
          )}

          {/* Starter - Frosted overlay */}
          {isStarter && (
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.1) 0%, transparent 60%)",
              }}
            />
          )}

          {/* Card Content */}
          <div className="relative z-10 flex flex-col h-full">
            {/* Card Image */}
            <div className="relative w-full h-32 md:h-40 mb-6 flex items-center justify-center">
              <Image
                src={cardImages[tier]}
                alt={`${name} membership card`}
                width={200}
                height={120}
                className={cn(
                  "object-contain transition-transform duration-300",
                  isPro && "drop-shadow-[0_0_25px_rgba(0,230,118,0.4)]",
                  isElite && "drop-shadow-xl opacity-95",
                  isStarter && "drop-shadow-xl opacity-90",
                  isHovered && "scale-105"
                )}
              />
            </div>

            {/* Header */}
            <div className="text-center mb-6">
              {/* Pro Tag */}
              {isPro && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/40 mb-4">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider font-mono">
                    MOST POPULAR
                  </span>
                </div>
              )}

              {/* Elite Tag */}
              {isElite && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 mb-4">
                  <span className="text-xs font-semibold text-platinum uppercase tracking-wider font-mono">
                    THE BLACK CARD
                  </span>
                </div>
              )}

              {/* Plan Name */}
              <h3
                className={cn(
                  "text-2xl font-bold mb-2",
                  isPro && "text-gradient-signal-green",
                  isElite && "text-gradient-platinum",
                  isStarter && "text-smoke/80"
                )}
              >
                {name}
              </h3>

              {/* Price */}
              <div className="mb-3">
                <span
                  className={cn(
                    "text-5xl price-display",
                    isPro && "text-white",
                    isElite && "text-platinum",
                    isStarter && "text-smoke/70"
                  )}
                >
                  {price}
                </span>
                <span className="text-lg text-muted-foreground">{period}</span>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>

            {/* Divider */}
            <div
              className={cn(
                "h-px w-full mb-6",
                isPro &&
                  "bg-gradient-to-r from-transparent via-primary/40 to-transparent",
                isElite &&
                  "bg-gradient-to-r from-transparent via-white/20 to-transparent",
                isStarter &&
                  "bg-gradient-to-r from-transparent via-white/10 to-transparent"
              )}
            />

            {/* Features List */}
            <ul className="space-y-3 flex-grow mb-8">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      isPro && "bg-primary/30",
                      isElite && "bg-white/10",
                      isStarter && "bg-white/10"
                    )}
                  >
                    <Check
                      className={cn(
                        "w-3 h-3",
                        isPro && "text-primary",
                        isElite && "text-platinum",
                        isStarter && "text-smoke/60"
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-sm leading-relaxed",
                      isPro && "text-smoke/90",
                      isElite && "text-smoke/80",
                      isStarter && "text-smoke/60"
                    )}
                  >
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            {/* CTA Button */}
            <div className="space-y-3">
              <Button
                asChild
                className={cn(
                  "w-full h-14 text-base font-bold rounded-xl transition-all duration-300",
                  // Pro - Solid Electric Green
                  isPro &&
                    "bg-primary hover:bg-primary/90 text-void hover:shadow-[0_0_30px_rgba(0,230,118,0.5)]",
                  // Elite - Platinum gradient
                  isElite &&
                    "bg-gradient-to-r from-platinum-dark via-platinum to-platinum-light text-void hover:shadow-[0_0_30px_rgba(229,228,226,0.4)]",
                  // Starter - Ghost outline
                  isStarter &&
                    "bg-transparent text-smoke/70 border border-white/20 hover:border-white/40 hover:bg-white/5"
                )}
              >
                <a
                  href={whopLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 font-mono"
                >
                  {isPro ? "EXECUTE" : isElite ? "APPLY NOW" : "GET STARTED"}
                </a>
              </Button>

              {/* Security Badge */}
              <p className="text-center text-xs text-muted-foreground/60">
                Secure transaction powered by{" "}
                <span className="text-muted-foreground/80">Whop</span> &{" "}
                <span className="text-muted-foreground/80">Stripe</span>
              </p>
            </div>
          </div>

          {/* Elite - Corner accents */}
          {isElite && (
            <>
              <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-white/20 rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-white/20 rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-white/20 rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-white/20 rounded-br-2xl" />
            </>
          )}

          {/* Pro - Corner accents */}
          {isPro && (
            <>
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary/50 rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary/50 rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary/50 rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary/50 rounded-br-2xl" />
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
            background: isPro
              ? "radial-gradient(ellipse at center, rgba(0, 230, 118, 0.2) 0%, transparent 70%)"
              : isElite
              ? "radial-gradient(ellipse at center, rgba(229, 228, 226, 0.1) 0%, transparent 70%)"
              : "radial-gradient(ellipse at center, rgba(255, 255, 255, 0.05) 0%, transparent 70%)",
            filter: "blur(12px)",
            opacity: isHovered ? 1 : 0.5,
            transition: "opacity 0.3s ease",
          }}
        />
      </motion.div>
    </motion.div>
  );
}
