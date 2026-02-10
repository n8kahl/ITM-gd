"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageCircle } from "lucide-react";

export function MobileStickyCtA() {
  const [isMobile, setIsMobile] = useState(false);
  const [scrollY, setScrollY] = useState(0);

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
    if (!isMobile) return;

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    const initialFrame = requestAnimationFrame(() => {
      setScrollY(window.scrollY);
    });

    return () => {
      cancelAnimationFrame(initialFrame);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isMobile]);

  const isVisible = isMobile && scrollY > 600;

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
          className="fixed bottom-4 left-4 right-4 z-50 md:hidden"
        >
          {/* Glass card heavy background */}
          <div className="glass-card-heavy rounded-xl">
            <div className="flex items-center justify-between px-4 py-3">
              {/* Left side - Text */}
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-champagne" />
                <span className="text-sm font-medium text-ivory">
                  Join Sniper
                </span>
              </div>

              {/* Right side - Chat + CTA Button */}
              <div className="flex items-center gap-2">
                {/* Chat button */}
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-chat-widget'))}
                  className="size-10 flex items-center justify-center rounded-full bg-background/20 backdrop-blur border border-white/10 hover:bg-white/10 transition-colors"
                  aria-label="Chat with us"
                >
                  <MessageCircle className="w-5 h-5 text-champagne" />
                </button>

                {/* Join CTA */}
                <Button
                  asChild
                  variant="luxury"
                  size="sm"
                  className="rounded-lg px-4"
                >
                  <a href="#pricing">
                    Join Now
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
