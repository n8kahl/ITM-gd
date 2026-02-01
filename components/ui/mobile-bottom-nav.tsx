'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
}

interface MobileBottomNavProps {
  items: NavItem[]
}

export function MobileBottomNav({ items }: MobileBottomNavProps) {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 lg:hidden">
      <nav className="bg-[#0F0F10]/80 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-full px-4 py-3">
        <div className="flex items-center justify-around gap-2">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== '/members' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center justify-center min-w-[60px] py-2 group"
              >
                {/* Gold glow for active state */}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-emerald-500/10 rounded-full"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30
                    }}
                  />
                )}

                {/* Icon with spring animation */}
                <motion.div
                  className="relative z-10"
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.1 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 17
                  }}
                >
                  <Icon
                    className={cn(
                      'w-6 h-6 transition-colors',
                      isActive
                        ? 'text-[#10B981]'
                        : 'text-white/40 group-hover:text-white/60'
                    )}
                  />
                </motion.div>

                {/* Label - Only show on active */}
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] font-medium text-[#10B981] mt-1 absolute -bottom-5"
                  >
                    {item.name}
                  </motion.span>
                )}

                {/* Active indicator dot */}
                {isActive && (
                  <motion.div
                    layoutId="activeDot"
                    className="absolute -top-1 w-1.5 h-1.5 bg-[#10B981] rounded-full"
                    initial={false}
                  />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
