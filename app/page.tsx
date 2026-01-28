import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, TrendingUp, Users, BookOpen, Target, Zap, Shield, BarChart3, ArrowRight } from "lucide-react";
import { GradientMeshBackground } from "@/components/ui/gradient-mesh-background";

export default function Home() {
  return (
    <main className="min-h-screen relative">
      {/* Animated Gradient Mesh Background */}
      <GradientMeshBackground />
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-accent/10">
        <div className="glass-card-heavy">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="TITM Logo" width={50} height={50} className="h-12 w-auto" />
              <div>
                <span className="text-xl font-bold text-gradient-gold">Trade In The Money</span>
                <p className="text-xs text-muted-foreground">Premium Trading Community</p>
              </div>
            </div>
            <Button
              asChild
              size="sm"
              className="bg-gradient-to-r from-gold-dark via-gold to-gold-light text-void font-bold hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all duration-300"
            >
              <a href="#pricing">Join Now</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section - Cinematic Entrance */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-4 py-20 md:py-32 overflow-hidden">
        <div className="container mx-auto relative z-10">
          {/* Floating Glass Card Container */}
          <div className="max-w-5xl mx-auto">
            <div className="glass-card-heavy p-8 md:p-12 lg:p-16 rounded-2xl border-gold-glow">
              <div className="text-center space-y-8">
                {/* Eyebrow Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-accent/30 bg-accent/5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                  </span>
                  <span className="text-sm font-medium text-accent">Live Trading Signals Active</span>
                </div>

                {/* Massive H1 with Gold Gradient */}
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight">
                  <span className="text-gradient-gold">Trade In The Money</span>
                </h1>

                {/* Subheadline */}
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif text-smoke/90 font-normal">
                  Master The Markets With <span className="text-primary">Elite Signals</span>
                </h2>

                {/* Description */}
                <p className="text-lg md:text-xl text-muted-foreground text-pretty max-w-2xl mx-auto leading-relaxed">
                  Join an exclusive community of professional traders. Get real-time signals,
                  comprehensive education, and proven strategies to elevate your trading game.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
                  {/* Primary Button - Gold/White with Glow */}
                  <Button
                    asChild
                    size="lg"
                    className="relative group bg-gradient-to-r from-gold-dark via-gold to-gold-light text-void font-bold text-lg px-10 h-14 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(212,175,55,0.4)]"
                  >
                    <a href="#pricing" className="flex items-center gap-2">
                      Get Started
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </a>
                  </Button>

                  {/* Secondary Button - Glass with Border */}
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="glass-card text-smoke font-semibold text-lg px-10 h-14 rounded-xl border border-smoke/20 hover:border-smoke/40 hover:bg-white/5 transition-all duration-300"
                  >
                    <a href="#features">Learn More</a>
                  </Button>
                </div>

                {/* Quick Stats */}
                <div className="flex flex-wrap gap-8 justify-center items-center pt-8 text-sm">
                  <div className="flex items-center gap-2 text-smoke/70">
                    <Check className="h-5 w-5 text-primary" />
                    <span>Real-Time Signals</span>
                  </div>
                  <div className="flex items-center gap-2 text-smoke/70">
                    <Check className="h-5 w-5 text-primary" />
                    <span>87% Success Rate</span>
                  </div>
                  <div className="flex items-center gap-2 text-smoke/70">
                    <Check className="h-5 w-5 text-primary" />
                    <span>10,000+ Members</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trusted By Social Proof Strip */}
          <div className="mt-16 md:mt-24">
            <div className="text-center mb-8">
              <p className="text-sm uppercase tracking-widest text-muted-foreground/60 font-medium">
                Trusted By Traders From
              </p>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
              {/* Placeholder logos - monochrome style */}
              {[
                { name: "Bloomberg", width: 120 },
                { name: "Reuters", width: 100 },
                { name: "CNBC", width: 80 },
                { name: "Forbes", width: 90 },
                { name: "Yahoo Finance", width: 110 },
              ].map((brand, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-center opacity-40 hover:opacity-60 transition-opacity duration-300 grayscale"
                  style={{ width: brand.width }}
                >
                  {/* Text placeholder for logos */}
                  <span className="text-xl md:text-2xl font-bold text-smoke/50 tracking-tight">
                    {brand.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-smoke/30 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-smoke/50 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {[
            { label: "Active Members", value: "10,000+" },
            { label: "Success Rate", value: "87%" },
            { label: "Signals Daily", value: "15+" },
            { label: "Years Experience", value: "8+" },
          ].map((stat, idx) => (
            <Card key={idx} className="bg-card/50 backdrop-blur border-border/40">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h3 className="text-3xl md:text-5xl font-bold text-balance">Everything You Need To Succeed</h3>
            <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
              Comprehensive tools and resources designed to transform your trading journey
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: TrendingUp,
                title: "Real-Time Signals",
                description: "Get instant trade alerts from experienced traders with detailed entry, exit, and stop-loss levels."
              },
              {
                icon: BookOpen,
                title: "Educational Content",
                description: "Access exclusive courses, webinars, and tutorials covering technical analysis and risk management."
              },
              {
                icon: Users,
                title: "Active Community",
                description: "Network with thousands of like-minded traders, share insights, and learn from collective experience."
              },
              {
                icon: Target,
                title: "Precise Analysis",
                description: "Detailed market analysis with charts, indicators, and actionable trade setups updated daily."
              },
              {
                icon: Zap,
                title: "Lightning Fast",
                description: "Receive signals instantly via Discord notifications so you never miss a profitable opportunity."
              },
              {
                icon: Shield,
                title: "Risk Management",
                description: "Learn proper position sizing, portfolio management, and strategies to protect your capital."
              },
            ].map((feature, idx) => (
              <Card key={idx} className="bg-card/60 backdrop-blur border-border/40 hover:bg-card/80 transition-all duration-300 hover:border-primary/30">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h3 className="text-3xl md:text-5xl font-bold text-balance">Choose Your Path To Success</h3>
            <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
              Select the plan that fits your trading goals and budget
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                name: "Starter",
                price: "$49",
                period: "/month",
                description: "Perfect for beginners looking to get started",
                features: [
                  "5 Daily Signals",
                  "Basic Market Analysis",
                  "Community Access",
                  "Email Support",
                  "Educational Resources"
                ],
                whopLink: "https://whop.com/titm-starter",
                popular: false
              },
              {
                name: "Pro",
                price: "$99",
                period: "/month",
                description: "Most popular choice for serious traders",
                features: [
                  "15+ Daily Signals",
                  "Advanced Technical Analysis",
                  "Priority Discord Access",
                  "Live Trading Sessions",
                  "1-on-1 Mentorship (Monthly)",
                  "Risk Management Tools",
                  "24/7 Priority Support"
                ],
                whopLink: "https://whop.com/titm-pro",
                popular: true
              },
              {
                name: "Elite",
                price: "$199",
                period: "/month",
                description: "For professional traders seeking maximum edge",
                features: [
                  "Unlimited Premium Signals",
                  "Personal Trading Coach",
                  "Exclusive Private Channel",
                  "Weekly Strategy Calls",
                  "Custom Analysis Requests",
                  "API Access",
                  "White Glove Support",
                  "Early Access to New Features"
                ],
                whopLink: "https://whop.com/titm-elite",
                popular: false
              }
            ].map((plan, idx) => (
              <Card key={idx} className={`relative ${plan.popular ? 'border-primary shadow-lg shadow-primary/20 scale-105' : 'bg-card/60 border-border/40'} backdrop-blur`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1 font-semibold">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-8 pt-8">
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <div className="mb-2">
                    <span className="text-5xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <CardDescription className="text-base">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, fidx) => (
                      <li key={fidx} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    asChild 
                    className={`w-full h-12 text-base font-semibold ${plan.popular ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'bg-secondary hover:bg-secondary/90 text-secondary-foreground'}`}
                  >
                    <a href={plan.whopLink} target="_blank" rel="noopener noreferrer">
                      Get {plan.name}
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h3 className="text-3xl md:text-5xl font-bold text-balance">Trusted By Traders Worldwide</h3>
            <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
              See what our community members have to say about their success
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
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
              }
            ].map((testimonial, idx) => (
              <Card key={idx} className="bg-card/60 backdrop-blur border-border/40">
                <CardHeader>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center font-semibold text-primary">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    </div>
                  </div>
                  <CardDescription className="text-base leading-relaxed">
                    "{testimonial.content}"
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Post-Purchase Instructions Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-card/80 backdrop-blur border-primary/30">
            <CardHeader className="text-center pb-8">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-3xl mb-3">What Happens After Purchase?</CardTitle>
              <CardDescription className="text-lg leading-relaxed">
                Getting started is quick and easy. Here's what to expect:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-6">
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
                  <div key={idx} className="flex gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground shrink-0">
                      {step.step}
                    </div>
                    <div className="flex-1 pt-1">
                      <h4 className="font-semibold text-lg mb-1">{step.title}</h4>
                      <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-6 border-t border-border/40">
                <p className="text-sm text-muted-foreground text-center">
                  Need help? Contact us at <a href="mailto:support@tradeinthemoney.com" className="text-primary hover:underline">support@tradeinthemoney.com</a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-card via-card to-primary/5 rounded-2xl border border-primary/20 p-12 md:p-16 space-y-6">
          <h3 className="text-3xl md:text-5xl font-bold text-balance">
            Ready To Elevate Your Trading?
          </h3>
          <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto leading-relaxed">
            Join thousands of successful traders who trust Trade In The Money for premium signals and education.
          </p>
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg px-10 h-14 mt-4">
            <a href="#pricing">Start Trading Smarter Today</a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="TITM Logo" width={40} height={40} className="h-10 w-auto" />
              <div>
                <div className="font-bold">Trade In The Money</div>
                <div className="text-xs text-muted-foreground">© 2026 All rights reserved</div>
              </div>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
              <a href="mailto:support@tradeinthemoney.com" className="hover:text-primary transition-colors">Contact</a>
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
