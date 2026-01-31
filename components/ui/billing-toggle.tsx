'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

type BillingCycle = 'monthly' | 'yearly'

interface BillingToggleProps {
  billingCycle: BillingCycle
  onChange: (cycle: BillingCycle) => void
}

export function BillingToggle({ billingCycle, onChange }: BillingToggleProps) {
  return (
    <div className="glass-card-heavy inline-flex items-center p-1.5 rounded-full border border-white/10">
      {/* Monthly Option */}
      <button
        onClick={() => onChange('monthly')}
        className={cn(
          'relative px-6 py-2.5 rounded-full text-sm font-medium transition-colors duration-300',
          billingCycle === 'monthly' ? 'text-[#0A0A0B]' : 'text-[#F5F5F0] hover:text-[#E8E4D9]'
        )}
      >
        {billingCycle === 'monthly' && (
          <motion.div
            layoutId="billing-pill"
            className="absolute inset-0 bg-gradient-to-r from-[#E8E4D9] to-[#F5F3ED] rounded-full"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        <span className="relative z-10">Monthly</span>
      </button>

      {/* Yearly Option */}
      <button
        onClick={() => onChange('yearly')}
        className={cn(
          'relative px-6 py-2.5 rounded-full text-sm font-medium transition-colors duration-300 flex items-center gap-2',
          billingCycle === 'yearly' ? 'text-[#0A0A0B]' : 'text-[#F5F5F0] hover:text-[#E8E4D9]'
        )}
      >
        {billingCycle === 'yearly' && (
          <motion.div
            layoutId="billing-pill"
            className="absolute inset-0 bg-gradient-to-r from-[#E8E4D9] to-[#F5F3ED] rounded-full"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        <span className="relative z-10">Yearly</span>

        {/* 2 MONTHS FREE Badge */}
        <motion.span
          animate={{
            opacity: [1, 0.7, 1],
            scale: [1, 1.02, 1],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className={cn(
            'relative z-10 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
            'text-emerald-400 bg-emerald-400/10 border border-emerald-400/30'
          )}
        >
          2 Months Free
        </motion.span>
      </button>
    </div>
  )
}
