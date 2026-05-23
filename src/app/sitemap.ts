import type { MetadataRoute } from 'next'

import { getAllProposals } from '@/lib/dao-data'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com'

const STATIC: MetadataRoute.Sitemap = [
  { url: BASE, changeFrequency: 'daily', priority: 1.0 },
  { url: `${BASE}/auction/latest`, changeFrequency: 'hourly', priority: 0.9 },
  { url: `${BASE}/proposals`, changeFrequency: 'hourly', priority: 0.8 },
  { url: `${BASE}/treasury`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE}/members`, changeFrequency: 'daily', priority: 0.6 },
  { url: `${BASE}/about`, changeFrequency: 'weekly', priority: 0.5 },
  { url: `${BASE}/feed`, changeFrequency: 'hourly', priority: 0.5 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let proposalUrls: MetadataRoute.Sitemap = []

  try {
    const proposals = await getAllProposals(200)
    proposalUrls = proposals.map((p) => ({
      url: `${BASE}/proposals/${p.proposalNumber}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))
  } catch {
    // sitemap degrades gracefully
  }

  return [...STATIC, ...proposalUrls]
}
