"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Video, Calendar, MessageCircle, Target, TrendingUp, Shield } from "lucide-react";
import { RevealHeading, RevealContent, StaggerContainer, StaggerItem } from "@/components/ui/scroll-animations";
import { Analytics } from "@/lib/analytics";
import { LAUNCHPASS_URLS, withRewardfulReferral } from "@/lib/rewardful";
import { useRewardfulLink } from "@/lib/use-rewardful-link";

export function MentorshipSection() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const mentorshipCheckoutUrl = useRewardfulLink(LAUNCHPASS_URLS.mentorship);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleApplyClick = () => {
    Analytics.trackCTAClick('Mentorship Join Now');
    window.location.href = withRewardfulReferral(mentorshipCheckoutUrl);
  };

  return (
    <section id="mentorship" className="container mx-auto px-4 py-12 md:py-14">
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
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:gap-10 xl:gap-12">
            <div className="space-y-6 lg:sticky lg:top-24 self-start">
              <RevealContent>
                <div className="inline-flex items-center gap-2 rounded-full border border-champagne/30 bg-champagne/5 px-4 py-2">
                  <Video className="h-4 w-4 text-champagne" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-champagne">
                    Private 1-on-1 Coaching
                  </span>
                </div>
              </RevealContent>

              <RevealHeading>
                <h2 className="text-3xl font-serif font-semibold leading-tight md:text-4xl xl:text-[3.25rem]">
                  <span className="text-ivory">TradeITM</span>{" "}
                  <span className="text-gradient-champagne">Precision Mentorship</span>
                </h2>
              </RevealHeading>

              <RevealContent delay={0.1}>
                <p className="max-w-xl text-base leading-relaxed text-ivory/70 md:text-lg">
                  8 weeks of direct, personal coaching focused on process, risk management, and execution.
                </p>
              </RevealContent>

              <RevealContent delay={0.2}>
                <div className="rounded-2xl border border-champagne/20 bg-[rgba(10,10,11,0.58)] p-6 md:p-7">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.26em] text-emerald-300/80">
                        <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                        8-Week Program
                      </div>

                      <div className="flex items-baseline gap-3">
                        <span className="text-5xl font-serif font-bold text-champagne md:text-6xl">
                          $2,500
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 text-sm text-ivory/60 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                        <span>Direct coaching with TradeITM</span>
                        <span className="hidden sm:inline text-ivory/25">•</span>
                        <span className="text-emerald-400/80">~$312/week</span>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed text-ivory/60">
                      Built for <span className="text-ivory">serious traders</span> who are already trading live,
                      willing to be coached, and ready to commit to structured improvement.
                    </p>

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
                          className="min-w-[220px] rounded-sm"
                        >
                          Join Now
                        </Button>
                      </motion.div>
                    </motion.div>

                    <p className="border-t border-white/[0.06] pt-5 text-xs leading-relaxed text-ivory/45">
                      Includes structured trade reviews, position sizing guidance, and direct feedback between calls.
                    </p>
                  </div>
                </div>
              </RevealContent>
            </div>

            <div className="space-y-6">
              <RevealContent delay={0.25}>
                <div className="relative rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-[rgba(10,10,11,0.6)] to-emerald-950/30 p-6 md:p-8">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />

                  <div className="relative space-y-6">
                    <div className="space-y-3 text-center lg:text-left">
                      <div className="inline-flex items-center gap-2 text-emerald-400">
                        <TrendingUp className="h-5 w-5" />
                        <span className="text-sm font-semibold uppercase tracking-wider">What You&apos;ll Work On</span>
                      </div>

                      <h3 className="text-2xl font-serif font-semibold text-ivory md:text-3xl">
                        Over 8 Weeks, You&apos;ll Build:
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                      {[
                        { text: "What to trade", icon: "🎯" },
                        { text: "When to trade", icon: "⏰" },
                        { text: "When NOT to trade", icon: "🛑" },
                        { text: "How to manage", icon: "📊" },
                        { text: "How to stay disciplined", icon: "🧠" },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="flex min-h-[110px] flex-col justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
                        >
                          <span className="text-2xl">{item.icon}</span>
                          <span className="text-sm font-medium text-ivory/80">{item.text}</span>
                        </div>
                      ))}
                    </div>

                    <p className="text-lg font-semibold text-champagne">
                      Build the discipline, process, and confidence to trade on your own terms.
                    </p>
                  </div>
                </div>
              </RevealContent>

              <div className="grid gap-6 lg:grid-cols-2">
                <RevealContent delay={0.3}>
                  <div className="h-full rounded-xl border border-red-500/20 bg-[rgba(10,10,11,0.5)] p-6">
                    <div className="mb-5 flex items-center gap-2">
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
                          <span className="mt-0.5 text-red-400/80">✗</span>
                          <span>{problem}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-5 border-t border-white/[0.06] pt-4 text-sm italic text-ivory/50">
                      If you nodded at any of these, this mentorship was built for you.
                    </p>
                  </div>
                </RevealContent>

                <RevealContent delay={0.4}>
                  <div className="h-full rounded-xl border border-champagne/20 bg-[rgba(10,10,11,0.5)] p-6">
                    <div className="mb-5 flex items-center gap-2">
                      <span className="text-xl">📦</span>
                      <h3 className="text-lg font-semibold text-ivory">What&apos;s Included</h3>
                    </div>

                    <div className="space-y-4">
                      {[
                        { icon: Calendar, text: "Weekly private 1-on-1 video calls", highlight: true },
                        { icon: Target, text: "Entry, exit, and risk management frameworks" },
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
                          <item.icon
                            className={cn(
                              "h-5 w-5 shrink-0",
                              item.highlight ? "text-champagne" : "text-emerald-400/80"
                            )}
                          />
                          <span className={item.highlight ? "font-medium" : "text-ivory/70"}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 border-t border-white/[0.06] pt-4">
                      <p className="text-xs text-ivory/50">
                        Plus: Journaling system, psychology coaching, and contract selection guidance designed to reinforce a disciplined process.
                      </p>
                    </div>
                  </div>
                </RevealContent>
              </div>
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
