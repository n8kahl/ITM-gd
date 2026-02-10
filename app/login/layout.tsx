import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Member Login - Trade In The Money',
  description: 'Log in to Trade In The Money with Discord to access your member dashboard, journal, academy, and AI coach.',
  alternates: {
    canonical: '/login',
  },
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children
}
