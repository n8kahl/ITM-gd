import React from "react"
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { StructuredData } from '@/components/seo/structured-data'
import Link from 'next/link'
import { User } from 'lucide-react'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import { AnalyticsProvider } from '@/components/analytics/analytics-provider'
import { AppToaster } from '@/components/ui/app-toaster'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tradeitm.com'
const IOS_SPLASH_SCREENS = [
  {
    href: '/splash/apple-splash-640x1136.png',
    media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-750x1334.png',
    media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-828x1792.png',
    media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-1125x2436.png',
    media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-1170x2532.png',
    media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-1179x2556.png',
    media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-1242x2208.png',
    media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-1242x2688.png',
    media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-1284x2778.png',
    media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-1290x2796.png',
    media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-1320x2868.png',
    media: '(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-1536x2048.png',
    media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-1620x2160.png',
    media: '(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-1640x2360.png',
    media: '(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-1668x2224.png',
    media: '(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-1668x2388.png',
    media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  },
  {
    href: '/splash/apple-splash-2048x2732.png',
    media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  },
]

export const metadata: Metadata = {
  title: 'Trade In The Money - Premium Trade Alerts & Education',
  description: 'Join the elite trading community. Get real-time trade alerts, expert education, and proven strategies from professional traders. Quality setups alerted daily.',
  generator: 'TradeITM',
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
  },
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
      { url: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
      { url: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
      { url: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: [
      { url: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
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
  const nonce = headersList.get('x-nonce') || undefined

  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth">
      <head>
        <StructuredData nonce={nonce} />
        {IOS_SPLASH_SCREENS.map((screen) => (
          <link
            key={screen.href}
            rel="apple-touch-startup-image"
            href={screen.href}
            media={screen.media}
          />
        ))}
      </head>
      <body className="font-sans antialiased">
        <ServiceWorkerRegister />
        <AnalyticsProvider />
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
