import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // SECURITY: Never ignore build errors in production
    // ignoreBuildErrors: false, // default
  },
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
}

export default withSentryConfig(nextConfig, {
  // Suppresses source map upload logs during build
  silent: true,

  // Upload source maps for better stack traces in Sentry
  // Requires SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT env vars
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to avoid ad-blockers
  tunnelRoute: '/monitoring',

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Hides source maps from generated client bundles
  hideSourceMaps: true,
});
