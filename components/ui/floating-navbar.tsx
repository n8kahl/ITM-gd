"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FloatingNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show/hide based on scroll direction
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }

      // Add background when scrolled
      setIsScrolled(currentScrollY > 50);
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.header
          className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <motion.nav
            className={cn(
              "flex items-center justify-between gap-4 px-4 md:px-6 py-3 rounded-full",
              "border transition-all duration-300",
              isScrolled
                ? "bg-[rgba(5,5,5,0.8)] backdrop-blur-2xl border-gold/20 shadow-lg shadow-black/20"
                : "bg-[rgba(10,10,10,0.4)] backdrop-blur-xl border-white/[0.08]"
            )}
            layout
            transition={{ duration: 0.3 }}
          >
            {/* Logo */}
            <a href="#" className="flex items-center gap-2 md:gap-3">
              <Image
                src="/logo.png"
                alt="TITM Logo"
                width={40}
                height={40}
                className="h-8 md:h-10 w-auto"
              />
              <div className="hidden sm:block">
                <span className="text-base md:text-lg font-bold text-gradient-gold">
                  Trade In The Money
                </span>
              </div>
            </a>

            {/* Navigation Links - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-6">
              <a
                href="#features"
                className="text-sm text-smoke/70 hover:text-smoke transition-colors"
              >
                Features
              </a>
              <a
                href="#pricing"
                className="text-sm text-smoke/70 hover:text-smoke transition-colors"
              >
                Pricing
              </a>
              <a
                href="#testimonials"
                className="text-sm text-smoke/70 hover:text-smoke transition-colors"
              >
                Reviews
              </a>
            </div>

            {/* CTA Button */}
            <Button
              asChild
              size="sm"
              className={cn(
                "bg-gradient-to-r from-gold-dark via-gold to-gold-light text-void font-bold",
                "hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all duration-300",
                "rounded-full px-4 md:px-6"
              )}
            >
              <a href="#pricing">Join Now</a>
            </Button>
          </motion.nav>
        </motion.header>
      )}
    </AnimatePresence>
  );
}
