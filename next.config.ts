import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  transpilePackages: [
    '@buildeross/constants',
    '@buildeross/hooks',
    '@buildeross/ipfs-service',
    '@buildeross/sdk',
    '@buildeross/types',
    '@buildeross/utils',
    '@buildeross/stores',
    '@buildeross/ui',
    '@rainbow-me/rainbowkit',
  ],
  experimental: {
    optimizePackageImports: [
      '@rainbow-me/rainbowkit',
      '@buildeross/hooks',
      '@buildeross/ui',
      '@buildeross/sdk',
      'lucide-react',
    ],
    turbopackFileSystemCacheForDev: true,
  },
  turbopack: {
    resolveAlias: {
      // Optional React Native peer pulled in transitively by @metamask/sdk —
      // not needed in a web build, alias it away.
      '@react-native-async-storage/async-storage': './empty.ts',
      // Node-only logger pretty-printer optionally required by pino. Browser
      // builds should never reach it.
      'pino-pretty': './empty.ts',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'gateway.pinata.cloud', pathname: '/ipfs/**' },
    ],
  },
  async redirects() {
    return [
      { source: '/token/:tokenId', destination: '/auction/:tokenId', permanent: true },
      {
        source: '/proposal/:proposalId',
        destination: '/proposals/:proposalId',
        permanent: true,
      },
      { source: '/contracts', destination: '/about', permanent: true },
    ]
  },
}

export default nextConfig
