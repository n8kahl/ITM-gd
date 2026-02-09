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
};

export default nextConfig;
