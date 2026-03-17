"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, TrendingUp, Users, BookOpen, Target, Zap, Shield, BarChart3 } from "lucide-react";
import { GradientMeshBackground } from "@/components/ui/gradient-mesh-background";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { BentoCard } from "@/components/ui/bento-card";
import { PricingCard } from "@/components/ui/pricing-card";
import { RevealHeading, RevealContent, StaggerContainer, StaggerItem } from "@/components/ui/scroll-animations";
import { RibbonDivider } from "@/components/ui/ribbon-divider";
import { DiscordMock } from "@/components/ui/discord-mock";
import { Analytics } from "@/lib/analytics";
import { LAUNCHPASS_URLS } from "@/lib/rewardful";
import { getPricingTiers, PricingTier } from "@/lib/supabase";
import { BRAND_LOGO_SRC, BRAND_NAME } from "@/lib/brand";
import { useRewardfulLink } from "@/lib/use-rewardful-link";
import { cn } from "@/lib/utils";

const FloatingNavbar = dynamic(
  () => import("@/components/ui/floating-navbar").then((mod) => mod.FloatingNavbar),
  { ssr: false },
);
const PromoBanner = dynamic(
  () => import("@/components/ui/promo-banner").then((mod) => mod.PromoBanner),
  { ssr: false },
);
const MobileStickyCtA = dynamic(
  () => import("@/components/ui/mobile-sticky-cta").then((mod) => mod.MobileStickyCtA),
  { ssr: false },
);
const CohortSection = dynamic(
  () => import("@/components/ui/cohort-section").then((mod) => mod.CohortSection),
  { ssr: false },
);
const MentorshipSection = dynamic(
  () => import("@/components/ui/mentorship-section").then((mod) => mod.MentorshipSection),
  { ssr: false },
);
const SubscribeModal = dynamic(
  () => import("@/components/ui/subscribe-modal").then((mod) => mod.SubscribeModal),
  { ssr: false },
);
const ContactModal = dynamic(
  () => import("@/components/ui/contact-modal").then((mod) => mod.ContactModal),
  { ssr: false },
);
const ChatWidget = dynamic(
  () => import("@/components/ui/chat-widget").then((mod) => mod.ChatWidget),
  { ssr: false },
);
const SparkleLog = dynamic(() => import("@/components/ui/sparkle-logo"), {
  ssr: false,
});
const CandlestickChart = dynamic(
  () => import("@/components/ui/mini-chart").then((mod) => mod.CandlestickChart),
  { ssr: false },
);

