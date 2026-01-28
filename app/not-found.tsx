"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { GradientMeshBackground } from "@/components/ui/gradient-mesh-background";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { SignalOff, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen relative flex items-center justify-center px-4">
      {/* Animated Gradient Mesh Background */}
      <GradientMeshBackground />

      {/* Aurora Liquid Light Background */}
      <AuroraBackground />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
        className="relative z-20 max-w-md w-full"
      >
        {/* Glass Card */}
        <div className="glass-card-heavy rounded-2xl p-8 md:p-12 text-center space-y-6 border border-white/10">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mx-auto w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center"
          >
            <SignalOff className="w-10 h-10 text-red-400" />
          </motion.div>

          {/* 404 Text */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="space-y-2"
          >
            <h1 className="text-6xl md:text-7xl font-serif font-bold text-gradient-champagne">
              404
            </h1>
            <h2 className="text-xl md:text-2xl font-medium text-ivory">
              Signal Lost
            </h2>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-muted-foreground leading-relaxed"
          >
            The page you&apos;re looking for has moved or doesn&apos;t exist.
            Let&apos;s get you back on track.
          </motion.p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <Button
              asChild
              variant="luxury-champagne"
              size="lg"
              className="rounded-lg w-full sm:w-auto"
            >
              <Link href="/" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Return to Base
              </Link>
            </Button>
          </motion.div>

          {/* Decorative Line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="h-px bg-gradient-to-r from-transparent via-champagne/30 to-transparent"
          />

          {/* Footer Note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="text-xs text-muted-foreground/60"
          >
            Need help? Contact{" "}
            <a
              href="mailto:support@tradeinthemoney.com"
              className="text-champagne/80 hover:text-champagne transition-colors"
            >
              support@tradeinthemoney.com
            </a>
          </motion.p>
        </div>
      </motion.div>

      {/* Ambient glow effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(239, 68, 68, 0.05) 0%, transparent 50%)",
        }}
      />
    </main>
  );
}
