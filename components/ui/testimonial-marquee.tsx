"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Quote } from "lucide-react";

interface Testimonial {
  name: string;
  role: string;
  content: string;
  avatar: string;
}

interface TestimonialMarqueeProps {
  testimonials: Testimonial[];
  direction?: "left" | "right";
  speed?: number;
  className?: string;
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className="flex-shrink-0 w-[350px] mx-3">
      <div
        className={cn(
          "relative p-6 rounded-2xl h-full",
          "bg-[rgba(10,10,10,0.5)] backdrop-blur-xl",
          "border border-white/[0.08]",
          "hover:border-gold/20 transition-colors duration-300"
        )}
      >
        {/* Quote Icon */}
        <div className="absolute top-4 right-4 opacity-20">
          <Quote className="w-8 h-8 text-gold" />
        </div>

        {/* Content */}
        <p className="text-smoke/80 text-sm leading-relaxed mb-6 line-clamp-4">
          &ldquo;{testimonial.content}&rdquo;
        </p>

        {/* Author */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-gold/20 to-primary/20">
            <Image
              src="/trader-avatar.png"
              alt={testimonial.name}
              fill
              className="object-cover opacity-80"
            />
          </div>
          <div>
            <div className="font-semibold text-smoke text-sm">
              {testimonial.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {testimonial.role}
            </div>
          </div>
        </div>

        {/* Decorative gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>
    </div>
  );
}

export function TestimonialMarquee({
  testimonials,
  direction = "left",
  speed = 30,
  className,
}: TestimonialMarqueeProps) {
  // Duplicate testimonials for seamless loop
  const duplicatedTestimonials = [...testimonials, ...testimonials];

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Gradient masks for fade effect */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-void to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-void to-transparent z-10 pointer-events-none" />

      {/* Marquee container */}
      <motion.div
        className="flex"
        animate={{
          x: direction === "left" ? [0, -50 * testimonials.length + "%"] : [-50 * testimonials.length + "%", 0],
        }}
        transition={{
          x: {
            duration: speed * testimonials.length,
            repeat: Infinity,
            ease: "linear",
          },
        }}
      >
        {duplicatedTestimonials.map((testimonial, idx) => (
          <TestimonialCard key={idx} testimonial={testimonial} />
        ))}
      </motion.div>
    </div>
  );
}
