"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function FloatingNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#pricing", label: "Pricing" },
    { href: "#testimonials", label: "Reviews" },
  ];

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50",
        "transition-all duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
        isScrolled
          ? "bg-[rgba(10,10,11,0.85)] backdrop-blur-[60px] shadow-[0_4px_30px_rgba(0,0,0,0.3)]"
          : "bg-transparent"
      )}
      style={{
        // Gradient border only when scrolled - more elegant than solid border
        borderBottom: isScrolled
          ? '1px solid transparent'
          : '1px solid transparent',
        backgroundImage: isScrolled
          ? 'linear-gradient(rgba(10,10,11,0.85), rgba(10,10,11,0.85)), linear-gradient(90deg, transparent 0%, rgba(232,228,217,0.15) 50%, transparent 100%)'
          : undefined,
        backgroundOrigin: 'padding-box, border-box',
        backgroundClip: 'padding-box, border-box',
      }}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Typographic Wordmark Logo */}
          <a href="#" className="flex items-center gap-1">
            <span className="font-serif text-xl sm:text-2xl tracking-tight font-semibold text-ivory">
              Trade
            </span>
            <span className="font-serif text-xl sm:text-2xl tracking-tight font-semibold text-champagne">
              ITM
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-wealth-emerald ml-0.5 mb-3" />
          </a>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-light tracking-wide",
                  "text-ivory/60 hover:text-ivory",
                  "transition-colors duration-300"
                )}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA Button */}
          <div className="hidden md:block">
            <Button
              asChild
              variant="luxury"
              size="default"
              className="rounded-sm"
            >
              <a href="#pricing">Join Now</a>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={cn(
              "md:hidden flex items-center justify-center",
              "w-11 h-11 rounded-sm",
              "text-ivory/80 hover:text-ivory",
              "hover:bg-white/5",
              "transition-colors duration-300"
            )}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Mobile Menu - Smoother spring animation */}
        <motion.div
          initial={false}
          animate={{
            height: isMobileMenuOpen ? "auto" : 0,
            opacity: isMobileMenuOpen ? 1 : 0,
          }}
          transition={{
            height: {
              type: "spring",
              stiffness: 300,
              damping: 30,
              mass: 0.8,
            },
            opacity: {
              duration: 0.2,
              ease: "easeOut",
            },
          }}
          className="md:hidden overflow-hidden"
        >
          <div className="py-4 space-y-1 border-t border-white/[0.08]">
            {navLinks.map((link, index) => (
              <motion.a
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                initial={{ opacity: 0, x: -10 }}
                animate={{
                  opacity: isMobileMenuOpen ? 1 : 0,
                  x: isMobileMenuOpen ? 0 : -10,
                }}
                transition={{
                  delay: isMobileMenuOpen ? index * 0.05 : 0,
                  duration: 0.2,
                  ease: "easeOut",
                }}
                className={cn(
                  "flex items-center h-12 px-2",
                  "text-base font-light tracking-wide",
                  "text-ivory/70 hover:text-ivory hover:bg-white/5",
                  "rounded-sm transition-colors duration-300"
                )}
              >
                {link.label}
              </motion.a>
            ))}

            {/* Mobile CTA Button - Full Width */}
            <motion.div
              className="pt-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: isMobileMenuOpen ? 1 : 0,
                y: isMobileMenuOpen ? 0 : 10,
              }}
              transition={{
                delay: isMobileMenuOpen ? navLinks.length * 0.05 : 0,
                duration: 0.25,
                ease: "easeOut",
              }}
            >
              <Button
                asChild
                variant="luxury"
                size="lg"
                className="w-full rounded-sm h-12"
              >
                <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)}>
                  Join Now
                </a>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </nav>
    </header>
  );
}
