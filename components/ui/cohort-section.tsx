"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar, Target, TrendingUp, Brain, Users } from "lucide-react";
import { RevealHeading, RevealContent, StaggerContainer, StaggerItem } from "@/components/ui/scroll-animations";
import { Analytics } from "@/lib/analytics";

interface CohortSectionProps {
  // No props needed - using direct link
}

const pillars = [
  {
    icon: Calendar,
    title: "Live Strategy Sessions",
    description: "Weekly live sessions breaking down real-time market structure and trade setups",
  },
  {
    icon: Target,
    title: "Trade Architecture",
    description: "Learn to build trades from the ground up—entries, exits, position sizing",
  },
  {
    icon: TrendingUp,
    title: "Portfolio Engineering",
    description: "Develop a complete portfolio strategy tailored to your capital and goals",
  },
  {
    icon: Brain,
    title: "Mindset Mastery",
    description: "Overcome the psychology barriers preventing consistent profitability",
  },
];

export function CohortSection({}: CohortSectionProps = {}) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleApplyClick = () => {
    Analytics.trackCTAClick('Cohort Join Today');
    window.location.href = 'https://whop.com/checkout/plan_T4Ymve5JhqpY7';
  };

  return (
    <section id="cohort" className="container mx-auto px-4 py-16">
      <motion.div
        ref={sectionRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "relative rounded-2xl overflow-hidden",
          "glass-card-heavy"
        )}
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
        style={{
          border: '1px solid rgba(232, 228, 217, 0.15)',
        }}
      >
        {/* Spotlight gradient following mouse */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-700"
          style={{
            background: isHovered
              ? `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(4, 120, 87, 0.08), transparent 40%)`
              : "none",
            opacity: isHovered ? 1 : 0,
          }}
        />

        {/* Emerald/Champagne glow accents */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-champagne/30 to-transparent" />
          <div className="absolute bottom-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>

        {/* Corner glow effects */}
        <div className="absolute -top-20 -left-20 w-60 h-60 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-champagne/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 p-8 md:p-12 lg:p-16">
          {/* Two-column layout */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left Column - Header + Price */}
            <div className="space-y-6">
              {/* Badge */}
              <RevealContent>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-champagne/30 bg-champagne/5">
                  <Users className="w-4 h-4 text-champagne" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-champagne">
                    Limited to 20 Traders
                  </span>
                </div>
              </RevealContent>

              {/* Title */}
              <RevealHeading>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-semibold">
                  <span className="text-ivory">Precision</span>{" "}
                  <span className="text-gradient-champagne">Cohort</span>
                </h2>
              </RevealHeading>

              {/* Subtitle */}
              <RevealContent delay={0.1}>
                <p className="text-lg text-ivory/70 leading-relaxed max-w-md">
                  The Next Cohort is starting soon! Our exclusive annual mentorship program for traders ready to
                  <span className="text-champagne"> develop their own edge</span>.
                </p>
              </RevealContent>

              {/* Price Display */}
              <RevealContent delay={0.2}>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl md:text-6xl font-serif font-bold text-champagne">
                      $1,500
                    </span>
                    <span className="text-lg text-ivory/60">/year</span>
                  </div>
                  <p className="text-sm text-ivory/50 italic">
                    Mentorship, not Signals
                  </p>
                </div>
              </RevealContent>

              {/* CTA Button */}
              <RevealContent delay={0.3}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-block"
                >
                  <motion.div
                    animate={{
                      boxShadow: [
                        "0 0 20px rgba(232, 228, 217, 0.2)",
                        "0 0 40px rgba(232, 228, 217, 0.35)",
                        "0 0 20px rgba(232, 228, 217, 0.2)",
                      ],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="rounded-sm"
                  >
                    <Button
                      onClick={handleApplyClick}
                      variant="luxury-champagne"
                      size="xl"
                      className="rounded-sm min-w-[200px]"
                    >
                      Join Today
                    </Button>
                  </motion.div>
                </motion.div>
              </RevealContent>

              {/* Scarcity indicator */}
              <RevealContent delay={0.4}>
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400"></span>
                  </span>
                  <span>Only 20 seats per cohort - Applications reviewed personally</span>
                </div>
              </RevealContent>
            </div>

            {/* Right Column - 4 Pillars */}
            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-6" staggerDelay={0.1}>
              {pillars.map((pillar) => (
                <StaggerItem key={pillar.title}>
                  <motion.div
                    className={cn(
                      "p-6 rounded-xl h-full",
                      "bg-[rgba(10,10,11,0.5)] border border-white/[0.06]",
                      "hover:border-champagne/20 transition-all duration-500"
                    )}
                    whileHover={{ y: -4 }}
                  >
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-gradient-to-br from-champagne/10 to-primary/10 border border-champagne/20">
                      <pillar.icon className="w-6 h-6 text-champagne" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-semibold text-ivory mb-2">
                      {pillar.title}
                    </h3>
                    <p className="text-sm text-ivory/60 leading-relaxed">
                      {pillar.description}
                    </p>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </div>

        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </motion.div>
    </section>
  );
}
