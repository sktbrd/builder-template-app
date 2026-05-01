import type { Metadata } from 'next'

import { ProposalCreateForm } from '@/components/dao/ProposalCreateForm'

export const metadata: Metadata = {
  title: 'New proposal',
}

export default function NewProposalPage() {
  return <ProposalCreateForm />
}
