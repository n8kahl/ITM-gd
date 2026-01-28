"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, TrendingUp, Users, BookOpen, Target, Zap, Shield, BarChart3 } from "lucide-react";
import { GradientMeshBackground } from "@/components/ui/gradient-mesh-background";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { BentoCard } from "@/components/ui/bento-card";
import { PricingCard } from "@/components/ui/pricing-card";
import { FloatingNavbar } from "@/components/ui/floating-navbar";
import { RevealHeading, RevealContent, StaggerContainer, StaggerItem } from "@/components/ui/scroll-animations";
import { TestimonialMarquee } from "@/components/ui/testimonial-marquee";
import { RibbonDivider } from "@/components/ui/ribbon-divider";
import { CandlestickChart, WinRateChart, SignalPulse } from "@/components/ui/mini-chart";
import { DiscordMock } from "@/components/ui/discord-mock";
import { HeroWinsBadge, LiveWinsTicker } from "@/components/ui/live-wins-ticker";
import { MobileStickyCtA } from "@/components/ui/mobile-sticky-cta";

export default function Home() {
  return (
    <main className="min-h-screen relative">
      {/* Animated Gradient Mesh Background */}
      <GradientMeshBackground />

      {/* Floating Island Navbar */}
      <FloatingNavbar />

      {/* Mobile Sticky CTA - appears after scrolling past hero */}
      <MobileStickyCtA />

      {/* Hero Section - Cinematic Brand Reveal */}
      <section className="relative min-h-[100vh] flex items-center justify-center px-4 pt-24 pb-20 overflow-hidden">
        {/* Aurora Liquid Light Background */}
        <AuroraBackground />

        {/* Main Content - Logo Centered */}
        <div className="container mx-auto relative z-20">
          <div className="flex flex-col items-center justify-center text-center space-y-10">
            {/* Logo with Backlight Effect */}
            <div className="relative">
              {/* Pulsing Backlight Glow */}
              <motion.div
                className="absolute inset-0 -inset-x-20 -inset-y-10"
                style={{
                  background: "radial-gradient(ellipse at center, rgba(4, 120, 87, 0.4) 0%, rgba(212, 175, 55, 0.2) 40%, transparent 70%)",
                  filter: "blur(60px)",
                }}
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.6, 0.9, 0.6],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Floating Logo */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.2, ease: [0.25, 0.4, 0.25, 1] }}
              >
                <motion.div
                  animate={{
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Image
                    src="/hero-logo.png"
                    alt="TradeITM"
                    width={600}
                    height={200}
                    sizes="(max-width: 768px) 80vw, 600px"
                    className="w-[80vw] md:w-[600px] h-auto object-contain drop-shadow-[0_0_40px_rgba(4,120,87,0.3)]"
                    priority
                  />
                </motion.div>
              </motion.div>
            </div>

            {/* Powerful Value Proposition */}
            <motion.div
              className="space-y-4 max-w-3xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
            >
              {/* Main Headline */}
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-ivory leading-tight">
                <span className="text-gradient-champagne">3 Guaranteed 100%+ Trades</span>{" "}
                <span className="text-ivory/90">Every Week</span>
              </h1>

              {/* Supporting Copy */}
              <p className="text-sm sm:text-base md:text-lg text-platinum/70 max-w-xl mx-auto leading-relaxed">
                Elite traders share their exact entries, exits & stop losses in real-time.
                <span className="text-champagne/80"> No fluff. Just profits.</span>
              </p>
            </motion.div>

            {/* Live Wins Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <HeroWinsBadge />
            </motion.div>

            {/* CTA Button - Centered */}
            <motion.div
              className="pt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 20px rgba(212, 175, 55, 0.3)",
                    "0 0 50px rgba(212, 175, 55, 0.5)",
                    "0 0 20px rgba(212, 175, 55, 0.3)",
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
                  <a href="#pricing">JOIN NOW</a>
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Subtle Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
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
      <section className="container mx-auto px-4 py-12">
        <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto" staggerDelay={0.1}>
          {[
            { label: "Win Rate", value: "87%", icon: "📈" },
            { label: "Avg. Weekly Gain", value: "127%", icon: "💰" },
            { label: "Signals Daily", value: "15+", icon: "⚡" },
            { label: "Years Experience", value: "8+", icon: "🏆" },
          ].map((stat, idx) => (
            <StaggerItem key={idx}>
              <Card className="bg-card/50 backdrop-blur border-border/40 h-full hover:border-primary/30 transition-colors duration-300">
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl md:text-4xl stat-value text-primary mb-2">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* Features Section - Bento Grid */}
      <section id="features" className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 space-y-4">
            <RevealHeading>
              <h2 className="text-3xl md:text-5xl font-bold">
                Everything You Need To{" "}
                <span className="text-gradient-champagne">Succeed</span>
              </h2>
            </RevealHeading>
            <RevealContent delay={0.2}>
              <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
                Comprehensive tools and resources designed to transform your trading journey
              </p>
            </RevealContent>
          </div>

          {/* Bento Grid Layout - Clean 2x3 grid */}
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8" staggerDelay={0.1}>
            {/* Row 1 */}
            {/* Real-Time Signals with Live Candlestick */}
            <StaggerItem>
              <BentoCard
                icon={TrendingUp}
                title="Real-Time Signals"
                description="Get instant trade alerts with detailed entry, exit, and stop-loss levels backed by proven strategies."
                spotlight="emerald"
                graphic={<CandlestickChart className="absolute inset-0" />}
              />
            </StaggerItem>

            {/* 87% Success Rate with Win Rate Chart */}
            <StaggerItem>
              <BentoCard
                icon={Target}
                title="87% Success Rate"
                description="Detailed market analysis with charts, indicators, and actionable trade setups updated daily."
                spotlight="emerald"
                graphic={<WinRateChart className="absolute inset-0" percentage={87} />}
              />
            </StaggerItem>

            {/* Active Community with Discord Mock */}
            <StaggerItem>
              <BentoCard
                icon={Users}
                title="Active Community"
                description="Join thousands of traders sharing real-time wins in our exclusive Discord server."
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
                description="Receive signals instantly via Discord notifications so you never miss a profitable opportunity."
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
      <section id="pricing" className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 space-y-4">
            <RevealHeading>
              <h2 className="text-3xl md:text-5xl font-bold">
                Choose Your{" "}
                <span className="text-gradient-champagne">Membership</span>
              </h2>
            </RevealHeading>
            <RevealContent delay={0.2}>
              <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
                Select the plan that fits your trading goals and budget
              </p>
            </RevealContent>
          </div>

          {/* Pricing Cards Grid - Ordered by price: Starter → Pro → Elite */}
          <StaggerContainer className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch" staggerDelay={0.15}>
            {/* Starter Card - $49/mo */}
            <StaggerItem>
              <PricingCard
                name="Starter"
                price="$49"
                period="/month"
                description="Perfect for beginners looking to get started"
                features={[
                  "5 Daily Signals",
                  "Basic Market Analysis",
                  "Community Access",
                  "Email Support",
                  "Educational Resources",
                ]}
                whopLink="https://whop.com/checkout/plan_starter"
                tier="starter"
              />
            </StaggerItem>

            {/* Pro Card - $99/mo */}
            <StaggerItem>
              <PricingCard
                name="Pro"
                price="$99"
                period="/month"
                description="Most popular choice for serious traders"
                features={[
                  "15+ Daily Signals",
                  "Advanced Technical Analysis",
                  "Priority Discord Access",
                  "Live Trading Sessions",
                  "1-on-1 Mentorship (Monthly)",
                  "Risk Management Tools",
                  "24/7 Priority Support",
                ]}
                whopLink="https://whop.com/checkout/plan_pro"
                tier="pro"
              />
            </StaggerItem>

            {/* Elite Card - $200/mo - The Premium Option */}
            <StaggerItem>
              <PricingCard
                name="Elite"
                price="$200"
                period="/month"
                description="For traders who want guaranteed results"
                features={[
                  "3+ Guaranteed 100%+ Trades/Week",
                  "Personal Trading Coach",
                  "Exclusive Private Channel",
                  "Weekly Strategy Calls",
                  "Exact Entry, Exit & Stop Loss",
                  "Real-Time Mobile Alerts",
                  "White Glove Support",
                  "30-Day Money-Back Guarantee",
                ]}
                whopLink="https://whop.com/trade-in-the-money/itm-elite-access/"
                tier="elite"
                spotsLeft={7}
              />
            </StaggerItem>
          </StaggerContainer>

          {/* Trust Signals & Guarantee */}
          <RevealContent delay={0.5}>
            <div className="mt-12 space-y-6">
              {/* Main Guarantee */}
              <div className="text-center">
                <div className="inline-flex flex-col sm:flex-row items-center gap-4 px-6 py-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-sm">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                    <Shield className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="text-lg font-bold text-emerald-400">
                      100% Money-Back Guarantee
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Follow our signals, and we guarantee a profit within 30 days or your money back!
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
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-xs">Cancel Anytime</span>
                </div>
              </div>
            </div>
          </RevealContent>
        </div>
      </section>

      {/* Testimonials Section - Infinite Marquee */}
      <section id="testimonials" className="py-14 overflow-hidden">
        <div className="container mx-auto px-4 mb-12">
          <div className="text-center space-y-4">
            <RevealHeading>
              <h2 className="text-3xl md:text-5xl font-bold">
                Trusted By Traders{" "}
                <span className="text-gradient-champagne">Worldwide</span>
              </h2>
            </RevealHeading>
            <RevealContent delay={0.2}>
              <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
                See what our community members have to say about their success
              </p>
            </RevealContent>
          </div>
        </div>

        {/* Marquee Row 1 - Left to Right */}
        <TestimonialMarquee
          testimonials={[
            {
              name: "Michael C.",
              role: "Elite Member",
              content: "Turned $2,500 into $11,200 in my first month. The NVDA call alone was +203%. TITM signals are the real deal.",
              avatar: "MC"
            },
            {
              name: "Sarah R.",
              role: "Elite Member",
              content: "Made back my entire membership cost in 2 days. Last week's TSLA play hit +156%. These guys know what they're doing.",
              avatar: "SR"
            },
            {
              name: "David P.",
              role: "Elite Member",
              content: "$8,400 profit this month following the signals. My account has grown 180% in 6 months. Best investment I've ever made.",
              avatar: "DP"
            },
            {
              name: "Emily W.",
              role: "Elite Member",
              content: "Went from -$4k to +$12k in 3 months. The risk management education saved me from blowing up my account.",
              avatar: "EW"
            },
            {
              name: "James M.",
              role: "Elite Member",
              content: "3 trades, $5,700 profit last week alone. The AMD call was +167%. This community delivers every single week.",
              avatar: "JM"
            },
          ]}
          direction="left"
          speed={25}
          className="mb-6"
        />

        {/* Marquee Row 2 - Right to Left */}
        <TestimonialMarquee
          testimonials={[
            {
              name: "Alex T.",
              role: "Part-time Trader",
              content: "Work full-time but still caught +$3,200 last month just from mobile alerts. These signals fit around any schedule.",
              avatar: "AT"
            },
            {
              name: "Lisa K.",
              role: "Elite Member",
              content: "$15k account to $41k in 4 months. The 1-on-1 mentorship sessions are invaluable. Worth every penny.",
              avatar: "LK"
            },
            {
              name: "Robert G.",
              role: "Elite Member",
              content: "Tried 5 other communities before TITM. None compare. +$22,000 in my first quarter. The speed of signals is unmatched.",
              avatar: "RG"
            },
            {
              name: "Jennifer L.",
              role: "Elite Member",
              content: "Membership paid for itself in the first week with one trade. +142% on SPY calls. Now I'm up $7,800 total.",
              avatar: "JL"
            },
            {
              name: "Marcus B.",
              role: "Elite Member",
              content: "Watch trades live, learn the strategy, bank profits. Simple. $4,200 last week following along. Life-changing.",
              avatar: "MB"
            },
          ]}
          direction="right"
          speed={30}
        />
      </section>

      {/* Ribbon Divider */}
      <RibbonDivider />

      {/* Post-Purchase Instructions Section */}
      <section className="container mx-auto px-4 py-14">
        <RevealContent>
          <div className="max-w-3xl mx-auto">
            <Card className="glass-card-heavy border-primary/30">
              <CardHeader className="text-center pb-8">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-3xl mb-3">What Happens After Purchase?</CardTitle>
                <CardDescription className="text-lg leading-relaxed">
                  Getting started is quick and easy. Here&apos;s what to expect:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <StaggerContainer className="space-y-6" staggerDelay={0.1} initialDelay={0.2}>
                  {[
                    {
                      step: "1",
                      title: "Complete Your Purchase",
                      description: "Click any 'Get Started' button above to be redirected to our secure Whop checkout page."
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
                      title: "Start Trading",
                      description: "Explore the channels, introduce yourself, and start receiving real-time trading signals immediately!"
                    }
                  ].map((step, idx) => (
                    <StaggerItem key={idx}>
                      <div className="flex gap-4">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-wealth-emerald-dark flex items-center justify-center font-bold text-primary-foreground shrink-0">
                          {step.step}
                        </div>
                        <div className="flex-1 pt-1">
                          <h4 className="font-semibold text-lg mb-1">{step.title}</h4>
                          <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
                <div className="pt-6 border-t border-border/40">
                  <p className="text-sm text-muted-foreground text-center">
                    Need help? Contact us at <a href="mailto:support@tradeinthemoney.com" className="text-primary hover:underline">support@tradeinthemoney.com</a>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </RevealContent>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-14">
        <RevealContent>
          <div className="max-w-4xl mx-auto text-center glass-card-heavy rounded-2xl border-champagne-glow p-12 md:p-16 space-y-6 relative overflow-hidden">
            {/* Background gradient accent */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-champagne/5 pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold">
                Stop Missing{" "}
                <span className="text-gradient-champagne">Winning Trades</span>
              </h2>
              <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto leading-relaxed mt-4">
                Every day you wait is another 100%+ trade you're missing. Get the exact entries elite traders use.
              </p>

              {/* Urgency Element */}
              <div className="flex items-center justify-center gap-2 mt-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400"></span>
                </span>
                <span className="text-sm text-red-400 font-medium">
                  Only 7 Elite spots remaining this month
                </span>
              </div>

              <Button
                asChild
                size="xl"
                variant="luxury-champagne"
                className="mt-6 rounded-sm min-w-[280px]"
              >
                <a href="#pricing">Claim Your Spot Now →</a>
              </Button>

              <p className="text-xs text-muted-foreground/60 mt-4">
                30-day money-back guarantee • Cancel anytime
              </p>
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
              <a href="mailto:support@tradeinthemoney.com" className="hover:text-champagne transition-colors duration-300">Contact</a>
            </div>
          </div>
          <div className="mt-6 text-center text-xs text-muted-foreground">
            <p>Trading involves risk. Past performance does not guarantee future results. Always trade responsibly.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
