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
  const isPro = tier === "pro";

  return (
    <motion.div
      className={cn(
        "relative rounded-2xl overflow-hidden h-full",
        isPro ? "lg:scale-105 z-10" : ""
      )}
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Popular Badge - Platinum gradient */}
      {popular && (
        <div className="absolute -top-px left-0 right-0 h-1 bg-gradient-to-r from-platinum-dark via-platinum to-platinum-light" />
      )}

      {/* Card Container */}
      <div
        className={cn(
          "relative h-full p-6 md:p-8 rounded-2xl border",
          // Pro card - Black Titanium metallic look with platinum accents
          isPro
            ? "bg-gradient-to-br from-[#1a1a1a] via-[#2d2d2d] to-[#1a1a1a] border-platinum/30"
            : // Glass cards for Starter and Elite
              "glass-card-heavy border-white/10"
        )}
      >
        {/* Metallic sheen overlay for Pro card - platinum */}
        {isPro && (
          <>
            {/* Primary metallic sheen */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                background:
                  "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.1) 25%, transparent 50%, rgba(255,255,255,0.05) 75%, transparent 100%)",
              }}
            />
            {/* Secondary diagonal shine - platinum */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                background:
                  "linear-gradient(45deg, transparent 30%, rgba(229,228,226,0.3) 50%, transparent 70%)",
              }}
            />
            {/* Edge highlight */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none border border-white/5" />
          </>
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
              className="object-contain drop-shadow-2xl"
            />
          </div>

          {/* Header */}
          <div className="text-center mb-6">
            {/* Popular Tag */}
            {popular && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-platinum/10 border border-platinum/30 mb-4">
                <span className="text-xs font-semibold text-platinum uppercase tracking-wider">
                  Most Popular
                </span>
              </div>
            )}

            {/* Plan Name */}
            <h3
              className={cn(
                "text-2xl font-bold mb-2",
                isPro ? "text-gradient-platinum" : "text-smoke"
              )}
            >
              {name}
            </h3>

            {/* Price */}
            <div className="mb-3">
              <span
                className={cn(
                  "text-5xl price-display",
                  isPro ? "text-white" : "text-smoke"
                )}
              >
                {price}
              </span>
              <span className="text-muted-foreground text-lg">{period}</span>
            </div>

            {/* Description */}
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>

          {/* Divider */}
          <div
            className={cn(
              "h-px w-full mb-6",
              isPro
                ? "bg-gradient-to-r from-transparent via-platinum/30 to-transparent"
                : "bg-gradient-to-r from-transparent via-white/10 to-transparent"
            )}
          />

          {/* Features List */}
          <ul className="space-y-3 flex-grow mb-8">
            {features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    isPro ? "bg-primary/20" : "bg-primary/10"
                  )}
                >
                  <Check
                    className={cn(
                      "w-3 h-3",
                      isPro ? "text-primary" : "text-primary/80"
                    )}
                  />
                </div>
                <span className="text-sm text-smoke/80 leading-relaxed">
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
                isPro
                  ? // Pro button - platinum gradient with pulse
                    "bg-gradient-to-r from-platinum-dark via-platinum to-platinum-light text-void hover:shadow-[0_0_30px_rgba(229,228,226,0.4)] animate-pulse-subtle"
                  : tier === "elite"
                    ? "bg-gradient-to-r from-signal-green-dark via-primary to-signal-green-light text-void hover:shadow-[0_0_20px_rgba(0,230,118,0.3)]"
                    : "bg-white/10 text-smoke hover:bg-white/20 border border-white/10"
              )}
            >
              <a
                href={whopLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                {isPro ? "Join Now" : `Get ${name}`}
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

        {/* Card texture overlay */}
        {isPro && (
          <div
            className="absolute inset-0 opacity-[0.02] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />
        )}
      </div>

      {/* Glow effect for Pro card - platinum */}
      {isPro && (
        <div className="absolute -inset-1 bg-gradient-to-r from-platinum/20 via-platinum/10 to-platinum/20 rounded-2xl blur-xl -z-10 opacity-50" />
      )}
    </motion.div>
  );
}
