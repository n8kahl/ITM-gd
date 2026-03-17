"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar, Target, TrendingUp, Brain, Users } from "lucide-react";
import { RevealHeading, RevealContent, StaggerContainer, StaggerItem } from "@/components/ui/scroll-animations";
import { Analytics } from "@/lib/analytics";
import { LAUNCHPASS_URLS, withRewardfulReferral } from "@/lib/rewardful";
import { useRewardfulLink } from "@/lib/use-rewardful-link";

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
    description: "Develop a portfolio framework built around disciplined allocation and risk management",
  },
  {
    icon: Brain,
    title: "Mindset Mastery",
    description: "Overcome the psychology barriers preventing consistent profitability",
  },
];

export function CohortSection({ }: CohortSectionProps = {}) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const cohortCheckoutUrl = useRewardfulLink(LAUNCHPASS_URLS.cohort);

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
    window.location.href = withRewardfulReferral(cohortCheckoutUrl);
  };

  return (
    <section id="cohort" className="container mx-auto px-4 py-12 md:py-14">
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

        <div className="relative z-10 p-6 md:p-8 lg:p-10 xl:p-12">
          {/* Two-column layout */}
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10 xl:gap-12">

            {/* Left Column - Header + Price */}
            <div className="space-y-5 lg:space-y-6">
              {/* Badge */}
              <RevealContent>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-champagne/30 bg-champagne/5">
                  <Users className="w-4 h-4 text-champagne" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-champagne">
                    Small Group Mentorship
                  </span>
                </div>
              </RevealContent>

              {/* Title */}
              <RevealHeading>
                <h2 className="text-3xl md:text-4xl xl:text-[3.25rem] font-serif font-semibold leading-tight">
                  <span className="text-ivory">Precision</span>{" "}
                  <span className="text-gradient-champagne">Cohort</span>
                </h2>
              </RevealHeading>

              {/* Subtitle */}
              <RevealContent delay={0.1}>
                <p className="max-w-lg text-base leading-relaxed text-ivory/70 md:text-lg">
                  Our 90 day mentorship program is built for traders ready to
                  <span className="text-champagne"> develop their own edge</span>.
                </p>
              </RevealContent>

              {/* Price Panel */}
              <RevealContent delay={0.2}>
                <div className="max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 md:p-6">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl md:text-6xl font-serif font-bold text-champagne">
                          $1,500
                        </span>
                        <span className="text-lg text-ivory/60">/90 days</span>
                      </div>
                      <p className="text-sm text-ivory/50 italic">
                        Mentorship, not Signals
                      </p>
                    </div>

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
                          className="min-w-[200px] rounded-sm"
                        >
                          Join Today
                        </Button>
                      </motion.div>
                    </motion.div>

                    <p className="text-sm leading-relaxed text-ivory/50">
                      Cohort sizes are kept small to support focused mentorship and direct feedback.
                    </p>
                  </div>
                </div>
              </RevealContent>
            </div>

            {/* Right Column - 4 Pillars */}
            <div className="space-y-4">
              <RevealContent delay={0.15}>
                <div className="flex items-center justify-between gap-4 px-1">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-champagne/70">
                      What Defines The Cohort
                    </p>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-ivory/55">
                      Structured coaching across live sessions, trade construction, portfolio risk, and trader psychology.
                    </p>
                  </div>
                </div>
              </RevealContent>

              <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5" staggerDelay={0.1}>
                {pillars.map((pillar) => (
                  <StaggerItem key={pillar.title}>
                    <motion.div
                      className={cn(
                        "h-full rounded-xl border border-white/[0.06] bg-[rgba(10,10,11,0.5)] p-5 md:p-6",
                        "transition-all duration-500 hover:border-champagne/20"
                      )}
                      whileHover={{ y: -4 }}
                    >
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-champagne/20 bg-gradient-to-br from-champagne/10 to-primary/10">
                        <pillar.icon className="h-6 w-6 text-champagne" strokeWidth={1.5} />
                      </div>
                      <h3 className="mb-2 text-lg font-semibold text-ivory">
                        {pillar.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-ivory/60">
                        {pillar.description}
                      </p>
                    </motion.div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
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
