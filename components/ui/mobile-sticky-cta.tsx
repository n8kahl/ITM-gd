"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function MobileStickyCtA() {
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsVisible(false);
      return;
    }

    const handleScroll = () => {
      // Show CTA after scrolling past hero section (approximately 100vh)
      const heroHeight = window.innerHeight;
      const scrollY = window.scrollY;

      // Show when scrolled past 80% of hero section
      setIsVisible(scrollY > heroHeight * 0.8);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Initial check
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  // Don't render on desktop
  if (!isMobile) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
          }}
          className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        >
          {/* Glass card heavy background */}
          <div className="glass-card-heavy mx-2 mb-2 rounded-xl">
            <div className="flex items-center justify-between px-4 py-3">
              {/* Left side - Text */}
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-champagne" />
                <span className="text-sm font-medium text-ivory">
                  Join Elite
                </span>
                <span className="text-xs text-ivory/60">
                  • 30-day guarantee
                </span>
              </div>

              {/* Right side - CTA Button */}
              <Button
                asChild
                variant="luxury"
                size="sm"
                className="rounded-lg px-4"
              >
                <a href="#pricing">
                  Get Started
                </a>
              </Button>
            </div>
          </div>

          {/* Safe area padding for devices with home indicator */}
          <div className="h-safe-area-inset-bottom bg-transparent" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
