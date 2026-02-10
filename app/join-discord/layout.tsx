import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Join Discord Access - Trade In The Money',
  description: 'Check and restore Trade In The Money Discord membership access for your account.',
  alternates: {
    canonical: '/join-discord',
  },
}

export default function JoinDiscordLayout({ children }: { children: ReactNode }) {
  return children
}
