import type { Metadata } from 'next'

import { daoConfig } from '@/lib/dao.config'

import { FeedView } from './FeedView'

export const metadata: Metadata = {
  title: 'Feed',
  description: `Real-time activity from ${daoConfig.name}: proposals, votes, auctions and on-chain events.`,
  alternates: { canonical: '/feed' },
}

export default function FeedPage() {
  return <FeedView />
}
