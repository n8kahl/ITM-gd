"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Video, Target, TrendingUp, Brain, Users, CheckCircle2, XCircle } from "lucide-react";
import { RevealHeading, RevealContent, StaggerContainer, StaggerItem } from "@/components/ui/scroll-animations";
import { Analytics } from "@/lib/analytics";

interface MentorshipSectionProps {
  onApplyClick: () => void;
}

const problems = [
  "You enter too early or too late",
  "You cut winners short and let losers run",
  "You overtrade and revenge trade",
  "You struggle with consistency",
  "You do not trust your own execution",
];

const includes = [
  "Weekly private one on one calls",
  "Live chart breakdowns",
  "Personalized entry and exit rules",
  "Contract selection guidance",
  "Position sizing framework",
  "Risk management system",
  "Trade review and correction",
  "Psychology and discipline coaching",
  "Journaling system",
  "Private Discord access",
];

const results = [
  "What to trade",
  "When to trade",
  "When NOT to trade",
  "How to manage trades",
  "How to stay disciplined",
];

const forWho = [
  { text: "Traders already trading live", isFor: true },
  { text: "Traders willing to be coached", isFor: true },
  { text: "Traders who want structure", isFor: true },
  { text: "Traders who take this seriously", isFor: true },
];

const notFor = [
  { text: "People who cut corners", isFor: false },
  { text: "People who aren't coachable", isFor: false },
  { text: "People looking for guarantees", isFor: false },
];

export function MentorshipSection({ onApplyClick }: MentorshipSectionProps) {
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
    Analytics.trackCTAClick('Mentorship Apply');
    onApplyClick();
  };

  return (
    <section id="mentorship" className="container mx-auto px-4 py-16">
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
          {/* Header Section */}
          <div className="text-center mb-12 space-y-6">
            {/* Badge */}
            <RevealContent>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-champagne/30 bg-champagne/5">
                <Video className="w-4 h-4 text-champagne" />
                <span className="text-xs font-semibold uppercase tracking-wider text-champagne">
                  One on One Coaching
                </span>
              </div>
            </RevealContent>

            {/* Title */}
            <RevealHeading>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-semibold">
                <span className="text-ivory">TradeITM 1 on 1</span>{" "}
                <span className="text-gradient-champagne">Precision Mentorship</span>
              </h2>
            </RevealHeading>

            {/* Price Display */}
            <RevealContent delay={0.1}>
              <div className="space-y-2">
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl md:text-6xl font-serif font-bold text-champagne">
                    $2,500
                  </span>
                </div>
              </div>
            </RevealContent>

            {/* Main Description */}
            <RevealContent delay={0.2}>
              <div className="max-w-3xl mx-auto space-y-4">
                <p className="text-lg text-ivory/80 leading-relaxed">
                  This is a private, one on one mentorship for traders who are tired of guessing,
                  tired of inconsistency, and ready to trade with{" "}
                  <span className="text-champagne font-semibold">structure, confidence, and discipline</span>.
                </p>
                <div className="flex flex-col gap-2 text-sm text-ivory/60 italic">
                  <p>This is not signals access.</p>
                  <p>This is not a course.</p>
                  <p className="text-champagne">This is direct coaching, execution refinement, and personal accountability.</p>
                </div>
              </div>
            </RevealContent>
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {/* Left Column - Problems & What You Get */}
            <div className="space-y-8">
              {/* 5 Biggest Problems */}
              <RevealContent delay={0.3}>
                <div className={cn(
                  "p-6 rounded-xl",
                  "bg-[rgba(10,10,11,0.5)] border border-red-500/20"
                )}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">🚨</span>
                    <h3 className="text-xl font-semibold text-ivory">The 5 Biggest Problems This Solves</h3>
                  </div>
                  <ul className="space-y-3">
                    {problems.map((problem, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-ivory/70">
                        <span className="text-red-400 mt-1">•</span>
                        <span>{problem}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-sm text-champagne italic">
                    If any of those sound familiar, this mentorship was built for you.
                  </p>
                </div>
              </RevealContent>

              {/* What You Get */}
              <RevealContent delay={0.4}>
                <div className={cn(
                  "p-6 rounded-xl",
                  "bg-[rgba(10,10,11,0.5)] border border-emerald-500/20"
                )}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">🎯</span>
                    <h3 className="text-xl font-semibold text-ivory">What You Get</h3>
                  </div>
                  <ul className="space-y-2">
                    {includes.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-ivory/70">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-1 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-sm text-champagne italic">
                    Everything is tailored to you, your account size, and your goals.
                  </p>
                </div>
              </RevealContent>
            </div>

            {/* Right Column - Results & Who It's For */}
            <div className="space-y-8">
              {/* The Result */}
              <RevealContent delay={0.5}>
                <div className={cn(
                  "p-6 rounded-xl",
                  "bg-[rgba(10,10,11,0.5)] border border-champagne/20"
                )}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">🔥</span>
                    <h3 className="text-xl font-semibold text-ivory">The Result</h3>
                  </div>
                  <p className="text-ivory/70 mb-4">You will know:</p>
                  <ul className="space-y-2 mb-4">
                    {results.map((result, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-ivory/70">
                        <span className="text-champagne">•</span>
                        <span>{result}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-1 text-sm text-ivory/60">
                    <p>No more guessing.</p>
                    <p>No more emotional clicking.</p>
                    <p className="text-champagne font-semibold">No more blowing accounts.</p>
                  </div>
                </div>
              </RevealContent>

              {/* Who This Is For */}
              <RevealContent delay={0.6}>
                <div className={cn(
                  "p-6 rounded-xl",
                  "bg-[rgba(10,10,11,0.5)] border border-white/10"
                )}>
                  <div className="space-y-6">
                    {/* For */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">🔒</span>
                        <h4 className="text-lg font-semibold text-ivory">Who This Is For</h4>
                      </div>
                      <ul className="space-y-2">
                        {forWho.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-ivory/70">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-1 shrink-0" />
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Not For */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">❌</span>
                        <h4 className="text-lg font-semibold text-ivory">Not For</h4>
                      </div>
                      <ul className="space-y-2">
                        {notFor.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-ivory/70">
                            <XCircle className="w-4 h-4 text-red-400 mt-1 shrink-0" />
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </RevealContent>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center space-y-6">
            {/* Limited Spots Message */}
            <RevealContent delay={0.7}>
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">⚡</span>
                  <h3 className="text-2xl font-semibold text-ivory">Limited Spots</h3>
                </div>
                <p className="text-ivory/70">This is one on one.</p>
                <p className="text-champagne font-semibold">Seats are extremely limited.</p>
                <p className="text-sm text-ivory/60 max-w-xl mx-auto mt-4">
                  If you are ready to operate at a higher level, apply now.
                </p>
              </div>
            </RevealContent>

            {/* CTA Button */}
            <RevealContent delay={0.8}>
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
                    Apply Now
                  </Button>
                </motion.div>
              </motion.div>
            </RevealContent>

            {/* Scarcity indicator */}
            <RevealContent delay={0.9}>
              <div className="flex items-center justify-center gap-2 text-sm text-red-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400"></span>
                </span>
                <span>Applications reviewed personally - Serious applicants only</span>
              </div>
            </RevealContent>
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
