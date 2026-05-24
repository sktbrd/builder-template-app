import type { MetadataRoute } from 'next'

import { getAllProposals, getAuctionPriceHistory } from '@/lib/dao-data'

export const revalidate = 3600

function resolveBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000'
  return raw.startsWith('http') ? raw.replace(/\/$/, '') : `https://${raw.replace(/\/$/, '')}`
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE = resolveBase()
  const now = new Date()

  const STATIC: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/auction/latest`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE}/proposals`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${BASE}/treasury`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/members`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE}/coins`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE}/feed`, lastModified: now, changeFrequency: 'hourly', priority: 0.5 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
  ]

  const [proposalUrls, auctionUrls] = await Promise.all([
    // Default cap is 1000 proposals (well under Next.js's 50k sitemap entry
    // limit). For DAOs that exceed this, see Next.js's `generateSitemaps`
    // API for sharding: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap#generating-multiple-sitemaps
    getAllProposals(1000)
      .then((proposals) =>
        proposals.map<MetadataRoute.Sitemap[number]>((p) => ({
          url: `${BASE}/proposals/${p.proposalNumber}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.6,
        }))
      )
      .catch(() => [] as MetadataRoute.Sitemap),
    getAuctionPriceHistory(365)
      .then((points) =>
        points.map<MetadataRoute.Sitemap[number]>((p) => ({
          url: `${BASE}/auction/${p.tokenId}`,
          lastModified: new Date(p.endTime * 1000),
          changeFrequency: 'monthly',
          priority: 0.5,
        }))
      )
      .catch(() => [] as MetadataRoute.Sitemap),
  ])

  return [...STATIC, ...proposalUrls, ...auctionUrls]
}
