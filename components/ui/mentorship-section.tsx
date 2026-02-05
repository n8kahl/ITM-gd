"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Video, CheckCircle2, Calendar, MessageCircle, Target, TrendingUp, Shield } from "lucide-react";
import { RevealHeading, RevealContent, StaggerContainer, StaggerItem } from "@/components/ui/scroll-animations";
import { Analytics } from "@/lib/analytics";

export function MentorshipSection() {
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
    Analytics.trackCTAClick('Mentorship Apply Now');
    window.location.href = 'https://whop.com/checkout/plan_W5Jebtb1V478b';
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
          {/* Header Section - Badge + Title Only */}
          <div className="text-center mb-12 space-y-6">
            <RevealContent>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-champagne/30 bg-champagne/5">
                <Video className="w-4 h-4 text-champagne" />
                <span className="text-xs font-semibold uppercase tracking-wider text-champagne">
                  Private 1-on-1 Coaching
                </span>
              </div>
            </RevealContent>

            <RevealHeading>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-semibold">
                <span className="text-ivory">TradeITM</span>{" "}
                <span className="text-gradient-champagne">Precision Mentorship</span>
              </h2>
            </RevealHeading>

            <RevealContent delay={0.1}>
              <p className="text-lg text-ivory/70 max-w-2xl mx-auto">
                8 weeks of direct, personal coaching to transform how you trade forever.
              </p>
            </RevealContent>
          </div>

          {/* HERO: The Transformation Promise */}
          <RevealContent delay={0.2}>
            <div className="relative mb-12 p-8 md:p-10 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-[rgba(10,10,11,0.6)] to-emerald-950/30 border border-emerald-500/30">
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />

              <div className="relative text-center space-y-6">
                <div className="inline-flex items-center gap-2 text-emerald-400 mb-2">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">The Transformation</span>
                </div>

                <h3 className="text-2xl md:text-3xl font-serif font-semibold text-ivory">
                  After 8 Weeks, You Will Know:
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-4xl mx-auto pt-4">
                  {[
                    { text: "What to trade", icon: "🎯" },
                    { text: "When to trade", icon: "⏰" },
                    { text: "When NOT to trade", icon: "🛑" },
                    { text: "How to manage", icon: "📊" },
                    { text: "How to stay disciplined", icon: "🧠" },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                    >
                      <span className="text-2xl">{item.icon}</span>
                      <span className="text-sm text-ivory/80 font-medium text-center">{item.text}</span>
                    </div>
                  ))}
                </div>

                <p className="text-champagne font-semibold text-lg pt-2">
                  No more guessing. No more emotional trading. No more blown accounts.
                </p>
              </div>
            </div>
          </RevealContent>

          {/* Two Column: Problems + What You Get */}
          <div className="grid lg:grid-cols-2 gap-6 mb-12">
            {/* Sound Familiar? */}
            <RevealContent delay={0.3}>
              <div className="h-full p-6 rounded-xl bg-[rgba(10,10,11,0.5)] border border-red-500/20">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-xl">🚨</span>
                  <h3 className="text-lg font-semibold text-ivory">Sound Familiar?</h3>
                </div>
                <ul className="space-y-3">
                  {[
                    "You enter too early or too late",
                    "You cut winners short, let losers run",
                    "You overtrade and revenge trade",
                    "You struggle with consistency",
                    "You don't trust your own execution",
                  ].map((problem, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-ivory/70">
                      <span className="text-red-400/80 mt-0.5">✗</span>
                      <span>{problem}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-sm text-ivory/50 italic border-t border-white/[0.06] pt-4">
                  If you nodded at any of these, this mentorship was built for you.
                </p>
              </div>
            </RevealContent>

            {/* What's Included */}
            <RevealContent delay={0.4}>
              <div className="h-full p-6 rounded-xl bg-[rgba(10,10,11,0.5)] border border-champagne/20">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-xl">📦</span>
                  <h3 className="text-lg font-semibold text-ivory">What's Included</h3>
                </div>

                <div className="space-y-4">
                  {[
                    { icon: Calendar, text: "Weekly private 1-on-1 video calls", highlight: true },
                    { icon: Target, text: "Personalized entry, exit & risk rules" },
                    { icon: MessageCircle, text: "Direct Discord access to me" },
                    { icon: TrendingUp, text: "Live chart breakdowns & trade reviews" },
                    { icon: Shield, text: "Position sizing & risk framework" },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center gap-3",
                        item.highlight && "text-champagne"
                      )}
                    >
                      <item.icon className={cn(
                        "w-5 h-5 shrink-0",
                        item.highlight ? "text-champagne" : "text-emerald-400/80"
                      )} />
                      <span className={item.highlight ? "font-medium" : "text-ivory/70"}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 pt-4 border-t border-white/[0.06]">
                  <p className="text-xs text-ivory/50">
                    Plus: Journaling system, psychology coaching, contract selection guidance — all tailored to your account size and goals.
                  </p>
                </div>
              </div>
            </RevealContent>
          </div>

          {/* Price + CTA Section */}
          <RevealContent delay={0.5}>
            <div className="text-center space-y-8 pt-4">
              {/* Price Display */}
              <div className="space-y-3">
                <div className="flex items-baseline justify-center gap-3">
                  <span className="text-5xl md:text-6xl font-serif font-bold text-champagne">
                    $2,500
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm text-ivory/60">
                  <span>8-Week Program</span>
                  <span className="hidden sm:inline text-ivory/30">•</span>
                  <span className="text-emerald-400/80">~$312/week of direct coaching</span>
                </div>
              </div>

              {/* Qualifier */}
              <div className="max-w-xl mx-auto">
                <p className="text-ivory/60 text-sm leading-relaxed">
                  This is for <span className="text-ivory">serious traders</span> who are already trading live,
                  willing to be coached, and ready to commit to real transformation.
                </p>
              </div>

              {/* CTA Button */}
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
                    className="rounded-sm min-w-[220px]"
                  >
                    Apply Now
                  </Button>
                </motion.div>
              </motion.div>

              {/* Scarcity */}
              <div className="flex items-center justify-center gap-2 text-sm text-red-400/90">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400"></span>
                </span>
                <span>Limited spots — applications reviewed personally</span>
              </div>
            </div>
          </RevealContent>
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