export default function Home() {
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [cohortModalMessage, setCohortModalMessage] = useState<string | undefined>(undefined);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const trialSignupUrl = useRewardfulLink(LAUNCHPASS_URLS.trial);

  // Legacy handler for contact modal with preset message (kept for fallback)
  const handleCohortContactFallback = () => {
    setCohortModalMessage("I'm interested in the Precision Cohort 90 day mentorship program. Here's my trading background:");
    setIsContactModalOpen(true);
  };

  // Fetch pricing tiers from database
  useEffect(() => {
    getPricingTiers()
      .then(setPricingTiers)
      .catch((error) => {
        console.error('Failed to load pricing tiers:', error);
        // Fallback is handled in the render - uses hardcoded values if empty
      });
  }, []);

  // Auto-popup subscribe modal after 5 seconds (once per session)
  useEffect(() => {
    const hasSeenModal = sessionStorage.getItem('titm_modal_seen');

    if (!hasSeenModal) {
      const timer = setTimeout(() => {
        setIsSubscribeModalOpen(true);
        sessionStorage.setItem('titm_modal_seen', 'true');
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <main className="min-h-screen relative">
      {/* Animated Gradient Mesh Background */}
      <GradientMeshBackground />

      {/* Floating Island Navbar */}
      <FloatingNavbar />

      {/* Promo Banner - Fixed below navbar */}
      <PromoBanner />

      {/* Subscribe Modal */}
      <SubscribeModal
        isOpen={isSubscribeModalOpen}
        onClose={() => setIsSubscribeModalOpen(false)}
      />

      {/* Contact Modal */}
      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => {
          setIsContactModalOpen(false);
          setCohortModalMessage(undefined);
        }}
        presetMessage={cohortModalMessage}
      />

      {/* Mobile Sticky CTA - appears after scrolling past hero */}
      <MobileStickyCtA />

      {/* Hero Section - Cinematic Brand Reveal */}
      <section className="relative flex min-h-[92svh] items-center justify-center overflow-hidden px-4 pb-16 pt-24 md:pb-20 lg:min-h-[96vh]">
        {/* Aurora Liquid Light Background */}
        <AuroraBackground />

        {/* Main Content - Logo Centered */}
        <div className="container relative z-20 mx-auto">
          <div className="flex flex-col items-center justify-center space-y-8 text-center md:space-y-10">
            {/* Logo with Sparkle Effects */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <SparkleLog
                src={BRAND_LOGO_SRC}
                alt={BRAND_NAME}
                width={600}
                height={200}
                sparkleCount={20}
                enableFloat={true}
                enableGlow={true}
                glowIntensity="high"
                className="w-[80vw] md:w-[600px]"
                priority
              />
            </motion.div>

            {/* Powerful Value Proposition */}
            <motion.div
              className="max-w-4xl space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
            >
              {/* Main Headline */}
              <h1 className="text-[clamp(2rem,5vw,4.35rem)] font-bold leading-[1.08] text-ivory">
                <span className="text-gradient-champagne">High Quality Setups</span>{" "}
                <span className="text-ivory/90">- Entries, Stop Loss, and Take Profits -</span>{" "}
                <span className="text-gradient-champagne">Every Day</span>
              </h1>

              {/* Supporting Copy */}
              <p className="mx-auto max-w-2xl text-sm leading-relaxed text-platinum/70 sm:text-base md:text-lg">
                Options trading education with real-time setups, entries, stop losses, and take profit levels.
                <span className="text-champagne/80"> Learn to trade with precision.</span>
              </p>
            </motion.div>

            {/* CTA Button - Centered */}
            <motion.div
              className="flex flex-col items-center gap-3 pt-2 md:pt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 20px rgba(16, 185, 129, 0.3)",
                    "0 0 50px rgba(16, 185, 129, 0.5)",
                    "0 0 20px rgba(16, 185, 129, 0.3)",
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
                  asChild
                  size="xl"
                  variant="luxury-champagne"
                  className="min-w-[220px] rounded-sm font-medium tracking-widest text-sm"
                >
                  <a href="#pricing" onClick={() => Analytics.trackCTAClick('Hero Join Now')}>JOIN NOW</a>
                </Button>
              </motion.div>

              {/* Member Login Link - Hidden for now
              <Link
                href="/login"
                className="mt-4 text-xs text-white/30 hover:text-white transition-colors cursor-pointer"
                onClick={() => Analytics.trackCTAClick('Hero Member Login')}
              >
                Already inside? Enter Terminal
              </Link>
              */}
            </motion.div>
          </div>
        </div>

        {/* Subtle Scroll Indicator */}
        <motion.div
          className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 md:bottom-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
        >
          <motion.div
            className="w-[1px] h-20 bg-gradient-to-b from-transparent via-champagne/20 to-transparent"
            animate={{ scaleY: [1, 1.3, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </section>

      {/* Ribbon Divider */}
      <RibbonDivider />

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-10 md:py-12">
        <StaggerContainer className="mx-auto grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4 md:gap-6" staggerDelay={0.1}>
          {[
            { label: "Trade Alerts", value: "Real-Time", support: "Delivered live in Discord", icon: "⚡" },
            { label: "Market Focus", value: "SPX + NDX", support: "Index-first execution", icon: "📈" },
            { label: "Daily Prep", value: "Every AM", support: "Watchlist and key levels", icon: "🎯" },
            { label: "Trading Experience", value: "8+ Years", support: "Process over hype", icon: "🏆" },
          ].map((stat, idx) => (
            <StaggerItem key={idx}>
              <Card className="bg-card/50 backdrop-blur border-border/40 h-full hover:border-primary/30 transition-colors duration-300">
                <CardContent className="flex h-full flex-col justify-between p-5 text-center md:p-6">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-primary/55">
                    {stat.icon} {stat.label}
                  </div>
                  <div className="mb-2 text-[1.9rem] font-semibold tracking-tight text-primary md:text-[2.35rem]">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground/90">{stat.support}</div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* Features Section - Bento Grid */}
      <section id="features" className="container mx-auto px-4 py-14 md:py-16">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="mb-12 space-y-4 text-center md:mb-14">
            <RevealHeading>
              <h2 className="text-3xl font-bold md:text-4xl xl:text-5xl">
                Everything You Need To{" "}
                <span className="text-gradient-champagne">Succeed</span>
              </h2>
            </RevealHeading>
            <RevealContent delay={0.2}>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground text-pretty md:text-xl">
                Comprehensive tools and resources designed to transform your trading journey
              </p>
            </RevealContent>
          </div>

          {/* Bento Grid Layout - Clean 2x3 grid */}
          <StaggerContainer className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-3" staggerDelay={0.1}>
            {/* Row 1 */}
            {/* Real-Time Trade Alerts with Live Candlestick */}
            <StaggerItem>
              <BentoCard
                icon={TrendingUp}
                title="Real-Time Trade Alerts"
                description="Get instant trade alerts with structured entry, exit, and stop-loss levels for educational use."
                spotlight="emerald"
                graphic={<CandlestickChart className="absolute inset-0" />}
              />
            </StaggerItem>

            <StaggerItem>
              <BentoCard
                icon={Target}
                title="Proven Strategies"
                description="Detailed market analysis with charts, indicators, and actionable trade setups updated daily."
                spotlight="emerald"
                graphic={<CandlestickChart className="absolute inset-0" />}
              />
            </StaggerItem>

            {/* Active Community with Discord Mock */}
            <StaggerItem>
              <BentoCard
                icon={Users}
                title="Active Community"
                description="Join a serious Discord community focused on setups, trade rationale, and disciplined execution."
                spotlight="emerald"
                graphic={<DiscordMock />}
                graphicClassName="!bg-transparent !border-0"
              />
            </StaggerItem>

            {/* Row 2 */}
            {/* Educational Content */}
            <StaggerItem>
              <BentoCard
                icon={BookOpen}
                title="Educational Content"
                description="Access exclusive courses, webinars, and tutorials from beginner basics to advanced strategies."
                spotlight="gold"
                image="/icon-education.png"
              />
            </StaggerItem>

            {/* Lightning Fast */}
            <StaggerItem>
              <BentoCard
                icon={Zap}
                title="Lightning Fast"
                description="Receive trade alerts instantly via Discord notifications so you can stay aligned with market-moving setups."
                spotlight="emerald"
                image="/icon-lightning.png"
              />
            </StaggerItem>

            {/* Risk Management */}
            <StaggerItem>
              <BentoCard
                icon={Shield}
                title="Risk Management"
                description="Learn proper position sizing, portfolio management, and strategies to protect your capital."
                spotlight="gold"
                image="/icon-shield.png"
              />
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* Ribbon Divider */}
      <RibbonDivider flip />

      {/* Pricing Section - Membership Cards */}
      <section id="pricing" className="container mx-auto px-4 py-14 md:py-16">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="mb-12 space-y-4 text-center md:mb-14">
            <RevealHeading>
              <h2 className="text-3xl font-bold md:text-4xl xl:text-5xl">
                Choose Your{" "}
                <span className="text-gradient-champagne">Plan</span>
              </h2>
            </RevealHeading>
            <RevealContent delay={0.2}>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground text-pretty md:text-xl">
                Select the plan that fits your trading goals and budget
              </p>
            </RevealContent>
          </div>

          {/* Pricing Cards Grid - Core → Pro → Execute */}
          <StaggerContainer
            className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4 xl:gap-7"
            staggerDelay={0.15}
          >
            <StaggerItem>
              <PricingCard
                name="7-Day Trial"
                price="$49.99"
                period="/ 7 days"
                description="Core Sniper Access"
                features={[
                  "🎯 Full Core Sniper SPX Alerts",
                  "👀 Morning Watchlist Access",
                  "🧠 Educational Commentary",
                  "💬 Community Access",
                  "📊 Daily Performance Recaps",
                ]}
                whopLink={LAUNCHPASS_URLS.trial}
                tier="trial"
                tagline="Limited Time"
                isYearly={false}
              />
            </StaggerItem>

            {/* Core Sniper Card */}
            <StaggerItem>
              <PricingCard
                name={pricingTiers.find(t => t.id === 'core')?.name || "Core Sniper"}
                price={pricingTiers.find(t => t.id === 'core')?.monthly_price || "$199"}
                period="/month"
                description={pricingTiers.find(t => t.id === 'core')?.description || "For disciplined traders who want full market exposure"}
                features={pricingTiers.find(t => t.id === 'core')?.features || [
                  "👀 Morning Watchlist",
                  "🎯 SPX day trade setups",
                  "🔔 High-volume & momentum alerts",
                  "🧠 Educational commentary & trade rationale",
                ]}
                whopLink={LAUNCHPASS_URLS.core}
                tier="core"
                tagline={pricingTiers.find(t => t.id === 'core')?.tagline || "Execution focused education"}
                isYearly={false}
              />
            </StaggerItem>

            {/* Pro Sniper Card */}
            <StaggerItem>
              <PricingCard
                name={pricingTiers.find(t => t.id === 'pro')?.name || "Pro Sniper"}
                price={pricingTiers.find(t => t.id === 'pro')?.monthly_price || "$299"}
                period="/month"
                description={pricingTiers.find(t => t.id === 'pro')?.description || "For traders scaling beyond day trades"}
                features={pricingTiers.find(t => t.id === 'pro')?.features || [
                  "Everything in Core Sniper, plus:",
                  "🧭 LEAPS",
                  "📈 Advanced swing trade strategy",
                  "🧠 Position building logic",
                  "📊 Longer term market structure insight",
                  "🎯 Capital allocation education",
                ]}
                whopLink={LAUNCHPASS_URLS.pro}
                tier="pro"
                tagline={pricingTiers.find(t => t.id === 'pro')?.tagline || "More patience & strategy, not just speed"}
                isYearly={false}
              />
            </StaggerItem>

            {/* Executive Sniper Card */}
            <StaggerItem>
              <PricingCard
                name={pricingTiers.find(t => t.id === 'executive')?.name || "Executive Sniper"}
                price={pricingTiers.find(t => t.id === 'executive')?.monthly_price || "$499"}
                period="/month"
                description={pricingTiers.find(t => t.id === 'executive')?.description || "For serious traders only"}
                features={pricingTiers.find(t => t.id === 'executive')?.features || [
                  "Everything in Pro Sniper, plus:",
                  "🔥 Advanced NDX real time alerts (entries & exits)",
                  "🧭 High-conviction LEAPS framework",
                  "🎯 Higher-level trade commentary",
                  "🧠 Risk scaling & portfolio mindset",
                ]}
                whopLink={LAUNCHPASS_URLS.executive}
                tier="executive"
                tagline={pricingTiers.find(t => t.id === 'executive')?.tagline || "Maximum conviction, maximum execution"}
                isYearly={false}
              />
            </StaggerItem>
          </StaggerContainer>

          {/* Trust Badges & Guarantee */}
          <RevealContent delay={0.5}>
            <div className="mt-10 space-y-5 md:mt-12">
              {/* Main Guarantee */}
              <div className="text-center">
                <div className="inline-flex flex-col sm:flex-row items-center gap-4 px-6 py-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-sm">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                    <Shield className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="text-lg font-bold text-emerald-400">
                      Support-First Billing Policy*
                    </div>
                    <p className="text-sm text-muted-foreground">
                      If you have a billing error or account-access issue, our team reviews every case quickly and fairly under our Refund Policy.
                    </p>
                  </div>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center justify-center gap-6 text-muted-foreground/60">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-xs">SSL Secured</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span className="text-xs">Powered by Stripe</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-xs">Secure Checkout</span>
                </div>
              </div>
            </div>
          </RevealContent>
        </div>
      </section>

      {/* Precision Cohort Section - 90 Day Mentorship */}
      <CohortSection />

      {/* Ribbon Divider */}
      <RibbonDivider flip />

      {/* 1 on 1 Mentorship Section */}
      <MentorshipSection />

      {/* Ribbon Divider */}
      <RibbonDivider />

      {/* Post-Purchase Instructions Section */}
      <section className="container mx-auto px-4 py-12 md:py-14">
        <RevealContent>
          <div className="mx-auto max-w-6xl">
            <Card className="glass-card-heavy overflow-hidden border-primary/25">
              <CardContent className="p-0">
                <div className="grid lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
                  <div className="border-b border-border/40 p-8 md:p-10 lg:border-b-0 lg:border-r lg:p-12">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                      <BarChart3 className="h-7 w-7 text-primary" />
                    </div>
                    <div className="mt-6 space-y-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/70">
                        Onboarding Flow
                      </p>
                      <h2 className="text-3xl font-semibold md:text-4xl">
                        What Happens After Purchase?
                      </h2>
                      <p className="max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
                        Getting started is quick and deliberate. Here&apos;s the path from checkout to your first session inside.
                      </p>
                    </div>
                    <div className="mt-8 border-t border-border/40 pt-5">
                      <p className="text-sm text-muted-foreground">
                        Need help? <button onClick={() => setIsContactModalOpen(true)} className="text-primary hover:underline">Contact us</button>
                      </p>
                    </div>
                  </div>

                  <div className="p-8 md:p-10 lg:p-12">
                    <StaggerContainer className="grid gap-4 sm:grid-cols-2 md:gap-5" staggerDelay={0.1} initialDelay={0.2}>
                      {[
                        {
                          step: "1",
                          title: "Complete Your Purchase",
                          description: "Click any 'Get Started' button above to be redirected to our secure LaunchPass checkout page."
                        },
                        {
                          step: "2",
                          title: "Receive Instant Access",
                          description: "After payment, you'll immediately receive an email with your Discord invite link and login credentials."
                        },
                        {
                          step: "3",
                          title: "Join Our Discord Community",
                          description: "Click the invite link to join our exclusive Discord server. Your role will be automatically assigned based on your plan."
                        },
                        {
                          step: "4",
                          title: "Start Learning Inside",
                          description: "Explore the channels, introduce yourself, and start reviewing the day's setups and commentary."
                        }
                      ].map((step, idx) => (
                        <StaggerItem key={idx}>
                          <div className="h-full rounded-2xl border border-border/40 bg-background/20 p-5 md:p-6">
                            <div className="flex gap-4">
                              <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-wealth-emerald-dark flex items-center justify-center font-bold text-primary-foreground">
                                {step.step}
                              </div>
                              <div className="flex-1 pt-1">
                                <h4 className="mb-2 text-lg font-semibold">{step.title}</h4>
                                <p className="leading-relaxed text-muted-foreground">{step.description}</p>
                              </div>
                            </div>
                          </div>
                        </StaggerItem>
                      ))}
                    </StaggerContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </RevealContent>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-12 md:py-14">
        <RevealContent>
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border-champagne-glow glass-card-heavy p-8 md:p-10 lg:p-12">
            {/* Background gradient accent */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-champagne/5 pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl text-center lg:text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-champagne/70">
                  Ready When You Are
                </p>
                <h2 className="mt-3 text-3xl font-bold md:text-4xl xl:text-5xl">
                  Start Trading{" "}
                  <span className="text-gradient-champagne">With an Edge</span>
                </h2>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty md:text-xl lg:mx-0">
                  Get daily trade setups, educational commentary, and a community of serious traders.
                  Learn the strategies that matter.
                </p>
              </div>

              <div className="flex flex-col items-center gap-4 lg:items-end">
                <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
                  <Button
                    asChild
                    size="xl"
                    variant="luxury-champagne"
                    className="min-w-[220px] rounded-sm"
                  >
                    <a href="#pricing">Choose Your Plan →</a>
                  </Button>

                  <a
                    href={trialSignupUrl}
                    className={cn(
                      "inline-flex min-w-[220px] items-center justify-center",
                      "rounded-sm border border-trial-blue px-8 py-4 text-sm font-semibold tracking-wider uppercase",
                      "bg-transparent text-trial-blue-light",
                      "transition-all duration-300 hover:bg-trial-blue/10 hover:shadow-[0_0_24px_rgba(59,130,246,0.2)]"
                    )}
                    onClick={() => Analytics.trackCTAClick("Final CTA Trial Button")}
                  >
                    Try 7 Days for $49.99 →
                  </a>
                </div>

                <p className="max-w-md text-center text-xs text-muted-foreground/60 lg:text-right">
                  All sales are final per our{" "}
                  <Link href="/refund-policy" className="underline hover:text-champagne/60">
                    Refund Policy
                  </Link>.
                  {" "}Trading involves substantial risk of loss. Content is for educational purposes only.
                </p>
              </div>
            </div>
          </div>
        </RevealContent>
      </section>

      {/* Footer */}
      <footer className="border-t border-champagne/10 bg-[rgba(10,10,11,0.9)] backdrop-blur-xl">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              {/* Typographic Logo in Footer */}
              <div className="flex items-center gap-1">
                <span className="font-serif text-xl tracking-tight font-semibold text-ivory">
                  Trade
                </span>
                <span className="font-serif text-xl tracking-tight font-semibold text-champagne">
                  ITM
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-wealth-emerald ml-0.5 mb-2" />
              </div>
              <div className="ml-2">
                <div className="text-xs text-muted-foreground">© 2026 All rights reserved</div>
              </div>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="/privacy-policy" className="hover:text-champagne transition-colors duration-300">Privacy Policy</a>
              <a href="/terms-of-service" className="hover:text-champagne transition-colors duration-300">Terms of Service</a>
              <a href="/refund-policy" className="hover:text-champagne transition-colors duration-300">Refund Policy</a>
              <button onClick={() => setIsContactModalOpen(true)} className="hover:text-champagne transition-colors duration-300">Contact</button>
            </div>
          </div>
          <div className="mt-6 text-center text-xs text-muted-foreground space-y-1 max-w-3xl mx-auto">
            <p>
              Trading options and other financial instruments involves substantial risk of loss and is not suitable for all investors.
              You could lose some or all of your invested capital. Past performance does not guarantee future results.
            </p>
            <p>
              Trade In The Money provides educational content only and is not a registered investment advisor.
              Nothing on this site constitutes personalized investment advice. Consult a licensed financial advisor before making investment decisions.
            </p>
          </div>
        </div>
      </footer>

      {/* AI Chat Widget */}
      <ChatWidget />
    </main>
  );
}
