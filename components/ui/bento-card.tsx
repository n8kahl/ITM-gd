"use client";

import { motion } from "framer-motion";
import { useState, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface BentoCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  iconClassName?: string;
  spotlight?: "emerald" | "gold";
  image?: string;
}

export function BentoCard({
  icon: Icon,
  title,
  description,
  className,
  iconClassName,
  spotlight = "emerald",
  image,
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

  const spotlightColor =
    spotlight === "gold"
      ? "rgba(212, 175, 55, 0.15)"
      : "rgba(16, 185, 129, 0.15)";

  const borderColor =
    spotlight === "gold"
      ? "rgba(212, 175, 55, 0.6)"
      : "rgba(16, 185, 129, 0.6)";

  return (
    <motion.div
      ref={cardRef}
      className={cn(
        "relative group rounded-2xl overflow-hidden",
        "bg-[rgba(10,10,10,0.6)] backdrop-blur-xl",
        "border border-white/[0.08]",
        "transition-colors duration-500",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Spotlight gradient that follows mouse */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: isHovered
            ? `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, ${spotlightColor}, transparent 40%)`
            : "none",
        }}
      />

      {/* Border glow effect */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: isHovered
            ? `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, ${borderColor}, transparent 40%)`
            : "none",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          padding: "1px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 p-6 md:p-8 h-full flex flex-col">
        {/* Icon or Image */}
        {image ? (
          <div className="relative w-20 h-20 md:w-24 md:h-24 mb-6">
            <Image
              src={image}
              alt={title}
              fill
              className="object-contain drop-shadow-lg"
            />
          </div>
        ) : (
          <div
            className={cn(
              "w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center mb-6",
              "bg-gradient-to-br",
              spotlight === "gold"
                ? "from-gold/20 to-gold-dark/10"
                : "from-primary/20 to-money-green-dark/10",
              iconClassName
            )}
          >
            <Icon
              className={cn(
                "w-7 h-7 md:w-8 md:h-8",
                spotlight === "gold" ? "text-gold" : "text-primary"
              )}
            />
          </div>
        )}

        {/* Title */}
        <h3 className="text-xl md:text-2xl font-bold text-smoke mb-3">
          {title}
        </h3>

        {/* Description */}
        <p className="text-muted-foreground leading-relaxed flex-grow">
          {description}
        </p>

        {/* Decorative corner accent */}
        <div
          className={cn(
            "absolute bottom-0 right-0 w-24 h-24 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
            spotlight === "gold"
              ? "bg-gradient-to-tl from-gold/10 to-transparent"
              : "bg-gradient-to-tl from-primary/10 to-transparent"
          )}
        />
      </div>
    </motion.div>
  );
}
