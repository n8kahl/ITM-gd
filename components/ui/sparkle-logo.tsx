'use client'

import React, { useMemo, useEffect, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'

// Hook to detect mobile devices for performance optimization
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

interface SparkleProps {
  x: number
  y: number
  size: number
  delay: number
  duration: number
  color: string
}

interface SparkleLogoProps {
  src: string
  alt: string
  width: number
  height: number
  sparkleCount?: number
  enableFloat?: boolean
  enableGlow?: boolean
  glowIntensity?: 'low' | 'medium' | 'high'
  className?: string
  priority?: boolean
}

function seededUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

const Sparkle: React.FC<SparkleProps> = ({ x, y, size, delay, duration, color }) => {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        background: color,
        boxShadow: `0 0 ${size * 2}px ${color}`,
        filter: 'blur(1px)',
      }}
      initial={{ scale: 0, opacity: 0, rotate: 0 }}
      animate={{
        scale: [0, 1, 0],
        opacity: [0, 0.8, 0],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}

const SparkleLog: React.FC<SparkleLogoProps> = ({
  src,
  alt,
  width,
  height,
  sparkleCount = 15,
  enableFloat = true,
  enableGlow = true,
  glowIntensity = 'medium',
  className = '',
  priority = false,
}) => {
  const isMobile = useIsMobile()

  // Reduce sparkle count on mobile for performance (0 = disabled entirely on mobile)
  const effectiveSparkleCount = isMobile ? 0 : sparkleCount
  // Disable glow backdrop animation on mobile
  const effectiveEnableGlow = isMobile ? false : enableGlow

  // Generate random sparkle positions and properties
  const sparkles = useMemo(() => {
    const colors = [
      'rgba(16, 185, 129, 0.8)', // Emerald
      'rgba(4, 120, 87, 0.7)',   // Dark emerald
      'rgba(16, 185, 129, 0.6)', // Gold
      'rgba(244, 228, 193, 0.5)', // Champagne
    ]

    return Array.from({ length: effectiveSparkleCount }, (_, i) => ({
      id: i,
      x: seededUnit(i + 1) * 100,
      y: seededUnit((i + 1) * 2.13) * 100,
      size: seededUnit((i + 1) * 3.17) * 6 + 3, // 3-9px
      delay: seededUnit((i + 1) * 4.29) * 3,
      duration: seededUnit((i + 1) * 5.43) * 2 + 2, // 2-4s
      color: colors[Math.floor(seededUnit((i + 1) * 6.71) * colors.length)],
    }))
  }, [effectiveSparkleCount])

  // Glow intensity settings
  const glowStyles = {
    low: 'drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]',
    medium: 'drop-shadow-[0_0_20px_rgba(16,185,129,0.4)] drop-shadow-[0_0_40px_rgba(16,185,129,0.2)]',
    high: 'drop-shadow-[0_0_30px_rgba(16,185,129,0.5)] drop-shadow-[0_0_60px_rgba(16,185,129,0.3)] drop-shadow-[0_0_90px_rgba(16,185,129,0.1)]',
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Radial gradient glow backdrop - disabled on mobile */}
      {effectiveEnableGlow && (
        <motion.div
          className="absolute inset-0 -z-10"
          style={{
            background: 'radial-gradient(circle, rgba(4,120,87,0.4) 0%, rgba(16, 185, 129,0.2) 50%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.6, 0.9, 0.6],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Sparkle particles */}
      <div className="absolute inset-0 pointer-events-none">
        {sparkles.map((sparkle) => (
          <Sparkle
            key={sparkle.id}
            x={sparkle.x}
            y={sparkle.y}
            size={sparkle.size}
            delay={sparkle.delay}
            duration={sparkle.duration}
            color={sparkle.color}
          />
        ))}
      </div>

      {/* Logo image with optional floating animation - disabled on mobile */}
      <motion.div
        animate={
          enableFloat && !isMobile
            ? {
                y: [0, -10, 0],
              }
            : {}
        }
        transition={
          enableFloat && !isMobile
            ? {
                duration: 6,
                repeat: Infinity,
                ease: 'easeInOut',
              }
            : {}
        }
        className={enableGlow && !isMobile ? glowStyles[glowIntensity] : ''}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="relative z-10 object-contain"
          priority={priority}
          draggable={false}
        />
      </motion.div>
    </div>
  )
}

export default SparkleLog
