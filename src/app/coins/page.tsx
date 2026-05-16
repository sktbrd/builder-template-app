import type { Metadata } from 'next'

import { daoConfig } from '@/lib/dao.config'

import { CoinsListView } from './CoinsListView'

export const metadata: Metadata = {
  title: 'Coins',
  description: `Content coins backed by ${daoConfig.name}'s creator coin.`,
  alternates: { canonical: '/coins' },
}

export default function CoinsPage() {
  return <CoinsListView />
}
