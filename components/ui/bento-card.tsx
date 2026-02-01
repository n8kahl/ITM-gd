"use client";

import { motion } from "framer-motion";
import { useState, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface BentoCardProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  className?: string;
  iconClassName?: string;
  spotlight?: "emerald" | "gold";
  image?: string; // Deprecated - prefer icons
  graphic?: ReactNode; // Custom graphic (charts, etc.)
  graphicClassName?: string;
}

export function BentoCard({
  icon: Icon,
  title,
  description,
  className,
  iconClassName,
  spotlight = "emerald",
  image,
  graphic,
  graphicClassName,
}: BentoCardProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Refined, subtle spotlight colors
  const spotlightColor =
    spotlight === "gold"
      ? "rgba(16, 185, 129, 0.08)"
      : "rgba(4, 120, 87, 0.10)";

  const borderColor =
    spotlight === "gold"
      ? "rgba(232, 228, 217, 0.3)"
      : "rgba(4, 120, 87, 0.4)";

  return (
    <motion.div
      ref={cardRef}
      className={cn(
        "relative group rounded-xl overflow-hidden",
        "bg-[rgba(10,10,11,0.7)] backdrop-blur-xl",
        "border border-white/[0.06]",
        "transition-all duration-500",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      {/* Spotlight gradient that follows mouse */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{
          background: isHovered
            ? `radial-gradient(500px circle at ${mousePosition.x}px ${mousePosition.y}px, ${spotlightColor}, transparent 40%)`
            : "none",
        }}
      />

      {/* Border glow effect */}
      <div
        className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{
          background: isHovered
            ? `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, ${borderColor}, transparent 40%)`
            : "none",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          padding: "1px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 p-6 md:p-8 h-full flex flex-col">
        {/* Graphic (for charts) or Icon or Image */}
        {graphic ? (
          <div
            className={cn(
              "relative w-full h-48 md:h-56 mb-6 rounded-lg overflow-hidden",
              "bg-[rgba(10,10,11,0.8)] border border-white/[0.04]",
              graphicClassName
            )}
          >
            {/* Terminal Grid Background */}
            <div
              className="absolute inset-0 pointer-events-none opacity-30"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(232,228,217,0.03) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(232,228,217,0.03) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px',
              }}
            />
            {graphic}
          </div>
        ) : image ? (
          <div
            className={cn(
              "relative w-full h-48 md:h-56 mb-6 rounded-lg overflow-hidden",
              "bg-[rgba(10,10,11,0.8)] border border-white/[0.04]"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              className="w-full h-full object-cover"
            />
            {/* Bottom fade gradient */}
            <div
              className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
              style={{
                background: "linear-gradient(to top, rgba(10,10,11,0.9) 0%, transparent 100%)",
              }}
            />
          </div>
        ) : Icon ? (
          <div
            className={cn(
              "w-16 h-16 md:w-20 md:h-20 rounded-xl flex items-center justify-center mb-6",
              "bg-gradient-to-br border",
              spotlight === "gold"
                ? "from-champagne/10 to-champagne/5 border-champagne/20"
                : "from-wealth-emerald/10 to-wealth-emerald/5 border-wealth-emerald/20",
              iconClassName
            )}
          >
            {/* Icon with gradient effect via SVG defs */}
            <svg width="0" height="0" className="absolute">
              <defs>
                <linearGradient id="icon-gradient-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#E8E4D9" />
                  <stop offset="50%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#B8B5AD" />
                </linearGradient>
                <linearGradient id="icon-gradient-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#047857" />
                  <stop offset="50%" stopColor="#059669" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
              </defs>
            </svg>
            <Icon
              className={cn(
                "w-8 h-8 md:w-10 md:h-10",
                spotlight === "gold" ? "text-champagne" : "text-wealth-emerald"
              )}
              strokeWidth={1.5}
              style={{
                stroke: spotlight === "gold"
                  ? "url(#icon-gradient-gold)"
                  : "url(#icon-gradient-emerald)",
              }}
            />
          </div>
        ) : null}

        {/* Title - Editorial Style */}
        <h3 className="text-lg md:text-xl font-semibold text-ivory mb-2 tracking-tight">
          {title}
        </h3>

        {/* Description - Light and readable */}
        <p className="text-sm text-ivory/60 leading-relaxed flex-grow font-light">
          {description}
        </p>

        {/* Subtle corner accent */}
        <div
          className={cn(
            "absolute bottom-0 right-0 w-20 h-20 opacity-0 group-hover:opacity-100 transition-opacity duration-700",
            spotlight === "gold"
              ? "bg-gradient-to-tl from-champagne/5 to-transparent"
              : "bg-gradient-to-tl from-wealth-emerald/5 to-transparent"
          )}
        />
      </div>

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </motion.div>
  );
}
