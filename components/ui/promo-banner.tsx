'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check } from 'lucide-react'

const PROMO_CODE = 'SNIPERS'
const STORAGE_KEY = 'titm_promo_dismissed'

export function PromoBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  // Check sessionStorage on mount
  useEffect(() => {
    const isDismissed = sessionStorage.getItem(STORAGE_KEY)
    if (!isDismissed) {
      // Small delay for smoother page load
      const timer = setTimeout(() => setIsVisible(true), 300)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    sessionStorage.setItem(STORAGE_KEY, 'true')
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(PROMO_CODE)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = PROMO_CODE
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            mass: 0.8
          }}
          className="fixed left-0 right-0 top-16 lg:top-20 z-40 h-10 lg:h-11"
        >
          {/* Banner Container */}
          <div className="h-full bg-gradient-to-r from-emerald-950/95 via-emerald-900/95 to-emerald-950/95 backdrop-blur-md border-b border-champagne/15 shadow-lg shadow-emerald-950/20">
            <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-center gap-2 lg:gap-3">
              {/* Promo Text */}
              <p className="text-xs lg:text-sm text-platinum/90 flex items-center gap-1.5 lg:gap-2 flex-wrap justify-center">
                <span className="hidden sm:inline">🎉</span>
                <span className="font-medium text-champagne/90">New Member Exclusive:</span>
                <span className="hidden sm:inline">Get</span>
                <span className="font-semibold text-emerald-400">10% OFF</span>
                <span className="hidden lg:inline">your first month with code:</span>
                <span className="lg:hidden">with</span>

                {/* Copyable Code Badge */}
                <button
                  onClick={handleCopyCode}
                  className="group relative inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-md transition-all duration-200 border border-champagne/20 hover:border-champagne/40"
                >
                  <span className="font-mono font-semibold text-champagne tracking-wide text-xs lg:text-sm">
                    {PROMO_CODE}
                  </span>

                  {/* Copy indicator */}
                  <span className={`text-[10px] lg:text-xs transition-all duration-200 ${
                    isCopied
                      ? 'text-emerald-400'
                      : 'text-platinum/50 group-hover:text-platinum/80'
                  }`}>
                    {isCopied ? (
                      <span className="flex items-center gap-0.5">
                        <Check className="w-3 h-3" />
                        <span className="hidden sm:inline">Copied!</span>
                      </span>
                    ) : (
                      <span className="hidden sm:inline">Click to copy</span>
                    )}
                  </span>

                  {/* Subtle shine effect on hover */}
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </button>
              </p>

              {/* Dismiss Button */}
              <button
                onClick={handleDismiss}
                className="absolute right-3 lg:right-4 p-1.5 rounded-full text-platinum/40 hover:text-platinum/80 hover:bg-white/5 transition-all duration-200"
                aria-label="Dismiss promo banner"
              >
                <X className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
