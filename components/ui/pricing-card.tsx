"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

  return (
    <motion.div
      className={cn(
        "relative rounded-2xl overflow-hidden h-full",
        isElite ? "lg:scale-105 z-10" : ""
      )}
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Elite Card - Neon Green Pulsing Border Glow */}
      {isElite && (
        <motion.div
          className="absolute -inset-[2px] rounded-2xl -z-10"
          style={{
            background: "linear-gradient(135deg, #00E676, #00C853, #00E676)",
          }}
          animate={{
            boxShadow: [
              "0 0 20px rgba(0, 230, 118, 0.4), 0 0 40px rgba(0, 230, 118, 0.2)",
              "0 0 30px rgba(0, 230, 118, 0.6), 0 0 60px rgba(0, 230, 118, 0.3)",
              "0 0 20px rgba(0, 230, 118, 0.4), 0 0 40px rgba(0, 230, 118, 0.2)",
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Pro Card - Platinum glow */}
      {isPro && (
        <div className="absolute -inset-1 bg-gradient-to-r from-platinum/20 via-platinum/30 to-platinum/20 rounded-2xl blur-xl -z-10 opacity-60" />
      )}

      {/* Card Container */}
      <div
        className={cn(
          "relative h-full p-6 md:p-8 rounded-2xl border overflow-hidden",
          // Elite - Matte Black
          isElite && "bg-[#0a0a0a] border-primary/50",
          // Pro - Brushed Platinum metallic
          isPro && "bg-gradient-to-br from-[#d4d4d4] via-[#f5f5f5] to-[#d4d4d4] border-white/50",
          // Starter - Ghost frosted glass
          isStarter && "bg-[rgba(15,15,15,0.8)] backdrop-blur-xl border-white/10"
        )}
      >
        {/* Elite - Scanner Light Effect */}
        {isElite && (
          <motion.div
            className="absolute left-0 right-0 h-[2px] pointer-events-none z-20"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(0, 230, 118, 0.6), transparent)",
              boxShadow: "0 0 20px rgba(0, 230, 118, 0.5), 0 0 40px rgba(0, 230, 118, 0.3)",
            }}
            animate={{
              top: ["-2px", "100%"],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              repeatDelay: 2,
              ease: "linear",
            }}
          />
        )}

        {/* Pro - Brushed metal texture overlay */}
        {isPro && (
          <>
            {/* Horizontal brush lines */}
            <div
              className="absolute inset-0 opacity-[0.08] pointer-events-none"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 2px,
                  rgba(0,0,0,0.1) 2px,
                  rgba(0,0,0,0.1) 3px
                )`,
              }}
            />
            {/* Diagonal shine */}
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                background: "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.5) 25%, transparent 50%, rgba(255,255,255,0.3) 75%, transparent 100%)",
              }}
            />
          </>
        )}

        {/* Starter - Frosted overlay */}
        {isStarter && (
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.1) 0%, transparent 60%)",
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
                "object-contain",
                isElite && "drop-shadow-[0_0_20px_rgba(0,230,118,0.3)]",
                isPro && "drop-shadow-lg",
                isStarter && "drop-shadow-xl opacity-90"
              )}
            />
          </div>

          {/* Header */}
          <div className="text-center mb-6">
            {/* Elite Tag */}
            {isElite && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/40 mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-xs font-semibold text-primary uppercase tracking-wider font-mono">
                  RECOMMENDED
                </span>
              </div>
            )}

            {/* Popular Tag for Pro */}
            {popular && isPro && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/10 border border-black/20 mb-4">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Most Popular
                </span>
              </div>
            )}

            {/* Plan Name */}
            <h3
              className={cn(
                "text-2xl font-bold mb-2",
                isElite && "text-gradient-signal-green",
                isPro && "text-gray-800",
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
                  isElite && "text-white",
                  isPro && "text-gray-900",
                  isStarter && "text-smoke/70"
                )}
              >
                {price}
              </span>
              <span
                className={cn(
                  "text-lg",
                  isPro ? "text-gray-600" : "text-muted-foreground"
                )}
              >
                {period}
              </span>
            </div>

            {/* Description */}
            <p
              className={cn(
                "text-sm",
                isPro ? "text-gray-600" : "text-muted-foreground"
              )}
            >
              {description}
            </p>
          </div>

          {/* Divider */}
          <div
            className={cn(
              "h-px w-full mb-6",
              isElite && "bg-gradient-to-r from-transparent via-primary/40 to-transparent",
              isPro && "bg-gradient-to-r from-transparent via-gray-400 to-transparent",
              isStarter && "bg-gradient-to-r from-transparent via-white/10 to-transparent"
            )}
          />

          {/* Features List */}
          <ul className="space-y-3 flex-grow mb-8">
            {features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    isElite && "bg-primary/30",
                    isPro && "bg-gray-800/20",
                    isStarter && "bg-white/10"
                  )}
                >
                  <Check
                    className={cn(
                      "w-3 h-3",
                      isElite && "text-primary",
                      isPro && "text-gray-700",
                      isStarter && "text-smoke/60"
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-sm leading-relaxed",
                    isElite && "text-smoke/80",
                    isPro && "text-gray-700",
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
                // Elite - Solid Electric Green
                isElite && "bg-primary hover:bg-primary/90 text-void hover:shadow-[0_0_30px_rgba(0,230,118,0.5)]",
                // Pro - Solid Black
                isPro && "bg-gray-900 hover:bg-black text-white hover:shadow-lg",
                // Starter - Ghost outline
                isStarter && "bg-transparent text-smoke/70 border border-white/20 hover:border-white/40 hover:bg-white/5"
              )}
            >
              <a
                href={whopLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                {isElite ? "Join Elite" : isPro ? "Get Pro" : "Get Started"}
              </a>
            </Button>

            {/* Security Badge */}
            <p
              className={cn(
                "text-center text-xs",
                isPro ? "text-gray-500" : "text-muted-foreground/60"
              )}
            >
              Secure transaction powered by{" "}
              <span className={isPro ? "text-gray-600" : "text-muted-foreground/80"}>
                Whop
              </span>{" "}
              &{" "}
              <span className={isPro ? "text-gray-600" : "text-muted-foreground/80"}>
                Stripe
              </span>
            </p>
          </div>
        </div>

        {/* Elite - Corner accents */}
        {isElite && (
          <>
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary/50 rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary/50 rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary/50 rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary/50 rounded-br-2xl" />
          </>
        )}

        {/* Noise texture for all cards */}
        <div
          className={cn(
            "absolute inset-0 pointer-events-none",
            isElite && "opacity-[0.03]",
            isPro && "opacity-[0.02]",
            isStarter && "opacity-[0.02]"
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
    </motion.div>
  );
}
