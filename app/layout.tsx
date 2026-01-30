import React from "react"
import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { StructuredData } from '@/components/seo/structured-data'
import './globals.css'

// Body font - clean, modern sans-serif
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Display font - premium editorial serif for headings
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Monospace font for code
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: 'Trade In The Money - Premium Trade Alerts & Education',
  description: 'Join the elite trading community. Get real-time trade alerts, expert education, and proven strategies from professional traders. Quality setups alerted daily.',
  generator: 'v0.app',
  metadataBase: new URL('https://trade-itm-prod.up.railway.app'),
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <StructuredData />
      </head>
      <body className={`${inter.variable} ${playfair.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
