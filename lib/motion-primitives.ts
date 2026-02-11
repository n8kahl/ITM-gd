import type { Transition, Variants } from 'framer-motion'

export const LUXURY_SPRING: Transition = {
  type: 'spring',
  mass: 1,
  stiffness: 85,
  damping: 20,
  restDelta: 0.001,
}

export const STAGGER_CHILDREN = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

export const FADE_UP_VARIANT: Variants = {
  initial: { opacity: 0, y: 12, filter: 'blur(2px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
}
