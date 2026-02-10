import React from "react"
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { StructuredData } from '@/components/seo/structured-data'
import Link from 'next/link'
import { User } from 'lucide-react'
import { AppToaster } from '@/components/ui/app-toaster'
import './globals.css'

export const metadata: Metadata = {
  title: 'Trade In The Money - Premium Trade Alerts & Education',
  description: 'Join the elite trading community. Get real-time trade alerts, expert education, and proven strategies from professional traders. Quality setups alerted daily.',
  generator: 'TradeITM',
  metadataBase: new URL('https://trade-itm-prod.up.railway.app'),
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TradeITM',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Trade In The Money - Premium Trade Alerts',
    description: 'Quality setups alerted daily. Join the elite trading community with real-time trade alerts and expert education.',
    siteName: 'Trade In The Money',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Trade In The Money - Premium Trade Alerts',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trade In The Money - Premium Trade Alerts',
    description: 'Quality setups alerted daily. Join the elite trading community.',
    images: ['/og-image.png'],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headersList = await headers()
  const nonce = headersList.get('x-nonce') || ''

  return (
    <html lang="en" className="dark">
      <head>
        <StructuredData nonce={nonce} />
      </head>
      <body className="font-sans antialiased">
        {/* Mobile Header Login Icon - visible only on mobile, hidden when navbar is present */}
        <Link
          href="/login"
          className="fixed top-4 right-4 z-40 md:hidden bg-white/5 border border-white/10 rounded-full p-2 flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Member Login"
        >
          <User className="w-5 h-5 text-ivory/80" />
        </Link>
        {children}
        <AppToaster />
      </body>
    </html>
  )
}
