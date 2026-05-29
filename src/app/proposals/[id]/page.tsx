import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ProposalDetailView } from '@/components/dao/ProposalDetailView'
import { getProposalByNumber } from '@/lib/dao-data'

export const revalidate = 30

type Params = Promise<{ id: string }>

export default async function ProposalDetailPage({ params }: { params: Params }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()

  const proposalNumber = parseInt(id, 10)
  if (!Number.isFinite(proposalNumber) || proposalNumber < 0) notFound()

  const detail = await getProposalByNumber(proposalNumber)
  if (!detail) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/proposals"
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          All proposals
        </Link>
      </div>

      <ProposalDetailView detail={detail} />
    </div>
  )
}
