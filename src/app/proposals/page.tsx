import type { Metadata } from 'next'

import { ProposalsListView } from '@/components/dao/ProposalsListView'
import { getAllProposals } from '@/lib/dao-data'

export const metadata: Metadata = {
  title: 'Proposals',
}

export const revalidate = 60

export default async function ProposalsPage() {
  const proposals = await getAllProposals(50)
  return <ProposalsListView proposals={proposals} />
}
