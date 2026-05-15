import type { Metadata } from 'next'

import { daoConfig } from '@/lib/dao.config'

import { CoinsListView } from './CoinsListView'

export const metadata: Metadata = {
  title: 'Coins',
  description: `Clanker coins launched by the ${daoConfig.name} community.`,
  alternates: { canonical: '/coins' },
}

export default function CoinsPage() {
  return <CoinsListView />
}
