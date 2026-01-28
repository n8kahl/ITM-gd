"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, TrendingUp, Users, BookOpen, Target, Zap, Shield, BarChart3, ArrowRight } from "lucide-react";
import { GradientMeshBackground } from "@/components/ui/gradient-mesh-background";
import { HeroBackground } from "@/components/hero-background";
import { BentoCard } from "@/components/ui/bento-card";
import { PricingCard } from "@/components/ui/pricing-card";
import { FloatingNavbar } from "@/components/ui/floating-navbar";
import { RevealHeading, RevealContent, StaggerContainer, StaggerItem } from "@/components/ui/scroll-animations";
import { TestimonialMarquee } from "@/components/ui/testimonial-marquee";
import { RibbonDivider } from "@/components/ui/ribbon-divider";
import { TickerTape } from "@/components/ui/ticker-tape";
import { LiveActivityFeed } from "@/components/ui/live-activity-feed";

export default function Home() {
  return (
    <main className="min-h-screen relative">
      {/* Animated Gradient Mesh Background */}
      <GradientMeshBackground />

      {/* Floating Island Navbar */}
      <FloatingNavbar />

      {/* Ticker Tape - HFT Data Feed */}
      <div className="fixed top-16 left-0 right-0 z-40">
        <TickerTape />
      </div>

      {/* Hero Section - High-Frequency Trading Style */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-4 py-20 md:py-32 overflow-hidden">
        {/* 3D Particle Wave Background */}
        <HeroBackground />

        <div className="container mx-auto relative z-10">
          {/* Floating Glass Card Container */}
          <div className="max-w-5xl mx-auto">
            <div className="glass-card-heavy p-8 md:p-12 lg:p-16 rounded-2xl border-platinum-glow">
              <div className="text-center space-y-8">
                {/* Eyebrow Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span className="text-sm font-medium font-mono text-primary">SIGNALS LIVE</span>
                </div>

                {/* Massive H1 with Platinum Gradient */}
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight">
                  <span className="text-gradient-platinum">Trade In The Money</span>
                </h1>

                {/* Subheadline */}
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif text-smoke/90 font-normal">
                  Master The Markets With <span className="text-primary font-semibold">Elite Signals</span>
                </h2>

                {/* Description */}
                <p className="text-lg md:text-xl text-muted-foreground text-pretty max-w-2xl mx-auto leading-relaxed">
                  Join an exclusive community of professional traders. Get real-time signals,
                  comprehensive education, and proven strategies to elevate your trading game.
                </p>

                {/* CTA Buttons - HFT Style */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
                  {/* Primary Button - Dark Green bg with Platinum text */}
                  <Button
                    asChild
                    size="lg"
                    className="relative group bg-gradient-to-r from-signal-green-dark via-primary to-signal-green-dark text-void font-bold text-lg px-10 h-14 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(0,230,118,0.4)]"
                  >
                    <a href="#pricing" className="flex items-center gap-2">
                      <span className="text-gradient-platinum font-bold">Get Started</span>
                      <ArrowRight className="h-5 w-5 text-platinum transition-transform group-hover:translate-x-1" />
                    </a>
                  </Button>

                  {/* Secondary Button - Thin Platinum border, transparent */}
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="bg-transparent text-platinum/80 font-semibold text-lg px-10 h-14 rounded-xl border border-platinum/30 hover:border-platinum/60 hover:text-white hover:shadow-[0_0_20px_rgba(229,228,226,0.15)] transition-all duration-300"
                  >
                    <a href="#features">Learn More</a>
                  </Button>
                </div>

                {/* Quick Stats - Monospace Numbers */}
                <div className="flex flex-wrap gap-8 justify-center items-center pt-8 text-sm">
                  <div className="flex items-center gap-2 text-smoke/70">
                    <Check className="h-5 w-5 text-primary" />
                    <span>Real-Time Signals</span>
                  </div>
                  <div className="flex items-center gap-2 text-smoke/70">
                    <Check className="h-5 w-5 text-primary" />
                    <span className="font-mono">87%</span>
                    <span>Success Rate</span>
                  </div>
                  <div className="flex items-center gap-2 text-smoke/70">
                    <Check className="h-5 w-5 text-primary" />
                    <span className="font-mono">10,000+</span>
                    <span>Members</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Activity Feed - replaces Trusted By */}
          <LiveActivityFeed />
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-smoke/30 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-smoke/50 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Ribbon Divider */}
      <RibbonDivider />

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-16">
        <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto" staggerDelay={0.1}>
          {[
            { label: "Active Members", value: "10,000+" },
            { label: "Success Rate", value: "87%" },
            { label: "Signals Daily", value: "15+" },
            { label: "Years Experience", value: "8+" },
          ].map((stat, idx) => (
            <StaggerItem key={idx}>
              <Card className="bg-card/50 backdrop-blur border-border/40 h-full">
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
      <section id="features" className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 space-y-4">
            <RevealHeading>
              <h2 className="text-3xl md:text-5xl font-bold">
                Everything You Need To{" "}
                <span className="text-gradient-gold">Succeed</span>
              </h2>
            </RevealHeading>
            <RevealContent delay={0.2}>
              <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
                Comprehensive tools and resources designed to transform your trading journey
              </p>
            </RevealContent>
          </div>

          {/* Bento Grid Layout */}
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6" staggerDelay={0.1}>
            {/* Real-Time Signals - Wide Card (2 columns) */}
            <StaggerItem className="md:col-span-2 lg:col-span-2">
              <BentoCard
                icon={TrendingUp}
                title="Real-Time Signals"
                description="Get instant trade alerts from experienced traders with detailed entry, exit, and stop-loss levels. Our signals are backed by years of market analysis and proven strategies that consistently deliver results."
                spotlight="emerald"
              />
            </StaggerItem>

            {/* Educational Content - Tall Card (2 rows) */}
            <StaggerItem className="md:row-span-2">
              <BentoCard
                icon={BookOpen}
                title="Educational Content"
                description="Access exclusive courses, webinars, and tutorials covering technical analysis, fundamental analysis, and risk management. From beginner basics to advanced strategies, we provide the knowledge you need to become a confident trader."
                className="h-full"
                spotlight="gold"
                image="/icon-education.png"
              />
            </StaggerItem>

            {/* Active Community */}
            <StaggerItem>
              <BentoCard
                icon={Users}
                title="Active Community"
                description="Network with thousands of like-minded traders, share insights, and learn from collective experience."
                spotlight="emerald"
              />
            </StaggerItem>

            {/* Precise Analysis */}
            <StaggerItem>
              <BentoCard
                icon={Target}
                title="Precise Analysis"
                description="Detailed market analysis with charts, indicators, and actionable trade setups updated daily."
                spotlight="gold"
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
      <section id="pricing" className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 space-y-4">
            <RevealHeading>
              <h2 className="text-3xl md:text-5xl font-bold">
                Choose Your{" "}
                <span className="text-gradient-gold">Membership</span>
              </h2>
            </RevealHeading>
            <RevealContent delay={0.2}>
              <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
                Select the plan that fits your trading goals and budget
              </p>
            </RevealContent>
          </div>

          {/* Pricing Cards Grid */}
          <StaggerContainer className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch" staggerDelay={0.15}>
            {/* Starter Card */}
            {/* Starter Card - Ghost */}
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

            {/* Elite Card - Hero (Matte Black & Green) */}
            <StaggerItem>
              <PricingCard
                name="Elite"
                price="$199"
                period="/month"
                description="For professional traders seeking maximum edge"
                features={[
                  "Unlimited Premium Signals",
                  "Personal Trading Coach",
                  "Exclusive Private Channel",
                  "Weekly Strategy Calls",
                  "Custom Analysis Requests",
                  "API Access",
                  "White Glove Support",
                  "Early Access to New Features",
                ]}
                whopLink="https://whop.com/checkout/plan_T02fUg2d3tG8H"
                tier="elite"
              />
            </StaggerItem>

            {/* Pro Card - Brushed Platinum */}
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
                popular
              />
            </StaggerItem>
          </StaggerContainer>

          {/* Money-back Guarantee */}
          <RevealContent delay={0.5}>
            <div className="mt-12 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  30-day money-back guarantee on all plans
                </span>
              </div>
            </div>
          </RevealContent>
        </div>
      </section>

      {/* Testimonials Section - Infinite Marquee */}
      <section id="testimonials" className="py-20 overflow-hidden">
        <div className="container mx-auto px-4 mb-12">
          <div className="text-center space-y-4">
            <RevealHeading>
              <h2 className="text-3xl md:text-5xl font-bold">
                Trusted By Traders{" "}
                <span className="text-gradient-gold">Worldwide</span>
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
              name: "Michael Chen",
              role: "Day Trader",
              content: "TITM transformed my trading completely. The signals are incredibly accurate and the community support is unmatched. I've seen consistent profits since joining.",
              avatar: "MC"
            },
            {
              name: "Sarah Rodriguez",
              role: "Swing Trader",
              content: "Best investment I've made in my trading career. The education alone is worth 10x the price. The mentors genuinely care about your success.",
              avatar: "SR"
            },
            {
              name: "David Park",
              role: "Options Trader",
              content: "The real-time signals and analysis have given me the confidence to make better trading decisions. My account has grown 180% in 6 months.",
              avatar: "DP"
            },
            {
              name: "Emily Watson",
              role: "Forex Trader",
              content: "The community is incredibly supportive. I went from losing money to consistently profitable in just 3 months. Can't recommend TITM enough!",
              avatar: "EW"
            },
            {
              name: "James Miller",
              role: "Crypto Trader",
              content: "The risk management education alone saved my portfolio. Now I trade with confidence and proper position sizing. Life-changing experience.",
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
              name: "Alex Thompson",
              role: "Part-time Trader",
              content: "As someone with a full-time job, the signal alerts are perfect. I can trade on my schedule and still catch great opportunities.",
              avatar: "AT"
            },
            {
              name: "Lisa Kim",
              role: "Stock Trader",
              content: "The 1-on-1 mentorship sessions are invaluable. Having a personal coach review my trades has accelerated my learning tremendously.",
              avatar: "LK"
            },
            {
              name: "Robert Garcia",
              role: "Day Trader",
              content: "I've tried many trading communities, but TITM is on another level. The quality of analysis and the speed of signals is unmatched.",
              avatar: "RG"
            },
            {
              name: "Jennifer Lee",
              role: "Swing Trader",
              content: "Finally found a community that actually delivers results. The Pro membership paid for itself in the first week!",
              avatar: "JL"
            },
            {
              name: "Marcus Brown",
              role: "Options Trader",
              content: "The live trading sessions are incredible. Watching experienced traders in real-time has taught me more than any course ever could.",
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
      <section className="container mx-auto px-4 py-20">
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
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-money-green-dark flex items-center justify-center font-bold text-primary-foreground shrink-0">
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
      <section className="container mx-auto px-4 py-20">
        <RevealContent>
          <div className="max-w-4xl mx-auto text-center glass-card-heavy rounded-2xl border-platinum-glow p-12 md:p-16 space-y-6 relative overflow-hidden">
            {/* Background gradient accent */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-platinum/5 pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold">
                Ready To Elevate Your{" "}
                <span className="text-gradient-platinum">Trading?</span>
              </h2>
              <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto leading-relaxed mt-4">
                Join thousands of successful traders who trust Trade In The Money for premium signals and education.
              </p>
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-platinum-dark via-platinum to-platinum-light text-void font-bold text-lg px-10 h-14 mt-8 rounded-xl hover:scale-105 hover:shadow-[0_0_40px_rgba(229,228,226,0.4)] transition-all duration-300"
              >
                <a href="#pricing">Start Trading Smarter Today</a>
              </Button>
            </div>
          </div>
        </RevealContent>
      </section>

      {/* Footer */}
      <footer className="border-t border-platinum/10 bg-[rgba(5,5,5,0.8)] backdrop-blur-xl">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="TITM Logo" width={40} height={40} className="h-10 w-auto" />
              <div>
                <div className="font-bold text-gradient-platinum">Trade In The Money</div>
                <div className="text-xs text-muted-foreground">© 2026 All rights reserved</div>
              </div>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-platinum transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-platinum transition-colors">Terms of Service</a>
              <a href="mailto:support@tradeinthemoney.com" className="hover:text-platinum transition-colors">Contact</a>
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
