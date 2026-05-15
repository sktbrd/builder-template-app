import type { Metadata } from 'next'

import { daoConfig } from '@/lib/dao.config'

import { FeedView } from './FeedView'

export const metadata: Metadata = {
  title: `Feed — ${daoConfig.name}`,
  description: `Real-time activity from ${daoConfig.name}: proposals, votes, auctions and on-chain events.`,
  alternates: { canonical: '/feed' },
}

export default function FeedPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Feed</h1>
        <p className="mt-1 text-sm text-muted-fg">
          Real-time activity from {daoConfig.name}.
        </p>
      </header>

      <FeedView />
    </div>
  )
}
