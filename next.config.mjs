import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // SECURITY: Never ignore build errors in production
    // ignoreBuildErrors: false, // default
  },
  serverExternalPackages: ['@resvg/resvg-js'],
  images: {
    // Enable Next.js image optimization for better mobile performance
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        pathname: '/avatars/**',
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
})
